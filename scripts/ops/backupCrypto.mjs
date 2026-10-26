// Encryption for production backups and the service-account key (backup design §3.3, §7).
// Node's built-in crypto only. Backups are sealed with the operator's PUBLIC key, so taking
// one needs no secret; opening one needs the private key and its passphrase. Secret files
// (the service-account key) are sealed with a passphrase alone.
import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  scryptSync,
} from 'node:crypto';

export const MIN_PASSPHRASE = 12;
const BACKUP_FORMAT = 'volley-skills-backup';
const SECRET_FORMAT = 'volley-skills-secret';
const VERSION = 1;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };
// Full 16-byte tags only: a shortened tag is easier to forge.
const GCM = { authTagLength: 16 };

function checkPassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE) {
    throw new Error(`The passphrase must be at least ${MIN_PASSPHRASE} characters.`);
  }
}

const b64 = (buf) => buf.toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64');

/** A new RSA-4096 key pair; the private key comes out encrypted with `passphrase`. */
export function generateBackupKeys(passphrase) {
  checkPassphrase(passphrase);
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

/** Hex SHA-256 of the public key (DER SPKI): names the key a backup was sealed for. */
export function keyFingerprint(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(der).digest('hex');
}

// The header fields every backup binds into the GCM tag: changing one fails the open.
const backupAad = (h) => Buffer.from(JSON.stringify([h.format, h.version, h.createdAt, h.projectId, h.keyId]));

/** Encrypts `plain` for the holder of the private key matching `publicKeyPem`. */
export function sealBackup(plain, publicKeyPem, { projectId, createdAt }) {
  const header = { format: BACKUP_FORMAT, version: VERSION, createdAt, projectId, keyId: keyFingerprint(publicKeyPem) };
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
  cipher.setAAD(backupAad(header));
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return {
    ...header,
    wrappedKey: b64(publicEncrypt({ key: publicKeyPem, ...OAEP }, dataKey)),
    iv: b64(iv),
    tag: b64(cipher.getAuthTag()),
    ciphertext: b64(ciphertext),
  };
}

/** The content of a sealed backup. Throws on a wrong key or passphrase, or any change to the file. */
export function openBackup(envelope, privateKeyPem, passphrase) {
  if (envelope?.format !== BACKUP_FORMAT || envelope.version !== VERSION) throw new Error('Not a volley-skills backup (version 1).');
  const dataKey = privateDecrypt({ key: privateKeyPem, passphrase, ...OAEP }, unb64(envelope.wrappedKey));
  const decipher = createDecipheriv('aes-256-gcm', dataKey, unb64(envelope.iv), GCM);
  decipher.setAAD(backupAad(envelope));
  decipher.setAuthTag(unb64(envelope.tag));
  return Buffer.concat([decipher.update(unb64(envelope.ciphertext)), decipher.final()]);
}

/** Encrypts a small secret file with a passphrase (scrypt + AES-256-GCM). */
export function sealSecret(plain, passphrase) {
  checkPassphrase(passphrase);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(passphrase, salt, 32, SCRYPT), iv);
  cipher.setAAD(Buffer.from(SECRET_FORMAT));
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { format: SECRET_FORMAT, version: VERSION, salt: b64(salt), iv: b64(iv), tag: b64(cipher.getAuthTag()), ciphertext: b64(ciphertext) };
}

/** The content of a sealed secret. Throws on a wrong passphrase or a changed file. */
export function openSecret(envelope, passphrase) {
  if (envelope?.format !== SECRET_FORMAT || envelope.version !== VERSION) throw new Error('Not a volley-skills secret file (version 1).');
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(passphrase, unb64(envelope.salt), 32, SCRYPT), unb64(envelope.iv), GCM);
  decipher.setAAD(Buffer.from(SECRET_FORMAT));
  decipher.setAuthTag(unb64(envelope.tag));
  return Buffer.concat([decipher.update(unb64(envelope.ciphertext)), decipher.final()]);
}
