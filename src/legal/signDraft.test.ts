import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSignDraft, DRAFT_TTL_MS, isSignNonce, newSignNonce, readSignDraft, saveSignDraft, SIGN_DRAFT_KEY, type SignDraft,
} from './signDraft';

const draft: SignDraft = {
  kind: 'reaccept',
  clubId: 'c'.repeat(20),
  email: 'a@b.c',
  personName: 'Ann',
  termsVersion: '2026-10-22',
  dpaVersion: '2026-10-22',
  subprocessorsVersion: '2026-10-22',
  language: 'en',
  savedAt: 1000,
  nonce: '0123456789abcdef0123456789abcdef',
};

beforeEach(() => localStorage.clear());

describe('signDraft', () => {
  it('round trips', () => {
    saveSignDraft(draft);
    expect(readSignDraft(2000)).toEqual(draft);
    clearSignDraft();
    expect(readSignDraft(2000)).toBeNull();
  });
  it('expires after 24 h', () => {
    saveSignDraft(draft);
    expect(readSignDraft(1000 + DRAFT_TTL_MS)).toEqual(draft);
    expect(readSignDraft(1000 + DRAFT_TTL_MS + 1)).toBeNull();
  });
  it('removes an expired draft when reading it', () => {
    saveSignDraft(draft);
    expect(readSignDraft(1000 + DRAFT_TTL_MS + 1)).toBeNull();
    expect(localStorage.getItem(SIGN_DRAFT_KEY)).toBeNull();
  });
  it('removes a malformed draft when reading it', () => {
    localStorage.setItem(SIGN_DRAFT_KEY, '{nope');
    expect(readSignDraft(2000)).toBeNull();
    expect(localStorage.getItem(SIGN_DRAFT_KEY)).toBeNull();
    localStorage.setItem(SIGN_DRAFT_KEY, JSON.stringify({ ...draft, personName: 5 }));
    expect(readSignDraft(2000)).toBeNull();
    expect(localStorage.getItem(SIGN_DRAFT_KEY)).toBeNull();
  });
  it('makes random 32-hex nonces and recognises only that shape', () => {
    const a = newSignNonce();
    expect(isSignNonce(a)).toBe(true);
    expect(newSignNonce()).not.toBe(a);
    expect(isSignNonce('abc')).toBe(false);
    expect(isSignNonce(`${'a'.repeat(31)}/`)).toBe(false);
    expect(isSignNonce(null)).toBe(false);
  });
  it('returns null for malformed JSON or shape', () => {
    localStorage.setItem(SIGN_DRAFT_KEY, '{nope');
    expect(readSignDraft(2000)).toBeNull();
    localStorage.setItem(SIGN_DRAFT_KEY, JSON.stringify({ kind: 'signup', clubId: 'x', email: 'a', savedAt: 1 }));
    expect(readSignDraft(2000)).toBeNull();
  });
  it('never throws when storage throws', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    const bad = { getItem: boom, setItem: boom, removeItem: boom } as unknown as Storage;
    expect(() => saveSignDraft(draft, bad)).not.toThrow();
    expect(readSignDraft(2000, bad)).toBeNull();
    expect(() => clearSignDraft(bad)).not.toThrow();
  });
  it.each([
    ['personName', undefined],
    ['termsVersion', 5],
    ['dpaVersion', undefined],
    ['subprocessorsVersion', null],
    ['language', 'xx'],
    ['language', undefined],
    ['nonce', undefined],
    ['nonce', 'short'],
  ])('returns null when %s is invalid', (field, value) => {
    localStorage.setItem(SIGN_DRAFT_KEY, JSON.stringify({ ...draft, [field]: value }));
    expect(readSignDraft(2000)).toBeNull();
  });
  it.each(['name', 'country', 'locale'])('returns null for a sign-up draft missing club.%s', (field) => {
    const club = { name: 'VC', country: 'LU', locale: 'en', [field]: undefined };
    localStorage.setItem(SIGN_DRAFT_KEY, JSON.stringify({ ...draft, kind: 'signup', club }));
    expect(readSignDraft(2000)).toBeNull();
  });
});
