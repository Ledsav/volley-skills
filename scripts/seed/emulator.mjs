#!/usr/bin/env node
// Starts the Auth + Firestore emulators with a JDK 21+ runtime (found
// automatically — no JAVA_HOME needed). Extra args pass through to
// `firebase emulators:start`.
//
//   npm run emulator

import { spawn } from 'node:child_process';
import { envWithJdk, firebaseBin, freeEmulatorPorts } from './jdk.mjs';

freeEmulatorPorts();
const env = envWithJdk();
const args = [firebaseBin(), 'emulators:start', '--only', 'auth,firestore', ...process.argv.slice(2)];

const child = spawn(process.execPath, args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('Failed to launch the emulator:', err.message);
  process.exit(1);
});
