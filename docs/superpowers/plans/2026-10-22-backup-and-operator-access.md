# Backups and Operator Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypted, restorable production backups on the free plan; the service-account key encrypted at rest; the operator access controls and the legal text corrected to match.

**Architecture:** Pure modules (crypto envelope, Firestore value encoding, file naming/retention) unit-tested with vitest; an I/O core (generic tree read, restore) tested on the emulator in `tests/rules/`; thin CLIs in `scripts/ops/`. Node built-in `crypto` and `zlib` only.

**Tech Stack:** Node 20 ESM scripts, firebase-admin, vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-volley-skills-backup-and-operator-access-design.md`

## Global Constraints

- Logs and errors carry counts, file names, sizes and hashes only: never document ids or field values.
- No new npm dependency.
- Retention: `RETENTION_DAYS = 35`.
- Envelope `format: 'volley-skills-backup'`, `version: 1`; file name `volley-skills-YYYY-MM-DDTHH-MM-SSZ.vsbackup`.
- RSA-4096 OAEP/SHA-256 key wrap; AES-256-GCM with header bound as AAD; private key PKCS#8 encrypted with `aes-256-cbc` and a passphrase of at least 12 characters.
- Secret files (service key): scrypt N=2^15, r=8, p=1, 16-byte salt; AES-256-GCM.
- Production writes need typed confirmation and refuse while `FIRESTORE_EMULATOR_HOST` is set.
- `.mjs` script tests: pure ones next to the code (`npm test`), emulator ones in `tests/rules/*.test.mjs` (`tsc -b` must not import `.mjs` from `.ts`).
- Never run anything against production; the operator runs `--prod`.

## Review Focus

1. A collection that no schema lists (new collection, orphan subcollection under a missing parent) must still be backed up and restored.
2. Timestamps, references, bytes and nested arrays of maps must restore to the same Firestore types, not to plain objects.
3. A wrong passphrase, the wrong private key, or a tampered header/ciphertext must fail loudly, never produce a partial restore.
4. Pruning must never delete a file that is not a backup by name, and never the backup just written.
5. Every production script must keep working once the plain key is gone (they all go through `loadServiceAccount`).

---

### Task 1: Crypto envelope (`scripts/ops/backupCrypto.mjs`)

**Produces:**
- `generateBackupKeys(passphrase: string) → { publicKeyPem, privateKeyPem }` (throws when passphrase < 12 chars)
- `keyFingerprint(publicKeyPem) → string` (hex SHA-256 of the DER SPKI)
- `sealBackup(plain: Buffer, publicKeyPem, { projectId, createdAt }) → envelope`
- `openBackup(envelope, privateKeyPem, passphrase) → Buffer`
- `sealSecret(plain: Buffer, passphrase) → { format: 'volley-skills-secret', version: 1, salt, iv, tag, ciphertext }`
- `openSecret(envelope, passphrase) → Buffer`

- [ ] Tests (`scripts/ops/backupCrypto.test.mjs`, keys generated once in `beforeAll`): round trip; envelope JSON does not contain a plaintext marker; wrong passphrase throws; another key pair's private key throws; changed `projectId`/`createdAt` throws; flipped ciphertext byte throws; `keyId` equals `keyFingerprint`; short passphrase refused; secret round trip; secret wrong passphrase throws.
- [ ] Run, watch fail; implement; run, pass; commit `feat(ops): encrypted backup envelope`.

### Task 2: Value encoding and file rules (`scripts/ops/firestoreJson.mjs`, `scripts/ops/backupFiles.mjs`)

**Produces:**
- `encodeData(data) → json`, `decodeData(json, db) → data` (tags in spec §3.2)
- `RETENTION_DAYS = 35`, `backupFileName(date) → string`, `backupDate(name) → Date | null`, `backupsToPrune(names, now) → string[]`

- [ ] Tests: Timestamp, GeoPoint, DocumentReference (db from `getFirestore(initializeApp({projectId}))`, no network), Buffer bytes, nested arrays of maps, null, a map with a real `__fs` key, all round-trip to equal values of the same class; file name format; `backupsToPrune` keeps day 35, prunes day 36, ignores non-matching names and other extensions.
- [ ] Run, fail, implement, pass; commit `feat(ops): backup value encoding and retention rules`.

### Task 3: I/O core (`scripts/ops/backupCore.mjs`)

**Produces:**
- `readEverything(db) → { docs: [{ path, data }], reads }` (generic walk, spec §3.1)
- `packBackup(docs, { projectId, createdAt, publicKeyPem }) → envelope` (encode, gzip, seal)
- `unpackBackup(envelope, privateKeyPem, passphrase, db) → { projectId, createdAt, docs }` (open, gunzip, check `format`/`version`, decode)
- `countsByCollection(docs) → { [topLevel]: n }`
- `restoreDocs(db, docs, { log }) → { written }` (reuses `writeAll`)

- [ ] Emulator test `tests/rules/backup.rules.test.mjs`: seed a club tree, a top-level collection no schema lists, an orphan `ghosts/missing/children/x` doc, a Timestamp and a reference; backup → clear → restore → every path and value equal (same types); counts by collection; a wrong passphrase rejects before any write.
- [ ] Run (scratch config on 8181), fail, implement, pass; commit `feat(ops): generic backup read and restore`.

### Task 4: Credentials and CLIs

**Produces:** `scripts/lib/prompt.mjs` (`askSecret(question)`, `confirmTyped` moves here and `cli.mjs` re-exports it), `scripts/lib/serviceAccount.mjs` (`ENC_KEY_PATH`, `PLAIN_KEY_PATH`, `loadServiceAccount({ dir = '.', ask = askSecret, warn = console.warn })`); CLIs `scripts/ops/backupKeygen.mjs --out <dir>`, `scripts/ops/backup.mjs --prod|--emulator --out <dir>`, `scripts/ops/restore.mjs --file f --key <private.pem> [--check] [--prod]`, `scripts/ops/encryptKey.mjs`; `prodDb()` becomes async and every caller awaits it; seed/backfill/export/snapshot scripts load the key through `loadServiceAccount`; npm scripts `backup`, `backup:keygen`, `backup:restore`, `key:encrypt`; `.gitignore` entries.

- [ ] Tests `scripts/lib/serviceAccount.test.mjs` (temp dir): encrypted file + right passphrase → key object; plain file → key + one warning; both → encrypted wins; neither → throws naming both files; wrong passphrase → throws.
- [ ] Run, fail, implement, pass. Smoke on the emulator: `backup.mjs --emulator` then `restore.mjs --check` with a throwaway key pair in the scratchpad. Commit `feat(ops): backup, restore and key CLIs; production scripts read the encrypted key`.

### Task 5: Docs and legal text

- [ ] `scripts/ops/README.md` (first-time setup: keygen, encrypt key, rotate key; weekly backup; check; restore; retention; external drive), `docs/SECURITY-OPERATIONS.md` (spec §5 checklist), legal spec D4/D8, club spec backups note, migration runbook step "take a backup and `--check` it" before the freeze, `CLAUDE.md` one paragraph, `docs/PRODUCTION-READINESS.md` item, `scripts/seed/README.md` key note.
- [ ] Full verification: `npm test`, rules tests, `npm run build`, `npm run lint`. Commit `docs: backups, restore and operator security`.
