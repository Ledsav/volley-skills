import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // .mjs: emulator tests of the Admin SDK scripts (scripts/**/*.mjs), kept out of tsc.
    include: ['tests/rules/**/*.test.{ts,mjs}'],
    testTimeout: 20000,
    hookTimeout: 30000,
    // All rules test files share a single Firestore emulator project/instance.
    // Running files in parallel lets one file's clearFirestore()/setup race
    // against another's writes, causing intermittent PERMISSION_DENIED
    // evaluation errors. Force serial execution across files.
    fileParallelism: false,
  },
});
