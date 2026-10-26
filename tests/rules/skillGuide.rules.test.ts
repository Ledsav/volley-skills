import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

describe('skillGuide rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: ['coach@example.com'],
      members: ['parent@example.com', 'guide@example.com'],
      sections: { guides: ['guide@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('clubs/club-a/config/skillGuide').set({ skills: [] });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a club admin write the skill guide, denies a member without the guides section', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, 'coach@example.com').doc('clubs/club-a/config/skillGuide').set({ skills: [] }));
    await assertFails(dbAs(env, 'parent@example.com').doc('clubs/club-a/config/skillGuide').set({ skills: [] }));
  });

  it('lets a guides-section member write the skill guide', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, 'guide@example.com').doc('clubs/club-a/config/skillGuide').set({ skills: [] }));
  });

  it('denies a team admin without the guides section from writing the skill guide', async () => {
    const env = await getTestEnv();
    // Team admin (teams/*.adminEmails) and section admin are different grants.
    await env.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('clubs/club-a/teams/team-1')
        .set({ name: 'U17', adminEmails: ['parent@example.com'] });
    });
    await assertFails(dbAs(env, 'parent@example.com').doc('clubs/club-a/config/skillGuide').set({ skills: [] }));
  });

  it('lets any active club member read the skill guide', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, 'parent@example.com').doc('clubs/club-a/config/skillGuide').get());
  });

  it('refuses reading the guide to a signed-in non-member', async () => {
    const env = await getTestEnv();
    await assertFails(dbAs(env, 'outsider@example.com').doc('clubs/club-a/config/skillGuide').get());
    await assertFails(env.unauthenticatedContext().firestore().doc('clubs/club-a/config/skillGuide').get());
  });

  it('refuses a config doc other than the two guides', async () => {
    const env = await getTestEnv();
    await assertFails(dbAs(env, 'coach@example.com').doc('clubs/club-a/config/other').set({ x: 1 }));
    await assertFails(dbAs(env, 'coach@example.com').doc('clubs/club-a/config/other').get());
  });

  it('keeps the guide readable to a suspended club admin only', async () => {
    const env = await getTestEnv();
    await seedClub(env, { id: 'club-s', status: 'suspended', admins: ['coach@example.com'], members: ['parent@example.com'] });
    await env.withSecurityRulesDisabled(async (c) => c.firestore().doc('clubs/club-s/config/skillGuide').set({ skills: [] }));
    await assertSucceeds(dbAs(env, 'coach@example.com').doc('clubs/club-s/config/skillGuide').get());
    await assertFails(dbAs(env, 'coach@example.com').doc('clubs/club-s/config/skillGuide').set({ skills: [1] }));
    await assertFails(dbAs(env, 'parent@example.com').doc('clubs/club-s/config/skillGuide').get());
  });
});
