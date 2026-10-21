import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import type { ClubStatus } from '../../src/types/club';

let testEnv: RulesTestEnvironment | null = null;

// `firebase emulators:exec` sets FIRESTORE_EMULATOR_HOST, so a run on another
// port (e.g. while a dev emulator holds 8080) still finds its emulator.
const [envHost, envPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':');
const EMULATOR_HOST = envHost || '127.0.0.1';
const EMULATOR_PORT = Number(envPort) || 8080;

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: 'volley-skills-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: EMULATOR_HOST,
        port: EMULATOR_PORT,
      },
    });
  }
  return testEnv;
}

// ---------------------------------------------------------------------------
// Club fixtures (club platform). Every later rules task seeds through these.
// ---------------------------------------------------------------------------

export type Firestore = firebase.firestore.Firestore;

/** The platform operator (a `platformAdmins/{email}` doc once seeded). */
export const OPERATOR = 'operator@example.com';

export interface SeedClubOptions {
  id: string;
  status?: ClubStatus; // default 'active'
  admins?: string[]; // member docs with role 'admin'
  members?: string[]; // member docs with role 'member'
  ownerEmail?: string; // default admins[0] ?? 'owner@example.com'
  termination?: {
    effectiveAt: Date | null;
    retrievalEndsAt: Date | null;
    requestedAt?: Date | null;
    requestedBy?: string | null;
  };
  // sectionAccess docs; all three are always written, default []
  sections?: Partial<Record<'exercises' | 'trainings' | 'guides', string[]>>;
}

/** Writes a full club doc (Task 1's `Club` shape), its member docs and its three sectionAccess docs. */
export async function seedClub(env: RulesTestEnvironment, opts: SeedClubOptions): Promise<void> {
  const admins = (opts.admins ?? []).map((e) => e.toLowerCase());
  const members = (opts.members ?? []).map((e) => e.toLowerCase());
  const ownerEmail = (opts.ownerEmail ?? admins[0] ?? 'owner@example.com').toLowerCase();
  const t = opts.termination;
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const club = db.doc(`clubs/${opts.id}`);
    await club.set({
      name: `Club ${opts.id}`,
      country: 'ES',
      locale: 'en',
      ownerEmail,
      aiEnabled: false,
      referenceOptOut: false,
      growthTestsEnabled: false,
      createdAt: new Date(),
      status: opts.status ?? 'active',
      statusReason: null,
      statusChangedAt: null,
      statusChangedBy: null,
      lastStatusLogId: null,
      legal: null,
      termination: {
        requestedAt: t?.requestedAt ?? null,
        requestedBy: t?.requestedBy ?? null,
        effectiveAt: t?.effectiveAt ?? null,
        retrievalEndsAt: t?.retrievalEndsAt ?? null,
      },
      billing: null,
    });
    const roles: Array<[string, 'admin' | 'member']> = [
      ...admins.map((e): [string, 'admin'] => [e, 'admin']),
      ...members.map((e): [string, 'member'] => [e, 'member']),
    ];
    for (const [email, role] of roles) {
      await club.collection('members').doc(email).set({
        email,
        clubId: opts.id,
        role,
        addedBy: 'seed',
        addedAt: new Date(),
      });
    }
    for (const section of ['exercises', 'trainings', 'guides'] as const) {
      await club
        .collection('sectionAccess')
        .doc(section)
        .set({ adminEmails: (opts.sections?.[section] ?? []).map((e) => e.toLowerCase()) });
    }
  });
}

/** Adds `platformAdmins/{email}` (lowercased, as the rules look it up). */
export async function seedPlatformAdmin(env: RulesTestEnvironment, email: string): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`platformAdmins/${email.toLowerCase()}`).set({});
  });
}

/** A signed-in client whose token carries `email` exactly as given (no lowercasing). */
export function dbAs(env: RulesTestEnvironment, email: string): Firestore {
  return env.authenticatedContext(`uid-${email}`, { email }).firestore();
}

/** `serverTimestamp()` for compat-API writes in rules tests. */
export function serverTimestamp(): firebase.firestore.FieldValue {
  return firebase.firestore.FieldValue.serverTimestamp();
}

/**
 * Every doc path inside a club (relative to `clubs/{clubId}`; '' is the club doc
 * itself), with one valid doc at each once `seedClubTree` has run. The isolation
 * suites (cross-club, platform admin) probe these.
 */
export function clubTreePaths(clubId: string, teamId: string, memberEmail: string): string[] {
  const team = `teams/${teamId}`;
  return [
    '',
    `members/${memberEmail.toLowerCase()}`,
    'acceptances/v1',
    'statusLog/l1',
    team,
    `${team}/players/p1`,
    `${team}/players/p1/physicalTests/t1`,
    `${team}/calendar/s1`,
    `${team}/testingSessions/ts1`,
    `${team}/testingSessions/ts1/entries/e1`,
    `${team}/matches/m1`,
    `${team}/matches/m1/events/ev1`,
    `${team}/awards/season`,
    `${team}/scoutProfile/usage`,
    'exercises/x1',
    'exercises/x1/diagrams/d1',
    'trainings/tr1',
    'counters/trainings',
    'config/skillGuide',
    'config/physicalTestGuide',
    'sectionAccess/exercises',
  ].map((p) => (p ? `clubs/${clubId}/${p}` : `clubs/${clubId}`));
}

/**
 * Writes one valid doc at every non-seedClub path of `clubTreePaths` (the club,
 * members and sectionAccess docs come from `seedClub`). `teamAdmins` go on the
 * team's `adminEmails` and the player's `viewerEmails`.
 */
export async function seedClubTree(
  env: RulesTestEnvironment,
  clubId: string,
  teamId: string,
  teamAdmins: string[]
): Promise<void> {
  const emails = teamAdmins.map((e) => e.toLowerCase());
  const skill = { score: 5 };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const c = `clubs/${clubId}`;
    const team = `${c}/teams/${teamId}`;
    const writes: Array<[string, Record<string, unknown>]> = [
      [`${c}/acceptances/v1`, { versionKey: 'v1', acceptedBy: 'seed@example.com', acceptedAt: new Date() }],
      [`${c}/statusLog/l1`, { from: 'pending', to: 'active', reason: null, by: OPERATOR, at: new Date() }],
      [team, { name: `Team ${teamId}`, adminEmails: emails, createdBy: 'seed' }],
      [
        `${team}/players/p1`,
        {
          name: 'Player One',
          viewerEmails: emails,
          skills: {
            serve: skill, attack: skill, block: skill, set: skill, defence: skill,
            reception: skill, jump: skill, speed: skill, iq: skill,
          },
        },
      ],
      [`${team}/players/p1/physicalTests/t1`, { testType: 'sprint', date: '2026-10-01', value: 4.2 }],
      [`${team}/calendar/s1`, { date: '2026-10-01', createdBy: 'seed' }],
      [`${team}/testingSessions/ts1`, { status: 'open', date: '2026-10-01' }],
      [`${team}/testingSessions/ts1/entries/e1`, { playerId: 'p1', value: 4.2 }],
      [`${team}/matches/m1`, { status: 'finished', date: '2026-10-01', createdBy: 'seed' }],
      [`${team}/matches/m1/events/ev1`, { type: 'point', order: 1, source: 'tap' }],
      [`${team}/awards/season`, { picks: {}, custom: [], order: [] }],
      [`${team}/scoutProfile/usage`, { counts: {} }],
      [`${c}/exercises/x1`, { name: 'Pepper', category: 'warmup', createdBy: 'seed' }],
      [
        `${c}/exercises/x1/diagrams/d1`,
        { title: 'Setup', order: 0, updatedBy: 'seed', scene: { v: 1, court: 'full', items: [] } },
      ],
      [
        `${c}/trainings/tr1`,
        { businessId: 'T-0001', name: 'Monday', exercises: [], exerciseIds: [], createdBy: 'seed' },
      ],
      [`${c}/counters/trainings`, { lastSequence: 1 }],
      [`${c}/config/skillGuide`, { skills: [] }],
      [`${c}/config/physicalTestGuide`, { tests: [] }],
    ];
    for (const [path, data] of writes) await db.doc(path).set(data);
  });
}
