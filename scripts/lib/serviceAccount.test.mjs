// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sealSecret } from '../ops/backupCrypto.mjs';
import { ENC_KEY_PATH, loadServiceAccount, PLAIN_KEY_PATH } from './serviceAccount.mjs';

const PASS = 'service key passphrase';
const KEY = { type: 'service_account', project_id: 'volley-skills', private_key: 'k' };

function dirWith({ enc, plain }) {
  const dir = mkdtempSync(join(tmpdir(), 'vs-key-'));
  if (enc) writeFileSync(join(dir, ENC_KEY_PATH), JSON.stringify(sealSecret(Buffer.from(JSON.stringify(enc)), PASS)));
  if (plain) writeFileSync(join(dir, PLAIN_KEY_PATH), JSON.stringify(plain));
  return dir;
}

describe('loadServiceAccount', () => {
  it('opens the encrypted key with its passphrase', async () => {
    const ask = vi.fn(async () => PASS);
    const warn = vi.fn();
    expect(await loadServiceAccount({ dir: dirWith({ enc: KEY }), ask, warn })).toEqual(KEY);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('uses a plain key with a warning to encrypt it', async () => {
    const ask = vi.fn();
    const warn = vi.fn();
    expect(await loadServiceAccount({ dir: dirWith({ plain: KEY }), ask, warn })).toEqual(KEY);
    expect(ask).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/key:encrypt/);
  });

  it('prefers the encrypted key when both exist', async () => {
    const other = { ...KEY, private_key: 'plain' };
    const key = await loadServiceAccount({ dir: dirWith({ enc: KEY, plain: other }), ask: async () => PASS, warn: () => {} });
    expect(key).toEqual(KEY);
  });

  it('names both files when neither exists', async () => {
    await expect(loadServiceAccount({ dir: dirWith({}), ask: async () => PASS, warn: () => {} })).rejects.toThrow(
      /serviceAccountKey\.json\.enc.*serviceAccountKey\.json/,
    );
  });

  it('refuses a wrong passphrase', async () => {
    await expect(loadServiceAccount({ dir: dirWith({ enc: KEY }), ask: async () => 'wrong passphrase!!', warn: () => {} })).rejects.toThrow(
      /Wrong passphrase/,
    );
  });
});
