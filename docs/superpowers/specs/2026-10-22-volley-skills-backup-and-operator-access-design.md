# Volley Skills — Backups and operator access

Date: 2026-10-22
Status: Approved in chat (2026-10-22)
Programme: `feature/club-platform`. Comes before the production migration and before Plan 3.

## 1. Intent

Production has no backup at all. Google's managed backups and point-in-time recovery need
billing, and the project stays on the free Spark plan (operator's decision, 2026-10-22). The
operator also holds production data in the clear: in the Firebase console, in a plain
service-account key on the laptop, and until 2026-10-22 in local dumps (now deleted).

This design gives production an encrypted backup that only the operator can open, a tested
restore, and a short list of controls so that the operator's own access is limited, logged
and written down. Club data stays readable at the infrastructure level, as in any hosted
service. GDPR asks for that access to be limited, purposeful and protected (Art. 28(3)(b),
Art. 32), not impossible (operator's decision, 2026-10-22; field-level encryption rejected).

### Goals
1. `backup.mjs`: a full, encrypted copy of production that misses no collection, keeps
   Firestore types, and logs counts only.
2. `restore.mjs`: checks a backup opens (`--check`), and restores it into the emulator
   (default) or production (typed confirmation). Tested on the emulator.
3. Backups that only the operator's private key can open. The backup command needs only the
   public key, so taking a backup never needs the passphrase.
4. The service-account key encrypted at rest; every production script asks for its passphrase.
5. Retention that matches the DPA: no backup lives past 35 days (pruned at 28 days by the
   weekly routine; see §3.4).
6. An operator security checklist and corrected legal-design text, so the DPA says what the
   system really does.

### Non-goals
- Google managed backups or point-in-time recovery (need billing).
- Scheduling. The operator runs the backup weekly and before every risky change.
- Partial restore (one club, one collection). Restore is the whole file; later if needed.
- Encrypting club data so that the operator cannot read it.

### Anti-goals
- A backup that misses a collection added later (so the walk is generic, not schema-based).
- A backup, log or error message that holds personal data in plain text.
- A DPA claiming backups that do not exist.
- A restore that can reach production by accident.

## 2. Decisions (operator, 2026-10-22)

| # | Decision |
|---|---|
| B1 | Stay on Spark. Backups are encrypted files produced by an Admin SDK script. |
| B2 | Files live on the operator's laptop (BitLocker on), with copies on an external drive. No cloud drive, so no new sub-processor. |
| B3 | The service-account key is encrypted with a passphrase; the plain file is deleted, and the key is rotated once in the Google Cloud console so any old plain copy stops working. |
| B4 | Operator access to club data stays possible at the infrastructure level, under controls (§5) and the DPA's operator access policy. |
| B5 | Local plain dumps of production in `.superpowers/prod-recon` were deleted (done 2026-10-22). |

## 3. Backup design

### 3.1 What is read
Every document in the database, found generically:
- `db.listCollections()` for the top level;
- per collection, `listDocuments()` (which also returns "missing" parents that only hold
  subcollections), then `getAll` in chunks of 100 for the data, then `listCollections()` on
  every document ref, recursively.

Cost is about 3 reads per document: about 700 reads for today's 235 documents, inside Spark's
50,000 a day. Scouting events grow this fast, so the walk stops, writing nothing, before it
spends more than `--max-reads` (default 20,000), leaving the rest of the day's quota to the
app. It is not a point-in-time snapshot: take it when the app is quiet.

### 3.2 Types
Data is encoded so a restore writes back the same Firestore types. A value with a special type
becomes a tagged object: `{"__fs":"timestamp","seconds","nanoseconds"}`, `{"__fs":"geopoint",
"latitude","longitude"}`, `{"__fs":"ref","path"}`, `{"__fs":"bytes","base64"}`. A real map
that happens to have a `__fs` key is wrapped as `{"__fs":"map","value":{...}}`. Arrays and maps
recurse.

### 3.3 Encryption
- Plain content is gzipped JSON: `{ format: 'volley-skills-backup', version: 1, projectId,
  createdAt, docs: [{ path, data }] }`.
- A fresh random AES-256-GCM key and 12-byte IV per file. The key is wrapped with the
  operator's RSA-4096 public key (OAEP, SHA-256).
- The envelope is JSON: `{ format, version, createdAt, projectId, keyId, wrappedKey, iv, tag,
  ciphertext }` (binary fields base64). `keyId` is the SHA-256 fingerprint of the public key.
  The header fields are bound into GCM as associated data, so tampering with them fails
  decryption.
- The public key is committed at `scripts/ops/backup-public-key.pem`. The private key is
  PKCS#8, encrypted with a passphrase (AES-256-CBC, Node's built-in key encryption), written
  outside the repo by `backupKeygen.mjs`. The operator keeps it and its passphrase in a
  password manager, plus an offline copy.
- Node's built-in `crypto` only. No new dependency.

### 3.4 Files and retention
- `--out <dir>` is required. The file name is `volley-skills-YYYY-MM-DDTHH-MM-SSZ.vsbackup`.
- After a backup is written and read back, files in `<dir>` matching that name pattern whose
  date in the name is more than 28 days old are deleted. Other files are never touched.
  `backup:prune --dir` applies the same rule to the external drive. Pruning runs weekly, so
  28 + 7 keeps every copy within the DPA's 35 days (review of 2026-10-22: 35-day retention
  with weekly pruning let files live about 42 days).
- `.gitignore` gets `*.vsbackup`, `serviceAccountKey.json.enc` and `*private-key*.pem`.

### 3.5 Logs
Counts per top-level collection, the total, reads used, the file name, its size and its
SHA-256. No document ids. No field values.

## 4. Restore design

- `restore.mjs --file <f> --key <private key file> --check` decrypts (asks for the
  passphrase) and prints the counts. It writes nothing. This is the regular "can I still open it" test.
- `restore.mjs --file <f>` writes every document into the emulator at 127.0.0.1:8080.
- `restore.mjs --file <f> --prod` writes into production. It refuses while
  `FIRESTORE_EMULATOR_HOST` is set and asks you to type the project id. It uses `set`, so it
  restores every backed-up document but does not delete documents created after the backup.
  The runbook says so. Write cost is one write per document (Spark: 20,000 a day), so a
  production restore stops after `--max-writes` (default 15,000) and continues the next day
  with `--from <n>`; an error mid-way prints the `--from` to resume at (documents are
  path-sorted, so the index is stable).
- The restore drill (backup, then restore into a fresh emulator database, then compare) runs
  as an emulator test in `tests/rules/`.

## 5. Operator access controls (checklist, `docs/SECURITY-OPERATIONS.md`)

1. 2-step verification or a passkey on the Google account that owns the Firebase project.
2. IAM: the operator alone is Owner. The deploy service account (GitHub secret
   `FIREBASE_SERVICE_ACCOUNT_VOLLEY_SKILLS`) has deploy roles only, with no Firestore data
   role, so a leaked CI secret cannot read club data.
3. The local service-account key is encrypted (B3), rotated once, and old keys are deleted in
   the console.
4. Firestore Data Access audit logs on (IAM & Admin, then Audit Logs, then Cloud Datastore API,
   with Data Read and Data Write). They record who read what, including the operator. Check in
   the console that Spark allows it; if it needs billing, write the gap down. The DPA names
   them only once they are on. Their entries hold document paths (member ids are emails), so
   they are personal data kept 30 days.
5. BitLocker on the laptop; the external drive encrypted too.
6. No plain copies of production on disk: scripts log counts only, and recon output stays
   counts only.
7. Operator access policy, written into the DPA: the operator reads club data only to run the
   service, on a club's documented request (support, restore), or when the law requires it;
   each such access is logged by the audit logs and noted in the club's status log.

## 6. Legal design corrections

`2026-10-20-volley-skills-legal-documents-design.md`:
- D4 changes "backups as Google provides" to: weekly encrypted backups (AES-256-GCM, operator's
  key), held on the operator's encrypted devices in the EU, deleted within 35 days of being
  taken; the operator access policy; data access audit logs only once verified on (§5 item 4).
- D8 changes the backup expiry text to: backups expire within 35 days of the end of processing.

`2026-10-20-volley-skills-club-platform-design.md`: the backups note points here.

## 7. Credential handling

- `scripts/lib/serviceAccount.mjs` exports `loadServiceAccount()`. It uses
  `serviceAccountKey.json.enc` and asks for the passphrase without echoing it. A plain
  `serviceAccountKey.json` still works, with a warning to encrypt it. With neither, it fails.
  Every production script uses it.
- `scripts/ops/encryptKey.mjs` encrypts the plain key: scrypt-derived key (N=2^15, r=8, p=1),
  AES-256-GCM. It asks for the passphrase twice (at least 12 characters), decrypts the
  result back and compares, then deletes the plain file.

## 8. What is left to the builder
- Module boundaries: pure crypto and encoding modules, with I/O cores and thin CLIs, as in
  Plan 4's scripts.
- Prompt helper details (hidden input on Windows terminals).
