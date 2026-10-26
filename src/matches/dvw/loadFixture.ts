import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Tests only (Node environment): the text of `fixtures/<name>`. */
export function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}
