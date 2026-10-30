# Operations: backups, restore, the service-account key

Design: `docs/superpowers/specs/2026-10-22-volley-skills-backup-and-operator-access-design.md`.
The operator's security checklist is in `docs/SECURITY-OPERATIONS.md`.

Run these from the repo root **in your own terminal** (PowerShell or Windows Terminal). They
ask for passphrases and fail when they get no keyboard input. Check that a passphrase is
not echoed as you type the first time: some Git Bash windows cannot hide it. They print
counts, file names, sizes and hashes only, never personal data.

## First-time setup (once)

1. **Encrypt the service-account key.** With `serviceAccountKey.json` at the repo root:

   ```bash
   npm run key:encrypt
   ```

   This writes `serviceAccountKey.json.enc` (gitignored) and deletes the plain file. From
   then on, every production script asks for this passphrase. Store the passphrase in
   your password manager.

2. **Rotate the key**, so that no old plain copy works any more. In the Google Cloud
   console, open IAM & Admin, then Service accounts, then the
   `firebase-adminsdk-…@volley-skills.iam.gserviceaccount.com` account, then Keys:
   1. Add key, then Create new key, as JSON. Save it at the repo root as
      `serviceAccountKey.json`.
   2. Delete `serviceAccountKey.json.enc`, then run `npm run key:encrypt` again.
   3. Back in the console, delete every older key of that account.

   Leave the GitHub deploy account (the `FIREBASE_SERVICE_ACCOUNT_VOLLEY_SKILLS` secret)
   alone. It is a different account; see `docs/SECURITY-OPERATIONS.md`.

3. **Create the backup key pair:**

   ```bash
   npm run backup:keygen -- --out <folder outside the repo>
   ```

   - The private key, encrypted with a new passphrase, goes to
     `<folder>/volley-skills-backup-private-key.pem`. Put the file and its passphrase in
     your password manager, and keep one more offline copy, for example on the external
     drive. **Without them no backup can ever be opened.**
   - The public key goes to `scripts/ops/backup-public-key.pem`. Commit it: taking a
     backup needs only this key, never a passphrase.

## Weekly, and before every risky change

Risky changes include the migration, a rules deploy and a bulk script.

```bash
npm run backup -- --prod --out <backup folder>
npm run backup:restore -- --file <backup folder>/<new file> --key <private key> --check
npm run backup:prune -- --dir <external drive folder>
```

- **The backup** reads every document (about 3 reads each, so about 700 for today's
  production) and writes `volley-skills-<time>.vsbackup`. It reads the file back, then
  deletes backups in that folder older than **28 days**. With a weekly routine, no copy
  lives past the 35 days the DPA states.
- **Take it when the app is quiet** (evening). It is not a point-in-time snapshot: a
  match scouted during the backup can be caught half-way.
- **Read budget.** The backup stops, writing nothing, before it spends more than
  `--max-reads` (default 20,000 of Spark's 50,000 a day, which the live app shares). It
  prints the reads it used; watch that figure grow as matches are scouted (hundreds of
  events each). When it nears the budget, raise `--max-reads` on a quiet day, or move to
  Google's managed backups (billing) for good.
- **The check** opens the file and prints the counts and the key id, which should match
  the backup's. It writes nothing.
- **Copy the new file to the external drive, then prune it** (the third command), so the
  copies there expire on the same rule.

The backup folder must be outside the repo. Keep it on the laptop's encrypted disk
(BitLocker), not in a synced cloud folder: a cloud drive would be a new sub-processor
in the DPA.

### The routine in one command, and the scheduled task

```bash
npm run backup:weekly
```

Asks for the key passphrase, backs up into `%USERPROFILE%\volley-backups`, then copies the
new file to every other drive with a `\volley-backups` folder at its root (create that
folder once on the BitLocker external drive) and prunes the copies there. Run the
`--check` above by hand now and then: it needs the private key.

A Windows scheduled task can open that window every Sunday at 21:00 (or at the next
sign-in if the laptop was off). It is registered **disabled**:

```bash
npm run backup:task                 # state
npm run backup:task -- -Enable      # switch it on
npm run backup:task -- -Disable     # switch it off
npm run backup:task -- -Register    # recreate it (disabled), e.g. on a new laptop
```

It runs only while you are signed in, because the passphrase is typed, never stored.

## Restore

```bash
# Into the local emulator, to look at the data or rehearse (start it with npm run emulator):
npm run backup:restore -- --file <f> --key <private key>

# Into PRODUCTION, after a loss:
npm run backup:restore -- --file <f> --key <private key> --prod
```

- A restore writes every backed-up document with `set`, one write each. Documents
  created after the backup are left in place. Documents deleted after the backup come back.
- **Write quota.** Spark allows 20,000 writes a day, shared with the app. A production
  restore stops after `--max-writes` (default 15,000) and prints `--from <n>`: run the same
  command with that flag the next day. If it stops on an error, it prints the `--from` to
  continue with too. Keep the app frozen until the restore is complete.
- `--prod` accepts only a production backup. It refuses while `FIRESTORE_EMULATOR_HOST`
  is set, and asks you to type `volley-skills`.
- An emulator restore holds production personal data. Stop the emulator when you are
  done (it is in-memory).

## Purging an ended club

See `scripts/migrate/README.md`, Purging an ended club. Backups taken before the purge
expire within 35 days, as the DPA says, provided the weekly routine (backup and prune)
keeps running. If you stop taking backups, delete the old files by hand.

## Checking stored data against the size caps

The size caps (`src/types/limitValues.js`, repeated in `firestore.rules`) refuse a save of any
document with a field over its cap, even a save that does not touch that field. Before the caps
are deployed (merging `feature/input-limits`), check that no production document is already over
one:

```bash
node scripts/ops/checkLimits.mjs --prod
```

- It asks for the service-account key passphrase, like the other production scripts, and
  refuses while `FIRESTORE_EMULATOR_HOST` is set.
- It only reads: every team, player, physical test, calendar session, match, award, scouting
  usage profile, exercise, training, guide and section-access document of every club, once
  each (about one read per document; `--max-reads`, default 20,000, stops it before more).
  It never reads match events, members or club profiles. `--club <id>` checks one club.
- It prints, per club, each cap with the largest value found and, for a cap that is exceeded,
  how many documents are over it and their paths (at most 20 per cap). It never prints a field
  value or a name.
- Exit code 0: everything is within the caps. Exit code 1: something is over a cap (or the run
  failed; the message says which). Fix those documents in the app, or raise the cap in
  `limitValues.js` and `firestore.rules` together, before deploying.
- `--emulator` runs the same check against the local emulator.

Match events are not checked: the app writes them with ids and enums only, far below their caps.
