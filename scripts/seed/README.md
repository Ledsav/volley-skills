# Roster migration seeder

Implements app design spec §9: a one-time script that imports the club's
`VCB_U17_PlayerCards_2026-27.xlsx` spreadsheet into Firestore as one team,
the `skillGuide/config` doc, and 20 player docs.

- `parseWorkbook.mjs` — pure parser: `.xlsx` → `{ team, skillGuide, players }` shaped
  to the data model in spec §5. No Firebase, no network.
- `seed.mjs` — writer. Uses the Firebase **Admin SDK** (bypasses security rules,
  as a migration should).
- `parseWorkbook.test.mjs` — unit tests for the parser (the full-workbook case is
  skipped when the gitignored `.xlsx` isn't present).

Imported players get `consent: { given: false }` — the spreadsheet predates the
app's consent flow, so an admin must confirm consent per player in the app after
import. Skill scores / notes / development-plan fields import as empty unless the
workbook has them filled.

The script logs **counts only** — never player or guardian field values.

## Prerequisites

- `reference/VCB_U17_PlayerCards_2026-27.xlsx` present (it is **gitignored** — it
  holds minors' contact data; keep it local, never commit it). Override the path
  with `--file <path>`.
- Emulator target: a JDK **21+** installed somewhere (the Firestore emulator
  needs it). `npm run emulator` locates it automatically — it checks `JAVA_HOME`,
  then the usual install dirs (Adoptium, Microsoft, Corretto, Zulu, `/usr/lib/jvm`,
  …), then `java` on `PATH` — so you do **not** need `JAVA_HOME` set. If none is
  found it prints a Temurin download link.
- Prod target: `serviceAccountKey.json` at the repo root (**gitignored**) —
  download it from the Firebase console → Project settings → Service accounts →
  "Generate new private key".

## Seed the emulator

Two terminals:

```bash
# terminal 1 — start a local Firestore emulator (in-memory, stays running)
npm run emulator

# terminal 2 — seed it
npm run seed:emulator
```

`npm run emulator` prints which JDK it picked, then starts Firestore (:8080) and
the Emulator UI (:4000, or the next free port). `seed:emulator` needs no Java —
it just talks to the running emulator over the wire.

`seed:emulator` runs `node scripts/seed/seed.mjs --emulator --reset`:

- connects to `127.0.0.1:8080` via `FIRESTORE_EMULATOR_HOST` (no credentials),
- `--reset` first deletes any team previously written by this script (so re-running
  is safe and doesn't pile up duplicates),
- writes the team with `adminEmails: ["coach@example.com"]`. To sign in as
  yourself instead:

  ```bash
  node scripts/seed/seed.mjs --emulator --reset --admin you@example.com
  # or: export SEED_ADMIN_EMAIL=you@example.com   (then `npm run seed:emulator`)
  ```

The emulator is in-memory: restart `npm run emulator` and re-run
`npm run seed:emulator`. (Disk persistence via `--import`/`--export-on-exit` works
on Linux/macOS — add those flags to the `emulator` script — but currently fails
with `EPERM` on this Windows box.)

Inspect the seeded data at the Emulator UI (`http://127.0.0.1:4000`, or the next free port) while
`npm run emulator` is running.

## Seed production

```bash
node scripts/seed/seed.mjs --prod --admin coach@realclub.example --yes
# npm run seed:prod  ==  node scripts/seed/seed.mjs --prod   (then add --admin / --yes yourself)
```

Guards (all must pass):

1. `serviceAccountKey.json` exists at the repo root.
2. `--admin <email>` is given (the real team admin who will sign in). No default.
3. `--yes` is given, or you type `seed` at the confirmation prompt.
4. The `teams` collection is **empty**. To seed a project that already has teams,
   add `--force` (it appends another team; it never edits or deletes existing data).

The script prints the target project id (from the key file) before writing. Run it
**once**.

## What gets written

| Path | Contents |
|---|---|
| `teams/{autoId}` | `name` (age group), `club`, `ageGroup`, `season`, empty `description`/`notes`, empty `developmentPlan`, `adminEmails: [<--admin>]`, `createdBy: "seed-script"`, `createdAt` |
| `skillGuide/config` | `skills[8]` — each `{ key, label, ranges[4], howToEvaluate }`, `updatedBy: "seed-script"`, `updatedAt` |
| `teams/{teamId}/players/{autoId}` ×20 | contact fields, `guardians[]`, `viewerEmails: []`, denormalized `teamName`/`ageGroup`/`season`, `skills` (per spec), `avgScore`/`level` (computed; `null` when unscored), `developmentPlan`, `consent: { given: false, date: null, confirmedBy: null }`, `createdBy: "seed-script"`, `createdAt`, `updatedAt` |
