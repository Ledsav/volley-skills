#!/usr/bin/env node
// Seeds a finished demo match and a live one into the LOCAL Firestore emulator,
// for the seeded team, so the Matches tab / report / scouting screen have data.
//
//   npm run seed:match              # against a running emulator (127.0.0.1:8080)
//
// Emulator-only. Replaces previously seeded demo matches (fixed ids).

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
admin.initializeApp({ projectId: 'volley-skills' });
const db = admin.firestore();

// Deterministic pseudo-random so every seed looks the same.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (list) => list[Math.floor(rand() * list.length)];

const teams = await db.collection('teams').where('createdBy', '==', 'seed-script').limit(1).get();
if (teams.empty) {
  console.error('No seeded team found — run `npm run seed:emulator` first.');
  process.exit(1);
}
const teamRef = teams.docs[0].ref;
const players = (await teamRef.collection('players').orderBy('number').limit(30).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const byPos = (p) => players.filter((x) => x.positionCategory === p);
const libero = byPos('L')[0] ?? null;
const field = players.filter((p) => p.id !== libero?.id);
const setter = byPos('S')[0] ?? field[0];
const ordered = [setter, ...byPos('OH'), ...byPos('O'), ...byPos('MB'), ...field].filter(
  (p, i, all) => p && all.findIndex((q) => q.id === p.id) === i && p.id !== libero?.id,
);
const lineup = ordered.slice(0, 6).map((p) => p.id);
const middles = byPos('MB').map((p) => p.id);
const roster = players.map((p) => ({ playerId: p.id, number: p.number, name: p.fullName, positionCategory: p.positionCategory }));
const liberos = libero ? [{ playerId: libero.id, mode: 'always', replaces: middles }] : [];
const format = { bestOf: 5, setPoints: 25, decidingSetPoints: 15, subsPerSet: 6, timeoutsPerSet: 2 };
const ohIds = new Set(byPos('OH').map((p) => p.id));

// Mirrors the engine's libero rule: replaces the first back-row middle (P5, P6,
// then P1 only when we are not serving).
function courtOf(rot, serving) {
  const court = [...rot];
  if (!libero) return court;
  for (const zone of [4, 5, 0]) {
    if (zone === 0 && serving === 'us') continue;
    if (middles.includes(rot[zone])) {
      court[zone] = libero.id;
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
    const attackers = court.filter((id) => id !== setter.id && id !== libero?.id);
    const receivers = court.filter((id) => id === libero?.id || ohIds.has(id));
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
