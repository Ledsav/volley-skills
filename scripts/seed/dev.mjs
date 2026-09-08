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
import { envWithJdk, firebaseBin } from './jdk.mjs';

const passthrough = process.argv.slice(2); // forwarded to the seed script (e.g. --admin ...)
const seedArgs = ['scripts/seed/seed.mjs', '--emulator', '--reset', ...passthrough]
  .map((a) => (a.includes(' ') ? JSON.stringify(a) : a))
  .join(' ');

// `emulators:exec` starts the emulators, waits for "All emulators ready",
// runs the command, then tears the emulators down on exit.
const inner = `node ${seedArgs} && vite`;
const env = { ...envWithJdk(), VITE_USE_EMULATOR: 'true' };
const args = [firebaseBin(), 'emulators:exec', '--only', 'auth,firestore', inner];

const child = spawn(process.execPath, args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
