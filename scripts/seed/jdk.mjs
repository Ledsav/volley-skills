// Locate a JDK 21+ (the Firestore emulator needs one) without requiring
// JAVA_HOME to be set globally, and resolve firebase-tools' JS entrypoint.
// Shared by emulator.mjs and dev.mjs.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const MIN_MAJOR = 21;

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

/** @returns {{home: string|null, major: number}|null} */
export function findJdk() {
  let best = null;
  for (const home of candidateHomes()) {
    const bin = javaBinIn(home);
    if (!bin) continue;
    const major = javaMajor(bin);
    if (major >= MIN_MAJOR && (!best || major > best.major)) best = { home, major };
  }
  if (best) return best;
  const major = javaMajor('java');
  return major >= MIN_MAJOR ? { home: null, major } : null;
}

/**
 * Returns `baseEnv` with JAVA_HOME + PATH patched to a JDK 21+, and logs the pick.
 * Exits the process with a Temurin hint if none is found.
 */
export function envWithJdk(baseEnv = process.env) {
  const jdk = findJdk();
  if (!jdk) {
    console.error(
      `\nNo JDK ${MIN_MAJOR}+ found. The Firestore emulator needs one.\n` +
        `Install Temurin: https://adoptium.net/temurin/releases/?version=21\n` +
        `Then re-run, or set JAVA_HOME to its folder.\n`
    );
    process.exit(1);
  }
  const env = { ...baseEnv };
  if (jdk.home) {
    env.JAVA_HOME = jdk.home;
    const sep = process.platform === 'win32' ? ';' : ':';
    env.PATH = `${join(jdk.home, 'bin')}${sep}${env.PATH}`;
  }
  console.log(`Using JDK ${jdk.major}${jdk.home ? ` at ${jdk.home}` : ' (from PATH)'}`);
  return env;
}

/** Absolute path to firebase-tools' JS entrypoint (run with `node` — the .cmd shim can't be spawned on Windows). */
export function firebaseBin() {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('firebase-tools/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return join(dirname(pkgPath), pkg.bin.firebase);
}
