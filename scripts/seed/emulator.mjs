#!/usr/bin/env node
// Launches the Firestore emulator with a JDK 21+ runtime, without requiring
// JAVA_HOME to be set globally. firebase-tools refuses Java < 21; this finds a
// suitable JDK (JAVA_HOME first, then the usual install locations, then PATH),
// points the emulator at it, and forwards any extra args to
// `firebase emulators:start --only firestore`.
//
//   npm run emulator                       # firestore emulator + UI
//   node scripts/seed/emulator.mjs --inspect-functions   # (any extra flags pass through)

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const MIN_MAJOR = 21;

/** Parse `java -version` (stderr) -> integer major, or 0. */
function javaMajor(javaBin) {
  const res = spawnSync(javaBin, ['-version'], { encoding: 'utf8' });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  const m = out.match(/version "(\d+)(?:\.(\d+))?/);
  if (!m) return 0;
  const first = Number(m[1]);
  return first === 1 ? Number(m[2] || 0) : first; // "1.8.0" -> 8, "21.0.1" -> 21
}

function javaBinIn(home) {
  const bin = join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  return existsSync(bin) ? bin : null;
}

function* candidateHomes() {
  if (process.env.JAVA_HOME) yield process.env.JAVA_HOME;

  const roots =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Eclipse Adoptium',
          'C:\\Program Files\\Java',
          'C:\\Program Files\\Microsoft',
          'C:\\Program Files\\Amazon Corretto',
          'C:\\Program Files\\Zulu',
          'C:\\Program Files\\BellSoft',
          'C:\\Program Files\\Semeru',
        ]
      : ['/usr/lib/jvm', '/opt/java', '/Library/Java/JavaVirtualMachines'];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const dir = join(root, name);
      yield dir;
      yield join(dir, 'Contents', 'Home'); // macOS layout
    }
  }
}

function findJdk() {
  let best = null;
  for (const home of candidateHomes()) {
    const bin = javaBinIn(home);
    if (!bin) continue;
    const major = javaMajor(bin);
    if (major >= MIN_MAJOR && (!best || major > best.major)) best = { home, major };
  }
  if (best) return best;

  // last resort: whatever `java` is on PATH
  const major = javaMajor('java');
  return major >= MIN_MAJOR ? { home: null, major } : null;
}

const jdk = findJdk();
if (!jdk) {
  console.error(
    `\nNo JDK ${MIN_MAJOR}+ found. The Firestore emulator needs one.\n` +
      `Install Temurin: https://adoptium.net/temurin/releases/?version=21\n` +
      `Then re-run, or set JAVA_HOME to its folder.\n`
  );
  process.exit(1);
}

const env = { ...process.env };
if (jdk.home) {
  env.JAVA_HOME = jdk.home;
  const sep = process.platform === 'win32' ? ';' : ':';
  env.PATH = `${join(jdk.home, 'bin')}${sep}${env.PATH}`;
}
console.log(`Using JDK ${jdk.major}${jdk.home ? ` at ${jdk.home}` : ' (from PATH)'}`);

// Resolve firebase-tools' JS entrypoint and run it with the current node —
// avoids the `.cmd`/`.ps1` shims, which Node refuses to spawn on Windows.
const require = createRequire(import.meta.url);
const ftPkgPath = require.resolve('firebase-tools/package.json');
const ftPkg = JSON.parse(readFileSync(ftPkgPath, 'utf8'));
const firebaseBin = join(dirname(ftPkgPath), ftPkg.bin.firebase);

const passthrough = process.argv.slice(2);
const args = [firebaseBin, 'emulators:start', '--only', 'firestore', ...passthrough];
const child = spawn(process.execPath, args, { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('Failed to launch the emulator:', err.message);
  process.exit(1);
});
