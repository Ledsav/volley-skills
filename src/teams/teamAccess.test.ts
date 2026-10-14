import { describe, expect, it } from 'vitest';
import { isTeamAdmin } from './teamAccess';
import { superAdminAccess } from '../test/authValue';

describe('isTeamAdmin', () => {
  const team = { adminEmails: ['coach@x.be'] };
  it('true for listed email', () => expect(isTeamAdmin(team, 'coach@x.be', null)).toBe(true));
  it('true for superadmin', () => expect(isTeamAdmin(team, 'boss@x.be', superAdminAccess)).toBe(true));
  it('false otherwise', () => {
    expect(isTeamAdmin(team, 'parent@x.be', null)).toBe(false);
    expect(isTeamAdmin(team, null, null)).toBe(false);
  });
});
