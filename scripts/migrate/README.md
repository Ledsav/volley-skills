# Migrations and club operations

Admin SDK scripts. Anything that touches production needs the encrypted service-account
key (`serviceAccountKey.json.enc`, see `scripts/ops/README.md`) and asks for its passphrase,
so run them in your own terminal. They log ids and counts only, never player or
guardian data.

## Club platform migration (one-off)

`2026-10-club-platform.mjs` moves the single-club production data (top-level `teams`,
`exercises`, `trainings`, `counters`, `skillGuide`, `physicalTestGuide`, `sectionAccess`,
`adminAllowlist`) under `clubs/<id>`. Ids are preserved and emails are lowercased.
Spec: `docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md` §9.

It creates:
- the club doc (active, AI and growth tests on, `legal: null`);
- the member docs: allowlist emails and the owner become admins, and everyone in a
  team's `adminEmails`, a player's `viewerEmails` or `sectionAccess` becomes a member;
- `platformAdmins/<operator>`.

It also drops `role` from `users` docs.

The arguments used below:
- `<id>` is the club's app-made id: 20 letters and digits, the same format sign-up gives a
  new club. Generate it once, write it down, and use the same one in every step:

  ```bash
  node -e "const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',b=require('crypto').randomBytes(20);console.log([...b].map(x=>c[x%62]).join(''))"
  ```
- `<officer>` is the club admin who accepts the Terms and DPA for the club (president,
  secretary or technical director). It may be the operator for the operator's own club:
  one account with roles.
- `<you>` is your own operator email.

### Read and write quotas

The Spark plan allows 50,000 reads and 20,000 writes a day, and that budget is shared
with everyone using the live app. Each pass over production (the dry run, the
rehearsal and the production run) costs about one read per legacy doc; the dry run
prints the figure. If that figure is large (more than about 10,000), do the dry run
and the rehearsal on one day and the production run on another, so the app never
runs out of reads.

### Runbook

1. **Dry run.** It reads production and writes nothing; no emulator is needed:

   ```bash
   node scripts/migrate/2026-10-club-platform.mjs --rehearse --dry-run \
     --club <id> --owner <officer> --operator <you> --country <XX>
   ```

   Check the counts, the club name (pass `--name "..."` to override it) and the reads.

2. **Rehearse into the local emulator.** Start it with `npm run emulator`, then run the
   same command without `--dry-run`. Start the app with `VITE_USE_EMULATOR=true npm run dev`.
   Sign in as the owner and as a coach, and check teams, players, matches, the library
   and `/club`. The emulator now holds production personal data, so stop it when you
   are done (it is in-memory).
3. **Freeze and back up.** Tell the club not to use the app until step 5 is done. Take a
   backup and check that it opens (`scripts/ops/README.md`): it is the way back if the
   migration goes wrong. Docs changed after they are copied are not copied again.
   During the freeze, deploy the indexes
   first, so the new "find my clubs" index is built before the new app needs it
   (indexes only add; the old app is unaffected):

   ```bash
   npx firebase deploy --only firestore:indexes --project volley-skills
   ```

   Wait until the console shows every index as enabled.
4. **Migrate production.** Run with `--prod --dry-run`, then with `--prod`. It asks you
   to type the club id, and exits non-zero if the verified counts fall short.
   - If the run stops on the write quota (20,000 a day), run it
     again the next day with `--resume` added, which skips docs that already exist.
     Keep the freeze until it finishes.
5. **Deploy.** Merge the branch to `main`: `deploy.yml` deploys the rules and the app
   together. On their first load, devices clear their old offline cache once
   (`vcb.schemaVersion`, `src/firebase/schemaVersion.ts`).
6. **Check.** Sign in to production as the owner and as a coach.
7. **After 14 days, drop the old collections:**

   ```bash
   node scripts/migrate/dropLegacy.mjs --prod --club <id>
   ```

   It refuses before the grace period ends. It prints the counts and asks you to type
   `delete legacy`. It never touches `users`, `interestSignups`, `platformAdmins` or
   `clubs`.

`legal` stays `null` until Plan 3 ships the review screen. The owner accepts the Terms
and DPA then.

## Purging an ended club

```bash
node scripts/ops/purgeClub.mjs --club <id> --prod   # or --emulator (default)
```

It runs only when one of these is true:
- the club is `terminating` and its export window (`retrievalEndsAt`) has passed;
- the club is `deleted`, that is rejected while pending.

It asks you to type the club id. It then deletes every subcollection (members, teams,
players, matches, library, config, section access) except `acceptances` and
`statusLog`. The club doc becomes a tombstone: `name`, `country`, `ownerEmail`,
`createdAt`, `status: 'deleted'`, `statusChangedAt` and `legal`. A "Data purged" entry
is added to `statusLog`.

Firebase Auth accounts are not touched, because a person may belong to other clubs.
Keep the printed summary for your records.

## Older scripts

`2026-09-11-section-access.mjs` is superseded by the club platform migration, which
reads `adminAllowlist`, team `adminEmails` and `sectionAccess` directly.
