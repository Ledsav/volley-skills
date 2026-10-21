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
