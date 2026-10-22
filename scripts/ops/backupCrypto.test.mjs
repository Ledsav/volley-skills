// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateBackupKeys,
  keyFingerprint,
  openBackup,
  openSecret,
  sealBackup,
  sealSecret,
} from './backupCrypto.mjs';

const PASS = 'correct horse battery';
const META = { projectId: 'volley-skills', createdAt: '2026-10-22T12:00:00.000Z' };
const MARKER = 'PLAINTEXT-MARKER-Olivia';

let keys;
let otherKeys;

beforeAll(() => {
  keys = generateBackupKeys(PASS);
  otherKeys = generateBackupKeys(PASS);
}, 60_000);

const flip = (b64) => {
  const buf = Buffer.from(b64, 'base64');
  buf[0] ^= 0xff;
  return buf.toString('base64');
};

describe('sealBackup / openBackup', () => {
  it('round-trips the content', () => {
    const plain = Buffer.from(`hello ${MARKER}`);
    const env = sealBackup(plain, keys.publicKeyPem, META);
    expect(openBackup(env, keys.privateKeyPem, PASS).equals(plain)).toBe(true);
  });

  it('describes itself and keeps the plaintext out of the envelope', () => {
    const env = sealBackup(Buffer.from(MARKER), keys.publicKeyPem, META);
    expect(env).toMatchObject({ format: 'volley-skills-backup', version: 1, ...META });
    expect(env.keyId).toBe(keyFingerprint(keys.publicKeyPem));
    expect(JSON.stringify(env)).not.toContain(MARKER);
    expect(JSON.stringify(env)).not.toContain(Buffer.from(MARKER).toString('base64'));
  });

  it('refuses a wrong passphrase', () => {
    const env = sealBackup(Buffer.from('x'), keys.publicKeyPem, META);
    expect(() => openBackup(env, keys.privateKeyPem, 'wrong passphrase!')).toThrow();
  });

  it("refuses another key pair's private key", () => {
    const env = sealBackup(Buffer.from('x'), keys.publicKeyPem, META);
    expect(() => openBackup(env, otherKeys.privateKeyPem, PASS)).toThrow();
  });

  it('refuses a changed header', () => {
    const env = sealBackup(Buffer.from('x'), keys.publicKeyPem, META);
    expect(() => openBackup({ ...env, projectId: 'other' }, keys.privateKeyPem, PASS)).toThrow();
    expect(() => openBackup({ ...env, createdAt: '2020-01-01T00:00:00.000Z' }, keys.privateKeyPem, PASS)).toThrow();
  });

  it('refuses a changed ciphertext', () => {
    const env = sealBackup(Buffer.from('some content'), keys.publicKeyPem, META);
    expect(() => openBackup({ ...env, ciphertext: flip(env.ciphertext) }, keys.privateKeyPem, PASS)).toThrow();
  });

  it('gives each key pair its own fingerprint', () => {
    expect(keyFingerprint(keys.publicKeyPem)).toMatch(/^[0-9a-f]{64}$/);
    expect(keyFingerprint(keys.publicKeyPem)).not.toBe(keyFingerprint(otherKeys.publicKeyPem));
  });

  it('refuses a passphrase shorter than 12 characters', () => {
    expect(() => generateBackupKeys('short')).toThrow(/12 characters/);
  });
});

describe('sealSecret / openSecret', () => {
  it('round-trips a secret file', () => {
    const plain = Buffer.from('{"private_key":"k"}');
    const env = sealSecret(plain, PASS);
    expect(env).toMatchObject({ format: 'volley-skills-secret', version: 1 });
    expect(JSON.stringify(env)).not.toContain('private_key');
    expect(openSecret(env, PASS).equals(plain)).toBe(true);
  });

  it('refuses a wrong passphrase', () => {
    const env = sealSecret(Buffer.from('x'), PASS);
    expect(() => openSecret(env, 'wrong passphrase!')).toThrow();
  });

  it('refuses a passphrase shorter than 12 characters', () => {
    expect(() => sealSecret(Buffer.from('x'), 'short')).toThrow(/12 characters/);
  });
});
