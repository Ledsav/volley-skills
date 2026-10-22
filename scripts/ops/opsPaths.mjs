// Paths and messages shared by the backup CLIs.
import { existsSync } from 'node:fs';
import { posix, resolve, win32 } from 'node:path';
import { fail } from '../migrate/cli.mjs';

/** The public key backups are sealed with (committed; the private key never is). */
export const PUBLIC_KEY_PATH = 'scripts/ops/backup-public-key.pem';

/** Whether absolute `dir` is `root` or inside it; Windows paths compare without letter case. */
export function isInside(dir, root, platform = process.platform) {
  const windows = platform === 'win32';
  const { sep } = windows ? win32 : posix;
  const norm = (p) => (windows ? p.toLowerCase() : p);
  return norm(dir) === norm(root) || norm(dir).startsWith(norm(root) + sep);
}

/** `dir` when it exists and is outside the repo (the scripts run from the repo root); exits otherwise. */
export function requireFolderOutsideRepo(dir) {
  if (!dir) fail('Missing --out <folder outside the repo>.');
  if (!existsSync(dir)) fail(`${dir} does not exist.`);
  if (isInside(resolve(dir), resolve('.'))) fail('Refusing: the folder is inside the repo. Choose a folder outside it.');
  return dir;
}

/**
 * An error message that is safe to print: the scripts' own messages carry counts only, but
 * Firestore's can name a document path, and member ids are emails.
 */
export function safeMessage(e) {
  if (e?.code !== undefined) return `Firestore error (code ${e.code}). Details hidden: they can contain document paths.`;
  return e?.message ?? String(e);
}
