# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web app for **Volley Club Belair (VCB)** that replaces a per-player spreadsheet
(`reference/VCB_U17_PlayerCards_2026-27.xlsx`) with a tool to manage teams, player
profiles (skills + development plans + physical testing), a club-wide
exercise/training library (with a court-diagram builder per exercise), and
per-team training calendars. **Single club, not multi-tenant.** Players are
minors, and guardian contact data is stored — this drives the consent/privacy
requirements.

The authoritative specs live in `docs/superpowers/`:

| Doc | Covers |
|---|---|
| `specs/2026-09-04-volley-skills-app-design.md` | Product scope, **Firestore data model**, authorization model, screen list, fetching rules, migration, compliance. Read this before touching data shapes or rules. |
| `specs/2026-09-04-volley-skills-design-system.md` | **Design system** — color tokens, typography (Inter), spacing/radius/elevation, status vocabulary, component specs. The source of truth for any UI work. |
| `specs/2026-09-07-volley-skills-plan-2-design.md`, `plan-3-design.md` | Design detail for later plan increments. |
| `plans/*.md` | The phased implementation plans (foundation, plan 2, plan 3 calendar + library). |

## Commands

```bash
npm run dev              # Vite dev server (talks to real Firebase unless VITE_USE_EMULATOR=true)
npm run dev:emulator     # one command: boot Auth+Firestore emulators, seed, start Vite, tear down on Ctrl+C
npm test                 # vitest run — all unit + component tests
npm run test:watch       # vitest watch mode
npm run test:rules       # Firestore security-rules tests (spins up the Firestore emulator via firebase emulators:exec)
npm run lint             # eslint . --ext ts,tsx
npm run build            # tsc -b && vite build (typecheck is part of the build)
```

Run a single test file / test:

```bash
npx vitest run src/players/skillMath.test.ts
npx vitest run -t "computes the average"
```

Rules tests are **not** picked up by `npm test` (excluded in `vite.config.ts`); they
run only via `npm run test:rules`, use a separate `vitest.rules.config.ts`, need a
JDK 21+ for the emulator, and are forced to run serially (`fileParallelism: false`)
because all files share one emulator project.

### Emulator / seeding

`scripts/seed/README.md` is the full guide. Key points:

- `npm run emulator` auto-locates a JDK 21+ (no `JAVA_HOME` needed) and starts Auth
  (:9099), Firestore (:8080), Emulator UI (:4000).
- `npm run seed:emulator` writes one team, `skillGuide/config`, and 20 player docs
  from the gitignored `.xlsx`. Emulator is in-memory — re-seed after every restart.
- The Auth emulator prints the email sign-in link to its console (no email is sent).
- Prod seeding (`node scripts/seed/seed.mjs --prod`) needs a gitignored
  `serviceAccountKey.json` at the repo root and is guarded to run once.

## Architecture

**Stack:** React 18 + TypeScript + Vite, Tailwind CSS, React Router v7
(`BrowserRouter` — clean URLs, so hosting needs SPA rewrites), Firebase Auth
(passwordless email-link), Firestore. **No Cloud Functions** — the app stays on
Firebase's free Spark plan, so *all* authorization is enforced in Firestore
Security Rules (`firestore.rules`).

### Feature-folder layout

`src/<feature>/` groups everything for a feature: components, dialogs, and a
`<feature>Api.ts` data-access module (e.g. `src/teams/teamsApi.ts`,
`src/players/playersApi.ts`). Shared primitives are in `src/components/`,
`src/layout/`, `src/theme/`. All Firestore document types live in `src/types/`.
`src/firebase/config.ts` is the single place the SDK is initialized and the only
place the emulator connection is wired (`import.meta.env.DEV &&
VITE_USE_EMULATOR === 'true'`).

### Data access pattern

`<feature>Api.ts` modules own all Firestore reads/writes and return plain typed
objects (`{ id, ...data } as Team`). Components never call `firebase/firestore`
directly. Writes use `serverTimestamp()`; computed fields (`avgScore`/`level` on a
player, training `businessId`) are derived on write, not in the UI.

### Fetching discipline (app design spec §8)

No view does an unbounded collection read. Libraries (exercises, trainings) and
history timelines use `orderBy(...).limit(N)` + cursor pagination
(`startAfter(lastDoc)`) — never offset paging. Filters are `where()` clauses on the
same limit+cursor query, backed by composite indexes in
`firestore.indexes.json`. The calendar queries only the visible month's date
range. Physical-testing "latest per quality" is up to 8 tiny `limit(1)` queries,
not a subcollection scan. **When adding a query, add the matching index.**

### Auth & routing

`src/App.tsx` wraps everything in `AuthProvider`; `RequireAuth` gates the
authenticated shell and `RequireAdmin` gates `/exercises`, `/trainings`,
`/exercises/:exerciseId/diagram` (the lazy-loaded court-diagram editor),
`/admin/guides`. Two roles: `admin` (full management) and `viewer` (read-only,
single player card — invite flow is still TBD, so only `admin` works end to end).
A user's role is set on their `users/{uid}` doc on first sign-in; `role: 'admin'`
is only accepted if their email is in `adminAllowlist/{email}` (enforced in rules;
that collection is never client-readable).

### Firestore model shape (see spec §5 for the full contract)

Team-scoped: `teams/{teamId}` → `players/{playerId}` → `physicalTests/{testId}`,
plus `teams/{teamId}/calendar/{sessionId}`. Club-global: `exercises/{id}`
(+ an ordered `exercises/{id}/diagrams/{diagramId}` subcollection of court
diagrams — admin-only, no index), `trainings/{id}` (+ `counters/trainings` for
transactional `businessId`), `skillGuide/config`, `physicalTestGuide/config`.
Access is email-keyed (`adminEmails`, `viewerEmails`) rather than uid-keyed so
granting access needs no uid lookup. Player docs denormalize
`teamName`/`ageGroup`/`season` so a viewer never needs to read the team doc.
Dates are ISO `"YYYY-MM-DD"` strings (calendar, physical tests) to allow
lexicographic range queries — not `Timestamp`.

Any rules change must be covered by a test in `tests/rules/` — those tests are the
real verification of the security boundary.

### Design system

The 8 skills and the 1–10 scale are **hardcoded**; admins edit only the guide
*text* per score range. Level bands: `avgScore < 4` Beginner, `< 6` Developing,
`< 8` Advanced, else Elite — the same four colors (`red`/`orange`/`blue`/`green`)
reused everywhere a level appears. Tailwind tokens (`navy`, `blue`, `orange`,
`green`, `ink`, radius `sm/md/lg`, shadow `card/pop`) come from the design-system
spec §8 and live in `tailwind.config.js`. Inter is self-hosted via
`@fontsource/inter`; numeric columns/stats use `tabular-nums`. Icons: `lucide-react`.
Dark mode is specified but MVP ships light-first.

## Conventions

- TypeScript `strict`, plus `noUnusedLocals`/`noUnusedParameters` — unused symbols
  fail the build.
- Tests sit next to the code they cover (`skillMath.ts` / `skillMath.test.ts`).
- Testing priority (spec §13): rules tests first, then pure-logic unit tests
  (skill math, `businessId` sequencing, physical-test computations), then component
  tests for the critical forms (player card edit, skill guide edit, training builder).
- No third-party analytics or tracking scripts — minors' data.
- Never commit `serviceAccountKey.json`, `.env.local`, or `reference/` (all gitignored).
