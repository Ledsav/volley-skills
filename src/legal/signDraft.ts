import type { ClubLocale } from '../types/club';
import { LEGAL_LANGS, type LegalLang } from './versions';

type Common = {
  email: string;
  personName: string;
  termsVersion: string;
  dpaVersion: string;
  subprocessorsVersion: string;
  language: LegalLang;
  savedAt: number;
};

export type SignDraft =
  | ({ kind: 'signup'; clubId: string; club: { name: string; country: string; locale: ClubLocale } } & Common)
  | ({ kind: 'reaccept'; clubId: string } & Common);

export const SIGN_DRAFT_KEY = 'vcb.signDraft';
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Keeps the draft across the trip through the email link. Storage failures are swallowed. */
export function saveSignDraft(d: SignDraft, storage: Storage = localStorage): void {
  try {
    storage.setItem(SIGN_DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage blocked: the commit will report noDraft */
  }
}

/** The saved draft, or null when missing, older than 24 h or malformed. Never throws. */
export function readSignDraft(now: number, storage: Storage = localStorage): SignDraft | null {
  try {
    const raw = storage.getItem(SIGN_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SignDraft | null;
    if (!d || typeof d !== 'object') return null;
    if (d.kind !== 'signup' && d.kind !== 'reaccept') return null;
    if (typeof d.clubId !== 'string' || typeof d.email !== 'string' || typeof d.savedAt !== 'number') return null;
    const strings = [d.personName, d.termsVersion, d.dpaVersion, d.subprocessorsVersion];
    if (strings.some((v) => typeof v !== 'string')) return null;
    if (!LEGAL_LANGS.includes(d.language)) return null;
    if (d.kind === 'signup') {
      const c = d.club;
      if (!c || typeof c.name !== 'string' || typeof c.country !== 'string' || typeof c.locale !== 'string') return null;
    }
    if (now - d.savedAt > DRAFT_TTL_MS) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearSignDraft(storage: Storage = localStorage): void {
  try {
    storage.removeItem(SIGN_DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}
