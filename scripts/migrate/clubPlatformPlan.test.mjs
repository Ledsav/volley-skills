import { describe, expect, it } from 'vitest';
import { planMigration } from './clubPlatformPlan.mjs';

const OPTS = { clubId: 'VcbMigratedClub00001', owner: 'President@x.com', operator: 'boss@x.com', country: 'ES', now: 'NOW' };
const ts = { seconds: 1 };

function source() {
  return [
    { path: 'adminAllowlist/Boss@x.com', data: {} },
    { path: 'users/u1', data: { email: 'boss@x.com', role: 'superadmin' } },
    { path: 'sectionAccess/exercises', data: { adminEmails: ['A@x.com'], migratedAt: 1 } },
    { path: 'skillGuide/config', data: { skills: [] } },
    { path: 'physicalTestGuide/config', data: { tests: [] } },
    { path: 'teams/t1', data: { name: 'U17', club: 'VCB', adminEmails: ['Coach@x.com', 'ana@x.com', 'Ana@x.com'] } },
    { path: 'teams/t1/players/p1', data: { fullName: 'P', viewerEmails: ['ANA@x.com', 'coach@x.com'] } },
    { path: 'teams/t1/matches/m1', data: { status: 'finished' } },
    { path: 'teams/t1/matches/m1/events/e1', data: { order: 1, at: ts } },
    { path: 'teams/t2', data: { name: 'U15', club: 'VCB', adminEmails: [] } },
    { path: 'teams/t3', data: { name: 'Sr', club: 'Other', adminEmails: [] } },
    { path: 'exercises/x1', data: { name: 'X' } },
    { path: 'exercises/x1/diagrams/d1', data: { order: 0 } },
    { path: 'trainings/tr1', data: { name: 'T' } },
    { path: 'counters/trainings', data: { lastSequence: 1 } },
  ];
}

const write = (plan, path) => plan.writes.find((w) => w.path === path);

describe('planMigration', () => {
  it('makes one member per person, admin wins', () => {
    const plan = planMigration(source(), OPTS);
    const members = [...plan.members].sort((a, b) => a.email.localeCompare(b.email));
    expect(members).toEqual([
      { email: 'a@x.com', role: 'member' },
      { email: 'ana@x.com', role: 'member' },
      { email: 'boss@x.com', role: 'admin' },
      { email: 'coach@x.com', role: 'member' },
      { email: 'president@x.com', role: 'admin' },
    ]);
    expect(write(plan, 'clubs/VcbMigratedClub00001/members/ana@x.com').data).toEqual({
      email: 'ana@x.com', clubId: 'VcbMigratedClub00001', role: 'member', addedBy: 'migration', addedAt: 'NOW',
    });
  });

  it('refuses the operator as owner', () => {
    expect(() => planMigration(source(), { ...OPTS, owner: 'Boss@X.com' })).toThrow('owner must not be the operator');
  });

  it('accepts the operator as owner only in test mode (the rules still never let the operator sign)', () => {
    const plan = planMigration(source(), { ...OPTS, owner: 'Boss@X.com', operatorOwnerTestMode: true });
    expect(plan.club.data.ownerEmail).toBe('boss@x.com');
    expect(write(plan, 'clubs/VcbMigratedClub00001/members/boss@x.com').data.role).toBe('admin');
  });

  it('validates the club id, emails, country and locale', () => {
    expect(() => planMigration(source(), { ...OPTS, clubId: 'Bad Id' })).toThrow(/clubId/);
    // Club ids are app-made auto ids (20 letters and digits), as at sign-up; never a hand-picked slug.
    expect(() => planMigration(source(), { ...OPTS, clubId: 'vcb' })).toThrow(/clubId/);
    expect(() => planMigration(source(), { ...OPTS, clubId: 'VcbMigratedClub0000-' })).toThrow(/clubId/);
    expect(() => planMigration(source(), { ...OPTS, owner: 'nope' })).toThrow(/owner/);
    expect(() => planMigration(source(), { ...OPTS, country: 'es' })).toThrow(/country/);
    expect(() => planMigration(source(), { ...OPTS, locale: 'fr' })).toThrow(/locale/);
  });

  it('copies nested docs with ids preserved', () => {
    const plan = planMigration(source(), OPTS);
    const event = write(plan, 'clubs/VcbMigratedClub00001/teams/t1/matches/m1/events/e1');
    expect(event.data).toEqual({ order: 1, at: ts });
    expect(event.data.at).toBe(ts);
    expect(write(plan, 'clubs/VcbMigratedClub00001/exercises/x1/diagrams/d1').data).toEqual({ order: 0 });
    expect(write(plan, 'clubs/VcbMigratedClub00001/counters/trainings').data).toEqual({ lastSequence: 1 });
  });

  it('drops team.club and lowercases team and player emails', () => {
    const plan = planMigration(source(), OPTS);
    const team = write(plan, 'clubs/VcbMigratedClub00001/teams/t1').data;
    expect(team).not.toHaveProperty('club');
    expect(team.adminEmails).toEqual(['coach@x.com', 'ana@x.com']);
    expect(write(plan, 'clubs/VcbMigratedClub00001/teams/t1/players/p1').data.viewerEmails).toEqual(['ana@x.com', 'coach@x.com']);
  });

  it('writes sectionAccess with adminEmails only', () => {
    expect(write(planMigration(source(), OPTS), 'clubs/VcbMigratedClub00001/sectionAccess/exercises').data).toEqual({ adminEmails: ['a@x.com'] });
  });

  it('moves the guides under config', () => {
    const plan = planMigration(source(), OPTS);
    expect(write(plan, 'clubs/VcbMigratedClub00001/config/skillGuide').data).toEqual({ skills: [] });
    expect(write(plan, 'clubs/VcbMigratedClub00001/config/physicalTestGuide').data).toEqual({ tests: [] });
  });

  it('names the club after the most common team.club', () => {
    expect(planMigration(source(), OPTS).club.data.name).toBe('VCB');
    expect(planMigration(source(), { ...OPTS, name: 'Given' }).club.data.name).toBe('Given');
    const noClub = source().map((d) => (d.path.match(/^teams\/[^/]+$/) ? { ...d, data: { ...d.data, club: '' } } : d));
    expect(() => planMigration(noClub, OPTS)).toThrow('pass --name');
  });

  it('strips role from users docs in place', () => {
    expect(write(planMigration(source(), OPTS), 'users/u1').data).toEqual({ email: 'boss@x.com' });
  });

  it('makes an active club with AI and growth tests on', () => {
    const plan = planMigration(source(), OPTS);
    expect(plan.club.path).toBe('clubs/VcbMigratedClub00001');
    expect(plan.club.data).toMatchObject({
      status: 'active', ownerEmail: 'president@x.com', aiEnabled: true, growthTestsEnabled: true, legal: null,
      locale: 'en', country: 'ES',
    });
    expect(plan.club.data.termination.effectiveAt).toBeNull();
    expect(write(plan, 'platformAdmins/boss@x.com').data).toEqual({ addedBy: 'migration', addedAt: 'NOW' });
    expect(plan.writes.some((w) => w.path.startsWith('clubs/VcbMigratedClub00001/adminAllowlist'))).toBe(false);
  });

  it('counts the expected docs per group', () => {
    const plan = planMigration(source(), OPTS);
    expect(plan.expected).toEqual({
      teams: 6, exercises: 2, trainings: 1, counters: 1, config: 2, sectionAccess: 1, members: plan.members.length,
    });
  });

  it('orders writes: members, platformAdmins, sectionAccess, config, library, teams, users', () => {
    const groups = planMigration(source(), OPTS).writes.map((w) => {
      const m = w.path.match(/^clubs\/VcbMigratedClub00001\/([^/]+)/);
      if (!m) return w.path.split('/')[0];
      return ['exercises', 'trainings', 'counters'].includes(m[1]) ? 'library' : m[1];
    });
    const order = [...new Set(groups)];
    expect(order).toEqual(['members', 'platformAdmins', 'sectionAccess', 'config', 'library', 'teams', 'users']);
  });
});
