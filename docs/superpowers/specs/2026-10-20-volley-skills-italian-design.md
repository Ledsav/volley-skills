# Volley Skills — Italian translation

Date: 2026-10-20
Status: Design — awaiting approval
Programme: `feature/club-platform` (built last of the four; see `2026-10-20-volley-skills-club-platform-design.md` §13)

## 1. Intent

Italy is the first market (pricing report: ~390 teams from Serie B up, mostly multi-team clubs). Below the top flight, staff work in Italian; an English-only app does not get adopted. The app gains a full Italian interface, built so that more languages (Spanish next) are a catalog away, without breaking the ~2,000 English text assertions in the test suite.

### Goals
1. Every piece of **app chrome** in Italian: screens, dialogs, errors, notices, page titles, empty states, the training PDF, the awards story text, CSV headers, the email-link sign-in email, the legal documents (content from the legal design).
2. Locale-aware dates, weekdays, months and numbers (`,` decimals in Italian).
3. AI features answer in the UI language; Italian text scouting understands Italian volleyball words.
4. Missing Italian strings fail the build (type-checked catalogs).
5. English stays the default and the test language.

### Non-goals
- Translating **user content**: exercise and training names/descriptions, team names, opponents, notes, development-plan text, custom award titles, diagram labels, saved skill/physical-test guide texts, saved AI drafts.
- Translating stored codes: `Level`, `ObjectiveStatus`, skill/grade codes, exercise categories stay English keys in Firestore and are labelled at display time.
- Machine translation at runtime.
- Localised URLs, `hreflang`, a localised `index.html` (SEO meta stays English; the runtime page title is localised).
- Spanish (catalog structure ready; translation is a later task).

### Anti-goals
- Translating a stored value, so Italian users write "Avanzato" into `player.level` and break queries, colours or English users' views.
- A big-bang key rewrite that breaks every test at once.
- Wrong volleyball vocabulary — a coach will notice "servizio" vs "battuta" before anything else.

## 2. Approach (builder's call, recorded)

**In-house typed catalogs, no i18n library.**
- `src/i18n/en/<feature>.ts` is the source of truth: a nested object per feature folder (`teams`, `players`, `matches`, `awards`, …, plus `common`), values are strings or functions for interpolation and plurals: `count: (n: number) => n === 1 ? '1 player' : \`${n} players\``.
- `src/i18n/it/<feature>.ts` is typed `satisfies Catalog['<feature>']` (types derived from the English catalog), so a missing or misspelt key fails `tsc -b` and therefore `npm run build`.
- Plurals in functions use `Intl.PluralRules(locale)` through a helper `plural(n, { one, other })`, replacing the 12 hand-written `n === 1 ? '' : 's'` and the three local `plural` helpers.
- `useT()` returns the active catalog (`const t = useT(); t.players.count(n)`); non-component code (PDF builder, awards story, parsers that produce user-facing messages, `useNotify` callers) gets it via `getT()` or as a parameter. Pure modules that return messages (`parseJsonArray`, `validateDraft`, `textScout`, `playersImport`, `trainingsImport`) return **codes + params**; the UI maps them to text. This keeps them testable and language-free.
- The Italian catalog is loaded with a dynamic import when Italian is active; English is bundled.

Why not react-i18next: the type-checked catalog gives compile-time completeness checks with no dependency, matches the codebase's preference for small hand-written helpers, and functions handle Italian plurals and gender agreement more naturally than string templates.

## 3. Choosing the language

**Release gate (builder's call):** Italian ships behind a flag, `ITALIAN_ENABLED` in `src/i18n/locales.ts` (false until the coach review in §6 and the on-device read-through sign off). While false: the resolver never returns `it`, the Settings row and the public-page toggle are hidden, the club `locale` select offers English only. Feature folders can therefore merge and deploy one by one; flipping the flag is the release step. Developers can force Italian locally with `?lang=it` in dev builds only.

- Order: user's choice (localStorage `vcb.locale`) → active club's `locale` (club-platform §3.1) → browser language (`it*` → `it`) → `en`.
- Settings → new "Language" row next to the theme toggle (English / Italiano), applied immediately without reload.
- `<html lang>` set early by a pre-paint script alongside `public/theme-init.js`, and updated on change.
- Firebase Auth: `auth.languageCode = locale` before `sendSignInLinkToEmail`; the operator configures the Italian email template in the Firebase console (task listed in the plan, not code).
- Public pages (`/login`, `/signup`, legal, `/privacy`) show an EN/IT toggle.

## 4. Formatting
`src/i18n/format.ts` exports locale-bound helpers used everywhere instead of ad-hoc formatting:
- `formatDate(iso, style)`, `formatMonth(year, month)`, `weekdayNames('short'|'narrow')`, `monthNames()` via `Intl.DateTimeFormat` — replacing `MONTH_NAMES`/`WEEKDAY_NAMES` in `src/calendar/monthGrid.ts`, `WEEKDAYS` in `TeamCalendarTab.tsx`, `MONTHS` in `PlayerKpiTiles.tsx`, and the five `toLocaleDateString(undefined, …)` calls (which today follow the browser, not the app).
- `formatNumber(n, digits)`, `formatPercent`, replacing displayed `toFixed` and `fmtPct`/`fmtEff` in `src/matches/format.ts` (`,` decimals in Italian). Values written to files meant for machines (JSON export) stay locale-free; **CSV**: headers translated, numbers keep `.` and `,` separators unless the builder adds a `;`-separated Italian variant (builder's call; Excel in Italy expects `;`).
- Week starts Monday already (fits Italy).

## 5. Text outside components
| Area | Treatment |
|---|---|
| Label maps (`SKILL_LABELS`, `GRADE_LABELS` in `skillGrades.ts`; the player skills map in `PlayerSkillsSection.tsx`; `POINT_REASON_LABELS`; `POSITION_CATEGORIES` labels; `EXERCISE_CATEGORIES`; `EXERCISE_FOCUSES`; `AWARD_TITLES`) | Move labels into catalogs keyed by the stored code; one map per concept (the two skill maps collapse into one place). |
| `Level` / `ObjectiveStatus` | Stored English; `StatusChip` and level badges render `t.levels[level]` / `t.objectiveStatus[s]`. |
| Default guides (`DEFAULT_SKILL_GUIDE`, `DEFAULT_PHYSICAL_TEST_GUIDE`) | Fallback content shown until an admin saves: localise the fallback per locale. Once saved it is club content. |
| Training PDF (`buildTrainingPdf.ts`, ~12 strings, prints `p.level` raw) | Receives the catalog + formatters; level labelled. Roboto covers Italian accents; `fontSafe` unchanged. |
| Awards story (`storyStats.ts` kickers/captions, intro title in `AwardsPage.tsx`) | From catalogs, with plural helpers. Rendered images use the UI language at render time. |
| Page meta (`usePageMeta`, 18 calls) | Titles from catalogs; " · Volley Skills" suffix stays. |
| Notices (`useNotify`, ~12 calls), errors ("Could not…", ~123) | Catalog entries; error copy keeps `role="alert"`. |
| AI prompts (`src/aiDraft/*Prompt.ts`) | Add a directive "Write all names and descriptions in {language}"; the description headings in `exercisePrompt.ts` ("Purpose:/Setup:/…") come from the catalog (no code parses them). Naming convention examples (`naming.ts`) localised. |
| Text scouting prompt (`textScout.ts`) | The grade/skill table sent to the model stays **pinned to English codes and labels** (it is a protocol, not UI). Add Italian everyday vocabulary next to the existing English/Spanish/French list (see glossary §6). The model's reply format is unchanged. The Italian button labels coaches see (e.g. "Battuta", "Punto") are added to the vocabulary so a coach can type what the screen says. |
| Legal documents | Italian versions per the legal design (separate files, separate hashes). |
| `index.html`, manifest | Unchanged (English). |

## 5b. Grammatical gender (operator decision 2026-10-20)

Italian positions, levels, award titles and many captions agree in gender (Palleggiatore/Palleggiatrice, Avanzato/Avanzata). Each **team** gets `gender: 'women' | 'men' | 'mixed'`:
- Team form: a required select (Women / Men / Mixed); rules validate the enum on team create/update (rules test); `teamsImport` accepts it.
- Existing teams: the field lands with this increment, with no migration script. Teams without a value use `mixed` forms and show a one-time prompt to team admins ("Is this a women's, men's or mixed team?"); the team form requires it on next save.
- Catalog entries that name or describe players take a `g: Gender` parameter: `t.positions.setter(g)`, `t.levels.Advanced(g)`. `mixed` uses the paired form ("Palleggiatore/trice") or a neutral rewording where it reads better. English ignores `g`.
- Player-level gender is not stored (no new personal-data field).

## 6. Volleyball glossary (Italian)

Proposed terms; **to be reviewed by an Italian-speaking coach before release** (the operator names the reviewer).

| English (app) | Italiano |
|---|---|
| Serve | Battuta |
| Reception | Ricezione |
| Attack | Attacco |
| Block | Muro |
| Dig | Difesa |
| Set (skill) | Alzata |
| Free ball | Free ball (palla facile) |
| Set (game) | Set |
| Point / Ace / Kill | Punto / Ace / Punto in attacco |
| Error | Errore |
| Timeout | Time-out |
| Substitution | Cambio |
| Rotation (P1–P6) | Rotazione (P1–P6) |
| Setter / Outside / Opposite / Middle / Libero | m: Palleggiatore / Schiacciatore (banda) / Opposto / Centrale / Libero — f: Palleggiatrice / Schiacciatrice (banda) / Opposta / Centrale / Libero |
| Beginner / Developing / Advanced / Elite | m: Principiante / In crescita / Avanzato / Élite — f: Principiante / In crescita / Avanzata / Élite |
| Physical testing | Test atletici |
| Development plan | Piano di sviluppo |
| Training (session) / Exercise | Allenamento / Esercizio |
| Team admin / Club admin | Amministratore squadra / Amministratore club |

Grade labels per skill (Ace, Pressure, Kill, Covered, Blocked, Overpass, Aced…) are translated with the same reviewer; the symbols `# + ! - / =` are shown unchanged.

Text-scout Italian vocabulary to add (examples): battuta, ace, ricezione, ricezione perfetta/positiva/negativa, schiacciata, attacco, pallonetto, muro, murata, difesa, alzata, palla facile, punto, fuori, in rete, errore, invasione, time-out, cambio.

## 7. Migration strategy (keeps tests green)
1. Land `src/i18n/` (catalog types, `useT`, `getT`, format helpers, locale resolution, Settings row) with `common` only.
2. Convert **feature by feature** (one folder per commit/PR-sized step): move strings to `en/<feature>.ts` **with identical English text**, so existing tests keep passing unchanged; then add `it/<feature>.ts`.
3. Convert pure modules to return codes (§2) with their tests updated in the same step.
4. Formatting helpers replace ad-hoc formatting; tests that assert English dates/numbers keep passing because tests run in `en`.
5. Last: the Italian glossary review and a full read-through on device.

Test setup forces `en` (`vitest` setup sets `vcb.locale = 'en'`). New tests:
- a type-level completeness check is the build itself (`it` catalogs `satisfies` the English types);
- a unit test that every `it` function returns a non-empty string for sample params;
- smoke component tests rendering a few key screens (home, team, player card, match report, training builder) in Italian, asserting a handful of Italian strings and no `undefined`;
- format helper tests for both locales (dates, `1,5` vs `1.5`, weekday order).

## 8. Effort and risk notes
- Size: ~1,400–1,800 strings across 147 `.tsx` and 157 `.ts` files; busiest folders: matches, players, awards, teams, physicalSessions, diagrams.
- The new screens from the club-platform, legal and DVW designs are written against `useT()` from the start if this lands later; if those designs land first (planned order), their strings are converted in step 2 like everything else.
- Text length: Italian runs ~15–25% longer; check tight places (scout buttons, chips, KPI tiles, awards slides) on a phone width.

## 9. Left to the builder
- Catalog granularity inside a feature.
- CSV variant for Italian Excel.
- Exact Settings row UI.
- Italian copy itself (then reviewed per §6).
