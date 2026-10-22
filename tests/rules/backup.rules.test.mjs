// Emulator tests of the backup core (backup design §3, §4): the generic walk misses
// nothing, values keep their Firestore types, and a bad key never reaches a write.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { generateBackupKeys } from '../../scripts/ops/backupCrypto.mjs';
import { countsByCollection, packBackup, readEverything, restoreDocs, unpackBackup } from '../../scripts/ops/backupCore.mjs';
import { adminDb, put } from './adminDb.mjs';
import { getTestEnv } from './testEnv';

const PASS = 'backup test passphrase';
const META = { projectId: 'volley-skills-test', createdAt: '2026-10-22T12:00:00.000Z' };
const quiet = () => {};

let db;
let keys;

beforeAll(() => {
  keys = generateBackupKeys(PASS);
}, 60_000);

beforeEach(async () => {
  const env = await getTestEnv();
  await env.clearFirestore();
  db = adminDb();
});

afterAll(async () => {
  const env = await getTestEnv();
  await env.cleanup();
});

async function seed() {
  await put(db, {
    'clubs/demo': { name: 'Demo', createdAt: new Timestamp(1_760_000_000, 5000) },
    'clubs/demo/members/coach@example.com': { role: 'admin', email: 'coach@example.com' },
    'clubs/demo/teams/t1': { name: 'U17', adminEmails: ['coach@example.com'] },
    'clubs/demo/teams/t1/players/p1': { fullName: 'Player One', skills: { serve: 7 }, team: db.doc('clubs/demo/teams/t1') },
    'clubs/demo/teams/t1/matches/m1/events/e1': { order: 1, at: new Timestamp(1_760_000_100, 0), where: new GeoPoint(45, 9) },
    'brandNewCollection/x': { list: [{ at: new Timestamp(1, 2000) }, { n: [1, 2] }], raw: Buffer.from([1, 2, 3]) },
    // A doc under a parent that does not exist: no schema walk would find it.
    'ghosts/missing/children/c1': { kept: true },
  });
}

describe('readEverything', () => {
  it('finds every doc, including new collections and docs under missing parents', async () => {
    await seed();
    const { docs, reads } = await readEverything(db);
    expect(docs.map((d) => d.path).sort()).toEqual([
      'brandNewCollection/x',
      'clubs/demo',
      'clubs/demo/members/coach@example.com',
      'clubs/demo/teams/t1',
      'clubs/demo/teams/t1/matches/m1/events/e1',
      'clubs/demo/teams/t1/players/p1',
      'ghosts/missing/children/c1',
    ]);
    expect(reads).toBeGreaterThan(0);
    expect(countsByCollection(docs)).toEqual({ brandNewCollection: 1, clubs: 5, ghosts: 1 });
  });
});

describe('backup and restore', () => {
  it('restores every doc with the same values and types', async () => {
    await seed();
    const before = (await readEverything(db)).docs;
    const envelope = packBackup(before, { ...META, publicKeyPem: keys.publicKeyPem });

    const env = await getTestEnv();
    await env.clearFirestore();
    expect((await readEverything(db)).docs).toEqual([]);

    const unpacked = unpackBackup(JSON.parse(JSON.stringify(envelope)), keys.privateKeyPem, PASS, db);
    expect(unpacked).toMatchObject(META);
    const { written } = await restoreDocs(db, unpacked.docs, { log: quiet });
    expect(written).toBe(before.length);

    const after = (await readEverything(db)).docs;
    expect(after.map((d) => d.path)).toEqual(before.map((d) => d.path));
    const event = after.find((d) => d.path.endsWith('/events/e1')).data;
    expect(event.at).toBeInstanceOf(Timestamp);
    expect(event.at.isEqual(new Timestamp(1_760_000_100, 0))).toBe(true);
    expect(event.where).toBeInstanceOf(GeoPoint);
    const player = after.find((d) => d.path.endsWith('/players/p1')).data;
    expect(player.team.path).toBe('clubs/demo/teams/t1');
    const fresh = after.find((d) => d.path === 'brandNewCollection/x').data;
    expect(fresh.list[0].at.isEqual(new Timestamp(1, 2000))).toBe(true);
    expect([...fresh.raw]).toEqual([1, 2, 3]);
    expect(after.find((d) => d.path === 'clubs/demo').data.createdAt.isEqual(new Timestamp(1_760_000_000, 5000))).toBe(true);
  });

  it('refuses a wrong passphrase before anything is written', async () => {
    await seed();
    const envelope = packBackup((await readEverything(db)).docs, { ...META, publicKeyPem: keys.publicKeyPem });
    expect(() => unpackBackup(envelope, keys.privateKeyPem, 'not the passphrase', db)).toThrow();
  });
});
