import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { LIMITS } from '../../src/types/limits';
import { skillGuide as enSkillGuide } from '../../src/i18n/en/skillGuide';
import { skillGuide as itSkillGuide } from '../../src/i18n/it/skillGuide';
import { physicalTestGuide as enTestGuide } from '../../src/i18n/en/physicalTestGuide';
import { physicalTestGuide as itTestGuide } from '../../src/i18n/it/physicalTestGuide';
import { dbAs, getTestEnv, seedClub, serverTimestamp, type Firestore } from './testEnv';

// Size caps (src/types/limits.ts, mirrored in firestore.rules). Each capped field is written
// once exactly at its cap (accepted) and once just over (refused). The "at the cap" docs fill
// every list to its maximum as well, so they also prove the rules stay within the evaluation
// budget for the largest document a coach can save.

const s = (n: number, c = 'x') => c.repeat(n);
const email = (i: number) => `${String(i).padStart(3, '0')}@${s(LIMITS.email - 4 - '.com'.length - 1)}.com`.slice(0, LIMITS.email);
const emails = (n: number) => Array.from({ length: n }, (_, i) => email(i));

const TEAM = 'clubs/club-a/teams/team-1';
const PLAYER = `${TEAM}/players/player-1`;
const COACH = 'coach@example.com'; // a team admin through adminEmails, not a club admin (the costlier path)
const ADMIN = 'head@example.com';
const SKILL_KEYS = ['serve', 'attack', 'block', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'];

function skills(notes = s(LIMITS.longText)) {
  return Object.fromEntries(SKILL_KEYS.map((k) => [k, { score: 5, notes, priority: false }]));
}

/** `n` objectives whose values total just under `LIMITS.objectivesText` / LIMITS.objectives each. */
function objectives(n: number, kind: 'targetDate' | 'target', perItem = Math.floor(LIMITS.objectivesText / LIMITS.objectives)) {
  const status = 'Not started';
  const date = '2026-12-31';
  const comment = s(perItem - status.length - date.length - 1000);
  return Array.from({ length: n }, () => ({ objective: s(1000), [kind]: date, status, coachComment: comment }));
}

function plan(short: number = LIMITS.objectives, season: number = LIMITS.objectives) {
  return {
    shortTermObjectives: objectives(short, 'targetDate'),
    seasonObjectives: objectives(season, 'target'),
    generalNotes: s(LIMITS.longText),
  };
}

function guardians(n: number) {
  return Array.from({ length: n }, () => ({ relation: 'mother', name: s(LIMITS.shortText), phone: s(LIMITS.shortText), email: email(1) }));
}

function maxPlayer() {
  return {
    number: 7,
    fullName: s(LIMITS.shortText),
    dob: '2010-04-12',
    nationality: s(LIMITS.shortText),
    licenseNumber: s(LIMITS.shortText),
    positionCategory: 'OH',
    shirtSize: 'M',
    starting: false,
    playerPhone: s(LIMITS.shortText),
    guardians: guardians(LIMITS.guardians),
    viewerEmails: emails(LIMITS.emailList),
    teamName: s(LIMITS.shortText),
    ageGroup: s(LIMITS.shortText),
    season: s(LIMITS.shortText),
    skills: skills(),
    avgScore: 5,
    level: 'Developing',
    developmentPlan: plan(),
    consent: { given: true, date: '2026-10-30', confirmedBy: email(2) },
    createdBy: 'seed',
  };
}

function maxTeam() {
  return {
    name: s(LIMITS.shortText),
    ageGroup: s(LIMITS.shortText),
    season: s(LIMITS.shortText),
    description: s(LIMITS.longText),
    notes: s(LIMITS.longText),
    gender: 'mixed',
    adminEmails: [COACH, ...emails(LIMITS.emailList - 1)],
    developmentPlan: plan(),
    createdBy: `uid-${ADMIN}`,
  };
}

const roster = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ playerId: `player-${String(i).padStart(13, '0')}`, number: i, name: s(LIMITS.shortText), positionCategory: 'OH' }));

function match(extra: Record<string, unknown> = {}) {
  return {
    date: '2026-10-30',
    opponent: s(LIMITS.shortText),
    competition: 'league',
    homeAway: 'home',
    format: { bestOf: 5, setPoints: 25, decidingSetPoints: 15, subsPerSet: 6, timeoutsPerSet: 2 },
    roster: roster(LIMITS.matchRoster),
    liberos: [],
    status: 'setup',
    createdBy: `uid-${COACH}`,
    ...extra,
  };
}

const custom = (n: number, note = s(80)) =>
  Array.from({ length: n }, (_, i) => ({ id: `custom-${i}`, title: s(40), playerId: `player-${i}`, note }));
const order = (n: number) => Array.from({ length: n }, (_, i) => `award-${i}`);
const awards = (extra: Record<string, unknown> = {}) => ({
  picks: { mvp: { playerId: 'p1', hidden: false } },
  custom: custom(5),
  order: order(LIMITS.awardOrder),
  ...extra,
});

const ranges = (n: number, each: number) =>
  Array.from({ length: n }, (_, i) => ({ min: i + 1, max: i + 1, description: s(each) }));
/** The most ranges, each description at the long-text cap (all values within LIMITS.guideRangesText). */
const fullRanges = () => ranges(LIMITS.guideRanges, LIMITS.longText);

function skillGuide(extra: Record<string, unknown> = {}) {
  return {
    skills: SKILL_KEYS.map((key) => ({ key, label: s(LIMITS.shortText), ranges: fullRanges(), howToEvaluate: s(LIMITS.longText) })),
    updatedBy: email(3),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

const TEST_KEYS = ['growth', 'cmj', 'approachJump', 'broadJump', 'sprint10m', 'shuttle5105', 'reaction', 'strength'];
function testGuide(extra: Record<string, unknown> = {}) {
  return {
    tests: TEST_KEYS.map((key) => ({ key, label: s(LIMITS.shortText), protocol: s(LIMITS.longText) })),
    updatedBy: email(3),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

const tokens = (n: number) => Array.from({ length: n }, (_, i) => `t${String(i).padStart(11, '0')}`);
const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ exerciseId: `ex-${String(i).padStart(17, '0')}`, order: i + 1, durationMinutes: 10 }));

describe('size caps', () => {
  let coach: Firestore;
  let admin: Firestore;

  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: [ADMIN],
      members: [COACH, 'lib@example.com'],
      sections: { trainings: [COACH, 'lib@example.com'], exercises: ['lib@example.com'], guides: ['lib@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(TEAM).set({ name: 'U17', adminEmails: [COACH], gender: 'mixed' });
      await db.doc(PLAYER).set({ fullName: 'Ada Example', viewerEmails: [], skills: skills('') });
      await db.doc(`${TEAM}/matches/m1`).set(match({ roster: [], opponent: 'Rivals' }));
      await db.doc('clubs/club-a/trainings/t1').set({ businessId: 'TR-0001', name: 'T', exercises: [], exerciseIds: [], createdBy: 'seed' });
      await db.doc('clubs/club-a/exercises/e1').set({ name: 'E', category: 'warmup', createdBy: 'seed' });
    });
    coach = dbAs(env, COACH);
    admin = dbAs(env, ADMIN);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  describe('teams', () => {
    it('accepts a team with every field and list at its cap', async () => {
      await assertSucceeds(admin.collection('clubs/club-a/teams').add(maxTeam()));
      await assertSucceeds(coach.doc(TEAM).update({ description: s(LIMITS.longText), notes: s(LIMITS.longText), developmentPlan: plan() }));
    });

    it('refuses a team field or list over its cap', async () => {
      await assertFails(admin.collection('clubs/club-a/teams').add({ ...maxTeam(), name: s(LIMITS.shortText + 1) }));
      await assertFails(admin.collection('clubs/club-a/teams').add({ ...maxTeam(), adminEmails: emails(LIMITS.emailList + 1) }));
      await assertFails(admin.collection('clubs/club-a/teams').add({ ...maxTeam(), adminEmails: [`${s(LIMITS.email * LIMITS.emailList)}@x.com`] }));
      await assertFails(coach.doc(TEAM).update({ description: s(LIMITS.longText + 1) }));
      await assertFails(coach.doc(TEAM).update({ notes: s(LIMITS.longText + 1) }));
      // A text field holding a list or a map is refused, whatever its length.
      await assertFails(coach.doc(TEAM).update({ description: [s(10)] }));
      await assertFails(coach.doc(TEAM).update({ name: { a: s(10) } }));
      await assertFails(coach.doc(TEAM).update({ season: s(LIMITS.shortText + 1) }));
      await assertFails(coach.doc(TEAM).update({ developmentPlan: { ...plan(), generalNotes: s(LIMITS.longText + 1) } }));
      await assertFails(coach.doc(TEAM).update({ developmentPlan: plan(LIMITS.objectives + 1, 0) }));
      await assertFails(
        coach.doc(TEAM).update({
          developmentPlan: { ...plan(0, 0), seasonObjectives: objectives(1, 'target', LIMITS.objectivesText + 100) },
        }),
      );
    });
  });

  describe('players', () => {
    it('accepts a player with every field and list at its cap', async () => {
      await assertSucceeds(coach.collection(`${TEAM}/players`).add(maxPlayer()));
      await assertSucceeds(coach.doc(PLAYER).set(maxPlayer()));
    });

    it('refuses a player field or list over its cap', async () => {
      await assertFails(coach.doc(PLAYER).update({ fullName: s(LIMITS.shortText + 1) }));
      await assertFails(coach.doc(PLAYER).update({ playerPhone: s(LIMITS.shortText + 1) }));
      await assertFails(coach.doc(PLAYER).update({ skills: { ...skills(''), iq: { score: 5, notes: s(LIMITS.longText + 1), priority: false } } }));
      await assertFails(coach.doc(PLAYER).update({ guardians: guardians(LIMITS.guardians + 1) }));
      await assertFails(coach.doc(PLAYER).update({ guardians: [{ relation: 'father', name: s(LIMITS.guardiansText), phone: '', email: '' }] }));
      await assertFails(coach.doc(PLAYER).update({ viewerEmails: emails(LIMITS.emailList + 1) }));
      await assertFails(coach.doc(PLAYER).update({ developmentPlan: plan(0, LIMITS.objectives + 1) }));
      await assertFails(coach.collection(`${TEAM}/players`).add({ ...maxPlayer(), nationality: s(LIMITS.shortText + 1) }));
    });

    it('caps physical test notes', async () => {
      const test = { testType: 'cmj', attemptsCm: [30], bestCm: 30, date: '2026-10-30', recordedBy: `uid-${COACH}` };
      await assertSucceeds(coach.collection(`${PLAYER}/physicalTests`).add({ ...test, notes: s(LIMITS.longText) }));
      await assertFails(coach.collection(`${PLAYER}/physicalTests`).add({ ...test, notes: s(LIMITS.longText + 1) }));
    });
  });

  describe('calendar sessions', () => {
    const session = (extra: Record<string, unknown> = {}) => ({
      date: '2026-10-30',
      trainingId: 't1',
      trainingBusinessId: 'TR-0001',
      trainingName: s(LIMITS.shortText),
      notes: s(LIMITS.longText),
      createdBy: `uid-${COACH}`,
      ...extra,
    });

    it('accepts notes and the training name at their caps, refuses them over', async () => {
      await assertSucceeds(coach.collection(`${TEAM}/calendar`).add(session()));
      await assertFails(coach.collection(`${TEAM}/calendar`).add(session({ notes: s(LIMITS.longText + 1) })));
      await assertFails(coach.collection(`${TEAM}/calendar`).add(session({ trainingName: s(LIMITS.shortText + 1) })));
    });
  });

  describe('exercises', () => {
    const exercise = (extra: Record<string, unknown> = {}) => ({
      name: s(LIMITS.shortText),
      description: s(LIMITS.longText),
      category: 'warmup',
      searchTokens: tokens(LIMITS.searchTokens),
      createdBy: 'uid-lib@example.com',
      ...extra,
    });

    it('accepts name, description and search tokens at their caps', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      await assertSucceeds(lib.collection('clubs/club-a/exercises').add(exercise()));
      await assertSucceeds(lib.doc('clubs/club-a/exercises/e1').update({ name: s(LIMITS.shortText), description: s(LIMITS.longText) }));
    });

    it('refuses them over their caps', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      await assertFails(lib.collection('clubs/club-a/exercises').add(exercise({ name: s(LIMITS.shortText + 1) })));
      await assertFails(lib.collection('clubs/club-a/exercises').add(exercise({ description: s(LIMITS.longText + 1) })));
      await assertFails(lib.collection('clubs/club-a/exercises').add(exercise({ searchTokens: tokens(LIMITS.searchTokens + 1) })));
      await assertFails(lib.doc('clubs/club-a/exercises/e1').update({ description: s(LIMITS.longText + 1) }));
    });
  });

  describe('trainings', () => {
    const training = (extra: Record<string, unknown> = {}) => ({
      businessId: 'TR-0002',
      name: s(LIMITS.shortText),
      description: s(LIMITS.longText),
      ageGroupTarget: s(LIMITS.shortText),
      exercises: steps(LIMITS.trainingExercises),
      exerciseIds: steps(LIMITS.trainingExercises).map((x) => x.exerciseId),
      searchTokens: tokens(LIMITS.searchTokens),
      createdBy: 'uid-lib@example.com',
      ...extra,
    });

    it('accepts every field and list at its cap', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      await assertSucceeds(lib.collection('clubs/club-a/trainings').add(training()));
      await assertSucceeds(lib.doc('clubs/club-a/trainings/t1').update({ description: s(LIMITS.longText), exercises: steps(LIMITS.trainingExercises) }));
    });

    it('refuses a field or list over its cap', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      await assertFails(lib.collection('clubs/club-a/trainings').add(training({ name: s(LIMITS.shortText + 1) })));
      await assertFails(lib.collection('clubs/club-a/trainings').add(training({ ageGroupTarget: s(LIMITS.shortText + 1) })));
      await assertFails(lib.doc('clubs/club-a/trainings/t1').update({ description: s(LIMITS.longText + 1) }));
      await assertFails(lib.doc('clubs/club-a/trainings/t1').update({ exercises: steps(LIMITS.trainingExercises + 1) }));
      await assertFails(lib.doc('clubs/club-a/trainings/t1').update({ exerciseIds: Array.from({ length: LIMITS.trainingExercises + 1 }, () => 'x') }));
      await assertFails(
        lib.doc('clubs/club-a/trainings/t1').update({ exercises: [{ exerciseId: s(LIMITS.trainingExercisesText), order: 1, durationMinutes: 5 }] }),
      );
    });
  });

  describe('matches and events', () => {
    it('accepts the opponent, a full roster and full award choices at their caps', async () => {
      await assertSucceeds(coach.collection(`${TEAM}/matches`).add(match()));
      await assertSucceeds(coach.doc(`${TEAM}/matches/m1`).update({ opponent: s(LIMITS.shortText), roster: roster(LIMITS.matchRoster), awards: awards() }));
    });

    it('refuses setup fields and award choices over their caps', async () => {
      await assertFails(coach.collection(`${TEAM}/matches`).add(match({ opponent: s(LIMITS.shortText + 1) })));
      await assertFails(coach.collection(`${TEAM}/matches`).add(match({ roster: roster(LIMITS.matchRoster + 1) })));
      await assertFails(coach.doc(`${TEAM}/matches/m1`).update({ roster: [{ playerId: 'p1', number: 1, name: s(LIMITS.matchRosterText), positionCategory: 'S' }] }));
      await assertFails(coach.doc(`${TEAM}/matches/m1`).update({ liberos: Array.from({ length: LIMITS.matchLiberos + 1 }, () => ({ playerId: 'p', mode: 'always', replaces: [] })) }));
      await assertFails(coach.doc(`${TEAM}/matches/m1`).update({ awards: awards({ custom: custom(6) }) }));
      await assertFails(coach.doc(`${TEAM}/matches/m1`).update({ awards: awards({ custom: custom(1, s(LIMITS.awardCustomText)) }) }));
      await assertFails(coach.doc(`${TEAM}/matches/m1`).update({ awards: awards({ order: order(LIMITS.awardOrder + 1) }) }));
    });

    it('caps an event lineup, roles and ids', async () => {
      const events = `${TEAM}/matches/m1/events`;
      const setStart = { type: 'setStart', set: 1, serving: 'us', order: 1, source: 'tap', chunkId: s(LIMITS.shortText) };
      const roles = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, 'OH']));
      await assertSucceeds(coach.collection(events).add({ ...setStart, lineup: order(LIMITS.eventLineup), roles: roles(LIMITS.eventRoles) }));
      await assertSucceeds(coach.collection(events).add({ ...setStart, lineup: [], roles: null, chunkId: null }));
      await assertFails(coach.collection(events).add({ ...setStart, lineup: order(LIMITS.eventLineup + 1) }));
      await assertFails(coach.collection(events).add({ ...setStart, lineup: [], roles: roles(LIMITS.eventRoles + 1) }));
      await assertFails(coach.collection(events).add({ ...setStart, lineup: [], chunkId: s(LIMITS.shortText + 1) }));
      await assertFails(coach.collection(events).add({ type: 'action', playerId: s(LIMITS.shortText + 1), skill: 'S', grade: '#', order: 2, source: 'tap' }));
    });
  });

  describe('season awards and the scouting usage profile', () => {
    it('accepts full award choices, refuses them over their caps', async () => {
      const doc = coach.doc(`${TEAM}/awards/season`);
      await assertSucceeds(doc.set(awards()));
      await assertFails(doc.set(awards({ order: order(LIMITS.awardOrder + 1) })));
      await assertFails(doc.set(awards({ custom: custom(2, s(LIMITS.awardCustomText)) })));
      await assertFails(doc.set(awards({ picks: Object.fromEntries(order(11).map((k) => [k, { playerId: null, hidden: true }])) })));
    });

    it('caps the usage profile at 500 players and refuses other keys', async () => {
      const doc = coach.doc(`${TEAM}/scoutProfile/usage`);
      const players = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, { matches: 1, totals: { S: 1 } }]));
      await assertSucceeds(doc.set({ players: players(LIMITS.scoutProfilePlayers) }));
      await assertFails(doc.set({ players: players(LIMITS.scoutProfilePlayers + 1) }));
      await assertFails(doc.set({ players: {}, extra: s(10) }));
      await assertSucceeds(doc.delete());
    });
  });

  describe('section access', () => {
    it(`accepts ${LIMITS.sectionEmailList} emails, refuses one more`, async () => {
      await assertSucceeds(admin.doc('clubs/club-a/sectionAccess/exercises').set({ adminEmails: emails(LIMITS.sectionEmailList) }));
      await assertFails(admin.doc('clubs/club-a/sectionAccess/exercises').set({ adminEmails: emails(LIMITS.sectionEmailList + 1) }));
    });
  });

  describe('config/skillGuide', () => {
    const path = 'clubs/club-a/config/skillGuide';

    it('accepts the guide the app saves (the English and Italian defaults)', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      for (const skills of [enSkillGuide.defaults, itSkillGuide.defaults]) {
        await assertSucceeds(lib.doc(path).set({ skills, updatedBy: 'uid-lib@example.com', updatedAt: serverTimestamp() }));
      }
    });

    it('accepts the nine skills with every text and range list at its cap', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      await assertSucceeds(lib.doc(path).set(skillGuide()));
    });

    it('refuses an unknown key, a malformed entry or text over its cap', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      const one = (entry: Record<string, unknown>) => ({ skills: [{ key: 'serve', label: 'Serve', ranges: ranges(4, 10), howToEvaluate: '', ...entry }] });
      await assertSucceeds(lib.doc(path).set(one({})));
      await assertFails(lib.doc(path).set({ ...one({}), extra: true }));
      await assertFails(lib.doc(path).set(one({ extra: 'x' })));
      await assertFails(lib.doc(path).set(one({ ranges: 'not a list' })));
      await assertFails(lib.doc(path).set(one({ key: ['serve'] })));
      await assertFails(lib.doc(path).set(one({ label: s(LIMITS.shortText + 1) })));
      await assertFails(lib.doc(path).set(one({ howToEvaluate: s(LIMITS.longText + 1) })));
      await assertFails(lib.doc(path).set(one({ ranges: ranges(LIMITS.guideRanges + 1, 1) })));
      await assertFails(lib.doc(path).set(one({ ranges: ranges(1, LIMITS.guideRangesText) })));
      await assertFails(lib.doc(path).set({ skills: [...skillGuide().skills, skillGuide().skills[0]] }));
      await assertFails(lib.doc(path).set({ skills: 'serve' }));
    });
  });

  describe('config/physicalTestGuide', () => {
    const path = 'clubs/club-a/config/physicalTestGuide';

    it('accepts the guide the app saves (the English and Italian defaults)', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      for (const tests of [enTestGuide.defaults, itTestGuide.defaults]) {
        await assertSucceeds(lib.doc(path).set({ tests, updatedBy: 'uid-lib@example.com', updatedAt: serverTimestamp() }));
      }
    });

    it('accepts the eight tests with every text at its cap', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      await assertSucceeds(lib.doc(path).set(testGuide()));
    });

    it('refuses an unknown key, a ninth test or text over its cap', async () => {
      const lib = dbAs(await getTestEnv(), 'lib@example.com');
      const one = (entry: Record<string, unknown>) => ({ tests: [{ key: 'cmj', label: 'CMJ', protocol: '', ...entry }] });
      await assertSucceeds(lib.doc(path).set(one({})));
      await assertFails(lib.doc(path).set({ ...one({}), extra: 1 }));
      await assertFails(lib.doc(path).set(one({ extra: 'x' })));
      await assertFails(lib.doc(path).set(one({ protocol: s(LIMITS.longText + 1) })));
      await assertFails(lib.doc(path).set(one({ label: s(LIMITS.shortText + 1) })));
      await assertFails(lib.doc(path).set({ tests: [...testGuide().tests, testGuide().tests[0]] }));
      await assertFails(lib.doc(path).set({ ...testGuide(), updatedBy: s(LIMITS.email + 1) }));
    });
  });
});
