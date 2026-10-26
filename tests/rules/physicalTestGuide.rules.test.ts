import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

describe('physicalTestGuide rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: ['coach@example.com'],
      members: ['parent@example.com', 'guide@example.com'],
      sections: { guides: ['guide@example.com'] },
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a club admin write the physical test guide, denies a member without the guides section', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, 'coach@example.com').doc('clubs/club-a/config/physicalTestGuide').set({ tests: [] }));
    await assertFails(dbAs(env, 'parent@example.com').doc('clubs/club-a/config/physicalTestGuide').set({ tests: [] }));
  });

  it('lets a guides-section member write the physical test guide', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, 'guide@example.com').doc('clubs/club-a/config/physicalTestGuide').set({ tests: [] }));
  });

  it('lets any active club member read the physical test guide, but not a non-member', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, 'parent@example.com').doc('clubs/club-a/config/physicalTestGuide').get());
    await assertFails(dbAs(env, 'outsider@example.com').doc('clubs/club-a/config/physicalTestGuide').get());
  });
});
