# Volley Skills App — Home, Team Stats & Awards Design

Date: 2026-10-14
Status: Draft — awaiting user review
Branch: `feature/home-stats-awards`
Companion to: `2026-10-14-volley-skills-match-insights-design.md` (season stats per player, `matchRating.ts`,
print/CSV conventions), `2026-10-13-volley-skills-scouting-design.md` (match/event model),
`2026-09-04-volley-skills-app-design.md` (fetching rules, compliance), `2026-09-04-volley-skills-design-system.md`

## 1. Purpose and success criteria

Three increments, built in this order (each depends on the previous):

1. **Home, 404 and web hygiene** — a coach dashboard at `/`, a real 404, friendly not-found
   states, and the SEO/metadata/installability basics a public-facing login page needs while
   keeping every private page out of search engines.
2. **Team stats dashboard + PDF/CSV** — a season view of a team built from finished matches,
   with leaderboards of the best players.
3. **Awards** — season and per-match awards (incl. match MVP): prepare (with coach overrides),
   present as a full-screen animated ceremony, and export portrait 9:16 PNG cards for social
   media, with an optional per-player photo and a customizable background.

Success: a coach opens the app and immediately sees a live match to resume, what's on in the next
7 days and recent results. After a season of scouted matches, the Stats tab shows the team's
numbers and top 3 per category and prints cleanly to A4. At the season party the coach clicks
through an animated ceremony on a projector; after a match they post an "MVP" card to Instagram
from their phone in under a minute.

## 2. Decisions log

| # | Decision | Choice |
|---|---|---|
| D1 | Home content | Coach dashboard (live, next 7 days, recent results, teams, shortcuts); no marketing landing |
| D2 | Not found | Catch-all `*` route inside the authenticated shell + shared `NotFoundState`; `permission-denied` maps to it (no existence leak) |
| D3 | SEO policy | Only `/login`, `/privacy`, `/request-access` indexable; everything else `noindex` via header **and** meta |
| D4 | Page metadata | Own `usePageMeta` hook; no react-helmet |
| D5 | Installability | Web app manifest only; no service worker (Firestore cache already handles offline) |
| D6 | Team stats data | Computed client-side from `listFinishedMatches` (≤ 60 docs, `summary` only); no aggregate doc |
| D7 | Rankings | One pure module `awardRules.ts` used by both leaderboards and awards |
| D8 | Award scopes | Season (10 awards, from the Stats tab) and match (8 awards incl. MVP, from a finished match) |
| D9 | Coach overrides | Allowed (swap winner, hide award, custom awards); saved in Firestore |
| D10 | Award storage | Match: `awards` field on the match doc. Season: `teams/{teamId}/awards/season`. Admin-only |
| D11 | Renderer | One canvas renderer `drawAwardCard(ctx, …, t)` used for ceremony, PNG and (later) video |
| D12 | Card format | Portrait 1080×1920 only |
| D13 | Photos / backgrounds | Picked on the device, used in memory, **never uploaded or stored**; preset/colour choice remembered in localStorage |
| D14 | Export | PNG + Web Share API now; video (MediaRecorder) is the next increment, out of this plan |
| D15 | Names on cards | Style per device; default "First name + initial" (minors, public socials) |
| D16 | Ceremony shows | Winner only — runners-up are never named on screen |

## 3. Increment 1 — Home, 404, navigation, SEO

### 3.1 Home page

**Route.** `/` renders `HomePage` inside `AppShell` (today it redirects to `/teams`).

**Blocks, top to bottom:**

1. **Greeting** — "Good morning/afternoon/evening, {first part of name or email}" + today's date.
2. **Live now** (only if any) — each `status: 'live'` match: team chip, "vs Opponent", current
   set score from `result`, **Resume scouting** → `/teams/:teamId/matches/:matchId/scout`.
3. **Next up** — next 7 days (today included) across teams: calendar sessions and `setup`
   matches, merged, sorted by date then time. Row: team chip, weekday + date (+ time if
   present), training title or "vs Opponent"; links to the team calendar / match page.
   Empty: "Nothing in the next 7 days" + "Plan a training" link (team admins).
4. **Recent results** — last 5 finished matches across teams: W/L pill, sets score, opponent,
   date, and "MVP: #7 L. Name" when determinable (saved override, else computed from `summary`
   via `awardRules`; omitted if neither). Links to the match report.
5. **Your teams** — compact cards (name, age group, player count, average level) reusing
   `TeamStatsRow` data; "All teams →".
6. **Shortcuts** — only for sections the user can access: New match (per team picker),
   Exercises, Trainings.

**No-access state.** A member with no teams and no section access sees a single card:
"You don't have access to any team yet" + **Request access** (`/request-access`) + a line on who
grants access. No empty lists.

**Data (fetching discipline, app spec §8).**

- `listMyTeams(email)` first page only (`TEAMS_PAGE_SIZE`). Superadmins: same query as the teams
  list page uses for them.
- Per team, in parallel: `listCalendarSessions(teamId, today, today+7)` and
  `listMatchesInRange(teamId, today−30, today+7)` — one match query yields live, upcoming
  (`setup`, date ≥ today) and recent (`finished`). Existing queries and indexes; nothing new.
- If the user admins more teams than one page: "Showing your first N teams" + link to `/teams`.
- Each block has its own skeleton and its own error line ("Could not load upcoming sessions.");
  one failing team does not blank the page.

**Pure logic** — `src/home/homeFeed.ts`:

```ts
export interface FeedInput { team: Team; sessions: CalendarSession[]; matches: Match[] }
export function liveMatches(input: FeedInput[]): FeedMatch[];
export function nextUp(input: FeedInput[], today: string, days = 7): FeedItem[];   // sorted
export function recentResults(input: FeedInput[], limit = 5): FeedMatch[];          // newest first
```

Files: `src/home/HomePage.tsx`, `src/home/LiveNowBlock.tsx`, `NextUpBlock.tsx`,
`RecentResultsBlock.tsx`, `homeFeed.ts`.

### 3.2 404 and not-found states

- `NotFoundPage` on `path="*"` inside the `RequireAuth` shell: an inline SVG illustration (ball
  landing past the line, design tokens only), "This page is out of bounds", the requested path,
  **Go home** and **Back** (history back, or home if there is no history). Sets `noindex`.
- Signed-out visitors to any unknown URL go to login first (catch-all is behind `RequireAuth`),
  so the 404 does not reveal which URLs exist.
- Shared `src/components/NotFoundState.tsx` (`title`, `message?`, `backTo`, `backLabel`) replaces
  the plain-text not-found messages on team, player, match, scout, exercise, training and diagram
  pages. Firestore `permission-denied` on those single-doc loads renders the same state.

### 3.3 Navigation plumbing

- `LoginPage`, `FinishSignInPage` and `TeamSettingsTab` (after delete) navigate to `/` instead of
  `/teams`.
- **Return to deep link:** when `RequireAuth` redirects a signed-out user, it stores the
  requested path in localStorage `vcb.auth.returnTo` (try/catch). `FinishSignInPage` consumes it
  and navigates there, else `/`. Only values starting with `/` and not `//` are accepted (no open
  redirect). Email-link sign-in may complete in a new tab, hence localStorage, not
  sessionStorage.
- **Nav:** "Home" (`House` icon) is the first sidebar item; the logo/club name links to `/`.
  Bottom bar on phones is capped at 5 items: Home, Teams, Exercises*, Trainings*, Settings
  (\*when accessible); admin items (Guides, Access) are reachable from the account menu on phones.

### 3.4 SEO, metadata and good practices

**Indexing policy (D3).** Indexable: `/login`, `/privacy`, `/request-access`. All else never.

- `firebase.json` hosting headers: `X-Robots-Tag: noindex, nofollow` for `/`, `/teams/**`,
  `/exercises/**`, `/trainings/**`, `/admin/**`, `/settings`, `/finish-sign-in`.
  (`/` is the authenticated home; the indexable entry point is `/login`.)
- `public/robots.txt`: `Allow` the three public paths, `Disallow` the private prefixes (prefixes
  only, never IDs), `Sitemap:` line.
- `public/sitemap.xml`: the three public URLs.
- Base URL from `VITE_SITE_URL` (documented in `.env.example`); robots/sitemap are generated at
  build time by a tiny Vite plugin (or a `prebuild` node script) so they carry the right origin.

**`usePageMeta`** — `src/layout/usePageMeta.ts`:

```ts
usePageMeta({ title: string; description?: string; robots?: 'index' | 'noindex'; canonical?: string })
```

Sets `document.title` to `"{title} · Volley Skills · VCB"`, meta description, meta robots,
`<link rel="canonical">` (from `VITE_SITE_URL` + path, public pages only); restores defaults on
unmount. Every top-level page calls it; private pages pass `robots: 'noindex'` (the default).

**`index.html`:**

- `<meta name="description">`, `<meta name="color-scheme" content="light dark">`,
  `theme-color` ×2 with `media="(prefers-color-scheme: …)"`.
- Open Graph (`og:title`, `og:description`, `og:type=website`, `og:image`, `og:url`) and
  `twitter:card=summary_large_image`. `public/og-image.png` 1200×630: VCB mark + colours, **no
  player imagery**.
- `<link rel="manifest" href="/manifest.webmanifest">`.
- `<link rel="preload">` for the Inter weight used above the fold.
- `<noscript>Volley Skills needs JavaScript to run.</noscript>`.

**Manifest** — `public/manifest.webmanifest`: `name`, `short_name`, `start_url: "/"`,
`display: "standalone"`, `theme_color`/`background_color` from tokens, icons 192, 512 and
512 maskable (generated once from `favicon.svg`, committed as PNGs). CSP needs no change
(`default-src 'self'` covers `manifest-src`).

**Accessibility/performance:**

- "Skip to content" link as the first focusable element in `AppShell`; `<main id="main">`.
- On route change, focus moves to the page `<h1>` (`tabIndex={-1}`), so screen readers announce
  navigation.
- New heavy routes are `lazy()` like `ScoutPage`: Stats tab content, awards route, card renderer.

**Out of scope:** JSON-LD, prerendering/SSR, analytics (forbidden — minors' data), i18n.

### 3.5 Tests (increment 1)

- `homeFeed.test.ts` — merge/sort across teams, 7-day window edges, live detection, recent limit,
  MVP fallback.
- `HomePage.test.tsx` — live block present/absent, no-access card, one block's error doesn't
  hide others.
- `App.test.tsx` — unknown route → 404; `/` → home.
- `NotFoundState` used by `MatchPage` for a missing match and for `permission-denied`.
- `usePageMeta.test.ts` — sets and restores title/description/robots/canonical.
- `returnTo.test.ts` — stores, consumes once, rejects `//evil.com` and absolute URLs.
- `seoConfig.test.ts` (node) — every private prefix has `X-Robots-Tag` in `firebase.json`;
  robots/sitemap list exactly the public routes.

## 4. Increment 2 — Team stats dashboard

### 4.1 Placement and access

New **Stats** tab on `TeamPage` (between Matches and Plan), rendered only for team admins
(matches are admin-read). Content is a lazily imported `TeamStatsTab`.

### 4.2 Data

- `listFinishedMatches(teamId)` (existing, cap 60, existing index). Only `summary`, `result`,
  `date`, `opponent`, `competition`, `homeAway`, `roster`, `awards` are used; events never read.
- Matches with `summary: null` are skipped. Matches whose summary has no player actions are
  "score-only".
- Coverage line: "Based on {n} scouted matches · {k} score-only · {s} skipped (finished before
  stats existed)". If 60 docs came back: "Showing the latest 60 matches."

### 4.3 Filters (client-side, no reads)

Competition (All / League / Cup / Friendly / Tournament), range (Whole season / Last 5 /
Last 10 / custom from–to), Home / Away / Both. State in the URL search params so a printed or
shared view is reproducible.

### 4.4 Pure logic — `src/teams/stats/teamSeason.ts`

```ts
export type StatsRange =
  | { kind: 'season' }
  | { kind: 'last'; count: 5 | 10 }                 // last N scouted matches by date
  | { kind: 'dates'; from: string; to: string };   // inclusive ISO dates
export interface StatsFilter { competition: Competition | 'all'; range: StatsRange; homeAway: HomeAway | 'all' }
export interface TeamSeason {
  coverage: { scouted: number; scoreOnly: number; skipped: number; capped: boolean };
  record: { won: number; lost: number; setsWon: number; setsLost: number };
  sideOut: number | null; breakPoint: number | null;       // from summed WonTotal, never averaged
  attackEff: number | null; receptionPos: number | null;    // from summed grade counts
  aces: number; serveErrors: number; oppErrorPoints: number;
  rotations: Record<1|2|3|4|5|6, { won: number; lost: number }>;
  bestRotation: number | null; weakestRotation: number | null;
  trend: { matchId: string; date: string; opponent: string; won: boolean;
           sideOut: number | null; attackEff: number | null; receptionPos: number | null }[]; // oldest first
  players: TeamPlayerRow[];   // via seasonStats() + matchRatings() per player
}
export function filterMatches(matches: Match[], f: StatsFilter): Match[];
export function teamSeason(matches: Match[]): TeamSeason;
```

Player identity: rows keyed by `playerId`; name and number from the newest roster snapshot
that contains the player; profile link only if the player is in the current roster
(`loadTeamRoster`, already used by matches).

### 4.5 Rankings — `src/awards/awardRules.ts` (shared with §5)

```ts
export type AwardId = 'mvp' | 'topScorer' | 'attacker' | 'server' | 'receiver' | 'blocker'
  | 'defender' | 'setter' | 'mostImproved' | 'everPresent';
export type AwardScope = 'match' | 'season';
export interface Ranked { playerId: string; value: number; display: string; attempts: number | null }
export interface AwardRanking { id: AwardId; ranked: Ranked[]; notEnoughData: string[] }
export function rankAward(id: AwardId, scope: AwardScope, matches: Match[]): AwardRanking;
export const AWARDS_FOR: Record<AwardScope, AwardId[]>;
```

| Award | Metric | Min match / season | Tie-break |
|---|---|---|---|
| `mvp` | MVP score | 1 action / played ≥ 50% of scouted matches | fewer errors, then more points |
| `topScorer` | points won | — | fewer errors |
| `attacker` | attack eff. | 8 / 30 attacks | more `#` |
| `server` | serve eff. | 8 / 30 serves | more aces (`S#`) |
| `receiver` | reception + % | 8 / 30 receptions | more `#` |
| `blocker` | block points (`B#`) | ≥ 1 | fewer block errors (`B=`, `B/`) |
| `defender` | D+F quality (`GRADE_WEIGHTS`) | 6 / 25 | more attempts |
| `setter` | E quality | 10 / 40 | more attempts |
| `mostImproved` | avg MVP score, last third − first third of matches played | season only, ≥ 6 played | higher last-third avg |
| `everPresent` | matches played | season only | more actions |

**MVP score** (per match):

```
mvp = points − errors + MVP_QUALITY_WEIGHT × Σ_skills attempts × (quality − 0.5)
MVP_QUALITY_WEIGHT = 0.5;  quality = Σ count[g]·GRADE_WEIGHTS[g] / attempts
```

Season MVP = mean of per-match MVP over matches played. Remaining ties after the tie-break →
shared rank (both listed). Constants live at the top of `awardRules.ts`.

### 4.6 UI — `src/teams/stats/`

1. Filters bar + coverage line.
2. **KPI row** (`tabular-nums`, `fmtEff`/`fmtPct`): record, sets, side-out %, break-point %,
   attack eff., reception +, aces / serve errors, points from opponent errors.
3. **Trend chart** — hand-built SVG like `PhysicalTestTrendChart`: three lines (side-out %,
   attack eff., reception +), x = matches with W/L markers; accessible table fallback
   (`sr-only`).
4. **Rotations** — 6 bars won/lost, best and weakest called out.
5. **Leaderboards** — one card per award (season scope): top 3 with value and attempts; "Not
   enough data: …" muted line; player → profile. **🏆 Season awards** button →
   `/teams/:teamId/awards`.
6. **Player table** — sortable: #, name, MP, pts, err, MVP (avg), att. eff., serve eff., rec +,
   rating per scoutable skill. Horizontal scroll on phone.

Empty (no scouted matches): "No scouted matches yet — scout a match to see team stats." + link
to the Matches tab.

### 4.7 Export

**Export** menu (same component/pattern as the match page):

- **Print / PDF** — `window.print()`. Print styles: A4 portrait; header with team, season,
  active filters, coverage line, print date; filters and buttons `print:hidden`; cards
  `break-inside: avoid`; charts `print-color-adjust: exact`; table `print:overflow-visible`.
- **CSV (EU / EN)** — `src/teams/stats/teamStatsCsv.ts`, the player table; same conventions as
  `reportCsv.ts` (BOM, `\r\n`, RFC 4180 quoting, formula-injection guard, EU `;` + decimal
  comma). File: `<team-slug>-stats-<from>-<to>.csv`.

### 4.8 Tests (increment 2)

- `teamSeason.test.ts` — filters, coverage counts, cap flag, side-out from summed totals,
  rotations, trend order, player identity from newest roster, departed player kept without link.
- `awardRules.test.ts` — each metric, minimums per scope, tie-breaks, shared rank, MVP formula at
  known inputs, most-improved thirds and < 6 matches exclusion, `AWARDS_FOR`.
- `teamStatsCsv.test.ts` — header, formats, injection guard.
- `TeamStatsTab.test.tsx` — tab absent for viewers; leaderboards render; not-enough-data line;
  Print calls `window.print`; CSV downloads; empty state.

No rules change, no new index.

## 5. Increment 3 — Awards

### 5.1 Routes and access

- Season: `/teams/:teamId/awards`. Match: `/teams/:teamId/matches/:matchId/awards` (finished
  matches only; otherwise `NotFoundState`-style "Awards are available once the match is
  finished").
- Full screen, outside `AppShell`, `RequireAuth` + team-admin check, `lazy()` loaded.
- Entry points: Stats tab 🏆 button; **🏆 Match awards** on `MatchPage` for finished matches;
  home "Recent results" MVP line links to the match awards.
- Season awards always use the whole season, all competitions (filters on the Stats tab do not
  apply).

### 5.2 Data model

```ts
// src/types/awards.ts
export interface AwardPick { playerId: string | null; hidden: boolean }
export interface CustomAward { id: string; title: string; playerId: string; note: string }
export interface AwardsConfig {
  picks: Partial<Record<AwardId, AwardPick>>;   // absent → the stats' choice
  custom: CustomAward[];                         // ≤ 5
  order: string[];                               // AwardId | CustomAward.id; default: stats order, MVP last
  updatedBy: string;
  updatedAt: Timestamp;
}
```

- Match: `teams/{teamId}/matches/{matchId}.awards: AwardsConfig | null` (absent on old docs).
- Season: `teams/{teamId}/awards/season`.
- API — `src/awards/awardsApi.ts`: `getSeasonAwards`, `saveSeasonAwards`, `saveMatchAwards`
  (match awards are read from the already-loaded match doc). Writes not awaited for UI
  (offline-safe, persistent cache), debounced 800 ms, "Saved / Saving… / Offline — will sync"
  indicator.

**Resolution** — `src/awards/resolveAwards.ts` (pure):

```ts
export interface ResolvedAward {
  key: string; title: string; kind: 'stats' | 'custom';
  winner: { playerId: string; name: string; number: number } | null;
  statLine: string | null;          // only when the winner is the stats' choice
  suggested: Ranked | null;         // stats' #1, shown in Prepare when overridden
  overridden: boolean; hidden: boolean;
}
export function resolveAwards(scope, matches, config, roster): ResolvedAward[];  // in config.order
```

Stats-chosen winners stay live (recomputed on load); overrides stay fixed. Awards with no
winner (no eligible player, no override) are shown in Prepare as "No winner — pick one or hide"
and skipped in Present.

### 5.3 Rules

`firestore.rules`, under `teams/{teamId}`:

```
match /awards/{scope} {
  allow read, delete: if isTeamAdmin();
  allow create, update: if isTeamAdmin()
    && scope == 'season'
    && request.resource.data.picks is map
    && request.resource.data.custom is list
    && request.resource.data.custom.size() <= 5
    && request.resource.data.order is list;
}
```

Match `awards` is covered by the existing match update rule (admin-only).

`tests/rules/awards.rules.test.ts`: admin read/write season doc; viewer and outsider denied
read and write; doc id ≠ `season` denied; `custom` of 6 denied. `matches.rules.test.ts` gains:
admin writes `awards`; non-admin denied.

### 5.4 Prepare view (route default)

- Header: scope ("Season 2026–27" / "vs Opponent · date"), **Present ▶**, **Export cards**,
  save indicator, Close (back to Stats tab / match page).
- Award list in reveal order. Each row: title; suggested winner + stat line + runners-up
  (Prepare is coach-only, so runners-up are fine here); **Winner** select (roster, "Stats'
  choice" first); **Hide** toggle; ↑ / ↓ reorder buttons (keyboard accessible, no drag
  library); **Photo** (§5.7); card thumbnail.
- **+ Custom award** — title (≤ 40 chars), player, note (≤ 80 chars).
- Settings panel: **Theme** (§5.6), **Name style** (§5.8).
- Note under photos: "Photos stay on this device and are forgotten when you leave."

### 5.5 Card renderer — `src/awards/card/`

- `drawAwardCard(ctx, card: CardModel, theme: CardTheme, photo: ImageBitmap | null, t: number)`
  — pure drawing on a 1080×1920 2D context; no DOM, no React.
- Layers: background → scrim (image backgrounds) → VCB mark + team name → award title → photo
  circle (cover-fit) **or default view**: large jersey number in team colours in the circle →
  name (auto-fit: shrink from 120 px to 64 px, then wrap to 2 lines, then ellipsis) → stat line
  → footer ("vs Opponent · 12 Oct 2026" / "Season 2026–27").
- `cardTimeline.ts` — maps `t` to per-layer progress with easing:

  | t | Beat |
  |---|---|
  | 0.00 – 0.20 | background in |
  | 0.20 – 0.45 | title slides up (ease-out) |
  | 0.45 – 0.70 | photo/number scales in with spring overshoot + light sweep |
  | 0.70 – 0.85 | name reveals letter by letter |
  | 0.85 – 1.00 | stat line fades in + confetti |

- Confetti from a seeded PRNG (`mulberry32(seed from card key)`), particle state a pure function
  of `t` → identical frames every render (required for video, D14).
- `CARD_DURATION_MS = 3500`. Before first draw / export: `await document.fonts.load('800 120px Inter')`
  (and the other used weights).
- Reduced motion: `t` jumps 0 → 1 with a 300 ms cross-fade; no confetti, no overshoot.

### 5.6 Themes

Presets: **VCB Navy**, **Gold Night**, **Court Orange**, **Clean Light** (colours from design
tokens). Custom: solid colour, two-colour gradient (angle fixed), or background image from the
device (cover-fit + 45% dark scrim). Preset/colours remembered per device in localStorage
`vcb.awards.theme` (try/catch); background images are never stored.

### 5.7 Photos (device-only, D13)

- `<input type="file" accept="image/*">` → `createImageBitmap(file, { imageOrientation: 'from-image' })`.
- Crop dialog: drag to position, zoom slider, circle preview; output downscaled to ≤ 1080 px.
- Kept in a React state map `awardKey → ImageBitmap`; `close()`d on remove and on unmount.
  Never written to Firestore, localStorage, IndexedDB or any network request.
- CSP already allows `blob:`/`data:` images; no change.

### 5.8 Name style (D15)

`'full' | 'firstInitial' | 'first' | 'number'` — "Lena Peeters", "Lena P.", "Lena", "#12".
Default `firstInitial`; per device in localStorage `vcb.awards.nameStyle`. Applies to ceremony
and cards. `src/awards/nameStyle.ts`, pure.

### 5.9 Present mode

- Fullscreen (`requestFullscreen`, button + **F**). Screen Wake Lock where supported (released on
  exit / visibility change).
- Per award: **title card** (award name only) → **suspense** (pulsing glow; holds until the coach
  advances) → **reveal** (plays the card timeline). MVP last by default. Winner only (D16).
- Final slide: grid of all winners (name style applied, photo or number).
- Controls: Space / → / tap right half = next; ← / tap left half = back; **Esc** = back to Prepare.
  On-screen controls auto-hide after 2 s of no pointer movement.
- Animation loop: one `requestAnimationFrame` loop drawing to a canvas sized to the viewport
  (letterboxed 9:16, background colour fills the bars); no React state per frame.

### 5.10 Export

- **Download PNG** per card: render offscreen at `t = 1` → `canvas.toBlob('image/png')`.
- **Share**: `navigator.canShare({ files })` → `navigator.share({ files, title })`; otherwise
  download.
- **Export all**: one share with all visible cards when supported; else sequential downloads
  (one per click-initiated loop, 300 ms apart). No zip library.
- File names: `vcb-<award>-<yyyy-mm-dd>-vs-<opponent-slug>.png` /
  `vcb-<award>-season-<yyyy>-<yy>.png` (existing `fileSlug`).

### 5.11 Tests (increment 3)

- `resolveAwards.test.ts` — stats choice, override, hidden, custom, order, MVP-last default,
  no-winner award, statLine only for stats choice, override keeps suggestion.
- `nameStyle.test.ts`, `cardTimeline.test.ts` (segment boundaries, easing monotonic,
  reduced-motion).
- `drawAwardCard.test.ts` with a recording mock context: photo vs number fallback, name fitting
  (long name shrinks then wraps), same calls for same `t` (determinism), scrim only on image
  backgrounds.
- `AwardsPrepare.test.tsx` — override saves via `saveSeasonAwards`; hide removes from sequence;
  custom award limit; photo picker never calls any API.
- `AwardsPresent.test.tsx` — keyboard next/back/Esc; final grid; reduced-motion path.
- `exportCards.test.ts` — share when `canShare`, download fallback, file names.
- Rules tests per §5.3.

## 6. Security and privacy

- One rules addition (`teams/{teamId}/awards/{scope}`), admin-only, covered by rules tests.
  Everything else reads data team admins can already read.
- Player photos and custom backgrounds never leave the device (D13); no consent-flow change.
  The privacy page gains one sentence: award-card photos are processed only in the browser and
  are not stored.
- Cards default to "First name + initial"; the ceremony never names runners-up.
- `og-image.png` contains no player imagery. robots.txt lists prefixes only.
- No new third-party libraries, no analytics.

## 7. Future increment (not in this plan) — video export

`canvas.captureStream(30)` + `MediaRecorder` (WebM; MP4 where Safari supports it) recording the
same renderer over `CARD_DURATION_MS` per card, portrait 1080×1920. Only a recorder wrapper and
an Export option are new; `drawAwardCard` is unchanged because it is deterministic in `t`.

## 8. Out of scope

- Guardian/viewer access to stats or awards.
- Stored player photos or team branding images.
- Landscape cards; video (see §7).
- JSON-LD, SSR/prerendering, service worker, analytics, i18n.
