import { describe, expect, it } from 'vitest';
import type { Access } from '../auth/access';
import { checklistSteps, stepDone, welcomeRows, type StepFacts, type Who } from './steps';

const none = { exercises: false, trainings: false, guides: false };
const admin: Who = { access: { isClubAdmin: true, sections: { exercises: true, trainings: true, guides: true } }, adminsAnyTeam: true };
const who = (access: Partial<Access['sections']>, adminsAnyTeam: boolean): Who => ({
  access: { isClubAdmin: false, sections: { ...none, ...access } },
  adminsAnyTeam,
});

describe('welcomeRows', () => {
  it('shows a club admin the four founder rows', () => {
    expect(welcomeRows(admin)).toEqual(['teams', 'coaches', 'sessions', 'scouting']);
  });
  it('shows a coach sessions, scouting and the library', () => {
    expect(welcomeRows(who({ trainings: true }, true))).toEqual(['sessions', 'scouting', 'library']);
  });
  it('shows a member with nothing the view row', () => {
    expect(welcomeRows(who({}, false))).toEqual(['view']);
  });
  it('shows a member with only exercises the library', () => {
    expect(welcomeRows(who({ exercises: true }, false))).toEqual(['library']);
  });
  it('never exceeds four rows', () => {
    expect(welcomeRows(admin).length).toBeLessThanOrEqual(4);
  });
});

describe('checklistSteps', () => {
  it('gives a club admin all five', () => {
    expect(checklistSteps(admin, null)).toEqual(['team', 'players', 'coach', 'session', 'match']);
  });
  it('hides players for a coach whose teams all have players', () => {
    expect(checklistSteps(who({}, true), { anyPlayers: true })).toEqual(['session', 'match']);
  });
  it('keeps players for a coach while unknown or empty', () => {
    expect(checklistSteps(who({}, true), { anyPlayers: false })).toEqual(['players', 'session', 'match']);
    expect(checklistSteps(who({}, true), null)).toEqual(['players', 'session', 'match']);
  });
  it('gives nothing to someone who admins no team', () => {
    expect(checklistSteps(who({ exercises: true }, false), null)).toEqual([]);
  });
});

describe('stepDone', () => {
  const facts: StepFacts = { teams: 0, anyPlayers: false, members: 1, anySession: false, anyMatch: false };
  it('follows the facts', () => {
    expect(stepDone('team', facts)).toBe(false);
    expect(stepDone('team', { ...facts, teams: 1 })).toBe(true);
    expect(stepDone('coach', facts)).toBe(false);
    expect(stepDone('coach', { ...facts, members: 2 })).toBe(true);
    expect(stepDone('players', { ...facts, anyPlayers: true })).toBe(true);
    expect(stepDone('session', { ...facts, anySession: true })).toBe(true);
    expect(stepDone('match', { ...facts, anyMatch: true })).toBe(true);
    expect(stepDone('match', facts)).toBe(false);
  });
});
