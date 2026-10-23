import { describe, expect, it } from 'vitest';
import { photoAllowed } from './photoGate';

const today = new Date(2026, 9, 23);

describe('photoAllowed', () => {
  it('lets an adult without consent through', () => {
    expect(photoAllowed({ dob: '1990-01-01' }, today)).toBe(true);
  });
  it('refuses a minor without consent', () => {
    expect(photoAllowed({ dob: '2010-01-01' }, today)).toBe(false);
    expect(photoAllowed({ dob: '2010-01-01', photoConsent: false }, today)).toBe(false);
  });
  it('allows a minor with consent', () => {
    expect(photoAllowed({ dob: '2010-01-01', photoConsent: true }, today)).toBe(true);
  });
  it('treats a missing or invalid dob as a minor', () => {
    expect(photoAllowed({}, today)).toBe(false);
    expect(photoAllowed({ dob: '' }, today)).toBe(false);
    expect(photoAllowed({ dob: 'nonsense' }, today)).toBe(false);
    expect(photoAllowed({ dob: '2000-02-31' }, today)).toBe(false);
    expect(photoAllowed({ photoConsent: true }, today)).toBe(true);
  });
  it('counts the 18th birthday as adult', () => {
    expect(photoAllowed({ dob: '2008-10-23' }, today)).toBe(true);
    expect(photoAllowed({ dob: '2008-10-24' }, today)).toBe(false);
  });
});
