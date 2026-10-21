# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **club-agnostic** web app for volleyball clubs that replaces a per-player spreadsheet
(the original was `reference/VCB_U17_PlayerCards_2026-27.xlsx`, used only for seeding)
with a tool to manage teams, player profiles (skills + development plans + physical
testing), a club-wide exercise/training library (with a court-diagram builder per
exercise), and per-team training calendars. **One deployment serves one club, not
multi-tenant** — but no club name is hardcoded: UI, metadata and award cards stay
generic, and a club's name only appears where it comes from data (`team.club`).
Internal localStorage keys keep their historical `vcb.` prefix (renaming would wipe
users' saved settings). Players are
minors, and guardian contact data is stored — this drives the consent/privacy
requirements.

The authoritative specs live in `docs/superpowers/`:

| Doc | Covers |
|---|---|
| `specs/2026-09-04-volley-skills-app-design.md` | Product scope, **Firestore data model**, authorization model, screen list, fetching rules, migration, compliance. Read this before touching data shapes or rules. |
| `specs/2026-09-04-volley-skills-design-system.md` | **Design system** — color tokens, typography (Inter), spacing/radius/elevation, status vocabulary, component specs. The source of truth for any UI work. |
| `specs/2026-09-07-volley-skills-plan-2-design.md`, `plan-3-design.md` | Design detail for later plan increments. |
| `specs/2026-10-13-volley-skills-scouting-design.md` | Match scouting: event-sourced live scouting, match/event data model, post-match report, offline behavior. |
| `specs/2026-10-14-volley-skills-home-stats-awards-design.md` | Home dashboard (`/`), team stats tab, season/match awards cards, 404 + SEO (`noindex` everywhere except `/login`, `/privacy`, `/request-access`). |
| `specs/2026-10-20-volley-skills-club-platform-design.md` | **Multi-club platform** (in design, branch `feature/club-platform`): `clubs/{clubId}` root, self-service sign-up, club lifecycle, platform admin, export, legal acceptance. Read before adding any new top-level collection. |
| `specs/2026-10-20-volley-skills-legal-documents-design.md`, `-italian-design.md`, `-dvw-import-design.md` | Terms/DPA/sub-processors, Italian translation, DataVolley `.dvw` import — same programme. |
| `docs/research/` | Pricing/competitor and legal research behind those designs (not legal advice). |

Implementation plans are written per increment to `docs/superpowers/plans/` and deleted once built (git history keeps them); the specs stay the source of truth.

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
- `npm run seed:match` adds a season of 10 finished matches, a finished demo match and a live one to the seeded team, then writes their summaries (`backfillSummaries.ts`, via vite-node) so the Stats tab and awards have data.
- The Auth emulator prints the email sign-in link to its console (no email is sent).
- Prod seeding (`node scripts/seed/seed.mjs --prod`) needs a gitignored
  `serviceAccountKey.json` at the repo root and is guarded to run once.

## Architecture

**Stack:** React 18 + TypeScript + Vite, Tailwind CSS, React Router v7
(`BrowserRouter` — clean URLs, so hosting needs SPA rewrites), Firebase Auth
(passwordless email-link), Firestore. **No Cloud Functions** — the app stays on
Firebase's free Spark plan, so *all* authorization is enforced in Firestore
Security Rules (`firestore.rules`).

**AI features** talk to any OpenAI-compatible endpoint through a provider-agnostic
client (`src/ai/aiClient.ts`, every request capped by `AI_MAX_TOKENS`). Settings
live in localStorage, the key in sessionStorage unless the coach opts to remember
it (`src/ai/aiSettings.ts`). Text scouting (`src/matches/text/`) strips player
names to jersey numbers before sending (`textScout.ts`); merges are `source: 'text'`
events sharing a `chunkId`. AI drafting (`src/aiDraft/`) sends only the request and
club-library exercise text, runs model output through the same validators as JSON
import (`parseScene`), and saves through the normal `*Api.ts` writes.

**Awards story** (`src/awards/`) is a canvas-rendered, Wrapped-style presentation:
`story/buildStory.ts` decides the slides, `card/drawSlide.ts` (`renderStoryFrame`)
draws any slide at any time for the live show, PNGs and the recorded video.
Background removal (`cutout/segment.ts`) runs MediaPipe on the device; its WASM
is copied to `public/mediapipe/` by a Vite plugin and the model lives in
`public/models/` — both same-origin, which is why CSP `script-src` has
`'wasm-unsafe-eval'`. Photos and cut-outs are memory-only and consent-gated.

**Training PDF** (`src/trainings/pdf/`): `buildTrainingPdf.ts` is a pure pdfmake
doc definition (cover with the session plan, then one page per unique exercise);
diagrams go in as vector SVG via `diagramToPdfSvg.ts` (theme CSS variables inlined
to light colours). `pdfmake` + fonts load only through the dynamic import in
`TrainingViewSheet`, and sharing is two taps ("Share PDF" builds, "Share PDF ready"
opens the share sheet) because browsers only allow `navigator.share` right after a tap.
Opened from a team calendar session (`/trainings?businessId=…&team=…&session=…`), the
export first asks for team notes (`TeamNotesDialog`): expected players with name,
position, level and a per-player note go on a "Team notes" page. That is the only
player data the PDF carries, by club decision. Roboto lacks arrow glyphs, so
`fontSafe` swaps them for ›/‹ in every printed string.

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
directly. Firestore uses a persistent local cache (`initializeFirestore` +
`persistentLocalCache`, multi-tab) so offline writes survive reloads; scouting event
writes are therefore never awaited. Writes use `serverTimestamp()`; computed fields (`avgScore`/`level` on a
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
authenticated shell, `RequireSuperAdmin` gates `/admin/access`, and
`RequireSection` (given a `section` prop) gates `/exercises`,
`/exercises/:exerciseId/diagram` (the lazy-loaded court-diagram editor),
`/trainings`, `/admin/guides`. `/` is the home dashboard and the `*` catch-all is the 404 page. Match pages live at `/teams/:teamId/matches/:matchId`;
the lazy-loaded full-screen scouting UI is `/teams/:teamId/matches/:matchId/scout`
(outside `AppShell`); the lazy full-screen awards routes (`/teams/:teamId/awards`,
`/teams/:teamId/matches/:matchId/awards`) are also outside `AppShell` and team-admin only.
Two roles: `superadmin` (full access to
everything) and `member` (read-only until granted access — invite flow for
guardians/viewers is still TBD). A member's actual access is resolved per-team
(email ∈ `teams/{id}.adminEmails`) and per-section (email ∈
`sectionAccess/{exercises,trainings,guides}.adminEmails`) via
`useAuth().access` (`src/auth/access.ts`). A user's role is set on their
`users/{uid}` doc on first sign-in; `role: 'superadmin'` is only accepted if
their email is in `adminAllowlist/{email}` (enforced in rules; that collection
is never client-readable). See
`docs/superpowers/specs/2026-09-11-volley-skills-access-model.md` for the full
model.

### Firestore model shape (see spec §5 for the full contract)

Team-scoped: `teams/{teamId}` → `players/{playerId}` → `physicalTests/{testId}`,
plus `teams/{teamId}/calendar/{sessionId}`, `teams/{teamId}/matches/{matchId}` →
`events/{eventId}` (ordered by `order`; all match state is derived by pure replay in
`src/matches/scoutEngine.ts`) `teams/{teamId}/scoutProfile/usage`, `teams/{teamId}/awards/season` and `matches/{id}.awards` (coach award choices; photos are never stored). Club-global: `exercises/{id}`
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
Dark mode ships: tokens are CSS variables per theme in `src/index.css`, so components never use `dark:` variants. Page titles come from `PageHeader` (`text-title`); success feedback goes through `useNotify()` (`src/components/Notice.tsx`), errors stay inline with `role="alert"`.

## Conventions

- TypeScript `strict`, plus `noUnusedLocals`/`noUnusedParameters` — unused symbols
  fail the build.
- Tests sit next to the code they cover (`skillMath.ts` / `skillMath.test.ts`).
- Testing priority (spec §13): rules tests first, then pure-logic unit tests
  (skill math, `businessId` sequencing, physical-test computations), then component
  tests for the critical forms (player card edit, skill guide edit, training builder).
- No third-party analytics or tracking scripts — minors' data.
- Never commit `serviceAccountKey.json`, `.env.local`, or `reference/` (all gitignored).
