// Emulator-launch helpers shared by emulator.mjs and dev.mjs: locate a JDK 21+
// (the Firestore emulator needs one) without a global JAVA_HOME, resolve
// firebase-tools' JS entrypoint, and clear ports left held by a previous
// emulator that didn't shut down cleanly.

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

const EMULATOR_PORTS = [8080, 9099, 4000, 4001, 4400, 4401, 4500, 4501, 9150];

function listeningPids(ports) {
  const pids = new Set();
  if (process.platform === 'win32') {
    const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).stdout || '';
    for (const line of out.split('\n')) {
      if (!/LISTENING/.test(line)) continue;
      const m = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
      if (m && ports.includes(Number(m[1]))) pids.add(m[2]);
    }
  } else {
    const out = spawnSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout || '';
    for (const line of out.split('\n')) {
      const m = line.match(/^\S+\s+(\d+).*:(\d+)\s+\(LISTEN\)/);
      if (m && ports.includes(Number(m[2]))) pids.add(m[1]);
    }
  }
  return [...pids];
}

function processName(pid) {
  if (process.platform === 'win32') {
    const out = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).stdout || '';
    return (out.match(/^"([^"]+)"/) || [, ''])[1].toLowerCase();
  }
  return (spawnSync('ps', ['-p', pid, '-o', 'comm='], { encoding: 'utf8' }).stdout || '').trim().toLowerCase();
}

/**
 * Kill java / node processes still holding the emulator ports (a previous run
 * that exited uncleanly). Only those two image names are touched, so an
 * unrelated service is left alone. Logs what it kills; no-op when ports are free.
 */
export function freeEmulatorPorts() {
  const killed = [];
  for (const pid of listeningPids(EMULATOR_PORTS)) {
    if (pid === String(process.pid)) continue;
    const name = processName(pid);
    if (!/^java|^node|openjdk/.test(name)) continue;
    const res =
      process.platform === 'win32'
        ? spawnSync('taskkill', ['/F', '/T', '/PID', pid], { encoding: 'utf8' })
        : spawnSync('kill', ['-9', pid], { encoding: 'utf8' });
    if (res.status === 0) killed.push(`${name || 'pid'} (${pid})`);
  }
  if (killed.length) {
    console.log(`Freed stale emulator ports — stopped ${killed.join(', ')}`);
    spawnSync(process.platform === 'win32' ? 'cmd' : 'sh', process.platform === 'win32' ? ['/c', 'timeout /t 2 /nobreak >nul'] : ['-c', 'sleep 2']);
  }
}
