#!/usr/bin/env node
// One command for local development against seeded emulators:
//   1. boot the Auth + Firestore emulators (JDK 21+ found automatically),
//   2. wait until they're ready, then seed the roster,
//   3. start Vite with VITE_USE_EMULATOR=true,
//   4. shut the emulators down when Vite exits (Ctrl+C).
//
//   npm run dev:emulator            # add `-- --admin you@example.com` to change the seeded admin
//
// Emulators are in-memory here, so every run gives a fresh seed.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { envWithJdk, firebaseBin } from './jdk.mjs';

const require = createRequire(import.meta.url);

function binOf(pkg) {
  const pkgPath = require.resolve(`${pkg}/package.json`);
  const meta = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const rel = typeof meta.bin === 'string' ? meta.bin : meta.bin[pkg];
  return join(dirname(pkgPath), rel);
}

const fb = JSON.parse(readFileSync('firebase.json', 'utf8'));
const firestorePort = fb.emulators?.firestore?.port ?? 8080;
const authPort = fb.emulators?.auth?.port ?? 9099;
const uiWanted = fb.emulators?.ui?.port ?? 4000;

const env = envWithJdk();
console.log(
  [
    '',
    'Emulators',
    `  Firestore     127.0.0.1:${firestorePort}`,
    `  Auth          127.0.0.1:${authPort}`,
    `  Emulator UI   http://127.0.0.1:${uiWanted}   (bumps to the next free port if ${uiWanted} is taken)`,
    '  App (Vite)    URL printed below once it starts',
    '',
  ].join('\n')
);

const passthrough = process.argv.slice(2); // forwarded to the seed script (e.g. --admin ...)
const seed = ['node', 'scripts/seed/seed.mjs', '--emulator', '--reset', ...passthrough]
  .map((a) => (a.includes(' ') ? JSON.stringify(a) : a))
  .join(' ');

// `emulators:exec` starts the emulators, waits for "All emulators ready",
// runs this, then tears the emulators down on exit. Resolve vite's JS
// entrypoint so it works regardless of whether node_modules/.bin is on PATH.
const inner = `${seed} && node ${JSON.stringify(binOf('vite'))}`;
const args = [firebaseBin(), 'emulators:exec', '--only', 'auth,firestore', inner];

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: { ...env, VITE_USE_EMULATOR: 'true' },
});
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
