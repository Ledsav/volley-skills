#!/usr/bin/env node
// Seeds a finished demo match and a live one into the LOCAL Firestore emulator,
// for the seeded team, so the Matches tab / report / scouting screen have data.
//
//   npm run seed:match              # against a running emulator (127.0.0.1:8080)
//   node scripts/seed/seedMatch.mjs --team <teamId>
//
// Team: --team <id>, else the team created by seed.mjs, else the team with the
// most players (e.g. after `npm run seed:import-snapshot`).
//
// Emulator-only. Replaces previously seeded demo matches (fixed ids).

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST is not a local address.');
  process.exit(1);
}
admin.initializeApp({ projectId: 'volley-skills' });
const db = admin.firestore();

// Deterministic pseudo-random so every seed looks the same.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (list) => list[Math.floor(rand() * list.length)];

async function findTeam() {
  const i = process.argv.indexOf('--team');
  if (i > -1) {
    const ref = db.collection('teams').doc(process.argv[i + 1]);
    if (!(await ref.get()).exists) {
      console.error(`Team ${process.argv[i + 1]} not found.`);
      process.exit(1);
    }
    return ref;
  }
  const seeded = await db.collection('teams').where('createdBy', '==', 'seed-script').limit(1).get();
  if (!seeded.empty) return seeded.docs[0].ref;
  let best = null;
  for (const t of (await db.collection('teams').limit(50).get()).docs) {
    const n = (await t.ref.collection('players').count().get()).data().count;
    if (n > 0 && (!best || n > best.n)) best = { ref: t.ref, n };
  }
  if (!best) {
    console.error('No team with players found — run `npm run seed:emulator` (or seed:import-snapshot) first.');
    process.exit(1);
  }
  return best.ref;
}

const teamRef = await findTeam();
console.log(`Team ${teamRef.id}`);
const players = (await teamRef.collection('players').orderBy('number').limit(30).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const byPos = (p) => players.filter((x) => x.positionCategory === p);
const liberoPlayers = byPos('L');
const isL = (p) => p.positionCategory === 'L';
const field = players.filter((p) => !isL(p));
// A 5-1 when positions allow: P1 S, P2 OH, P3 MB, P4 O, P5 OH, P6 MB, falling
// back to U / OH / any remaining field player per slot.
const used = new Set();
const slot = (...prefs) => {
  const p = [...prefs.flatMap(byPos), ...field].find((x) => !used.has(x.id));
  if (p) used.add(p.id);
  return p;
};
const p1 = slot('S');
const p2 = slot('OH');
const p3 = slot('MB', 'U');
const p4 = slot('O', 'U', 'OH');
const p5 = slot('OH', 'U');
const p6 = slot('MB', 'U');
const setter = p1;
const lineupPlayers = [p1, p2, p3, p4, p5, p6];
const lineup = lineupPlayers.map((p) => p.id);
// Match roster: at most 14 — lineup first, then the libero(s), then the rest by number.
// Jersey numbers must be unique within a match roster.
const rosterNumbers = new Set();
const rosterPlayers = [
  ...lineupPlayers,
  ...liberoPlayers.slice(0, 2),
  ...players.filter((p) => !lineup.includes(p.id) && !isL(p)),
]
  .filter((p) => !rosterNumbers.has(p.number) && rosterNumbers.add(p.number))
  .slice(0, 14);
const roster = rosterPlayers.map((p) => ({ playerId: p.id, number: p.number, name: p.fullName, positionCategory: p.positionCategory }));
const rosterLiberos = rosterPlayers.filter(isL);
// The libero replaces the middle slots (P3 / P6), MB or not.
const replaces = [lineup[2], lineup[5]];
const liberos =
  rosterLiberos.length === 1
    ? [{ playerId: rosterLiberos[0].id, mode: 'always', replaces }]
    : rosterLiberos.length >= 2
      ? [
          { playerId: rosterLiberos[0].id, mode: 'receiving', replaces },
          { playerId: rosterLiberos[1].id, mode: 'serving', replaces },
        ]
      : [];
const liberoIds = new Set(liberos.map((l) => l.playerId));
const format = { bestOf: 5, setPoints: 25, decidingSetPoints: 15, subsPerSet: 6, timeoutsPerSet: 2 };
const ohIds = new Set(byPos('OH').map((p) => p.id));
if (lineupPlayers.some((p) => !p)) {
  console.error('Need at least 6 non-libero players for a lineup.');
  process.exit(1);
}
console.log(`Lineup P1..P6: ${lineupPlayers.map((p) => p.positionCategory).join(' ')}; liberos: ${liberos.length} (${liberos.map((l) => l.mode).join('/') || 'none'})`);

// Mirrors the engine's applyLibero: pick the libero for the serve state, then
// replace the first back-row player (P5, P6, then P1 only when we are not serving).
function courtOf(rot, serving) {
  const court = [...rot];
  const libero =
    liberos.find((l) => l.mode === 'always') ?? liberos.find((l) => l.mode === (serving === 'us' ? 'serving' : 'receiving'));
  if (!libero) return court;
  for (const zone of [4, 5, 0]) {
    if (zone === 0 && serving === 'us') continue;
    if (libero.replaces.includes(rot[zone])) {
      court[zone] = libero.playerId;
      break;
    }
  }
  return court;
}

function buildSet(events, set, finalScore) {
  let order = events.length;
  const push = (e) => events.push({ order: ++order, source: 'tap', chunkId: null, createdBy: 'seed-match', ...e });
  let serving = set % 2 === 1 ? 'us' : 'them';
  let rot = [...lineup];
  push({ type: 'setStart', set, lineup: rot, serving });
  const score = { us: 0, them: 0 };
  const winner = finalScore.us > finalScore.them ? 'us' : 'them';
  const loser = winner === 'us' ? 'them' : 'us';
  while (score.us < finalScore.us || score.them < finalScore.them) {
    const rem = { us: finalScore.us - score.us, them: finalScore.them - score.them };
    // The set winner's final point always comes last, so the set never ends early.
    let usWins;
    if (rem[loser] === 0) usWins = winner === 'us';
    else if (rem[winner] === 1) usWins = loser === 'us';
    else usWins = rand() < rem.us / (rem.us + rem.them);

    const court = courtOf(rot, serving);
    const attackers = court.filter((id) => id !== setter.id && !liberoIds.has(id));
    const receivers = court.filter((id) => liberoIds.has(id) || ohIds.has(id));
    if (serving === 'us') push({ type: 'action', playerId: rot[0], skill: 'S', grade: usWins && rand() < 0.15 ? '#' : pick(['+', '-', '-']) });
    else push({ type: 'action', playerId: pick(receivers.length ? receivers : attackers), skill: 'R', grade: pick(['#', '+', '+', '!', '-']) });
    const last = events[events.length - 1];
    if (!(last.skill === 'S' && last.grade === '#')) {
      push({ type: 'action', playerId: setter.id, skill: 'E', grade: pick(['#', '+', '+', '!']) });
      if (usWins) push({ type: 'action', playerId: pick(attackers), skill: 'A', grade: '#' });
      else if (rand() < 0.5) push({ type: 'action', playerId: pick(attackers), skill: 'A', grade: pick(['=', '/']) });
      else push({ type: 'point', winner: 'them', reason: pick(['oppKill', 'oppBlock', 'oppAce']) });
    }
    if (usWins) {
      score.us += 1;
      if (serving === 'them') {
        rot = rot.map((_, i) => rot[(i + 1) % 6]);
        serving = 'us';
      }
    } else {
      score.them += 1;
      serving = 'them';
    }
  }
  return score;
}

async function writeMatch(id, meta, sets, finished) {
  const ref = teamRef.collection('matches').doc(id);
  const old = await ref.collection('events').limit(2000).get();
  for (let i = 0; i < old.docs.length; i += 400) {
    const b = db.batch();
    old.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  const events = [];
  const results = [];
  for (const [i, s] of sets.entries()) {
    results.push(buildSet(events, i + 1, s));
    if (finished || i < sets.length - 1) events.push({ order: events.length + 1, source: 'tap', chunkId: null, createdBy: 'seed-match', type: 'setEnd', set: i + 1 });
  }
  const done = finished ? results : results.slice(0, -1);
  await ref.set({
    ...meta,
    format,
    roster,
    liberos,
    status: finished ? 'finished' : 'live',
    result: { setsUs: done.filter((s) => s.us > s.them).length, setsThem: done.filter((s) => s.them > s.us).length, sets: done },
    summary: null,
    usageContribution: null,
    activeDevice: null,
    createdBy: 'seed-match',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  for (let i = 0; i < events.length; i += 400) {
    const b = db.batch();
    events.slice(i, i + 400).forEach((e) => b.set(ref.collection('events').doc(), e));
    await b.commit();
  }
  console.log(`Seeded ${id}: ${events.length} events`);
}

const today = new Date().toISOString().slice(0, 10);
await writeMatch(
  'demo-match',
  { date: today, opponent: 'CV Demo Rivals', competition: 'league', homeAway: 'home' },
  [{ us: 25, them: 21 }, { us: 23, them: 25 }, { us: 25, them: 18 }, { us: 25, them: 22 }],
  true,
);
await writeMatch(
  'demo-live',
  { date: today, opponent: 'Live Test VC', competition: 'friendly', homeAway: 'away' },
  [{ us: 25, them: 19 }, { us: 12, them: 10 }],
  false,
);
