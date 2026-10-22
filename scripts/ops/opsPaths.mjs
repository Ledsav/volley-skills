// Paths shared by the backup CLIs.
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fail } from '../migrate/cli.mjs';

/** The public key backups are sealed with (committed; the private key never is). */
export const PUBLIC_KEY_PATH = 'scripts/ops/backup-public-key.pem';

/** `dir` when it exists and is outside the repo (the scripts run from the repo root); exits otherwise. */
export function requireFolderOutsideRepo(dir) {
  if (!dir) fail('Missing --out <folder outside the repo>.');
  if (!existsSync(dir)) fail(`${dir} does not exist.`);
  if ((resolve(dir) + sep).startsWith(resolve('.') + sep)) fail('Refusing: --out is inside the repo. Choose a folder outside it.');
  return dir;
}
