# Home, Team Stats & Awards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coach home dashboard, a real 404 + SEO hygiene, a team season-stats dashboard with PDF/CSV, and season/match awards (prepare → animated ceremony → 9:16 PNG cards).

**Architecture:** Three increments on branch `feature/home-stats-awards`. All stats are computed client-side from finished matches' saved `summary` (≤ 60 docs via the existing `listFinishedMatches`); one pure ranking module (`src/awards/awardRules.ts`) feeds both leaderboards and awards. Award cards are drawn by one deterministic canvas function `drawAwardCard(ctx, card, theme, art, t)` used by the ceremony and PNG export. The only security-boundary change is a new admin-only `teams/{teamId}/awards/season` doc.

**Tech Stack:** React 18 + TypeScript (strict), Vite 5, Tailwind 3, React Router 7, Firebase 12 (Firestore), Vitest 2 + Testing Library, `@firebase/rules-unit-testing`, `lucide-react`. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-volley-skills-home-stats-awards-design.md`

## Global Constraints

- No new runtime dependencies; no chart, PDF, zip, screenshot or helmet library.
- TypeScript `strict` + `noUnusedLocals`/`noUnusedParameters`: unused symbols fail `npm run build`.
- Components never import `firebase/firestore`; all reads/writes go through `<feature>Api.ts`.
- Every query bounded (`limit`) — this plan adds **no new query and no new index**.
- Indexable routes are exactly `/login`, `/privacy`, `/request-access`; everything else `noindex`.
- Player photos and background images are **never** written to Firestore, localStorage, IndexedDB or the network.
- Card size exactly 1080×1920; `CARD_DURATION_MS = 3500`.
- Name style default `firstInitial`; ceremony never names runners-up.
- `MIN` thresholds, `MVP_QUALITY_WEIGHT = 0.5` and grade weights are copied verbatim from spec §4.5.
- localStorage keys: `vcb.auth.returnTo`, `vcb.awards.theme`, `vcb.awards.nameStyle`; every access wrapped in try/catch.
- Page title format: `"{title} · Volley Skills · VCB"`.
- No analytics, no tracking. Tests sit next to the code they cover. Rules changes need a test in `tests/rules/`.
- Commit after every task; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Long / non-Latin player names on cards** ("Maria-Fernanda Van den Broeck-Oliveira", "Zoë Ünal") — must shrink, wrap to 2 lines, then ellipsis; never overflow the card. Pinned in Task 18.
2. **A team with finished matches that are all score-only or pre-summary** — Stats tab and awards must show the empty/coverage message, not NaN or a crash. Pinned in Tasks 10 and 15.
3. **An override pointing to a player no longer on any roster** — Prepare and cards must still render (name "Unknown player"), not crash. Pinned in Task 15.
4. **`returnTo` tampering** (`//evil.com`, `https://evil.com`, `/\evil`) — must fall back to `/`. Pinned in Task 5.
5. **Ties at the top of a leaderboard** — both players listed with the same rank; the awards winner is the first after tie-breaks, and a full tie doesn't drop either. Pinned in Task 9.

---

## File map

```
Increment 1
  src/layout/usePageMeta.ts (+test)            page title/description/robots/canonical
  src/seo/seoRoutes.ts (+test)                 public routes, private prefixes, robots/sitemap text
  vite.config.ts                               build plugin emitting robots.txt/sitemap.xml
  firebase.json                                X-Robots-Tag headers
  index.html, public/manifest.webmanifest,
  public/og-image.svg/.png, public/icon-*.png  metadata + installability
  src/components/NotFoundState.tsx (+test)     shared not-found block
  src/layout/NotFoundPage.tsx (+test)          catch-all page
  src/auth/returnTo.ts (+test)                 deep-link return after sign-in
  src/layout/AppShell.tsx                      Home nav, skip link, <main>, route focus
  src/home/homeFeed.ts (+test)                 pure feed merging
  src/home/HomePage.tsx (+test), src/home/*Block.tsx
  src/teams/teamAccess.ts (+test)              isTeamAdmin(team, email, access)

Increment 2
  src/types/awards.ts                          AwardId, AwardScope (+ config types in Task 14)
  src/awards/awardRules.ts (+test)             metrics, MVP score, rankings
  src/teams/stats/rosterIndex.ts (+test)       latest roster snapshot per player + current roster merge
  src/teams/stats/teamSeason.ts (+test)        filter, coverage, aggregates, player rows
  src/teams/stats/statsFilterParams.ts (+test) filter <-> URL search params
  src/matches/report/reportCsv.ts              export csvDocument + Cell
  src/teams/stats/teamStatsCsv.ts (+test)
  src/teams/stats/TeamTrendChart.tsx, RotationBars.tsx, Leaderboards.tsx, PlayerStatsTable.tsx
  src/teams/stats/TeamStatsTab.tsx (+test)
  src/teams/TeamPage.tsx                       Stats tab

Increment 3
  src/types/awards.ts, src/types/match.ts      AwardsConfig, Match.awards
  src/awards/awardsApi.ts (+test)
  firestore.rules, tests/rules/awards.rules.test.ts, tests/rules/matches.rules.test.ts
  src/awards/resolveAwards.ts (+test)
  src/awards/nameStyle.ts (+test), src/awards/card/cardTheme.ts (+test)
  src/awards/card/cardTimeline.ts (+test), src/awards/card/confetti.ts (+test)
  src/awards/card/drawAwardCard.ts (+test), src/awards/card/fitName.ts (+test)
  src/awards/card/testCtx.ts                   recording 2D-context fake for tests
  src/awards/photo.ts (+test), src/awards/PhotoCropDialog.tsx
  src/awards/exportCards.ts (+test)
  src/awards/presentSteps.ts (+test)
  src/awards/AwardsPage.tsx (+test), AwardsPrepare.tsx (+test), AwardsPresent.tsx (+test)
  src/App.tsx, src/matches/MatchPage.tsx, src/home/RecentResultsBlock.tsx, src/legal/PrivacyPage.tsx
```

---

# Increment 1 — Home, 404, navigation, SEO

### Task 1: `usePageMeta` hook

**Files:**
- Create: `src/layout/usePageMeta.ts`
- Test: `src/layout/usePageMeta.test.ts`

**Interfaces:**
- Produces: `usePageMeta(meta: PageMeta): void`, `interface PageMeta { title: string; description?: string; robots?: 'index' | 'noindex'; canonicalPath?: string }`, `DEFAULT_DESCRIPTION: string`, `pageTitle(title: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/layout/usePageMeta.test.ts
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DESCRIPTION, pageTitle, usePageMeta } from './usePageMeta';

const meta = (name: string) => document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;
const canonical = () => document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null;

describe('usePageMeta', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('formats the title', () => {
    expect(pageTitle('Home')).toBe('Home · Volley Skills · VCB');
  });

  it('sets title, description and noindex by default', () => {
    renderHook(() => usePageMeta({ title: 'Home' }));
    expect(document.title).toBe('Home · Volley Skills · VCB');
    expect(meta('description')).toBe(DEFAULT_DESCRIPTION);
    expect(meta('robots')).toBe('noindex, nofollow');
    expect(canonical()).toBeNull();
  });

  it('sets index + canonical for public pages', () => {
    renderHook(() => usePageMeta({ title: 'Sign in', description: 'Sign in to VCB', robots: 'index', canonicalPath: '/login' }));
    expect(meta('description')).toBe('Sign in to VCB');
    expect(meta('robots')).toBe('index, follow');
    expect(canonical()).toMatch(/\/login$/);
  });

  it('restores defaults on unmount', () => {
    const { unmount } = renderHook(() => usePageMeta({ title: 'Sign in', robots: 'index', canonicalPath: '/login' }));
    unmount();
    expect(document.title).toBe('Volley Skills · VCB');
    expect(meta('robots')).toBe('noindex, nofollow');
    expect(canonical()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/layout/usePageMeta.test.ts`
Expected: FAIL — cannot resolve `./usePageMeta`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/layout/usePageMeta.ts
import { useEffect } from 'react';

export interface PageMeta {
  title: string;
  description?: string;
  /** Private pages are `noindex` (the default); only /login, /privacy, /request-access pass `index`. */
  robots?: 'index' | 'noindex';
  /** Path for <link rel="canonical">; public pages only. */
  canonicalPath?: string;
}

export const DEFAULT_DESCRIPTION =
  'Volley Skills — team, player, training and match scouting tool for Volley Club Belair.';
const DEFAULT_TITLE = 'Volley Skills · VCB';

export function pageTitle(title: string): string {
  return `${title} · ${DEFAULT_TITLE}`;
}

function siteOrigin(): string {
  return (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;
}

function upsertMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string | null) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'canonical' }));
  el.href = href;
}

export function usePageMeta({ title, description, robots = 'noindex', canonicalPath }: PageMeta): void {
  useEffect(() => {
    document.title = pageTitle(title);
    upsertMeta('description', description ?? DEFAULT_DESCRIPTION);
    upsertMeta('robots', robots === 'index' ? 'index, follow' : 'noindex, nofollow');
    setCanonical(canonicalPath ? `${siteOrigin()}${canonicalPath}` : null);
    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta('description', DEFAULT_DESCRIPTION);
      upsertMeta('robots', 'noindex, nofollow');
      setCanonical(null);
    };
  }, [title, description, robots, canonicalPath]);
}
```

Add to `src/vite-env.d.ts` (inside `interface ImportMetaEnv`, create the interface if absent):

```ts
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/layout/usePageMeta.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Call it from every top-level page**

Add one line near the top of each page component (import `usePageMeta` from `'../layout/usePageMeta'`):

| File | Call |
|---|---|
| `src/auth/LoginPage.tsx` | `usePageMeta({ title: 'Sign in', description: 'Sign in to Volley Skills, the Volley Club Belair team tool.', robots: 'index', canonicalPath: '/login' });` |
| `src/legal/PrivacyPage.tsx` | `usePageMeta({ title: 'Privacy', description: 'How Volley Skills handles player and guardian data.', robots: 'index', canonicalPath: '/privacy' });` |
| `src/interest/RequestAccessPage.tsx` | `usePageMeta({ title: 'Request access', description: 'Ask for access to Volley Skills.', robots: 'index', canonicalPath: '/request-access' });` |
| `src/auth/FinishSignInPage.tsx` | `usePageMeta({ title: 'Signing in' });` |
| `src/teams/TeamsListPage.tsx` | `usePageMeta({ title: 'Teams' });` |
| `src/teams/TeamPage.tsx` | `usePageMeta({ title: team?.name ?? 'Team' });` (before the early returns) |
| `src/players/PlayerCardPage.tsx` | `usePageMeta({ title: 'Player' });` |
| `src/matches/MatchPage.tsx` | `usePageMeta({ title: match ? \`vs ${match.opponent}\` : 'Match' });` |
| `src/matches/scout/ScoutPage.tsx` | `usePageMeta({ title: 'Scouting' });` |
| `src/exercises/ExercisesPage.tsx` | `usePageMeta({ title: 'Exercises' });` |
| `src/trainings/TrainingsPage.tsx` | `usePageMeta({ title: 'Trainings' });` |
| `src/admin/GuidesPage.tsx` | `usePageMeta({ title: 'Guides' });` |
| `src/access/AccessManagerPage.tsx` | `usePageMeta({ title: 'Access' });` |
| `src/settings/SettingsPage.tsx` | `usePageMeta({ title: 'Settings' });` |
| `src/diagrams/DiagramEditorPage.tsx` | `usePageMeta({ title: 'Court diagram' });` |

Hooks must run before any early `return` in each component.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS (no regressions; pages that previously asserted `document.title` — grep `document.title` in `src/**/*.test.tsx` — update expectations to the new format).

- [ ] **Step 7: Commit**

```bash
git add src/layout/usePageMeta.ts src/layout/usePageMeta.test.ts src/vite-env.d.ts src
git commit -m "feat(seo): usePageMeta — per-page title, description, robots, canonical"
```

---

### Task 2: robots.txt, sitemap.xml, X-Robots-Tag, index.html metadata, manifest

**Files:**
- Create: `src/seo/seoRoutes.ts`, `src/seo/seoRoutes.test.ts`, `public/manifest.webmanifest`, `public/og-image.svg`, `public/og-image.png`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/icon-maskable.svg`, `.env.example` (append if exists)
- Modify: `vite.config.ts`, `firebase.json`, `index.html`

**Interfaces:**
- Produces: `PUBLIC_ROUTES: readonly string[]`, `PRIVATE_PREFIXES: readonly string[]`, `robotsTxt(origin: string): string`, `sitemapXml(origin: string): string`, `noindexHeaderSources(): string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/seo/seoRoutes.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVATE_PREFIXES, PUBLIC_ROUTES, noindexHeaderSources, robotsTxt, sitemapXml } from './seoRoutes';

describe('seoRoutes', () => {
  it('public routes are exactly the three indexable pages', () => {
    expect([...PUBLIC_ROUTES]).toEqual(['/login', '/privacy', '/request-access']);
  });

  it('robots.txt allows public, disallows private prefixes, links the sitemap', () => {
    const txt = robotsTxt('https://example.org');
    for (const r of PUBLIC_ROUTES) expect(txt).toContain(`Allow: ${r}`);
    for (const p of PRIVATE_PREFIXES) expect(txt).toContain(`Disallow: ${p}`);
    expect(txt).toContain('Sitemap: https://example.org/sitemap.xml');
    expect(txt).not.toMatch(/[0-9a-zA-Z]{20}/); // no doc IDs
  });

  it('sitemap lists exactly the public routes', () => {
    const xml = sitemapXml('https://example.org');
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(PUBLIC_ROUTES.map((r) => `https://example.org${r}`));
  });

  it('firebase.json sends X-Robots-Tag noindex for every private source', () => {
    const config = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
      hosting: { headers: { source: string; headers: { key: string; value: string }[] }[] };
    };
    const noindexed = config.hosting.headers
      .filter((h) => h.headers.some((x) => x.key === 'X-Robots-Tag' && x.value === 'noindex, nofollow'))
      .map((h) => h.source);
    expect(noindexed.sort()).toEqual(noindexHeaderSources().sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/seo/seoRoutes.test.ts`
Expected: FAIL — cannot resolve `./seoRoutes`.

- [ ] **Step 3: Implement `seoRoutes.ts`**

```ts
// src/seo/seoRoutes.ts
/** The only routes search engines may index (spec D3). */
export const PUBLIC_ROUTES = ['/login', '/privacy', '/request-access'] as const;

/** Private areas: path prefixes only, never IDs (robots.txt is public). */
export const PRIVATE_PREFIXES = ['/teams', '/exercises', '/trainings', '/admin', '/settings', '/finish-sign-in'] as const;

export function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    ...PUBLIC_ROUTES.map((r) => `Allow: ${r}`),
    'Disallow: /$',
    ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(origin: string): string {
  const urls = PUBLIC_ROUTES.map((r) => `  <url><loc>${origin}${r}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Firebase Hosting `source` globs that must carry `X-Robots-Tag: noindex, nofollow`. */
export function noindexHeaderSources(): string[] {
  return ['/', ...PRIVATE_PREFIXES.flatMap((p) => [p, `${p}/**`])];
}
```

- [ ] **Step 4: Add the headers to `firebase.json`**

Inside `hosting.headers`, after the existing `"source": "**"` block, add one entry per value of `noindexHeaderSources()` (13 entries):

```json
{ "source": "/", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/teams", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/teams/**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/exercises", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/exercises/**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/trainings", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/trainings/**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/admin", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/admin/**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/settings", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/settings/**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/finish-sign-in", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] },
{ "source": "/finish-sign-in/**", "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }] }
```

- [ ] **Step 5: Emit robots.txt / sitemap.xml at build time**

Modify `vite.config.ts`:

```ts
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { robotsTxt, sitemapXml } from './src/seo/seoRoutes';

function seoFiles(origin: string): Plugin {
  return {
    name: 'vcb-seo-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(origin) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(origin) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const origin = (env.VITE_SITE_URL || 'https://volley-skills.web.app').replace(/\/$/, '');
  return {
    plugins: [react(), seoFiles(origin)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setupTests.ts',
      exclude: ['**/node_modules/**', '**/dist/**', 'tests/rules/**'],
    },
  };
});
```

Keep the `/// <reference types="vitest" />` or `vitest/config` typing that the file had: if `test` errors in types, import `defineConfig` from `'vitest/config'` instead (it re-exports `loadEnv`-compatible config) and import `loadEnv`/`Plugin` from `'vite'`. Check `tsconfig.node.json` includes `src/seo/seoRoutes.ts` if the config typecheck complains (add it to `include`).

Append to `.env.example` (create if missing):

```
# Public origin used for canonical URLs, robots.txt and sitemap.xml
VITE_SITE_URL=https://volley-skills.web.app
```

- [ ] **Step 6: Icons, OG image, manifest, index.html**

Create `public/og-image.svg` (1200×630): navy (`#2356A8`) background, white "Volley Skills" in Inter 800 at 96 px centred, "Volley Club Belair" below in 40 px at 80% white, an orange (`#F97316`) 12 px bar under the title. No people.

Create `public/icon-maskable.svg`: copy of `public/favicon.svg` content placed on a full-bleed navy square with the mark scaled to the central 80% (maskable safe zone).

Rasterise once (tool is fetched by npx, not added to package.json):

```bash
npx --yes @resvg/resvg-js-cli --fit-width 1200 public/og-image.svg public/og-image.png
npx --yes @resvg/resvg-js-cli --fit-width 192 public/favicon.svg public/icon-192.png
npx --yes @resvg/resvg-js-cli --fit-width 512 public/favicon.svg public/icon-512.png
npx --yes @resvg/resvg-js-cli --fit-width 512 public/icon-maskable.svg public/icon-maskable-512.png
```

`public/manifest.webmanifest`:

```json
{
  "name": "Volley Skills · VCB",
  "short_name": "Volley Skills",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#F8FAFC",
  "theme_color": "#2356A8",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

(Replace `#F8FAFC` with the light `--color-bg` value from `src/index.css` if it differs.)

`index.html` `<head>` becomes:

```html
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Volley Skills · VCB</title>
<meta name="description" content="Volley Skills — team, player, training and match scouting tool for Volley Club Belair." />
<meta name="robots" content="noindex, nofollow" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" content="#2356A8" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#1C4586" media="(prefers-color-scheme: dark)" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Volley Skills · VCB" />
<meta property="og:description" content="Team, player, training and match scouting tool for Volley Club Belair." />
<meta property="og:image" content="/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<!-- No-flash dark-mode init. External (not inline) so the prod CSP is `script-src 'self'`. -->
<script src="/theme-init.js"></script>
```

and in `<body>` before `#root`: `<noscript>Volley Skills needs JavaScript to run.</noscript>`.

The static `robots` meta is `noindex` because the HTML shell is served for every path; public pages flip it to `index` via `usePageMeta` once rendered (Google renders JS), while private paths are additionally blocked by the header. Inter preload: skip (the fontsource CSS is hashed by Vite; preloading a guessed URL would 404) — note this in the commit message.

- [ ] **Step 7: Run tests and build**

Run: `npx vitest run src/seo/seoRoutes.test.ts && npm run build && ls dist/robots.txt dist/sitemap.xml dist/manifest.webmanifest`
Expected: tests PASS; build succeeds; three files listed.

- [ ] **Step 8: Commit**

```bash
git add src/seo vite.config.ts firebase.json index.html public .env.example tsconfig.node.json
git commit -m "feat(seo): robots/sitemap at build, X-Robots-Tag on private paths, OG/manifest/icons

Inter is not preloaded: fontsource files are content-hashed by Vite."
```

---

### Task 3: NotFoundState, NotFoundPage, catch-all route

**Files:**
- Create: `src/components/NotFoundState.tsx`, `src/components/NotFoundState.test.tsx`, `src/layout/NotFoundPage.tsx`, `src/layout/NotFoundPage.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Produces: `NotFoundState({ title, message?, backTo, backLabel, illustration? }: NotFoundStateProps)`, `NotFoundPage()`, `isNotFoundError(e: unknown): boolean` (true for Firestore `permission-denied` / `not-found`) exported from `NotFoundState.tsx`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/NotFoundState.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NotFoundState, isNotFoundError } from './NotFoundState';

describe('NotFoundState', () => {
  it('renders title, message and back link', () => {
    render(
      <MemoryRouter>
        <NotFoundState title="Match not found" message="It may have been deleted." backTo="/teams/t1" backLabel="Back to team" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
    expect(screen.getByText('It may have been deleted.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to team' })).toHaveAttribute('href', '/teams/t1');
  });

  it('treats permission-denied and not-found as not found', () => {
    expect(isNotFoundError({ code: 'permission-denied' })).toBe(true);
    expect(isNotFoundError({ code: 'not-found' })).toBe(true);
    expect(isNotFoundError({ code: 'unavailable' })).toBe(false);
    expect(isNotFoundError(new Error('x'))).toBe(false);
  });
});
```

```tsx
// src/layout/NotFoundPage.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('shows the path, sets noindex, links home', () => {
    render(
      <MemoryRouter initialEntries={['/nope/here']}>
        <Routes>
          <Route path="/" element={<p>home page</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'This page is out of bounds' })).toBeInTheDocument();
    expect(screen.getByText('/nope/here')).toBeInTheDocument();
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow');
    fireEvent.click(screen.getByRole('link', { name: 'Go home' }));
    expect(screen.getByText('home page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/NotFoundState.test.tsx src/layout/NotFoundPage.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/NotFoundState.tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

export interface NotFoundStateProps {
  title: string;
  message?: string;
  backTo: string;
  backLabel: string;
  illustration?: ReactNode;
}

/** Firestore answers `permission-denied` for docs you can't read: show "not found" so existence isn't leaked. */
export function isNotFoundError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return code === 'permission-denied' || code === 'not-found';
}

export function NotFoundState({ title, message, backTo, backLabel, illustration }: NotFoundStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {illustration ?? <SearchX size={48} strokeWidth={1.5} className="text-slate" aria-hidden="true" />}
      <h1 tabIndex={-1} className="mt-4 text-2xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>
      {message && <p className="mt-2 text-slate">{message}</p>}
      <Link to={backTo} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-blue px-4 font-medium text-white hover:bg-blue-strong">
        {backLabel}
      </Link>
    </div>
  );
}
```

```tsx
// src/layout/NotFoundPage.tsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePageMeta } from './usePageMeta';

function OutOfBounds() {
  return (
    <svg viewBox="0 0 160 100" className="h-28 w-44" aria-hidden="true">
      <rect x="10" y="20" width="110" height="70" rx="4" className="fill-none stroke-border" strokeWidth="3" />
      <line x1="65" y1="20" x2="65" y2="90" className="stroke-border" strokeWidth="3" />
      <circle cx="138" cy="34" r="14" className="fill-orange" />
      <path d="M126 30c8 2 16 2 24 0M128 42c6-6 14-8 20-6" className="fill-none stroke-white" strokeWidth="2" />
      <path d="M100 70 Q120 30 132 40" className="fill-none stroke-slate" strokeDasharray="4 4" strokeWidth="2" />
    </svg>
  );
}

export function NotFoundPage() {
  usePageMeta({ title: 'Not found' });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <OutOfBounds />
      <h1 tabIndex={-1} className="mt-4 text-2xl font-semibold tracking-[-0.01em] text-ink">This page is out of bounds</h1>
      <p className="mt-2 text-slate">
        Nothing lives at <code className="rounded-sm bg-bg px-1 text-ink">{pathname}</code>
      </p>
      <div className="mt-6 flex gap-2">
        <Link to="/" className="inline-flex min-h-11 items-center rounded-md bg-blue px-4 font-medium text-white hover:bg-blue-strong">
          Go home
        </Link>
        <button
          type="button"
          onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 font-medium text-ink hover:bg-bg"
        >
          Back
        </button>
      </div>
    </div>
  );
}
```

Note: the NotFoundPage test asserts the path text inside `<code>`; `getByText('/nope/here')` matches the `<code>` element.

In `src/App.tsx`, inside the `<Route element={<AuthenticatedLayout />}>` block, add as the **last** child:

```tsx
<Route path="*" element={<NotFoundPage />} />
```

(import `NotFoundPage` from `'./layout/NotFoundPage'`). Leave the `/` redirect for now — Task 8 replaces it.

- [ ] **Step 4: Add the App-level test**

In `src/App.test.tsx`, following its existing pattern for rendering a signed-in user at a URL, add:

```tsx
it('renders the 404 page for an unknown URL', async () => {
  // use the file's existing helper that renders <App/> signed in at a path, e.g. renderAt('/does-not-exist')
  renderAt('/does-not-exist');
  expect(await screen.findByRole('heading', { name: 'This page is out of bounds' })).toBeInTheDocument();
});
```

If `App.test.tsx` has no such helper, set `window.history.pushState({}, '', '/does-not-exist')` before `render(<App />)` with `useAuth` mocked via `authValue()` from `src/test/authValue.ts`, as the other tests in that file do.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/components/NotFoundState.test.tsx src/layout/NotFoundPage.test.tsx src/App.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/NotFoundState.tsx src/components/NotFoundState.test.tsx src/layout/NotFoundPage.tsx src/layout/NotFoundPage.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat(ui): 404 page and shared not-found state"
```

---

### Task 4: Use `NotFoundState` on resource pages

**Files:**
- Modify: `src/matches/MatchPage.tsx`, `src/matches/scout/ScoutPage.tsx`, `src/teams/TeamPage.tsx`, `src/players/PlayerCardPage.tsx`, `src/diagrams/DiagramEditorPage.tsx` (and any exercise/training detail view that prints a not-found string — find them with the grep in Step 1)
- Test: `src/matches/MatchPage.test.tsx`, `src/teams/TeamPage.test.tsx`

**Interfaces:**
- Consumes: `NotFoundState`, `isNotFoundError` (Task 3).

- [ ] **Step 1: Find every not-found / no-access message**

Run: `npx rg -n "not found|don't have access|Could not load (team|match|player)" src --glob '!*.test.*'`
Expected: hits in `MatchPage.tsx` ("Match not found."), `ScoutPage.tsx` ("Match not found."), `TeamPage.tsx` ("You don't have access to this team."), plus any others. Each one gets the treatment below.

- [ ] **Step 2: Write failing tests**

Append to `src/matches/MatchPage.test.tsx`:

```tsx
it('shows the not-found state for a missing match', async () => {
  vi.mocked(matchesApi.getMatch).mockResolvedValue(null);
  renderPage();
  expect(await screen.findByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to team' })).toHaveAttribute('href', '/teams/t1');
});

it('shows the same state when access is denied', async () => {
  vi.mocked(matchesApi.getMatch).mockRejectedValue({ code: 'permission-denied' });
  renderPage();
  expect(await screen.findByRole('heading', { name: 'Match not found' })).toBeInTheDocument();
});
```

Append to `src/teams/TeamPage.test.tsx` (use the file's existing render helper and `teamsApi` mock):

```tsx
it('shows the not-found state when the team cannot be read', async () => {
  vi.mocked(teamsApi.getTeam).mockRejectedValue({ code: 'permission-denied' });
  renderTeamPage(); // existing helper in this file
  expect(await screen.findByRole('heading', { name: 'Team not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'All teams' })).toHaveAttribute('href', '/teams');
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/matches/MatchPage.test.tsx src/teams/TeamPage.test.tsx`
Expected: FAIL — headings not found.

- [ ] **Step 4: Implement**

`MatchPage.tsx`: replace the `.then((m) => (m ? setMatch(m) : setError('Match not found.')))` pattern with a `notFound` state:

```tsx
const [notFound, setNotFound] = useState(false);
// in the load effect:
getMatch(teamId, matchId)
  .then((m) => (m ? setMatch(m) : setNotFound(true)))
  .catch((e) => (isNotFoundError(e) ? setNotFound(true) : setError('Could not load this match.')));
// before other early returns:
if (notFound) {
  return <NotFoundState title="Match not found" message="It may have been deleted, or you don't have access." backTo={`/teams/${teamId}`} backLabel="Back to team" />;
}
```

`ScoutPage.tsx`: same, `backTo={\`/teams/${teamId}\`}`, `backLabel="Back to team"`, wherever it sets `'Match not found.'`.

`TeamPage.tsx`: replace the `setError("You don't have access to this team.")` branch:

```tsx
const [notFound, setNotFound] = useState(false);
void getTeam(teamId)
  .then((t) => (t ? setTeam(t) : setNotFound(true)))
  .catch(() => setNotFound(true));
if (notFound) return <NotFoundState title="Team not found" message="It may have been deleted, or you don't have access." backTo="/teams" backLabel="All teams" />;
```

`PlayerCardPage.tsx`: when the player (or its team) load returns null or rejects with `isNotFoundError`, render `<NotFoundState title="Player not found" backTo={\`/teams/${teamId}\`} backLabel="Back to team" />`.

`DiagramEditorPage.tsx` (exercise missing): `<NotFoundState title="Exercise not found" backTo="/exercises" backLabel="All exercises" />`.

Any other hit from Step 1 follows the same shape with the nearest list page as `backTo`.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (update any older assertions on the removed strings).

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(ui): friendly not-found state for missing or inaccessible team/player/match/exercise"
```

---

### Task 5: Return to deep link after sign-in; land on `/`

**Files:**
- Create: `src/auth/returnTo.ts`, `src/auth/returnTo.test.ts`
- Modify: `src/auth/RequireAuth.tsx`, `src/auth/FinishSignInPage.tsx`, `src/auth/LoginPage.tsx`, `src/teams/TeamSettingsTab.tsx`
- Test: existing `src/auth/FinishSignInPage.test.tsx` (if present) / `src/auth/LoginPage.test.tsx`

**Interfaces:**
- Produces: `rememberReturnTo(path: string): void`, `takeReturnTo(): string` (returns a safe path or `'/'`, removes the key), `isSafeReturnPath(p: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/auth/returnTo.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSafeReturnPath, rememberReturnTo, takeReturnTo } from './returnTo';

describe('returnTo', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a path once', () => {
    rememberReturnTo('/teams/t1/matches/m1');
    expect(takeReturnTo()).toBe('/teams/t1/matches/m1');
    expect(takeReturnTo()).toBe('/');
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', 'teams'])(
    'rejects %s',
    (p) => {
      expect(isSafeReturnPath(p)).toBe(false);
      rememberReturnTo(p);
      expect(takeReturnTo()).toBe('/');
    },
  );

  it('does not remember login or the sign-in callback', () => {
    rememberReturnTo('/login');
    expect(takeReturnTo()).toBe('/');
    rememberReturnTo('/finish-sign-in?x=1');
    expect(takeReturnTo()).toBe('/');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberReturnTo('/teams')).not.toThrow();
    expect(takeReturnTo()).toBe('/');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/auth/returnTo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/auth/returnTo.ts
const KEY = 'vcb.auth.returnTo';

/** Same-origin app paths only: no protocol, no protocol-relative `//`, no backslash tricks. */
export function isSafeReturnPath(p: string): boolean {
  return /^\/(?![/\\])/.test(p) && !/[\\]/.test(p) && !p.startsWith('/login') && !p.startsWith('/finish-sign-in');
}

/** localStorage, not sessionStorage: the email link may open in a new tab. */
export function rememberReturnTo(path: string): void {
  if (!isSafeReturnPath(path)) return;
  try {
    localStorage.setItem(KEY, path);
  } catch {
    /* storage blocked: fall back to home */
  }
}

export function takeReturnTo(): string {
  try {
    const value = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return value && isSafeReturnPath(value) ? value : '/';
  } catch {
    return '/';
  }
}
```

`RequireAuth.tsx` — before `return <Navigate to="/login" replace />`:

```tsx
import { useLocation } from 'react-router-dom';
import { rememberReturnTo } from './returnTo';
// inside the component (top, with other hooks):
const location = useLocation();
// replace the redirect line:
if (!firebaseUser) {
  rememberReturnTo(`${location.pathname}${location.search}`);
  return <Navigate to="/login" replace />;
}
```

`FinishSignInPage.tsx`: `navigate('/teams', { replace: true })` → `navigate(takeReturnTo(), { replace: true })`.
`LoginPage.tsx` (already-signed-in redirect at line ~38): `navigate('/teams', …)` → `navigate(takeReturnTo(), …)`.
`TeamSettingsTab.tsx` (after delete): `navigate('/teams', …)` → `navigate('/', …)`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/auth src/teams/TeamSettingsTab.test.tsx`
Expected: PASS after updating any assertion that expected navigation to `/teams` (now `/`).

- [ ] **Step 5: Commit**

```bash
git add src/auth src/teams/TeamSettingsTab.tsx src/teams/TeamSettingsTab.test.tsx
git commit -m "feat(auth): return to the requested page after sign-in; land on home"
```

---

### Task 6: AppShell — Home nav, skip link, `<main>`, route focus, phone bar cap

**Files:**
- Modify: `src/layout/AppShell.tsx`
- Test: `src/layout/AppShell.test.tsx` (create if absent)

**Interfaces:**
- Produces: `<main id="main" tabIndex={-1}>` wrapping page content; first sidebar item `{ to: '/', label: 'Home', Icon: House, end: true }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/layout/AppShell.test.tsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { authValue, superAdminAccess } from '../test/authValue';
import { AppShell } from './AppShell';

vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

function renderShell() {
  render(
    <MemoryRouter initialEntries={['/teams']}>
      <AppShell>
        <h1>Teams</h1>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('has a skip link to main and Home first in the sidebar', () => {
    useAuthMock.mockReturnValue(authValue());
    renderShell();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')?.tagName).toBe('MAIN');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = within(nav).getAllByRole('link').map((l) => l.textContent?.trim());
    expect(labels.indexOf('Home')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Home')).toBeLessThan(labels.indexOf('Teams'));
  });

  it('caps the phone bottom bar at 5 items for a superadmin', () => {
    useAuthMock.mockReturnValue(authValue({ access: superAdminAccess, appUser: { uid: 'u-1', email: 'user@example.com', role: 'superadmin' } }));
    renderShell();
    const bottom = screen.getByRole('navigation', { name: 'Main (phone)' });
    expect(within(bottom).getAllByRole('link')).toHaveLength(5);
    expect(within(bottom).queryByText('Guides')).toBeNull();
    expect(within(bottom).queryByText('Access')).toBeNull();
  });
});
```

If `AppShell` reads other hooks/contexts (theme, unsynced writes), mock them the way existing tests that render `AppShell` do (grep `AppShell` in `src/**/*.test.tsx`); copy those mocks.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/layout/AppShell.test.tsx`
Expected: FAIL — no skip link / no Home.

- [ ] **Step 3: Implement**

In `AppShell.tsx`:

1. Import `House` from `lucide-react`, `useLocation` from `react-router-dom`, `useEffect, useRef` from `react`.
2. Add `end?: boolean` to the nav item type and prepend `{ to: '/', label: 'Home', Icon: House, show: true, end: true }` to `navItems`; pass `end={end}` to every `NavLink` (so Home is not active on every route).
3. Wrap the logo (`<Logo … />`) in `<NavLink to="/" aria-label="Volley Skills home">…</NavLink>`.
4. Skip link as the first child of the root element:

```tsx
<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ink focus:shadow-pop">
  Skip to content
</a>
```

5. Replace `<div className="mx-auto w-full max-w-screen-xl">{children}</div>` with:

```tsx
<main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-screen-xl focus:outline-none">
  {children}
</main>
```

6. Route focus (skip the very first render so initial load doesn't steal focus):

```tsx
const { pathname } = useLocation();
const mainRef = useRef<HTMLElement>(null);
const firstRender = useRef(true);
useEffect(() => {
  if (firstRender.current) {
    firstRender.current = false;
    return;
  }
  const heading = mainRef.current?.querySelector<HTMLElement>('h1');
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  } else {
    mainRef.current?.focus({ preventScroll: true });
  }
}, [pathname]);
```

7. Bottom bar: give the `<nav>` `aria-label="Main (phone)"` (and the sidebar nav `aria-label="Main"`), and render only non-admin items, capped so total with Settings ≤ 5:

```tsx
const phoneItems = navItems.filter((i) => i.show && !i.admin).slice(0, 4);
// map phoneItems instead of navItems in the bottom <nav>; Settings stays as the 5th.
```

Admin items stay in the sidebar group and are added to the account `Menu` items for phones only if not already reachable — add `{ kind: 'action', label: 'Guides', onSelect: () => navigate('/admin/guides') }` / `'Access'` entries when `access.sections.guides` / `access.isSuperAdmin` (the account menu is visible on all sizes, which is acceptable).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/layout src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/layout
git commit -m "feat(ui): Home nav item, skip link, main landmark, focus on route change, 5-item phone bar"
```

---

### Task 7: `isTeamAdmin` helper + `homeFeed` pure logic

**Files:**
- Create: `src/teams/teamAccess.ts`, `src/teams/teamAccess.test.ts`, `src/home/homeFeed.ts`, `src/home/homeFeed.test.ts`

**Interfaces:**
- Produces:
  - `isTeamAdmin(team: Pick<Team, 'adminEmails'>, email: string | null | undefined, access: Access | null): boolean`
  - `interface FeedInput { team: Team; sessions: CalendarSession[]; matches: Match[] }`
  - `interface FeedMatch { team: Team; match: Match }`
  - `type FeedItem = { kind: 'session'; date: string; team: Team; session: CalendarSession } | { kind: 'match'; date: string; team: Team; match: Match }`
  - `liveMatches(input: FeedInput[]): FeedMatch[]`
  - `nextUp(input: FeedInput[], today: string, days?: number): FeedItem[]`
  - `recentResults(input: FeedInput[], limit?: number): FeedMatch[]`
  - `addDays(iso: string, n: number): string`, `todayIso(now?: Date): string`

- [ ] **Step 1: Write the failing tests**

```ts
// src/teams/teamAccess.test.ts
import { describe, expect, it } from 'vitest';
import { isTeamAdmin } from './teamAccess';
import { superAdminAccess } from '../test/authValue';

describe('isTeamAdmin', () => {
  const team = { adminEmails: ['coach@x.be'] };
  it('true for listed email', () => expect(isTeamAdmin(team, 'coach@x.be', null)).toBe(true));
  it('true for superadmin', () => expect(isTeamAdmin(team, 'boss@x.be', superAdminAccess)).toBe(true));
  it('false otherwise', () => {
    expect(isTeamAdmin(team, 'parent@x.be', null)).toBe(false);
    expect(isTeamAdmin(team, null, null)).toBe(false);
  });
});
```

```ts
// src/home/homeFeed.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import type { CalendarSession } from '../types/calendarSession';
import type { Team } from '../types/team';
import { addDays, liveMatches, nextUp, recentResults, todayIso } from './homeFeed';

const team = (id: string): Team => ({
  id, name: id.toUpperCase(), club: 'VCB', ageGroup: 'U17', season: '2026-27', description: '', notes: '',
  adminEmails: [], developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' }, createdBy: '', createdAt: null,
});
const match = (id: string, date: string, status: Match['status'], setsUs = 0, setsThem = 0): Match => ({
  id, date, opponent: `Opp ${id}`, competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster: [], liberos: [],
  status, result: { setsUs, setsThem, sets: [] }, summary: null, usageContribution: null, activeDevice: null,
  createdBy: '', createdAt: null, updatedAt: null,
});
const session = (id: string, date: string): CalendarSession => ({
  id, date, trainingId: 't', trainingBusinessId: 'TR-1', trainingName: `Training ${id}`, notes: '', createdBy: '', createdAt: null,
});

describe('homeFeed', () => {
  it('date helpers', () => {
    expect(addDays('2026-10-14', 7)).toBe('2026-10-21');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(todayIso(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
  });

  it('collects live matches across teams', () => {
    const out = liveMatches([
      { team: team('a'), sessions: [], matches: [match('m1', '2026-10-14', 'live'), match('m2', '2026-10-10', 'finished')] },
      { team: team('b'), sessions: [], matches: [match('m3', '2026-10-14', 'live')] },
    ]);
    expect(out.map((x) => x.match.id)).toEqual(['m1', 'm3']);
  });

  it('next up: sessions and setup matches within [today, today+7], sorted', () => {
    const out = nextUp(
      [
        { team: team('a'), sessions: [session('s1', '2026-10-16'), session('s0', '2026-10-13')], matches: [match('m1', '2026-10-21', 'setup'), match('m9', '2026-10-22', 'setup')] },
        { team: team('b'), sessions: [session('s2', '2026-10-14')], matches: [match('m2', '2026-10-15', 'finished')] },
      ],
      '2026-10-14',
    );
    expect(out.map((i) => (i.kind === 'session' ? i.session.id : i.match.id))).toEqual(['s2', 's1', 'm1']);
  });

  it('recent results: finished only, newest first, limited', () => {
    const matches = ['01', '02', '03', '04', '05', '06'].map((d, i) => match(`m${i}`, `2026-10-${d}`, 'finished', 3, 1));
    const out = recentResults([{ team: team('a'), sessions: [], matches: [...matches, match('live', '2026-10-07', 'live')] }]);
    expect(out.map((x) => x.match.id)).toEqual(['m5', 'm4', 'm3', 'm2', 'm1']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/teams/teamAccess.test.ts src/home/homeFeed.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// src/teams/teamAccess.ts
import type { Access } from '../auth/access';
import type { Team } from '../types/team';

/** Mirrors the rules' isTeamAdmin(): listed in adminEmails, or a superadmin. */
export function isTeamAdmin(team: Pick<Team, 'adminEmails'>, email: string | null | undefined, access: Access | null): boolean {
  return !!access?.isSuperAdmin || (!!email && team.adminEmails.includes(email));
}
```

```ts
// src/home/homeFeed.ts
import type { CalendarSession } from '../types/calendarSession';
import type { Match } from '../types/match';
import type { Team } from '../types/team';

export interface FeedInput { team: Team; sessions: CalendarSession[]; matches: Match[] }
export interface FeedMatch { team: Team; match: Match }
export type FeedItem =
  | { kind: 'session'; date: string; team: Team; session: CalendarSession }
  | { kind: 'match'; date: string; team: Team; match: Match };

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date, ISO "YYYY-MM-DD" (calendar dates are local, not UTC). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return todayIso(new Date(y, m - 1, d + n));
}

export function liveMatches(input: FeedInput[]): FeedMatch[] {
  return input.flatMap(({ team, matches }) => matches.filter((m) => m.status === 'live').map((match) => ({ team, match })));
}

export function nextUp(input: FeedInput[], today: string, days = 7): FeedItem[] {
  const end = addDays(today, days);
  const inWindow = (d: string) => d >= today && d <= end;
  const items: FeedItem[] = input.flatMap(({ team, sessions, matches }) => [
    ...sessions.filter((s) => inWindow(s.date)).map((session) => ({ kind: 'session' as const, date: session.date, team, session })),
    ...matches.filter((m) => m.status === 'setup' && inWindow(m.date)).map((match) => ({ kind: 'match' as const, date: match.date, team, match })),
  ]);
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.team.name.localeCompare(b.team.name));
}

export function recentResults(input: FeedInput[], limit = 5): FeedMatch[] {
  return input
    .flatMap(({ team, matches }) => matches.filter((m) => m.status === 'finished').map((match) => ({ team, match })))
    .sort((a, b) => b.match.date.localeCompare(a.match.date))
    .slice(0, limit);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/teams/teamAccess.test.ts src/home/homeFeed.test.ts`
Expected: PASS.

- [ ] **Step 5: Use `isTeamAdmin` in PlayerCardPage**

Replace `setIsAdmin(Boolean(firebaseUser?.email && fetchedTeam?.adminEmails.includes(firebaseUser.email)))` with `setIsAdmin(!!fetchedTeam && isTeamAdmin(fetchedTeam, firebaseUser?.email, access))` (pull `access` from `useAuth()`; add it to the effect deps). Run `npx vitest run src/players/PlayerCardPage.test.tsx` — PASS.

- [ ] **Step 6: Commit**

```bash
git add src/teams/teamAccess.ts src/teams/teamAccess.test.ts src/home src/players/PlayerCardPage.tsx
git commit -m "feat(home): feed logic (live, next 7 days, recent results) and isTeamAdmin helper"
```

---

### Task 8: HomePage and route `/`

**Files:**
- Create: `src/home/HomePage.tsx`, `src/home/HomePage.test.tsx`, `src/home/LiveNowBlock.tsx`, `src/home/NextUpBlock.tsx`, `src/home/RecentResultsBlock.tsx`, `src/home/useHomeFeed.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `listMyTeams` (teamsApi), `listCalendarSessions(teamId, start, end)` (calendarApi — verify argument order in `src/calendar/calendarApi.ts:18`), `listMatchesInRange(teamId, start, end)`, `homeFeed` functions, `isTeamAdmin`, `usePageMeta`.
- Produces: `useHomeFeed(email: string | null): HomeFeedState` where
  `interface HomeFeedState { loading: boolean; teams: Team[]; hasMoreTeams: boolean; feed: FeedInput[]; errors: { sessions: boolean; matches: boolean; teams: boolean } }`;
  `RecentResultsBlock({ items, mvpFor? }: { items: FeedMatch[]; mvpFor?: (fm: FeedMatch) => string | null })` (Task 26 passes `mvpFor`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/home/HomePage.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue } from '../test/authValue';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import type { Team } from '../types/team';
import { HomePage } from './HomePage';
import * as teamsApi from '../teams/teamsApi';
import * as calendarApi from '../calendar/calendarApi';
import * as matchesApi from '../matches/matchesApi';

vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../teams/teamsApi');
vi.mock('../calendar/calendarApi');
vi.mock('../matches/matchesApi');
const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const team: Team = {
  id: 't1', name: 'U17 Girls', club: 'VCB', ageGroup: 'U17', season: '2026-27', description: '', notes: '',
  adminEmails: ['user@example.com'], developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' }, createdBy: '', createdAt: null,
};
const live: Match = {
  id: 'm1', date: '2026-10-14', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster: [], liberos: [],
  status: 'live', result: { setsUs: 1, setsThem: 0, sets: [] }, summary: null, usageContribution: null, activeDevice: null, createdBy: '', createdAt: null, updatedAt: null,
};

function renderHome() {
  render(<MemoryRouter><HomePage /></MemoryRouter>);
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 18, 0));
    useAuthMock.mockReturnValue(authValue());
    vi.mocked(teamsApi.listMyTeams).mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });
    vi.mocked(calendarApi.listCalendarSessions).mockResolvedValue([]);
    vi.mocked(matchesApi.listMatchesInRange).mockResolvedValue([live]);
  });

  it('greets and shows a live match to resume', async () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: /Good evening/ })).toBeInTheDocument();
    const resume = await screen.findByRole('link', { name: /Resume scouting/ });
    expect(resume).toHaveAttribute('href', '/teams/t1/matches/m1/scout');
  });

  it('shows the no-access card when the user has no teams or sections', async () => {
    vi.mocked(teamsApi.listMyTeams).mockResolvedValue({ teams: [], lastDoc: null, hasMore: false });
    renderHome();
    expect(await screen.findByText("You don't have access to any team yet")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request access' })).toHaveAttribute('href', '/request-access');
  });

  it('a failing calendar does not hide matches', async () => {
    vi.mocked(calendarApi.listCalendarSessions).mockRejectedValue(new Error('x'));
    renderHome();
    expect(await screen.findByText('Could not load upcoming sessions.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Resume scouting/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/home/HomePage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the data hook**

```ts
// src/home/useHomeFeed.ts
import { useEffect, useState } from 'react';
import { listCalendarSessions } from '../calendar/calendarApi';
import { listMatchesInRange } from '../matches/matchesApi';
import { listMyTeams } from '../teams/teamsApi';
import type { Team } from '../types/team';
import { addDays, todayIso, type FeedInput } from './homeFeed';

export interface HomeFeedState {
  loading: boolean;
  teams: Team[];
  hasMoreTeams: boolean;
  feed: FeedInput[];
  errors: { teams: boolean; sessions: boolean; matches: boolean };
}

export function useHomeFeed(email: string | null): HomeFeedState {
  const [state, setState] = useState<HomeFeedState>({
    loading: true, teams: [], hasMoreTeams: false, feed: [], errors: { teams: false, sessions: false, matches: false },
  });

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    const today = todayIso();
    void (async () => {
      let teams: Team[] = [];
      let hasMoreTeams = false;
      try {
        const page = await listMyTeams(email);
        teams = page.teams;
        hasMoreTeams = page.hasMore;
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, errors: { ...s.errors, teams: true } }));
        return;
      }
      let sessionsFailed = false;
      let matchesFailed = false;
      const feed = await Promise.all(
        teams.map(async (team): Promise<FeedInput> => {
          const [sessions, matches] = await Promise.all([
            listCalendarSessions(team.id, today, addDays(today, 7)).catch(() => {
              sessionsFailed = true;
              return [];
            }),
            listMatchesInRange(team.id, addDays(today, -30), addDays(today, 7)).catch(() => {
              matchesFailed = true;
              return [];
            }),
          ]);
          return { team, sessions, matches };
        }),
      );
      if (!cancelled) {
        setState({ loading: false, teams, hasMoreTeams, feed, errors: { teams: false, sessions: sessionsFailed, matches: matchesFailed } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  return state;
}
```

(If `listCalendarSessions`' signature differs, adapt the call — check `src/calendar/calendarApi.ts:18-31`.)

- [ ] **Step 4: Implement the blocks and page**

```tsx
// src/home/LiveNowBlock.tsx
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import type { FeedMatch } from './homeFeed';

export function LiveNowBlock({ items }: { items: FeedMatch[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="live-now" className="mb-6">
      <h2 id="live-now" className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-strong">
        <Radio size={16} aria-hidden="true" /> Live now
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ team, match }) => (
          <div key={match.id} className="rounded-lg border-2 border-red bg-surface p-4 shadow-card">
            <p className="text-xs text-slate">{team.name}</p>
            <p className="mt-1 text-lg font-semibold text-ink">vs {match.opponent}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink">
              {match.result.setsUs}–{match.result.setsThem}
            </p>
            <Link
              to={`/teams/${team.id}/matches/${match.id}/scout`}
              className="mt-3 inline-flex min-h-11 items-center rounded-md bg-red px-4 font-medium text-white hover:bg-red-strong"
            >
              Resume scouting
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// src/home/NextUpBlock.tsx
import { Link } from 'react-router-dom';
import type { FeedItem } from './homeFeed';

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export function NextUpBlock({ items, failed }: { items: FeedItem[]; failed: boolean }) {
  return (
    <section aria-labelledby="next-up" className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-card">
      <h2 id="next-up" className="mb-3 text-lg font-semibold text-ink">Next 7 days</h2>
      {failed && <p role="alert" className="mb-2 text-sm text-red">Could not load upcoming sessions.</p>}
      {items.length === 0 ? (
        <p className="text-slate">Nothing in the next 7 days.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.kind === 'session' ? `s-${item.session.id}` : `m-${item.match.id}`}>
              <Link
                to={item.kind === 'session' ? `/teams/${item.team.id}` : `/teams/${item.team.id}/matches/${item.match.id}`}
                className="flex min-h-11 items-center gap-3 py-2 hover:bg-bg"
              >
                <span className="w-24 shrink-0 text-sm tabular-nums text-slate">{fmtDay(item.date)}</span>
                <span className="rounded-sm bg-bg px-2 py-0.5 text-xs font-medium text-ink">{item.team.name}</span>
                <span className="truncate text-ink">{item.kind === 'session' ? item.session.trainingName : `vs ${item.match.opponent}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

```tsx
// src/home/RecentResultsBlock.tsx
import { Link } from 'react-router-dom';
import type { FeedMatch } from './homeFeed';

export function RecentResultsBlock({ items, failed, mvpFor }: { items: FeedMatch[]; failed: boolean; mvpFor?: (fm: FeedMatch) => string | null }) {
  return (
    <section aria-labelledby="recent" className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-card">
      <h2 id="recent" className="mb-3 text-lg font-semibold text-ink">Recent results</h2>
      {failed && <p role="alert" className="mb-2 text-sm text-red">Could not load matches.</p>}
      {items.length === 0 ? (
        <p className="text-slate">No finished matches yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((fm) => {
            const { team, match } = fm;
            const won = match.result.setsUs > match.result.setsThem;
            const mvp = mvpFor?.(fm) ?? null;
            return (
              <li key={match.id}>
                <Link to={`/teams/${team.id}/matches/${match.id}`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:bg-bg">
                  <span className={`rounded-sm px-2 py-0.5 text-xs font-bold text-white ${won ? 'bg-green-strong' : 'bg-red-strong'}`}>{won ? 'W' : 'L'}</span>
                  <span className="tabular-nums font-semibold text-ink">{match.result.setsUs}–{match.result.setsThem}</span>
                  <span className="text-ink">vs {match.opponent}</span>
                  <span className="text-sm text-slate">{team.name} · {match.date}</span>
                  {mvp && <span className="text-sm text-slate">MVP: {mvp}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

```tsx
// src/home/HomePage.tsx
import { Link } from 'react-router-dom';
import { ClipboardList, Dumbbell, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { PageSkeleton } from '../components/Skeleton';
import { usePageMeta } from '../layout/usePageMeta';
import { liveMatches, nextUp, recentResults, todayIso } from './homeFeed';
import { LiveNowBlock } from './LiveNowBlock';
import { NextUpBlock } from './NextUpBlock';
import { RecentResultsBlock } from './RecentResultsBlock';
import { useHomeFeed } from './useHomeFeed';

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function HomePage() {
  usePageMeta({ title: 'Home' });
  const { appUser, access } = useAuth();
  const email = appUser?.email ?? null;
  const name = (email?.split('@')[0] ?? '').split(/[._-]/)[0];
  const state = useHomeFeed(email);
  const anySection = !!access && (access.sections.exercises || access.sections.trainings || access.isSuperAdmin);
  const today = todayIso();

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">
        {greeting()}{name ? `, ${name.charAt(0).toUpperCase()}${name.slice(1)}` : ''}
      </h1>
      <p className="mb-6 mt-1 text-slate">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {state.loading ? (
        <PageSkeleton layout="team" label="Loading your dashboard..." />
      ) : state.errors.teams ? (
        <p role="alert" className="text-red">Could not load your teams.</p>
      ) : state.teams.length === 0 && !anySection ? (
        <div className="max-w-lg rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-ink">You don't have access to any team yet</h2>
          <p className="mt-2 text-slate">A club administrator grants access to teams and sections. Ask them, or send a request.</p>
          <Link to="/request-access" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-blue px-4 font-medium text-white hover:bg-blue-strong">
            Request access
          </Link>
        </div>
      ) : (
        <>
          <LiveNowBlock items={liveMatches(state.feed)} />
          <div className="grid gap-6 lg:grid-cols-2">
            <NextUpBlock items={nextUp(state.feed, today)} failed={state.errors.sessions} />
            <RecentResultsBlock items={recentResults(state.feed)} failed={state.errors.matches} />
          </div>
          {state.teams.length > 0 && (
            <section aria-labelledby="your-teams" className="mb-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="your-teams" className="text-lg font-semibold text-ink">Your teams</h2>
                <Link to="/teams" className="text-sm text-blue hover:underline">All teams →</Link>
              </div>
              {state.hasMoreTeams && <p className="mb-2 text-sm text-slate">Showing your first {state.teams.length} teams.</p>}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {state.teams.map((t) => (
                  <li key={t.id}>
                    <Link to={`/teams/${t.id}`} className="block rounded-lg border border-border bg-surface p-4 shadow-card hover:border-blue">
                      <p className="font-semibold text-ink">{t.name}</p>
                      <p className="text-sm text-slate">{t.ageGroup} · {t.season}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-label="Shortcuts" className="flex flex-wrap gap-2">
            <Link to="/teams" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-ink hover:bg-bg"><Users size={16} aria-hidden="true" /> Teams</Link>
            {access?.sections.exercises && <Link to="/exercises" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-ink hover:bg-bg"><Dumbbell size={16} aria-hidden="true" /> Exercises</Link>}
            {access?.sections.trainings && <Link to="/trainings" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-ink hover:bg-bg"><ClipboardList size={16} aria-hidden="true" /> Trainings</Link>}
          </section>
        </>
      )}
    </div>
  );
}
```

Spec 3.1 lists per-team player count/avg level on team cards; those need a player read per team, which the "no extra reads" rule forbids here — the cards show age group + season instead. "New match" shortcut: the team page's Matches tab owns match creation, so the Teams shortcut covers it. (Both are deliberate narrowings; mention them in the PR description.)

`PageSkeleton` layouts: check `src/components/Skeleton.tsx` for valid `layout` values and pick the closest.

In `src/App.tsx`: remove `<Route path="/" element={<Navigate to="/teams" replace />} />` and add inside the authenticated layout block: `<Route path="/" element={<HomePage />} />`. Remove the `Navigate` import if now unused (it is still used by `/admin/interest`, so keep it if so).

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/home src/App.test.tsx`
Expected: PASS (update any App test that expected `/` → `/teams`).

- [ ] **Step 6: Commit**

```bash
git add src/home src/App.tsx src/App.test.tsx
git commit -m "feat(home): coach dashboard at / — live now, next 7 days, recent results, teams"
```

---

# Increment 2 — Team stats dashboard

### Task 9: `awardRules` — metrics, MVP score, rankings

**Files:**
- Create: `src/types/awards.ts`, `src/awards/awardRules.ts`, `src/awards/awardRules.test.ts`, `src/awards/testMatches.ts` (fixtures shared by award/stats tests)

**Interfaces:**
- Consumes: `mergeLines`, `attackEff`, `serveEff`, `ratio` from `src/matches/scoutStats.ts`; `GRADE_WEIGHTS` from `src/players/matchRating.ts`; `fmtEff`, `fmtPct` from `src/matches/format.ts`.
- Produces:
  - `src/types/awards.ts`: `type AwardId = 'mvp' | 'topScorer' | 'attacker' | 'server' | 'receiver' | 'blocker' | 'defender' | 'setter' | 'mostImproved' | 'everPresent'`; `type AwardScope = 'match' | 'season'`.
  - `AWARD_TITLES: Record<AwardId, string>`, `AWARDS_FOR: Record<AwardScope, AwardId[]>` (MVP last), `MVP_QUALITY_WEIGHT = 0.5`, `MIN_ATTEMPTS_FOR: Partial<Record<AwardId, { match: number; season: number }>>`
  - `quality(line: SkillLine | undefined): number | null`
  - `mvpScore(p: PlayerStats): number`
  - `scoutedMatches(matches: Match[]): Match[]` (summary present with ≥ 1 player action)
  - `mvpAverage(matches: Match[], playerId: string): number | null`
  - `interface Ranked { playerId: string; value: number; display: string; attempts: number | null; rank: number }`
  - `interface AwardRanking { id: AwardId; ranked: Ranked[]; notEnoughData: string[] }`
  - `rankAward(id: AwardId, scope: AwardScope, matches: Match[]): AwardRanking`

- [ ] **Step 1: Write fixtures**

```ts
// src/awards/testMatches.ts
import { DEFAULT_FORMAT, GRADES, type Grade, type Match, type PlayerStats, type Skill, type SkillLine } from '../types/match';
import { attackEff, serveEff, ratio } from '../matches/scoutStats';
import { rallyOutcome } from '../matches/skillGrades';

/** Builds a SkillLine from a grade string like "##+=": one char per action. */
export function line(grades: string): SkillLine {
  const counts = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  for (const g of grades) counts[g as Grade] += 1;
  return { attempts: grades.length, grades: counts };
}

/** PlayerStats from per-skill grade strings, points/errors derived like computeStats. */
export function player(playerId: string, skills: Partial<Record<Skill, string>>): PlayerStats {
  const lines: Partial<Record<Skill, SkillLine>> = {};
  let points = 0;
  let errors = 0;
  for (const [s, gs] of Object.entries(skills) as [Skill, string][]) {
    lines[s] = line(gs);
    for (const g of gs) {
      const o = rallyOutcome(s, g as Grade);
      if (o === 'us') points += 1;
      if (o === 'them') errors += 1;
    }
  }
  const r = lines.R;
  return {
    playerId, skills: lines, points, errors,
    attackEff: attackEff(lines.A), serveEff: serveEff(lines.S),
    receptionPos: r ? ratio(r.grades['#'] + r.grades['+'], r.attempts) : null,
    receptionPerfect: r ? ratio(r.grades['#'], r.attempts) : null,
  };
}

export function finished(id: string, date: string, players: PlayerStats[] | null, opts: Partial<Match> = {}): Match {
  return {
    id, date, opponent: `Opp ${id}`, competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
    roster: (players ?? []).map((p, i) => ({ playerId: p.playerId, number: i + 1, name: `Player ${p.playerId}`, positionCategory: 'OH' })),
    liberos: [], status: 'finished', result: { setsUs: 3, setsThem: 1, sets: [] },
    summary: players === null ? null : {
      players: Object.fromEntries(players.map((p) => [p.playerId, p])),
      team: {
        sideOut: { won: 10, total: 20 }, breakPoint: { won: 5, total: 20 }, oppErrorPoints: 4,
        rotations: { 1: { won: 4, lost: 2 }, 2: { won: 2, lost: 4 }, 3: { won: 3, lost: 3 }, 4: { won: 5, lost: 1 }, 5: { won: 1, lost: 5 }, 6: { won: 3, lost: 3 } },
        weakestRotation: 5, receptionPos: 0.5, attackEff: 0.2, aces: 3, serveErrors: 2,
      },
      timeoutEffects: [], sourceCounts: { tap: 0, text: 0 },
    },
    usageContribution: null, activeDevice: null, createdBy: '', createdAt: null, updatedAt: null,
    ...opts,
  };
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/awards/awardRules.test.ts
import { describe, expect, it } from 'vitest';
import { AWARDS_FOR, mvpAverage, mvpScore, quality, rankAward, scoutedMatches } from './awardRules';
import { finished, line, player } from './testMatches';

const A8 = (s: string) => s.padEnd(8, '!'); // pad to the match minimum with neutral grades

describe('awardRules', () => {
  it('lists awards per scope with MVP last', () => {
    expect(AWARDS_FOR.match).toEqual(['topScorer', 'attacker', 'server', 'receiver', 'blocker', 'defender', 'setter', 'mvp']);
    expect(AWARDS_FOR.season).toEqual(['topScorer', 'attacker', 'server', 'receiver', 'blocker', 'defender', 'setter', 'mostImproved', 'everPresent', 'mvp']);
  });

  it('quality uses grade weights', () => {
    expect(quality(line('####'))).toBe(1);
    expect(quality(line('===='))).toBe(0);
    expect(quality(line('#='))).toBe(0.5);
    expect(quality(undefined)).toBeNull();
  });

  it('mvpScore = points − errors + 0.5 × Σ attempts × (quality − 0.5)', () => {
    // A: "##=" → points 2, errors 1, quality 2/3 → 3 × (1/6) = 0.5 → × 0.5 = 0.25
    expect(mvpScore(player('p', { A: '##=' }))).toBeCloseTo(2 - 1 + 0.25);
    // R: "####" → 0 points, quality 1 → 4 × 0.5 × 0.5 = 1
    expect(mvpScore(player('p', { R: '####' }))).toBeCloseTo(1);
  });

  it('scoutedMatches skips null summaries and score-only matches', () => {
    const ms = [finished('a', '2026-10-01', null), finished('b', '2026-10-02', []), finished('c', '2026-10-03', [player('p', { S: '#' })])];
    expect(scoutedMatches(ms).map((m) => m.id)).toEqual(['c']);
  });

  it('match MVP ranks by score with tie-break fewer errors', () => {
    const m = finished('m', '2026-10-01', [player('a', { A: '##=' }), player('b', { A: '###' }), player('c', { R: '+' })]);
    const r = rankAward('mvp', 'match', [m]);
    expect(r.ranked[0].playerId).toBe('b');
    expect(r.ranked.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it('attacker needs 8 attempts in a match; below goes to notEnoughData', () => {
    const m = finished('m', '2026-10-01', [player('a', { A: A8('####') }), player('b', { A: '###' })]);
    const r = rankAward('attacker', 'match', [m]);
    expect(r.ranked.map((x) => x.playerId)).toEqual(['a']);
    expect(r.ranked[0].attempts).toBe(8);
    expect(r.ranked[0].display).toBe('+50% att. eff.');
    expect(r.notEnoughData).toEqual(['b']);
  });

  it('season attacker needs 30 attempts', () => {
    const ms = [1, 2, 3].map((i) => finished(`m${i}`, `2026-10-0${i}`, [player('a', { A: '#'.repeat(10) })]));
    expect(rankAward('attacker', 'season', ms).ranked.map((x) => x.playerId)).toEqual(['a']);
    expect(rankAward('attacker', 'season', ms.slice(0, 2)).notEnoughData).toEqual(['a']);
  });

  it('server tie-break: more aces', () => {
    // both serveEff 0: a has "#=" ×4 (4 aces), b has "!!" ×4 (0 aces)
    const m = finished('m', '2026-10-01', [player('b', { S: '!!!!!!!!' }), player('a', { S: '#=#=#=#=' })]);
    expect(rankAward('server', 'match', [m]).ranked.map((x) => x.playerId)).toEqual(['a', 'b']);
  });

  it('full ties share a rank and both are kept', () => {
    const m = finished('m', '2026-10-01', [player('a', { B: '#' }), player('b', { B: '#' }), player('c', { B: '##' })]);
    const r = rankAward('blocker', 'match', [m]);
    expect(r.ranked.map((x) => [x.playerId, x.rank])).toEqual([['c', 1], ['a', 2], ['b', 2]]);
  });

  it('season MVP is the per-match average and needs ≥ 50% of scouted matches', () => {
    const ms = [
      finished('m1', '2026-10-01', [player('a', { A: '#' }), player('b', { A: '###' })]),
      finished('m2', '2026-10-02', [player('a', { A: '###' })]),
      finished('m3', '2026-10-03', [player('a', { A: '#' })]),
    ];
    expect(mvpAverage(ms, 'b')).not.toBeNull();
    const r = rankAward('mvp', 'season', ms);
    expect(r.ranked.map((x) => x.playerId)).toEqual(['a']); // b played 1 of 3 < 50%
    expect(r.notEnoughData).toEqual(['b']);
  });

  it('most improved: last third vs first third, ≥ 6 matches, positive only', () => {
    const grades = ['=', '=', '#', '#', '###', '###'];
    const ms = grades.map((g, i) => finished(`m${i}`, `2026-10-0${i + 1}`, [player('a', { A: g }), player('b', { A: '#' })]));
    const r = rankAward('mostImproved', 'season', ms);
    expect(r.ranked.map((x) => x.playerId)).toEqual(['a']); // b flat → not ranked
    expect(rankAward('mostImproved', 'season', ms.slice(0, 5)).ranked).toEqual([]);
    expect(rankAward('mostImproved', 'match', ms).ranked).toEqual([]);
  });

  it('ever-present counts matches played, tie-break more actions', () => {
    const ms = [
      finished('m1', '2026-10-01', [player('a', { S: '!' }), player('b', { S: '!!' })]),
      finished('m2', '2026-10-02', [player('a', { S: '!' }), player('b', { S: '!' })]),
    ];
    expect(rankAward('everPresent', 'season', ms).ranked.map((x) => x.playerId)).toEqual(['b', 'a']);
  });

  it('returns empty rankings when nothing is scouted', () => {
    const ms = [finished('a', '2026-10-01', null), finished('b', '2026-10-02', [])];
    for (const id of AWARDS_FOR.season) expect(rankAward(id, 'season', ms).ranked).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/awards/awardRules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// src/types/awards.ts
export type AwardId =
  | 'mvp' | 'topScorer' | 'attacker' | 'server' | 'receiver' | 'blocker' | 'defender' | 'setter' | 'mostImproved' | 'everPresent';
export type AwardScope = 'match' | 'season';
```

```ts
// src/awards/awardRules.ts
import { fmtEff, fmtPct } from '../matches/format';
import { attackEff, mergeLines, ratio, serveEff } from '../matches/scoutStats';
import { GRADE_WEIGHTS } from '../players/matchRating';
import type { AwardId, AwardScope } from '../types/awards';
import { GRADES, type Match, type PlayerStats, type Skill, type SkillLine } from '../types/match';

export const MVP_QUALITY_WEIGHT = 0.5;

export const AWARD_TITLES: Record<AwardId, string> = {
  mvp: 'MVP', topScorer: 'Top scorer', attacker: 'Best attacker', server: 'Best server', receiver: 'Best receiver',
  blocker: 'Best blocker', defender: 'Best defender', setter: 'Best setter', mostImproved: 'Most improved', everPresent: 'Ever-present',
};

const BOTH: AwardId[] = ['topScorer', 'attacker', 'server', 'receiver', 'blocker', 'defender', 'setter'];
export const AWARDS_FOR: Record<AwardScope, AwardId[]> = {
  match: [...BOTH, 'mvp'],
  season: [...BOTH, 'mostImproved', 'everPresent', 'mvp'],
};

export const MIN_ATTEMPTS_FOR: Partial<Record<AwardId, { match: number; season: number }>> = {
  attacker: { match: 8, season: 30 },
  server: { match: 8, season: 30 },
  receiver: { match: 8, season: 30 },
  defender: { match: 6, season: 25 },
  setter: { match: 10, season: 40 },
};

export interface Ranked { playerId: string; value: number; display: string; attempts: number | null; rank: number }
export interface AwardRanking { id: AwardId; ranked: Ranked[]; notEnoughData: string[] }

export function quality(l: SkillLine | undefined): number | null {
  if (!l || l.attempts === 0) return null;
  return GRADES.reduce((sum, g) => sum + l.grades[g] * GRADE_WEIGHTS[g], 0) / l.attempts;
}

const actionCount = (p: PlayerStats) => Object.values(p.skills).reduce((n, l) => n + (l?.attempts ?? 0), 0);

export function mvpScore(p: PlayerStats): number {
  let bonus = 0;
  for (const l of Object.values(p.skills)) {
    const q = quality(l);
    if (l && q !== null) bonus += l.attempts * (q - 0.5);
  }
  return p.points - p.errors + MVP_QUALITY_WEIGHT * bonus;
}

export function scoutedMatches(matches: Match[]): Match[] {
  return matches.filter((m) => m.summary && Object.values(m.summary.players).some((p) => actionCount(p) > 0));
}

/** Per player: their PlayerStats in each scouted match they played, oldest first. */
function appearances(matches: Match[]): Map<string, PlayerStats[]> {
  const out = new Map<string, PlayerStats[]>();
  const sorted = [...scoutedMatches(matches)].sort((a, b) => a.date.localeCompare(b.date));
  for (const m of sorted) {
    for (const p of Object.values(m.summary!.players)) {
      if (actionCount(p) === 0) continue;
      out.set(p.playerId, [...(out.get(p.playerId) ?? []), p]);
    }
  }
  return out;
}

const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

export function mvpAverage(matches: Match[], playerId: string): number | null {
  return mean((appearances(matches).get(playerId) ?? []).map(mvpScore));
}

interface Candidate { playerId: string; value: number; tie: number; attempts: number | null; display: string }

const merged = (games: PlayerStats[], skills: Skill[]) => mergeLines(games.flatMap((g) => skills.map((s) => g.skills[s])));
const sum = (games: PlayerStats[], f: (p: PlayerStats) => number) => games.reduce((n, g) => n + f(g), 0);
const rating = (q: number) => `rating ${(1 + 9 * q).toFixed(1)}`;

/** Ranks every player for one award; ties on value and tie-break share a rank. */
export function rankAward(id: AwardId, scope: AwardScope, matches: Match[]): AwardRanking {
  if (scope === 'match' && (id === 'mostImproved' || id === 'everPresent')) return { id, ranked: [], notEnoughData: [] };
  const apps = appearances(matches);
  const scoutedCount = scoutedMatches(matches).length;
  const min = MIN_ATTEMPTS_FOR[id]?.[scope] ?? 0;
  const candidates: Candidate[] = [];
  const notEnoughData: string[] = [];

  const byAttempts = (playerId: string, l: SkillLine | undefined, value: (l: SkillLine) => number | null, tie: number, display: (v: number) => string) => {
    if (!l || l.attempts === 0) return;
    if (l.attempts < min) {
      notEnoughData.push(playerId);
      return;
    }
    const v = value(l);
    if (v !== null) candidates.push({ playerId, value: v, tie, attempts: l.attempts, display: display(v) });
  };

  for (const [playerId, games] of apps) {
    const points = sum(games, (g) => g.points);
    const errors = sum(games, (g) => g.errors);
    switch (id) {
      case 'mvp': {
        if (scope === 'season' && games.length < Math.ceil(scoutedCount / 2)) {
          notEnoughData.push(playerId);
          break;
        }
        const v = mean(games.map(mvpScore))!;
        // tie-break: fewer errors, then more points → encode as -errors * 1000 + points
        candidates.push({ playerId, value: v, tie: -errors * 1000 + points, attempts: null, display: `${v.toFixed(1)} MVP pts${scope === 'season' ? '/match' : ''}` });
        break;
      }
      case 'topScorer':
        if (points > 0) candidates.push({ playerId, value: points, tie: -errors, attempts: null, display: `${points} pts` });
        break;
      case 'attacker': {
        const l = merged(games, ['A']);
        byAttempts(playerId, l, (x) => attackEff(x), l?.grades['#'] ?? 0, (v) => `${fmtEff(v)} att. eff.`);
        break;
      }
      case 'server': {
        const l = merged(games, ['S']);
        byAttempts(playerId, l, (x) => serveEff(x), l?.grades['#'] ?? 0, (v) => `${fmtEff(v)} serve eff.`);
        break;
      }
      case 'receiver': {
        const l = merged(games, ['R']);
        byAttempts(playerId, l, (x) => ratio(x.grades['#'] + x.grades['+'], x.attempts), l?.grades['#'] ?? 0, (v) => `${fmtPct(v)} rec. +`);
        break;
      }
      case 'blocker': {
        const l = merged(games, ['B']);
        const kills = l?.grades['#'] ?? 0;
        if (kills >= 1) candidates.push({ playerId, value: kills, tie: -((l?.grades['='] ?? 0) + (l?.grades['/'] ?? 0)), attempts: l!.attempts, display: `${kills} block${kills === 1 ? '' : 's'}` });
        break;
      }
      case 'defender': {
        const l = merged(games, ['D', 'F']);
        byAttempts(playerId, l, quality, l?.attempts ?? 0, rating);
        break;
      }
      case 'setter': {
        const l = merged(games, ['E']);
        byAttempts(playerId, l, quality, l?.attempts ?? 0, rating);
        break;
      }
      case 'mostImproved': {
        if (games.length < 6) break;
        const third = Math.floor(games.length / 3);
        const first = mean(games.slice(0, third).map(mvpScore))!;
        const last = mean(games.slice(-third).map(mvpScore))!;
        const delta = last - first;
        if (delta > 0) candidates.push({ playerId, value: delta, tie: last, attempts: null, display: `+${delta.toFixed(1)} MVP pts/match` });
        break;
      }
      case 'everPresent':
        candidates.push({ playerId, value: games.length, tie: sum(games, actionCount), attempts: null, display: `${games.length} match${games.length === 1 ? '' : 'es'}` });
        break;
    }
  }

  candidates.sort((a, b) => b.value - a.value || b.tie - a.tie);
  const ranked: Ranked[] = [];
  candidates.forEach((c, i) => {
    const prev = candidates[i - 1];
    const rank = prev && prev.value === c.value && prev.tie === c.tie ? ranked[i - 1].rank : i + 1;
    ranked.push({ playerId: c.playerId, value: c.value, display: c.display, attempts: c.attempts, rank });
  });
  return { id, ranked, notEnoughData };
}
```

Note on the "full ties" test: `a` and `b` both 1 block, equal tie → share rank 2; `Array.prototype.sort` is stable, so input order `a, b` is kept.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/awards/awardRules.test.ts`
Expected: PASS. If the `attacker` display test fails on formatting, check `fmtEff(0.5)` → `+50%`, matching `'+50% att. eff.'`.

- [ ] **Step 6: Commit**

```bash
git add src/types/awards.ts src/awards
git commit -m "feat(awards): award rules — MVP score, per-award metrics, minimums, tie-breaks"
```

---

### Task 10: `rosterIndex`, `teamSeason`, filter params

**Files:**
- Create: `src/teams/stats/rosterIndex.ts`, `src/teams/stats/rosterIndex.test.ts`, `src/teams/stats/teamSeason.ts`, `src/teams/stats/teamSeason.test.ts`, `src/teams/stats/statsFilterParams.ts`, `src/teams/stats/statsFilterParams.test.ts`

**Interfaces:**
- Consumes: `seasonStats`, `matchRatings`, `MatchRatings` (matchRating.ts); `mvpAverage`, `scoutedMatches` (Task 9); `FINISHED_MATCHES_CAP` (matchesApi.ts); `mergeLines`, `attackEff`, `ratio` (scoutStats).
- Produces:
  - `interface Person { playerId: string; name: string; number: number | null; current: boolean }`
  - `latestRosterIndex(matches: Match[]): Map<string, Person>`; `withCurrentRoster(index: Map<string, Person>, players: Player[]): Map<string, Person>`; `UNKNOWN_PERSON(playerId): Person`
  - `type StatsRange = { kind: 'season' } | { kind: 'last'; count: 5 | 10 } | { kind: 'dates'; from: string; to: string }`
  - `interface StatsFilter { competition: Competition | 'all'; range: StatsRange; homeAway: HomeAway | 'all' }`, `DEFAULT_FILTER`
  - `interface Coverage { scouted: number; scoreOnly: number; skipped: number; capped: boolean }`, `seasonCoverage(all: Match[]): Coverage`
  - `filterMatches(matches: Match[], f: StatsFilter): Match[]`
  - `interface TeamPlayerRow { playerId: string; number: number | null; name: string; current: boolean; matchesPlayed: number; points: number; errors: number; mvpAvg: number | null; attackEff: number | null; serveEff: number | null; receptionPos: number | null; ratings: MatchRatings }`
  - `interface TrendPoint { matchId: string; date: string; opponent: string; won: boolean; sideOut: number | null; attackEff: number | null; receptionPos: number | null }`
  - `interface TeamSeason { record: { won: number; lost: number; setsWon: number; setsLost: number }; sideOut: number | null; breakPoint: number | null; attackEff: number | null; receptionPos: number | null; aces: number; serveErrors: number; oppErrorPoints: number; rotations: Record<number, { won: number; lost: number }>; bestRotation: number | null; weakestRotation: number | null; trend: TrendPoint[]; players: TeamPlayerRow[] }`
  - `teamSeason(matches: Match[], people: Map<string, Person>): TeamSeason`
  - `parseStatsFilter(params: URLSearchParams): StatsFilter`, `statsFilterToParams(f: StatsFilter): URLSearchParams`

- [ ] **Step 1: Write the failing tests**

```ts
// src/teams/stats/rosterIndex.test.ts
import { describe, expect, it } from 'vitest';
import { finished, player } from '../../awards/testMatches';
import type { Player } from '../../types/player';
import { latestRosterIndex, withCurrentRoster } from './rosterIndex';

describe('rosterIndex', () => {
  it('takes name/number from the newest roster snapshot containing the player', () => {
    const old = finished('m1', '2026-09-01', [player('a', {})], { roster: [{ playerId: 'a', number: 4, name: 'Old Name', positionCategory: 'OH' }] });
    const neu = finished('m2', '2026-10-01', [player('a', {})], { roster: [{ playerId: 'a', number: 9, name: 'New Name', positionCategory: 'OH' }] });
    const idx = latestRosterIndex([neu, old]);
    expect(idx.get('a')).toEqual({ playerId: 'a', name: 'New Name', number: 9, current: false });
  });

  it('marks current players and adds those who never played', () => {
    const m = finished('m1', '2026-09-01', [player('a', {})], { roster: [{ playerId: 'a', number: 4, name: 'Ana', positionCategory: 'OH' }] });
    const idx = withCurrentRoster(latestRosterIndex([m]), [
      { id: 'a', number: 5, fullName: 'Ana Current' } as Player,
      { id: 'z', number: 12, fullName: 'Zoë New' } as Player,
    ]);
    expect(idx.get('a')).toMatchObject({ current: true, name: 'Ana', number: 4 }); // snapshot wins for name
    expect(idx.get('z')).toEqual({ playerId: 'z', name: 'Zoë New', number: 12, current: true });
  });
});
```

```ts
// src/teams/stats/teamSeason.test.ts
import { describe, expect, it } from 'vitest';
import { finished, player } from '../../awards/testMatches';
import { latestRosterIndex } from './rosterIndex';
import { DEFAULT_FILTER, filterMatches, seasonCoverage, teamSeason } from './teamSeason';

const ms = [
  finished('m1', '2026-09-01', [player('a', { A: '##=', R: '#+' })], { competition: 'league', homeAway: 'home' }),
  finished('m2', '2026-09-08', [player('a', { A: '#' }), player('b', { S: '#' })], { competition: 'cup', homeAway: 'away', result: { setsUs: 1, setsThem: 3, sets: [] } }),
  finished('m3', '2026-09-15', [], {}),
  finished('m4', '2026-09-22', null, {}),
];

describe('teamSeason', () => {
  it('coverage counts scouted, score-only and skipped', () => {
    expect(seasonCoverage(ms)).toEqual({ scouted: 2, scoreOnly: 1, skipped: 1, capped: false });
  });

  it('flags the cap at 60 docs', () => {
    const many = Array.from({ length: 60 }, (_, i) => finished(`x${i}`, '2026-09-01', null));
    expect(seasonCoverage(many).capped).toBe(true);
  });

  it('filters by competition, home/away, last N and dates', () => {
    expect(filterMatches(ms, { ...DEFAULT_FILTER, competition: 'cup' }).map((m) => m.id)).toEqual(['m2']);
    expect(filterMatches(ms, { ...DEFAULT_FILTER, homeAway: 'home' }).map((m) => m.id)).toEqual(['m1', 'm3', 'm4']);
    expect(filterMatches(ms, { ...DEFAULT_FILTER, range: { kind: 'last', count: 5 } }).map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(filterMatches(ms, { ...DEFAULT_FILTER, range: { kind: 'dates', from: '2026-09-05', to: '2026-09-20' } }).map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('aggregates record, side-out from summed totals and rotations', () => {
    const s = teamSeason(ms, latestRosterIndex(ms));
    expect(s.record).toEqual({ won: 3, lost: 1, setsWon: 10, setsLost: 6 });
    expect(s.sideOut).toBeCloseTo(0.5); // 10/20 per scouted summary, summed
    expect(s.rotations[4]).toEqual({ won: 15, lost: 3 }); // m1, m2, m3 summaries × (5,1)
    expect(s.bestRotation).toBe(4);
    expect(s.weakestRotation).toBe(5);
    expect(s.trend.map((t) => t.matchId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('player rows from summed counts, newest roster names', () => {
    const s = teamSeason(ms, latestRosterIndex(ms));
    const a = s.players.find((p) => p.playerId === 'a')!;
    expect(a.matchesPlayed).toBe(2);
    expect(a.attackEff).toBeCloseTo((3 - 1) / 4);
    expect(a.name).toBe('Player a');
  });

  it('empty input gives nulls, not NaN', () => {
    const s = teamSeason([], new Map());
    expect(s.sideOut).toBeNull();
    expect(s.attackEff).toBeNull();
    expect(s.bestRotation).toBeNull();
    expect(s.players).toEqual([]);
  });
});
```

Note on rotations: `finished(..., [])` still has a summary with the fixture team block, so m3 contributes to team totals and trend (it's score-only: no player actions, but team side-out etc. are real). m4 (null summary) contributes only to `record`.

```ts
// src/teams/stats/statsFilterParams.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTER } from './teamSeason';
import { parseStatsFilter, statsFilterToParams } from './statsFilterParams';

describe('statsFilterParams', () => {
  it('round-trips', () => {
    const f = { competition: 'cup' as const, homeAway: 'away' as const, range: { kind: 'dates' as const, from: '2026-09-01', to: '2026-10-01' } };
    expect(parseStatsFilter(statsFilterToParams(f))).toEqual(f);
    expect(parseStatsFilter(statsFilterToParams({ ...DEFAULT_FILTER, range: { kind: 'last', count: 10 } })).range).toEqual({ kind: 'last', count: 10 });
  });

  it('defaults on garbage', () => {
    expect(parseStatsFilter(new URLSearchParams('comp=lol&range=last7&ha=x&from=bad'))).toEqual(DEFAULT_FILTER);
  });

  it('default filter produces empty params', () => {
    expect(statsFilterToParams(DEFAULT_FILTER).toString()).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/teams/stats`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// src/teams/stats/rosterIndex.ts
import type { Match } from '../../types/match';
import type { Player } from '../../types/player';

export interface Person { playerId: string; name: string; number: number | null; current: boolean }

export const UNKNOWN_PERSON = (playerId: string): Person => ({ playerId, name: 'Unknown player', number: null, current: false });

/** Name/number per player from the newest match roster that lists them (survives number changes and departures). */
export function latestRosterIndex(matches: Match[]): Map<string, Person> {
  const out = new Map<string, Person>();
  for (const m of [...matches].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const r of m.roster) {
      if (!out.has(r.playerId)) out.set(r.playerId, { playerId: r.playerId, name: r.name, number: r.number, current: false });
    }
  }
  return out;
}

/** Marks current team players and adds the ones who never played (for award pickers). */
export function withCurrentRoster(index: Map<string, Person>, players: Player[]): Map<string, Person> {
  const out = new Map(index);
  for (const p of players) {
    const known = out.get(p.id);
    out.set(p.id, known ? { ...known, current: true } : { playerId: p.id, name: p.fullName, number: p.number, current: true });
  }
  return out;
}
```

```ts
// src/teams/stats/teamSeason.ts
import { mvpAverage, scoutedMatches } from '../../awards/awardRules';
import { FINISHED_MATCHES_CAP } from '../../matches/matchesApi';
import { attackEff, mergeLines, ratio } from '../../matches/scoutStats';
import { matchRatings, seasonStats, type MatchRatings } from '../../players/matchRating';
import type { Competition, HomeAway, Match, PlayerStats } from '../../types/match';
import { UNKNOWN_PERSON, type Person } from './rosterIndex';

export type StatsRange = { kind: 'season' } | { kind: 'last'; count: 5 | 10 } | { kind: 'dates'; from: string; to: string };
export interface StatsFilter { competition: Competition | 'all'; range: StatsRange; homeAway: HomeAway | 'all' }
export const DEFAULT_FILTER: StatsFilter = { competition: 'all', range: { kind: 'season' }, homeAway: 'all' };

export interface Coverage { scouted: number; scoreOnly: number; skipped: number; capped: boolean }

const hasActions = (p: PlayerStats) => Object.values(p.skills).some((l) => !!l && l.attempts > 0);

export function seasonCoverage(all: Match[]): Coverage {
  let scouted = 0, scoreOnly = 0, skipped = 0;
  for (const m of all) {
    if (!m.summary) skipped += 1;
    else if (Object.values(m.summary.players).some(hasActions)) scouted += 1;
    else scoreOnly += 1;
  }
  return { scouted, scoreOnly, skipped, capped: all.length >= FINISHED_MATCHES_CAP };
}

export function filterMatches(matches: Match[], f: StatsFilter): Match[] {
  let out = [...matches]
    .filter((m) => f.competition === 'all' || m.competition === f.competition)
    .filter((m) => f.homeAway === 'all' || m.homeAway === f.homeAway)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (f.range.kind === 'dates') {
    const { from, to } = f.range;
    out = out.filter((m) => m.date >= from && m.date <= to);
  }
  if (f.range.kind === 'last') {
    const count = f.range.count;
    const scouted = new Set(scoutedMatches(out).map((m) => m.id));
    out = out.filter((m) => scouted.has(m.id)).slice(-count).reverse();
  }
  return out;
}

export interface TeamPlayerRow {
  playerId: string; number: number | null; name: string; current: boolean;
  matchesPlayed: number; points: number; errors: number; mvpAvg: number | null;
  attackEff: number | null; serveEff: number | null; receptionPos: number | null; ratings: MatchRatings;
}
export interface TrendPoint { matchId: string; date: string; opponent: string; won: boolean; sideOut: number | null; attackEff: number | null; receptionPos: number | null }
export interface TeamSeason {
  record: { won: number; lost: number; setsWon: number; setsLost: number };
  sideOut: number | null; breakPoint: number | null; attackEff: number | null; receptionPos: number | null;
  aces: number; serveErrors: number; oppErrorPoints: number;
  rotations: Record<number, { won: number; lost: number }>;
  bestRotation: number | null; weakestRotation: number | null;
  trend: TrendPoint[]; players: TeamPlayerRow[];
}

export function teamSeason(matches: Match[], people: Map<string, Person>): TeamSeason {
  const record = { won: 0, lost: 0, setsWon: 0, setsLost: 0 };
  for (const m of matches) {
    record.setsWon += m.result.setsUs;
    record.setsLost += m.result.setsThem;
    if (m.result.setsUs > m.result.setsThem) record.won += 1;
    else if (m.result.setsThem > m.result.setsUs) record.lost += 1;
  }
  const withSummary = matches.filter((m) => m.summary).sort((a, b) => a.date.localeCompare(b.date));
  const so = { won: 0, total: 0 }, bp = { won: 0, total: 0 };
  let aces = 0, serveErrors = 0, oppErrorPoints = 0;
  const rotations: Record<number, { won: number; lost: number }> = {};
  for (let r = 1; r <= 6; r++) rotations[r] = { won: 0, lost: 0 };
  for (const m of withSummary) {
    const t = m.summary!.team;
    so.won += t.sideOut.won; so.total += t.sideOut.total;
    bp.won += t.breakPoint.won; bp.total += t.breakPoint.total;
    aces += t.aces; serveErrors += t.serveErrors; oppErrorPoints += t.oppErrorPoints;
    for (const [r, v] of Object.entries(t.rotations)) {
      rotations[Number(r)].won += v.won;
      rotations[Number(r)].lost += v.lost;
    }
  }
  const allPlayers = withSummary.flatMap((m) => Object.values(m.summary!.players));
  const attack = mergeLines(allPlayers.map((p) => p.skills.A));
  const reception = mergeLines(allPlayers.map((p) => p.skills.R));

  const rates = Object.entries(rotations)
    .filter(([, v]) => v.won + v.lost > 0)
    .map(([r, v]) => ({ r: Number(r), rate: v.won / (v.won + v.lost) }));
  const best = rates.length ? rates.reduce((a, b) => (b.rate > a.rate ? b : a)).r : null;
  const weakest = rates.length ? rates.reduce((a, b) => (b.rate < a.rate ? b : a)).r : null;

  const ids = new Set(allPlayers.filter(hasActions).map((p) => p.playerId));
  const players: TeamPlayerRow[] = [...ids].map((playerId) => {
    const s = seasonStats(withSummary, playerId);
    const person = people.get(playerId) ?? UNKNOWN_PERSON(playerId);
    return {
      playerId, number: person.number, name: person.name, current: person.current,
      matchesPlayed: s.matchesPlayed, points: s.points, errors: s.errors, mvpAvg: mvpAverage(withSummary, playerId),
      attackEff: s.attackEff, serveEff: s.serveEff, receptionPos: s.receptionPos, ratings: matchRatings(s),
    };
  }).sort((a, b) => (a.number ?? 999) - (b.number ?? 999));

  return {
    record,
    sideOut: ratio(so.won, so.total), breakPoint: ratio(bp.won, bp.total),
    attackEff: attackEff(attack),
    receptionPos: reception ? ratio(reception.grades['#'] + reception.grades['+'], reception.attempts) : null,
    aces, serveErrors, oppErrorPoints, rotations, bestRotation: best, weakestRotation: weakest,
    trend: withSummary.map((m) => ({
      matchId: m.id, date: m.date, opponent: m.opponent, won: m.result.setsUs > m.result.setsThem,
      sideOut: ratio(m.summary!.team.sideOut.won, m.summary!.team.sideOut.total),
      attackEff: m.summary!.team.attackEff, receptionPos: m.summary!.team.receptionPos,
    })),
    players,
  };
}
```

Check: fixture rotations per summary (r4 won 5 lost 1) × 3 summaries (m1, m2, m3) = 15/3 ✓; r5 (1/5) is weakest ✓; record: m1 3–1 W, m2 1–3 L, m3 3–1 W, m4 3–1 W → won 3, lost 1, sets 10–6 ✓. If `latestRosterIndex` gives `name: 'Player a'` the fixture roster names match ✓.

```ts
// src/teams/stats/statsFilterParams.ts
import { DEFAULT_FILTER, type StatsFilter } from './teamSeason';

const COMPETITIONS = ['league', 'cup', 'friendly', 'tournament'] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseStatsFilter(p: URLSearchParams): StatsFilter {
  const comp = p.get('comp');
  const ha = p.get('ha');
  const range = p.get('range');
  const from = p.get('from') ?? '';
  const to = p.get('to') ?? '';
  return {
    competition: COMPETITIONS.includes(comp as (typeof COMPETITIONS)[number]) ? (comp as StatsFilter['competition']) : 'all',
    homeAway: ha === 'home' || ha === 'away' ? ha : 'all',
    range:
      range === 'last5' ? { kind: 'last', count: 5 }
      : range === 'last10' ? { kind: 'last', count: 10 }
      : range === 'dates' && ISO.test(from) && ISO.test(to) ? { kind: 'dates', from, to }
      : DEFAULT_FILTER.range,
  };
}

export function statsFilterToParams(f: StatsFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.competition !== 'all') p.set('comp', f.competition);
  if (f.homeAway !== 'all') p.set('ha', f.homeAway);
  if (f.range.kind === 'last') p.set('range', `last${f.range.count}`);
  if (f.range.kind === 'dates') {
    p.set('range', 'dates');
    p.set('from', f.range.from);
    p.set('to', f.range.to);
  }
  return p;
}
```

Note: the "last" branch returns newest first (`reverse()`), matching the test `['m2','m1']`; `teamSeason` re-sorts internally so order doesn't matter downstream.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/teams/stats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teams/stats
git commit -m "feat(stats): team season aggregation, coverage, filters, roster index"
```

---

### Task 11: Team stats CSV

**Files:**
- Modify: `src/matches/report/reportCsv.ts` (export `Cell`, add `csvDocument`)
- Create: `src/teams/stats/teamStatsCsv.ts`, `src/teams/stats/teamStatsCsv.test.ts`

**Interfaces:**
- Produces: `export type Cell`; `csvDocument(rows: Cell[][], format: CsvFormat): string` (BOM + separator + `\r\n`); `teamStatsCsv(rows: TeamPlayerRow[], format?: CsvFormat): string`; `teamStatsCsvFileName(teamName: string, matches: Match[]): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/teams/stats/teamStatsCsv.test.ts
import { describe, expect, it } from 'vitest';
import { finished } from '../../awards/testMatches';
import type { TeamPlayerRow } from './teamSeason';
import { teamStatsCsv, teamStatsCsvFileName } from './teamStatsCsv';

const row = (over: Partial<TeamPlayerRow>): TeamPlayerRow => ({
  playerId: 'a', number: 7, name: 'Ana', current: true, matchesPlayed: 3, points: 12, errors: 4, mvpAvg: 3.25,
  attackEff: 0.4125, serveEff: null, receptionPos: 0.5, ratings: { attack: { rating: 7.25, attempts: 40 } }, ...over,
});

describe('teamStatsCsv', () => {
  it('writes BOM, header and EU decimals', () => {
    const csv = teamStatsCsv([row({})], 'eu');
    expect(csv.startsWith('﻿Number;Name;Matches;Points;Errors;MVP avg;Attack eff;Serve eff;Reception +')).toBe(true);
    expect(csv).toContain('7;Ana;3;12;4;3,25;0,413;;0,5');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('guards formula injection in names', () => {
    expect(teamStatsCsv([row({ name: '=HYPERLINK("x")' })], 'en')).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('file name from team and date span', () => {
    const ms = [finished('a', '2026-09-01', []), finished('b', '2026-10-12', [])];
    expect(teamStatsCsvFileName('U17 Girls', ms)).toBe('U17-Girls-stats-2026-09-01-2026-10-12.csv');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/teams/stats/teamStatsCsv.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `reportCsv.ts`: change `type Cell = …` to `export type Cell = …`, add

```ts
/** A whole CSV document: BOM (Excel), separator per format, CRLF line ends. */
export function csvDocument(rows: Cell[][], format: CsvFormat): string {
  return BOM + rows.map((row) => row.map((cell) => csvCell(cell, format)).join(SEPARATOR[format])).join('\r\n') + '\r\n';
}
```

and make `reportCsv` return `csvDocument(rows, format)`.

```ts
// src/teams/stats/teamStatsCsv.ts
import { fileSlug } from '../../export/exportJson';
import { csvDocument, type Cell, type CsvFormat } from '../../matches/report/reportCsv';
import type { Match } from '../../types/match';
import type { SkillKey } from '../../types/player';
import type { TeamPlayerRow } from './teamSeason';

const RATED: SkillKey[] = ['serve', 'reception', 'attack', 'block', 'set', 'defence'];

export function teamStatsCsv(rows: TeamPlayerRow[], format: CsvFormat = 'en'): string {
  const header: Cell[] = ['Number', 'Name', 'Matches', 'Points', 'Errors', 'MVP avg', 'Attack eff', 'Serve eff', 'Reception +', ...RATED.map((k) => `Rating ${k}`)];
  const body: Cell[][] = rows.map((r) => [
    r.number, r.name, r.matchesPlayed, r.points, r.errors, r.mvpAvg, r.attackEff, r.serveEff, r.receptionPos,
    ...RATED.map((k) => r.ratings[k]?.rating ?? null),
  ]);
  return csvDocument([header, ...body], format);
}

export function teamStatsCsvFileName(teamName: string, matches: Match[]): string {
  const dates = matches.map((m) => m.date).sort();
  const span = dates.length ? `${dates[0]}-${dates[dates.length - 1]}` : 'empty';
  return `${fileSlug(teamName)}-stats-${span}.csv`;
}
```

Check `SkillKey` values in `src/types/player.ts` include exactly these six (they are the keys of `SKILL_SOURCES` in matchRating.ts); adjust if the names differ.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/teams/stats/teamStatsCsv.test.ts src/matches/report/reportCsv.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/matches/report/reportCsv.ts src/teams/stats/teamStatsCsv.ts src/teams/stats/teamStatsCsv.test.ts
git commit -m "feat(stats): team player table CSV (EU/EN) sharing the report CSV document writer"
```

---

### Task 12: Stats visual components — trend chart, rotations, leaderboards, player table

**Files:**
- Create: `src/teams/stats/TeamTrendChart.tsx`, `src/teams/stats/RotationBars.tsx`, `src/teams/stats/Leaderboards.tsx`, `src/teams/stats/PlayerStatsTable.tsx`, `src/teams/stats/statsComponents.test.tsx`

**Interfaces:**
- Consumes: `TrendPoint`, `TeamSeason['rotations']`, `TeamPlayerRow`, `Person` (Task 10); `rankAward`, `AWARDS_FOR`, `AWARD_TITLES`, `AwardRanking` (Task 9); `fmtPct`, `fmtEff`.
- Produces:
  - `TeamTrendChart({ points }: { points: TrendPoint[] })`
  - `RotationBars({ rotations, best, weakest }: { rotations: Record<number, { won: number; lost: number }>; best: number | null; weakest: number | null })`
  - `Leaderboards({ teamId, rankings, people }: { teamId: string; rankings: AwardRanking[]; people: Map<string, Person> })`
  - `PlayerStatsTable({ teamId, rows }: { teamId: string; rows: TeamPlayerRow[] })`

- [ ] **Step 1: Write the failing test**

```tsx
// src/teams/stats/statsComponents.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { AwardRanking } from '../../awards/awardRules';
import type { Person } from './rosterIndex';
import { Leaderboards } from './Leaderboards';
import { PlayerStatsTable } from './PlayerStatsTable';
import { RotationBars } from './RotationBars';
import { TeamTrendChart } from './TeamTrendChart';
import type { TeamPlayerRow } from './teamSeason';

const people = new Map<string, Person>([
  ['a', { playerId: 'a', name: 'Ana', number: 7, current: true }],
  ['b', { playerId: 'b', name: 'Bea', number: 9, current: false }],
]);

describe('stats components', () => {
  it('leaderboards: top 3, links only for current players, not-enough-data line', () => {
    const rankings: AwardRanking[] = [{
      id: 'attacker',
      ranked: [
        { playerId: 'a', value: 0.4, display: '+40% att. eff.', attempts: 40, rank: 1 },
        { playerId: 'b', value: 0.3, display: '+30% att. eff.', attempts: 35, rank: 2 },
      ],
      notEnoughData: ['c'],
    }];
    render(<MemoryRouter><Leaderboards teamId="t1" rankings={rankings} people={people} /></MemoryRouter>);
    const card = screen.getByRole('region', { name: 'Best attacker' });
    expect(within(card).getByRole('link', { name: /#7 Ana/ })).toHaveAttribute('href', '/teams/t1/players/a');
    expect(within(card).getByText(/#9 Bea/).closest('a')).toBeNull();
    expect(within(card).getByText('+40% att. eff. · 40 att.')).toBeInTheDocument();
    expect(within(card).getByText(/Not enough data: Unknown player/)).toBeInTheDocument();
  });

  it('leaderboard with no ranked players says so', () => {
    render(<MemoryRouter><Leaderboards teamId="t1" rankings={[{ id: 'setter', ranked: [], notEnoughData: [] }]} people={people} /></MemoryRouter>);
    expect(within(screen.getByRole('region', { name: 'Best setter' })).getByText('No data yet')).toBeInTheDocument();
  });

  it('player table sorts by a column', () => {
    const rows: TeamPlayerRow[] = [
      { playerId: 'a', number: 7, name: 'Ana', current: true, matchesPlayed: 2, points: 5, errors: 1, mvpAvg: 2, attackEff: 0.1, serveEff: null, receptionPos: null, ratings: {} },
      { playerId: 'b', number: 9, name: 'Bea', current: true, matchesPlayed: 3, points: 9, errors: 2, mvpAvg: 4, attackEff: 0.3, serveEff: null, receptionPos: null, ratings: {} },
    ];
    render(<MemoryRouter><PlayerStatsTable teamId="t1" rows={rows} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Points/ }));
    const firstRow = screen.getAllByRole('row')[1];
    expect(within(firstRow).getByText('Bea')).toBeInTheDocument();
  });

  it('trend chart has an accessible data table; rotations call out best and weakest', () => {
    render(<TeamTrendChart points={[
      { matchId: 'm1', date: '2026-09-01', opponent: 'X', won: true, sideOut: 0.5, attackEff: 0.2, receptionPos: 0.6 },
      { matchId: 'm2', date: '2026-09-08', opponent: 'Y', won: false, sideOut: 0.4, attackEff: null, receptionPos: 0.5 },
    ]} />);
    expect(screen.getByRole('table', { name: 'Trend data' })).toBeInTheDocument();
    render(<RotationBars rotations={{ 1: { won: 4, lost: 2 }, 2: { won: 1, lost: 5 }, 3: { won: 0, lost: 0 }, 4: { won: 0, lost: 0 }, 5: { won: 0, lost: 0 }, 6: { won: 0, lost: 0 } }} best={1} weakest={2} />);
    expect(screen.getByText('Best rotation: 1')).toBeInTheDocument();
    expect(screen.getByText('Weakest rotation: 2')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/teams/stats/statsComponents.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/teams/stats/TeamTrendChart.tsx
import { fmtEff, fmtPct } from '../../matches/format';
import type { TrendPoint } from './teamSeason';

const W = 640, H = 200, PAD_L = 36, PAD_R = 8, PAD_T = 12, PAD_B = 28;
const Y_MIN = -0.5, Y_MAX = 1;
const SERIES = [
  { key: 'sideOut', label: 'Side-out %', className: 'stroke-blue' },
  { key: 'attackEff', label: 'Attack eff.', className: 'stroke-orange' },
  { key: 'receptionPos', label: 'Reception +', className: 'stroke-green' },
] as const;

export function TeamTrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return <p className="text-sm text-slate">Scout at least two matches to see a trend.</p>;
  const x = (i: number) => PAD_L + (i / (points.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + ((Y_MAX - Math.max(Y_MIN, Math.min(Y_MAX, v))) / (Y_MAX - Y_MIN)) * (H - PAD_T - PAD_B);
  const path = (key: (typeof SERIES)[number]['key']) =>
    points
      .map((p, i) => ({ v: p[key], i }))
      .filter((p): p is { v: number; i: number } => p.v !== null)
      .map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(' ');
  return (
    <figure className="break-inside-avoid">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full [print-color-adjust:exact]" aria-hidden="true">
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(g)} y2={y(g)} className="stroke-border" strokeDasharray={g === 0 ? undefined : '3 3'} />
            <text x={PAD_L - 4} y={y(g) + 4} textAnchor="end" className="fill-slate text-[10px]">{g * 100}%</text>
          </g>
        ))}
        {SERIES.map((s) => <path key={s.key} d={path(s.key)} fill="none" strokeWidth={2} className={s.className} />)}
        {points.map((p, i) => (
          <text key={p.matchId} x={x(i)} y={H - 8} textAnchor="middle" className={`text-[10px] font-bold ${p.won ? 'fill-green-strong' : 'fill-red-strong'}`}>
            {p.won ? 'W' : 'L'}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-slate">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <svg width="16" height="4" aria-hidden="true"><line x1="0" x2="16" y1="2" y2="2" strokeWidth="3" className={s.className} /></svg>
            {s.label}
          </span>
        ))}
      </figcaption>
      <table className="sr-only" aria-label="Trend data">
        <thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th>{SERIES.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.matchId}>
              <td>{p.date}</td><td>{p.opponent}</td><td>{p.won ? 'Won' : 'Lost'}</td>
              <td>{fmtPct(p.sideOut)}</td><td>{fmtEff(p.attackEff)}</td><td>{fmtPct(p.receptionPos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
```

```tsx
// src/teams/stats/RotationBars.tsx
export function RotationBars({ rotations, best, weakest }: { rotations: Record<number, { won: number; lost: number }>; best: number | null; weakest: number | null }) {
  const max = Math.max(1, ...Object.values(rotations).map((v) => v.won + v.lost));
  return (
    <div className="break-inside-avoid">
      <ul className="space-y-1.5">
        {[1, 2, 3, 4, 5, 6].map((r) => {
          const v = rotations[r] ?? { won: 0, lost: 0 };
          return (
            <li key={r} className="flex items-center gap-2 text-sm">
              <span className="w-6 tabular-nums text-slate">R{r}</span>
              <span className="flex h-4 flex-1 overflow-hidden rounded-sm bg-bg [print-color-adjust:exact]" aria-label={`Rotation ${r}: ${v.won} won, ${v.lost} lost`} role="img">
                <span className="bg-green" style={{ width: `${(v.won / max) * 100}%` }} />
                <span className="bg-red" style={{ width: `${(v.lost / max) * 100}%` }} />
              </span>
              <span className="w-14 text-right tabular-nums text-ink">{v.won}–{v.lost}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-slate">
        {best !== null && <span className="mr-4">Best rotation: {best}</span>}
        {weakest !== null && <span>Weakest rotation: {weakest}</span>}
      </p>
    </div>
  );
}
```

```tsx
// src/teams/stats/Leaderboards.tsx
import { Link } from 'react-router-dom';
import { AWARD_TITLES, type AwardRanking } from '../../awards/awardRules';
import { UNKNOWN_PERSON, type Person } from './rosterIndex';

const label = (p: Person) => `${p.number !== null ? `#${p.number} ` : ''}${p.name}`;

export function Leaderboards({ teamId, rankings, people }: { teamId: string; rankings: AwardRanking[]; people: Map<string, Person> }) {
  const person = (id: string) => people.get(id) ?? UNKNOWN_PERSON(id);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rankings.map((r) => {
        const titleId = `lb-${r.id}`;
        return (
          <section key={r.id} aria-labelledby={titleId} className="break-inside-avoid rounded-lg border border-border bg-surface p-4 shadow-card">
            <h3 id={titleId} className="mb-2 font-semibold text-ink">{AWARD_TITLES[r.id]}</h3>
            {r.ranked.length === 0 ? (
              <p className="text-sm text-slate">No data yet</p>
            ) : (
              <ol className="space-y-1">
                {r.ranked.slice(0, 3).map((x) => {
                  const p = person(x.playerId);
                  return (
                    <li key={x.playerId} className="flex items-baseline gap-2">
                      <span className="w-5 tabular-nums text-slate">{x.rank}.</span>
                      <span className="flex-1 truncate">
                        {p.current ? <Link to={`/teams/${teamId}/players/${p.playerId}`} className="text-ink hover:underline">{label(p)}</Link> : <span className="text-ink">{label(p)}</span>}
                      </span>
                      <span className="text-sm tabular-nums text-slate">{x.display}{x.attempts !== null ? ` · ${x.attempts} att.` : ''}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            {r.notEnoughData.length > 0 && (
              <p className="mt-2 text-xs text-slate">Not enough data: {r.notEnoughData.map((id) => label(person(id))).join(', ')}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

```tsx
// src/teams/stats/PlayerStatsTable.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown } from 'lucide-react';
import { fmtEff, fmtPct } from '../../matches/format';
import type { TeamPlayerRow } from './teamSeason';

type SortKey = 'number' | 'matchesPlayed' | 'points' | 'errors' | 'mvpAvg' | 'attackEff' | 'serveEff' | 'receptionPos';
const COLS: { key: SortKey; label: string; fmt: (r: TeamPlayerRow) => string }[] = [
  { key: 'matchesPlayed', label: 'MP', fmt: (r) => String(r.matchesPlayed) },
  { key: 'points', label: 'Points', fmt: (r) => String(r.points) },
  { key: 'errors', label: 'Errors', fmt: (r) => String(r.errors) },
  { key: 'mvpAvg', label: 'MVP', fmt: (r) => (r.mvpAvg === null ? '—' : r.mvpAvg.toFixed(1)) },
  { key: 'attackEff', label: 'Att. eff.', fmt: (r) => fmtEff(r.attackEff) },
  { key: 'serveEff', label: 'Serve eff.', fmt: (r) => fmtEff(r.serveEff) },
  { key: 'receptionPos', label: 'Rec. +', fmt: (r) => fmtPct(r.receptionPos) },
];

export function PlayerStatsTable({ teamId, rows }: { teamId: string; rows: TeamPlayerRow[] }) {
  const [sort, setSort] = useState<SortKey>('number');
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'number') return (a.number ?? 999) - (b.number ?? 999);
    return ((b[sort] as number | null) ?? -Infinity) - ((a[sort] as number | null) ?? -Infinity);
  });
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-slate">
            <th scope="col" className="py-2 pr-2"><button type="button" onClick={() => setSort('number')} className="font-medium">#</button></th>
            <th scope="col" className="py-2 pr-2">Name</th>
            {COLS.map((c) => (
              <th key={c.key} scope="col" className="py-2 pr-2 text-right" aria-sort={sort === c.key ? 'descending' : 'none'}>
                <button type="button" onClick={() => setSort(c.key)} className="inline-flex items-center gap-1 font-medium">
                  {c.label}{sort === c.key && <ArrowDown size={12} aria-hidden="true" />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.playerId} className="border-b border-border last:border-0">
              <td className="py-2 pr-2 text-slate">{r.number ?? '—'}</td>
              <th scope="row" className="py-2 pr-2 text-left font-normal">
                {r.current ? <Link to={`/teams/${teamId}/players/${r.playerId}`} className="text-ink hover:underline">{r.name}</Link> : <span className="text-ink">{r.name}</span>}
              </th>
              {COLS.map((c) => <td key={c.key} className="py-2 pr-2 text-right text-ink">{c.fmt(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Per spec §4.6 the table also shows ratings per skill: add after the COLS cells one column per rated skill (`serve, reception, attack, block, set, defence`), header = capitalised key, cell = `r.ratings[k]?.rating?.toFixed(1) ?? '—'`. (Not sortable.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/teams/stats/statsComponents.test.tsx`
Expected: PASS. (The table's player name is in a `<th scope="row">`; `within(firstRow).getByText('Bea')` still matches.)

- [ ] **Step 5: Commit**

```bash
git add src/teams/stats
git commit -m "feat(stats): trend chart, rotation bars, leaderboards, sortable player table"
```

---

### Task 13: `TeamStatsTab` + Stats tab on `TeamPage` + print

**Files:**
- Create: `src/teams/stats/TeamStatsTab.tsx`, `src/teams/stats/TeamStatsTab.test.tsx`
- Modify: `src/teams/TeamPage.tsx`, `src/index.css` (print rules if needed), `src/teams/TeamPage.test.tsx`

**Interfaces:**
- Consumes: `listFinishedMatches`, `loadTeamRoster` (matchesApi); Tasks 9–12; `Menu`; `downloadText`; `isTeamAdmin`.
- Produces: `TeamStatsTab({ team }: { team: Team })` (default export too, for `lazy`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/teams/stats/TeamStatsTab.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finished, player } from '../../awards/testMatches';
import * as matchesApi from '../../matches/matchesApi';
import { downloadText } from '../../export/exportJson';
import type { Team } from '../../types/team';
import { TeamStatsTab } from './TeamStatsTab';

vi.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../../matches/matchesApi', async (orig) => ({
  ...(await orig<typeof import('../../matches/matchesApi')>()),
  listFinishedMatches: vi.fn(),
  loadTeamRoster: vi.fn(),
}));
vi.mock('../../export/exportJson', async (orig) => ({ ...(await orig<typeof import('../../export/exportJson')>()), downloadText: vi.fn() }));

const team = { id: 't1', name: 'U17 Girls', season: '2026-27', adminEmails: [] } as unknown as Team;

describe('TeamStatsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue([]);
  });

  it('shows coverage, KPIs and leaderboards', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      finished('m1', '2026-09-01', [player('a', { A: '########' })]),
      finished('m2', '2026-09-08', null),
    ]);
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    expect(await screen.findByText(/Based on 1 scouted match/)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Top scorer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Season awards/ })).toHaveAttribute('href', '/teams/t1/awards');
  });

  it('empty state when nothing is scouted', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([finished('m2', '2026-09-08', null)]);
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    expect(await screen.findByText(/No scouted matches yet/)).toBeInTheDocument();
  });

  it('load error is shown inline', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockRejectedValue(new Error('x'));
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    expect(await screen.findByText('Could not load team stats.')).toBeInTheDocument();
  });

  it('exports: print and CSV', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([finished('m1', '2026-09-01', [player('a', { A: '#' })])]);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    await screen.findByText(/Based on 1 scouted match/);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print / PDF' }));
    expect(print).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'CSV · Excel (Belgium/EU)' }));
    expect(downloadText).toHaveBeenCalledWith(expect.stringMatching(/U17-Girls-stats/), expect.any(String), 'text/csv;charset=utf-8');
  });

  it('filter changes the URL-driven view', async () => {
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      finished('m1', '2026-09-01', [player('a', { A: '#' })], { competition: 'cup' }),
      finished('m2', '2026-09-08', [player('a', { A: '#' })], { competition: 'league' }),
    ]);
    render(<MemoryRouter><TeamStatsTab team={team} /></MemoryRouter>);
    await screen.findByText(/Based on 2 scouted matches/);
    fireEvent.change(screen.getByLabelText('Competition'), { target: { value: 'cup' } });
    expect(await screen.findByText(/Showing 1 of 2 matches/)).toBeInTheDocument();
  });
});
```

(Check the `Menu` item role in `src/components/Menu.tsx` — if items are `role="menuitem"` this works; otherwise use the role it renders.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/teams/stats/TeamStatsTab.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/teams/stats/TeamStatsTab.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileSpreadsheet, Printer, Trophy } from 'lucide-react';
import { AWARDS_FOR, rankAward } from '../../awards/awardRules';
import { Menu } from '../../components/Menu';
import { downloadText } from '../../export/exportJson';
import { fmtEff, fmtPct } from '../../matches/format';
import { listFinishedMatches, loadTeamRoster } from '../../matches/matchesApi';
import type { CsvFormat } from '../../matches/report/reportCsv';
import type { Match } from '../../types/match';
import type { Player } from '../../types/player';
import type { Team } from '../../types/team';
import { Leaderboards } from './Leaderboards';
import { PlayerStatsTable } from './PlayerStatsTable';
import { RotationBars } from './RotationBars';
import { latestRosterIndex, withCurrentRoster } from './rosterIndex';
import { parseStatsFilter, statsFilterToParams } from './statsFilterParams';
import { TeamTrendChart } from './TeamTrendChart';
import { filterMatches, seasonCoverage, teamSeason, type StatsFilter } from './teamSeason';
import { teamStatsCsv, teamStatsCsvFileName } from './teamStatsCsv';

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-border bg-surface p-3 shadow-card">
      <div className="text-2xl font-extrabold tabular-nums text-ink">{value}</div>
      <div className="text-xs text-slate">{label}</div>
    </div>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 'es'}`;

export function TeamStatsTab({ team }: { team: Team }) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [error, setError] = useState(false);
  const [params, setParams] = useSearchParams();
  const filter = parseStatsFilter(params);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listFinishedMatches(team.id), loadTeamRoster(team.id).catch(() => [] as Player[])])
      .then(([ms, players]) => {
        if (cancelled) return;
        setMatches(ms);
        setRoster(players);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [team.id]);

  const view = useMemo(() => {
    if (!matches) return null;
    const people = withCurrentRoster(latestRosterIndex(matches), roster);
    const filtered = filterMatches(matches, filter);
    return {
      people, filtered, coverage: seasonCoverage(matches), season: teamSeason(filtered, people),
      rankings: AWARDS_FOR.season.map((id) => rankAward(id, 'season', filtered)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, roster, params.toString()]);

  function setFilter(next: StatsFilter) {
    const p = statsFilterToParams(next);
    // keep any non-filter params the page uses (none today)
    setParams(p, { replace: true });
  }

  function exportCsv(format: CsvFormat) {
    if (!view) return;
    downloadText(teamStatsCsvFileName(team.name, view.filtered), teamStatsCsv(view.season.players, format), 'text/csv;charset=utf-8');
  }

  if (error) return <p role="alert" className="text-red">Could not load team stats.</p>;
  if (!view) return <p className="text-slate">Loading team stats…</p>;

  const { coverage, season, filtered } = view;
  if (coverage.scouted === 0) {
    return <p className="text-slate">No scouted matches yet — scout a match to see team stats.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <h2 className="text-xl font-semibold">{team.name} · Season {team.season}</h2>
        <p className="text-sm">Printed {new Date().toLocaleDateString()}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm text-slate">
          Competition
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink" value={filter.competition}
            onChange={(e) => setFilter({ ...filter, competition: e.target.value as StatsFilter['competition'] })}>
            <option value="all">All</option><option value="league">League</option><option value="cup">Cup</option>
            <option value="friendly">Friendly</option><option value="tournament">Tournament</option>
          </select>
        </label>
        <label className="text-sm text-slate">
          Range
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink"
            value={filter.range.kind === 'last' ? `last${filter.range.count}` : filter.range.kind}
            onChange={(e) => {
              const v = e.target.value;
              setFilter({
                ...filter,
                range: v === 'last5' ? { kind: 'last', count: 5 } : v === 'last10' ? { kind: 'last', count: 10 }
                  : v === 'dates' ? { kind: 'dates', from: filtered[0]?.date ?? '', to: filtered[filtered.length - 1]?.date ?? '' }
                  : { kind: 'season' },
              });
            }}>
            <option value="season">Whole season</option><option value="last5">Last 5</option><option value="last10">Last 10</option><option value="dates">Dates…</option>
          </select>
        </label>
        {filter.range.kind === 'dates' && (
          <>
            <label className="text-sm text-slate">From <input type="date" className="ml-1 rounded-md border border-border px-2 py-1" value={filter.range.from}
              onChange={(e) => filter.range.kind === 'dates' && setFilter({ ...filter, range: { ...filter.range, from: e.target.value } })} /></label>
            <label className="text-sm text-slate">To <input type="date" className="ml-1 rounded-md border border-border px-2 py-1" value={filter.range.to}
              onChange={(e) => filter.range.kind === 'dates' && setFilter({ ...filter, range: { ...filter.range, to: e.target.value } })} /></label>
          </>
        )}
        <label className="text-sm text-slate">
          Venue
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink" value={filter.homeAway}
            onChange={(e) => setFilter({ ...filter, homeAway: e.target.value as StatsFilter['homeAway'] })}>
            <option value="all">Home & away</option><option value="home">Home</option><option value="away">Away</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Link to={`/teams/${team.id}/awards`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-orange px-4 font-medium text-white hover:bg-orange-strong">
            <Trophy size={16} aria-hidden="true" /> Season awards
          </Link>
          <Menu
            label="Export"
            trigger={<span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4"><Download size={16} aria-hidden="true" /> Export</span>}
            items={[
              { kind: 'action', label: 'Print / PDF', icon: <Printer size={16} />, onSelect: () => window.print() },
              { kind: 'divider' },
              { kind: 'action', label: 'CSV · Excel (Belgium/EU)', icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('eu') },
              { kind: 'action', label: 'CSV · Excel (English) / Sheets', icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('en') },
            ]}
          />
        </div>
      </div>

      <p className="text-sm text-slate">
        Based on {plural(coverage.scouted, 'scouted match')}
        {coverage.scoreOnly > 0 && ` · ${coverage.scoreOnly} score-only`}
        {coverage.skipped > 0 && ` · ${coverage.skipped} skipped (finished before stats existed)`}
        {filtered.length !== coverage.scouted + coverage.scoreOnly + coverage.skipped && ` · Showing ${filtered.length} of ${coverage.scouted + coverage.scoreOnly + coverage.skipped} matches`}
        {coverage.capped && ' · Showing the latest 60 matches.'}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi value={`${season.record.won}–${season.record.lost}`} label={`Record · sets ${season.record.setsWon}–${season.record.setsLost}`} />
        <Kpi value={fmtPct(season.sideOut)} label="Side-out" />
        <Kpi value={fmtPct(season.breakPoint)} label="Break point" />
        <Kpi value={fmtEff(season.attackEff)} label="Attack eff." />
        <Kpi value={fmtPct(season.receptionPos)} label="Reception +" />
        <Kpi value={`${season.aces} / ${season.serveErrors}`} label="Aces / serve errors" />
        <Kpi value={String(season.oppErrorPoints)} label="Points from opp. errors" />
      </div>

      <section aria-labelledby="trend-h" className="break-inside-avoid">
        <h3 id="trend-h" className="mb-2 font-semibold text-ink">Trend</h3>
        <TeamTrendChart points={season.trend} />
      </section>
      <section aria-labelledby="rot-h">
        <h3 id="rot-h" className="mb-2 font-semibold text-ink">Rotations</h3>
        <RotationBars rotations={season.rotations} best={season.bestRotation} weakest={season.weakestRotation} />
      </section>
      <section aria-labelledby="lb-h">
        <h3 id="lb-h" className="mb-2 font-semibold text-ink">Best players</h3>
        <Leaderboards teamId={team.id} rankings={view.rankings} people={view.people} />
      </section>
      <section aria-labelledby="pt-h" className="print:break-before-page">
        <h3 id="pt-h" className="mb-2 font-semibold text-ink">Players</h3>
        <PlayerStatsTable teamId={team.id} rows={season.players} />
      </section>
    </div>
  );
}

export default TeamStatsTab;
```

Fix in the coverage line: the test expects "Based on 1 scouted match" — `plural(1, 'scouted match')` = "1 scouted match" ✓; `plural(2, …)` = "2 scouted matches" ✓.

`TeamPage.tsx`:

```tsx
import { lazy, Suspense } from 'react';
import { isTeamAdmin } from './teamAccess';
const TeamStatsTab = lazy(() => import('./stats/TeamStatsTab'));
// TeamTab union gains 'stats'
const admin = !!team && isTeamAdmin(team, firebaseUser?.email, access);
// tabs: after matches
...(admin ? [{ id: 'stats' as const, label: 'Stats' }] : []),
// render
{activeTab === 'stats' && admin && (
  <Suspense fallback={<p className="text-slate">Loading team stats…</p>}>
    <TeamStatsTab team={team} />
  </Suspense>
)}
```

Also make the tab deep-linkable for the awards "Close" button and print: read the initial tab from `?tab=stats` (`useSearchParams`), i.e. `useState<TeamTab>(() => (params.get('tab') as TeamTab) ?? 'overview')`; when `onChange` fires, keep the existing state update and also `setParams` with `tab` (preserving other params). Unknown values fall back to `overview` through the existing `activeTab` guard — extend that guard: `const activeTab = (tab === 'calendar' && !canCalendar) || (tab === 'stats' && !admin) ? 'overview' : tab;`.

Print: the team page card already has padding/border; add `print:border-0 print:p-0 print:shadow-none` to the outer card div, and `print:hidden` to the `SectionTabs` and the team description line. The AppShell sidebar/bottom bar must be hidden in print — check `AppShell.tsx` for `print:hidden`; if missing, add `print:hidden` to the `<aside>` and the bottom `<nav>`.

Add to `TeamPage.test.tsx`:

```tsx
it('shows the Stats tab only to team admins', async () => {
  // admin: team.adminEmails contains the signed-in email (authValue default user@example.com)
  vi.mocked(teamsApi.getTeam).mockResolvedValue({ ...TEAM, adminEmails: ['user@example.com'] });
  renderTeamPage();
  expect(await screen.findByRole('tab', { name: 'Stats' })).toBeInTheDocument();
});
it('hides the Stats tab for viewers', async () => {
  vi.mocked(teamsApi.getTeam).mockResolvedValue({ ...TEAM, adminEmails: ['someone@else.be'] });
  renderTeamPage();
  await screen.findByRole('tab', { name: 'Overview' });
  expect(screen.queryByRole('tab', { name: 'Stats' })).toBeNull();
});
```

(`TEAM` / `renderTeamPage` = the fixture and helper already in that test file; adapt names.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/teams`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teams src/layout/AppShell.tsx src/index.css
git commit -m "feat(stats): Stats tab — filters, KPIs, trend, rotations, leaderboards, player table, PDF/CSV"
```

---

# Increment 3 — Awards

### Task 14: Awards data model, API, rules + rules tests

**Files:**
- Modify: `src/types/awards.ts`, `src/types/match.ts`, `firestore.rules`, `tests/rules/matches.rules.test.ts`
- Create: `src/awards/awardsApi.ts`, `src/awards/awardsApi.test.ts`, `tests/rules/awards.rules.test.ts`

**Interfaces:**
- Produces:
  - `interface AwardPick { playerId: string | null; hidden: boolean }`
  - `interface CustomAward { id: string; title: string; playerId: string; note: string }`
  - `interface AwardsInput { picks: Partial<Record<AwardId, AwardPick>>; custom: CustomAward[]; order: string[] }`
  - `interface AwardsConfig extends AwardsInput { updatedBy: string; updatedAt: unknown }`
  - `EMPTY_AWARDS: AwardsInput`, `MAX_CUSTOM_AWARDS = 5`, `CUSTOM_TITLE_MAX = 40`, `CUSTOM_NOTE_MAX = 80`
  - `Match.awards?: AwardsConfig | null`
  - `getSeasonAwards(teamId: string): Promise<AwardsInput | null>`, `saveSeasonAwards(teamId: string, input: AwardsInput, uid: string): Promise<void>`, `saveMatchAwards(teamId: string, matchId: string, input: AwardsInput, uid: string): Promise<void>`

- [ ] **Step 1: Types**

Append to `src/types/awards.ts`:

```ts
export interface AwardPick { playerId: string | null; hidden: boolean }
export interface CustomAward { id: string; title: string; playerId: string; note: string }
export interface AwardsInput {
  /** Absent key → the stats' choice. */
  picks: Partial<Record<AwardId, AwardPick>>;
  custom: CustomAward[];
  /** AwardId | CustomAward.id in reveal order. */
  order: string[];
}
export interface AwardsConfig extends AwardsInput { updatedBy: string; updatedAt: unknown }
export const EMPTY_AWARDS: AwardsInput = { picks: {}, custom: [], order: [] };
export const MAX_CUSTOM_AWARDS = 5;
export const CUSTOM_TITLE_MAX = 40;
export const CUSTOM_NOTE_MAX = 80;
```

In `src/types/match.ts`, add to `interface Match`: `/** Coach award choices; absent on matches without prepared awards. */ awards?: AwardsConfig | null;` (import type from `./awards`).

- [ ] **Step 2: Write the failing API test**

```ts
// src/awards/awardsApi.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDoc = vi.fn(() => Promise.resolve());
const updateDoc = vi.fn(() => Promise.resolve());
const getDoc = vi.fn();
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  serverTimestamp: () => 'TS',
}));

import { getSeasonAwards, saveMatchAwards, saveSeasonAwards } from './awardsApi';

const input = { picks: { mvp: { playerId: 'a', hidden: false } }, custom: [], order: ['mvp'] };

describe('awardsApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the season doc or null', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...input, updatedBy: 'u', updatedAt: 'x' }) });
    expect(await getSeasonAwards('t1')).toEqual(input);
    getDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getSeasonAwards('t1')).toBeNull();
  });

  it('writes season and match awards with author + timestamp', async () => {
    await saveSeasonAwards('t1', input, 'u1');
    expect(setDoc).toHaveBeenCalledWith({ path: 'teams/t1/awards/season' }, { ...input, updatedBy: 'u1', updatedAt: 'TS' });
    await saveMatchAwards('t1', 'm1', input, 'u1');
    expect(updateDoc).toHaveBeenCalledWith({ path: 'teams/t1/matches/m1' }, { awards: { ...input, updatedBy: 'u1', updatedAt: 'TS' }, updatedAt: 'TS' });
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/awards/awardsApi.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the API**

```ts
// src/awards/awardsApi.ts
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AwardsConfig, AwardsInput } from '../types/awards';

const strip = ({ picks, custom, order }: AwardsInput): AwardsInput => ({ picks, custom, order });

export async function getSeasonAwards(teamId: string): Promise<AwardsInput | null> {
  const snap = await getDoc(doc(db, 'teams', teamId, 'awards', 'season'));
  return snap.exists() ? strip(snap.data() as AwardsConfig) : null;
}

/** Not awaited by the UI: the persistent cache queues it offline. */
export function saveSeasonAwards(teamId: string, input: AwardsInput, uid: string): Promise<void> {
  return setDoc(doc(db, 'teams', teamId, 'awards', 'season'), { ...strip(input), updatedBy: uid, updatedAt: serverTimestamp() });
}

export function saveMatchAwards(teamId: string, matchId: string, input: AwardsInput, uid: string): Promise<void> {
  return updateDoc(doc(db, 'teams', teamId, 'matches', matchId), {
    awards: { ...strip(input), updatedBy: uid, updatedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
}
```

Run: `npx vitest run src/awards/awardsApi.test.ts` → PASS.

- [ ] **Step 5: Write the failing rules tests**

```ts
// tests/rules/awards.rules.test.ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

const CONFIG = { picks: {}, custom: [], order: [], updatedBy: 'coach-uid', updatedAt: new Date() };
const custom = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, title: 'Spirit', playerId: 'p1', note: '' }));

describe('awards rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('adminAllowlist/super@example.com').set({});
      await db.doc('users/super-uid').set({ role: 'superadmin', email: 'super@example.com' });
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
      await db.doc('teams/team-1/players/p1').set({ fullName: 'P', viewerEmails: ['parent@example.com'] });
      await db.doc('teams/team-1/awards/season').set(CONFIG);
    });
  });

  afterAll(async () => {
    await (await getTestEnv()).cleanup();
  });

  const as = async (uid: string, email: string) => (await getTestEnv()).authenticatedContext(uid, { email }).firestore();

  it('team admin reads and writes the season awards', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertSucceeds(db.doc('teams/team-1/awards/season').get());
    await assertSucceeds(db.doc('teams/team-1/awards/season').set({ ...CONFIG, custom: custom(5) }));
  });

  it('superadmin can write', async () => {
    const db = await as('super-uid', 'super@example.com');
    await assertSucceeds(db.doc('teams/team-1/awards/season').set(CONFIG));
  });

  it('viewer (guardian) and outsiders cannot read or write', async () => {
    for (const [uid, email] of [['parent-uid', 'parent@example.com'], ['x-uid', 'x@example.com']]) {
      const db = await as(uid, email);
      await assertFails(db.doc('teams/team-1/awards/season').get());
      await assertFails(db.doc('teams/team-1/awards/season').set(CONFIG));
    }
  });

  it('only the "season" doc id is allowed', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertFails(db.doc('teams/team-1/awards/other').set(CONFIG));
  });

  it('rejects more than 5 custom awards and bad shapes', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertFails(db.doc('teams/team-1/awards/season').set({ ...CONFIG, custom: custom(6) }));
    await assertFails(db.doc('teams/team-1/awards/season').set({ ...CONFIG, picks: 'x' }));
    await assertFails(db.doc('teams/team-1/awards/season').set({ ...CONFIG, order: 'x' }));
  });
});
```

Append to `tests/rules/matches.rules.test.ts` inside its `describe`:

```ts
it('team admin can save match awards; a guardian cannot', async () => {
  const awards = { picks: { mvp: { playerId: 'p1', hidden: false } }, custom: [], order: ['mvp'], updatedBy: 'coach-uid', updatedAt: new Date() };
  const coach = await as('coach-uid', 'coach@example.com');
  await assertSucceeds(coach.doc('teams/team-1/matches/m1').update({ awards }));
  const parent = await as('parent-uid', 'parent@example.com');
  await assertFails(parent.doc('teams/team-1/matches/m1').update({ awards }));
});
```

- [ ] **Step 6: Run rules tests to verify failure**

Run: `npm run test:rules -- tests/rules/awards.rules.test.ts`
(If extra args aren't forwarded through `emulators:exec`, run `npm run test:rules` for the whole suite.)
Expected: awards tests FAIL (no rule → default deny for admin writes); matches test passes already (existing rule).

- [ ] **Step 7: Add the rule**

In `firestore.rules`, inside `match /teams/{teamId} { … }`, next to `match /matches/{matchId}`:

```
      match /awards/{scope} {
        function isTeamAdmin() {
          return request.auth != null && (request.auth.token.email in
            get(/databases/$(database)/documents/teams/$(teamId)).data.adminEmails || isSuperAdmin());
        }
        allow read, delete: if isTeamAdmin();
        allow create, update: if isTeamAdmin()
          && scope == 'season'
          && request.resource.data.picks is map
          && request.resource.data.custom is list
          && request.resource.data.custom.size() <= 5
          && request.resource.data.order is list;
      }
```

- [ ] **Step 8: Run all rules tests**

Run: `npm run test:rules`
Expected: PASS (whole suite).

- [ ] **Step 9: Commit**

```bash
git add src/types src/awards/awardsApi.ts src/awards/awardsApi.test.ts firestore.rules tests/rules
git commit -m "feat(awards): awards config model, API, admin-only season doc rule + rules tests"
```

---

### Task 15: `resolveAwards`

**Files:**
- Create: `src/awards/resolveAwards.ts`, `src/awards/resolveAwards.test.ts`

**Interfaces:**
- Consumes: `rankAward`, `AWARDS_FOR`, `AWARD_TITLES`, `Ranked` (Task 9); `Person`, `UNKNOWN_PERSON` (Task 10); `AwardsInput`, `AwardScope` (Task 14).
- Produces:
  - `interface ResolvedAward { key: string; title: string; kind: 'stats' | 'custom'; winner: Person | null; statLine: string | null; suggested: Ranked | null; runnersUp: Ranked[]; overridden: boolean; hidden: boolean; note: string }`
  - `resolveAwards(scope: AwardScope, matches: Match[], config: AwardsInput | null, people: Map<string, Person>): ResolvedAward[]`
  - `defaultOrder(scope: AwardScope, custom: CustomAward[]): string[]`
  - `revealable(awards: ResolvedAward[]): ResolvedAward[]` (not hidden, has winner)

- [ ] **Step 1: Write the failing test**

```ts
// src/awards/resolveAwards.test.ts
import { describe, expect, it } from 'vitest';
import { latestRosterIndex } from '../teams/stats/rosterIndex';
import { EMPTY_AWARDS } from '../types/awards';
import { defaultOrder, resolveAwards, revealable } from './resolveAwards';
import { finished, player } from './testMatches';

const m = finished('m1', '2026-10-12', [player('a', { A: '########', S: '#' }), player('b', { A: '#!!!!!!!' })]);
const people = latestRosterIndex([m]);
const byKey = (xs: ReturnType<typeof resolveAwards>, k: string) => xs.find((x) => x.key === k)!;

describe('resolveAwards', () => {
  it('stats choice by default, MVP last, statLine present', () => {
    const out = resolveAwards('match', [m], null, people);
    expect(out[out.length - 1].key).toBe('mvp');
    const att = byKey(out, 'attacker');
    expect(att.winner?.playerId).toBe('a');
    expect(att.statLine).toBe('+100% att. eff. · 8 att.');
    expect(att.runnersUp.map((r) => r.playerId)).toEqual(['b']);
    expect(att.overridden).toBe(false);
  });

  it('override keeps the suggestion and drops the stat line', () => {
    const out = resolveAwards('match', [m], { ...EMPTY_AWARDS, picks: { attacker: { playerId: 'b', hidden: false } } }, people);
    const att = byKey(out, 'attacker');
    expect(att.winner?.playerId).toBe('b');
    expect(att.overridden).toBe(true);
    expect(att.statLine).toBeNull();
    expect(att.suggested?.playerId).toBe('a');
  });

  it('override equal to the stats choice is not "overridden"', () => {
    const out = resolveAwards('match', [m], { ...EMPTY_AWARDS, picks: { attacker: { playerId: 'a', hidden: false } } }, people);
    expect(byKey(out, 'attacker').overridden).toBe(false);
    expect(byKey(out, 'attacker').statLine).not.toBeNull();
  });

  it('hidden awards are excluded from the reveal', () => {
    const out = resolveAwards('match', [m], { ...EMPTY_AWARDS, picks: { mvp: { playerId: null, hidden: true } } }, people);
    expect(byKey(out, 'mvp').hidden).toBe(true);
    expect(revealable(out).some((x) => x.key === 'mvp')).toBe(false);
  });

  it('custom awards slot in before MVP and respect saved order', () => {
    const custom = [{ id: 'c1', title: 'Spirit of the team', playerId: 'b', note: 'Always cheering' }];
    expect(defaultOrder('match', custom).slice(-2)).toEqual(['c1', 'mvp']);
    const out = resolveAwards('match', [m], { picks: {}, custom, order: ['c1', 'attacker'] }, people);
    expect(out.slice(0, 2).map((x) => x.key)).toEqual(['c1', 'attacker']);
    const c = byKey(out, 'c1');
    expect(c).toMatchObject({ kind: 'custom', title: 'Spirit of the team', note: 'Always cheering', statLine: null });
    expect(c.winner?.playerId).toBe('b');
  });

  it('unknown override player → "Unknown player", never a crash', () => {
    const out = resolveAwards('match', [m], { ...EMPTY_AWARDS, picks: { mvp: { playerId: 'ghost', hidden: false } } }, people);
    expect(byKey(out, 'mvp').winner).toMatchObject({ playerId: 'ghost', name: 'Unknown player' });
  });

  it('no eligible player and no override → winner null, not revealable', () => {
    const out = resolveAwards('match', [m], null, people);
    expect(byKey(out, 'setter').winner).toBeNull();
    expect(revealable(out).some((x) => x.key === 'setter')).toBe(false);
  });

  it('nothing scouted at all → every stats award has no winner', () => {
    const out = resolveAwards('season', [finished('x', '2026-10-01', null)], null, new Map());
    expect(out.filter((x) => x.kind === 'stats').every((x) => x.winner === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/resolveAwards.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/awards/resolveAwards.ts
import { UNKNOWN_PERSON, type Person } from '../teams/stats/rosterIndex';
import type { AwardId, AwardScope, AwardsInput, CustomAward } from '../types/awards';
import type { Match } from '../types/match';
import { AWARD_TITLES, AWARDS_FOR, rankAward, type Ranked } from './awardRules';

export interface ResolvedAward {
  key: string; title: string; kind: 'stats' | 'custom';
  winner: Person | null; statLine: string | null;
  suggested: Ranked | null; runnersUp: Ranked[];
  overridden: boolean; hidden: boolean; note: string;
}

export function defaultOrder(scope: AwardScope, custom: CustomAward[]): string[] {
  const stats = AWARDS_FOR[scope].filter((id) => id !== 'mvp');
  return [...stats, ...custom.map((c) => c.id), 'mvp'];
}

const statLine = (r: Ranked) => `${r.display}${r.attempts !== null ? ` · ${r.attempts} att.` : ''}`;

export function resolveAwards(scope: AwardScope, matches: Match[], config: AwardsInput | null, people: Map<string, Person>): ResolvedAward[] {
  const cfg = config ?? { picks: {}, custom: [], order: [] };
  const person = (id: string) => people.get(id) ?? UNKNOWN_PERSON(id);
  const byKey = new Map<string, ResolvedAward>();

  for (const id of AWARDS_FOR[scope]) {
    const ranking = rankAward(id, scope, matches);
    const suggested = ranking.ranked[0] ?? null;
    const pick = cfg.picks[id as AwardId];
    const chosenId = pick?.playerId ?? suggested?.playerId ?? null;
    const overridden = !!pick?.playerId && pick.playerId !== suggested?.playerId;
    byKey.set(id, {
      key: id, title: AWARD_TITLES[id], kind: 'stats',
      winner: chosenId ? person(chosenId) : null,
      statLine: !overridden && suggested ? statLine(suggested) : null,
      suggested, runnersUp: ranking.ranked.slice(1, 3),
      overridden, hidden: !!pick?.hidden, note: '',
    });
  }
  for (const c of cfg.custom) {
    byKey.set(c.id, {
      key: c.id, title: c.title, kind: 'custom', winner: person(c.playerId), statLine: null,
      suggested: null, runnersUp: [], overridden: false, hidden: false, note: c.note,
    });
  }

  const saved = cfg.order.filter((k) => byKey.has(k));
  const order = [...saved, ...defaultOrder(scope, cfg.custom).filter((k) => !saved.includes(k))];
  return order.map((k) => byKey.get(k)!);
}

export function revealable(awards: ResolvedAward[]): ResolvedAward[] {
  return awards.filter((a) => !a.hidden && a.winner !== null);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/awards/resolveAwards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/resolveAwards.ts src/awards/resolveAwards.test.ts
git commit -m "feat(awards): resolve stats choices, overrides, hidden and custom awards in reveal order"
```

---

### Task 16: Name style + card themes (device prefs)

**Files:**
- Create: `src/awards/nameStyle.ts`, `src/awards/nameStyle.test.ts`, `src/awards/card/cardTheme.ts`, `src/awards/card/cardTheme.test.ts`

**Interfaces:**
- Produces:
  - `type NameStyle = 'full' | 'firstInitial' | 'first' | 'number'`; `NAME_STYLE_LABELS: Record<NameStyle, string>`; `styleName(p: Person, style: NameStyle): string`; `readNameStyle(): NameStyle`; `writeNameStyle(s: NameStyle): void`
  - `interface CardTheme { id: string; label: string; bgFrom: string; bgTo: string; accent: string; text: string; muted: string }`
  - `PRESETS: CardTheme[]` (ids `navy`, `gold`, `court`, `light`)
  - `interface ThemePrefs { presetId: string; custom: { from: string; to: string } | null }`
  - `readThemePrefs(): ThemePrefs`, `writeThemePrefs(p: ThemePrefs): void`, `themeFromPrefs(p: ThemePrefs): CardTheme`

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/nameStyle.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readNameStyle, styleName, writeNameStyle } from './nameStyle';

const p = { playerId: 'a', name: 'Lena Peeters', number: 12, current: true };

describe('nameStyle', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('formats', () => {
    expect(styleName(p, 'full')).toBe('Lena Peeters');
    expect(styleName(p, 'firstInitial')).toBe('Lena P.');
    expect(styleName(p, 'first')).toBe('Lena');
    expect(styleName(p, 'number')).toBe('#12');
  });

  it('handles single names, extra spaces and no number', () => {
    expect(styleName({ ...p, name: '  Zoë  ' }, 'firstInitial')).toBe('Zoë');
    expect(styleName({ ...p, name: 'Ana  van  Damme' }, 'firstInitial')).toBe('Ana v.');
    expect(styleName({ ...p, number: null }, 'number')).toBe('Lena P.');
  });

  it('defaults to firstInitial and persists; survives throwing storage', () => {
    expect(readNameStyle()).toBe('firstInitial');
    writeNameStyle('first');
    expect(readNameStyle()).toBe('first');
    localStorage.setItem('vcb.awards.nameStyle', 'bogus');
    expect(readNameStyle()).toBe('firstInitial');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    expect(readNameStyle()).toBe('firstInitial');
  });
});
```

```ts
// src/awards/card/cardTheme.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { PRESETS, readThemePrefs, themeFromPrefs, writeThemePrefs } from './cardTheme';

describe('cardTheme', () => {
  afterEach(() => localStorage.clear());

  it('has the four presets', () => {
    expect(PRESETS.map((t) => t.id)).toEqual(['navy', 'gold', 'court', 'light']);
  });

  it('defaults to navy, persists, applies custom colours', () => {
    expect(readThemePrefs()).toEqual({ presetId: 'navy', custom: null });
    writeThemePrefs({ presetId: 'gold', custom: { from: '#000000', to: '#ff0000' } });
    const prefs = readThemePrefs();
    expect(themeFromPrefs(prefs)).toMatchObject({ id: 'gold', bgFrom: '#000000', bgTo: '#ff0000' });
  });

  it('ignores corrupt storage and invalid colours', () => {
    localStorage.setItem('vcb.awards.theme', '{bad json');
    expect(readThemePrefs()).toEqual({ presetId: 'navy', custom: null });
    localStorage.setItem('vcb.awards.theme', JSON.stringify({ presetId: 'nope', custom: { from: 'red;}', to: '#fff' } }));
    expect(readThemePrefs()).toEqual({ presetId: 'navy', custom: null });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/nameStyle.test.ts src/awards/card/cardTheme.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/awards/nameStyle.ts
import type { Person } from '../teams/stats/rosterIndex';

export type NameStyle = 'full' | 'firstInitial' | 'first' | 'number';
export const NAME_STYLE_LABELS: Record<NameStyle, string> = {
  full: 'Full name', firstInitial: 'First name + initial', first: 'First name', number: 'Number only',
};
const KEY = 'vcb.awards.nameStyle';
const STYLES = Object.keys(NAME_STYLE_LABELS) as NameStyle[];

export function styleName(p: Person, style: NameStyle): string {
  const parts = p.name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? p.name.trim();
  if (style === 'number' && p.number !== null) return `#${p.number}`;
  if (style === 'full') return parts.join(' ');
  if (style === 'first') return first;
  return parts.length > 1 ? `${first} ${parts[1].charAt(0)}.` : first;
}

export function readNameStyle(): NameStyle {
  try {
    const v = localStorage.getItem(KEY);
    return STYLES.includes(v as NameStyle) ? (v as NameStyle) : 'firstInitial';
  } catch {
    return 'firstInitial';
  }
}

export function writeNameStyle(s: NameStyle): void {
  try { localStorage.setItem(KEY, s); } catch { /* per-device convenience only */ }
}
```

`'Ana van Damme'` → `first='Ana'`, `parts[1]='van'` → `'Ana v.'` ✓ (matches test).

```ts
// src/awards/card/cardTheme.ts
export interface CardTheme { id: string; label: string; bgFrom: string; bgTo: string; accent: string; text: string; muted: string }

export const PRESETS: CardTheme[] = [
  { id: 'navy', label: 'VCB Navy', bgFrom: '#1C4586', bgTo: '#0B1B36', accent: '#F97316', text: '#FFFFFF', muted: 'rgba(255,255,255,0.75)' },
  { id: 'gold', label: 'Gold Night', bgFrom: '#1A1A1A', bgTo: '#3A2A05', accent: '#F5C542', text: '#FFFFFF', muted: 'rgba(255,255,255,0.75)' },
  { id: 'court', label: 'Court Orange', bgFrom: '#F97316', bgTo: '#B4410B', accent: '#FFFFFF', text: '#FFFFFF', muted: 'rgba(255,255,255,0.8)' },
  { id: 'light', label: 'Clean Light', bgFrom: '#F8FAFC', bgTo: '#E2E8F0', accent: '#2356A8', text: '#0F172A', muted: '#475569' },
];

export interface ThemePrefs { presetId: string; custom: { from: string; to: string } | null }
const KEY = 'vcb.awards.theme';
const DEFAULT: ThemePrefs = { presetId: 'navy', custom: null };
const HEX = /^#[0-9a-fA-F]{6}$/;

export function readThemePrefs(): ThemePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ThemePrefs> | null;
    if (!raw || !PRESETS.some((t) => t.id === raw.presetId)) return DEFAULT;
    const c = raw.custom;
    const custom = c && HEX.test(c.from) && HEX.test(c.to) ? { from: c.from, to: c.to } : null;
    if (c && !custom) return DEFAULT;
    return { presetId: raw.presetId!, custom };
  } catch {
    return DEFAULT;
  }
}

export function writeThemePrefs(p: ThemePrefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* per-device convenience only */ }
}

export function themeFromPrefs(p: ThemePrefs): CardTheme {
  const base = PRESETS.find((t) => t.id === p.presetId) ?? PRESETS[0];
  return p.custom ? { ...base, bgFrom: p.custom.from, bgTo: p.custom.to } : base;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/awards/nameStyle.test.ts src/awards/card/cardTheme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/nameStyle.ts src/awards/nameStyle.test.ts src/awards/card/cardTheme.ts src/awards/card/cardTheme.test.ts
git commit -m "feat(awards): name styles (default first name + initial) and card theme presets"
```

---

### Task 17: Card timeline + seeded confetti

**Files:**
- Create: `src/awards/card/cardTimeline.ts`, `src/awards/card/cardTimeline.test.ts`, `src/awards/card/confetti.ts`, `src/awards/card/confetti.test.ts`

**Interfaces:**
- Produces:
  - `CARD_DURATION_MS = 3500`
  - `interface Beats { bg: number; title: number; photo: number; name: number; stat: number; confetti: number }` (each 0..1)
  - `cardBeats(t: number, reducedMotion?: boolean): Beats`
  - `easeOutCubic(x)`, `easeOutBack(x)` (overshoots > 1 mid-way, ends at 1)
  - `interface Particle { x: number; y: number; rot: number; size: number; color: string; alpha: number }`
  - `mulberry32(seed: number): () => number`; `seedFrom(text: string): number`
  - `confettiAt(seed: number, p: number, colors: string[], count?: number): Particle[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/card/cardTimeline.test.ts
import { describe, expect, it } from 'vitest';
import { cardBeats, easeOutBack, easeOutCubic } from './cardTimeline';

describe('cardTimeline', () => {
  it('beats follow the spec segments', () => {
    expect(cardBeats(0)).toEqual({ bg: 0, title: 0, photo: 0, name: 0, stat: 0, confetti: 0 });
    expect(cardBeats(0.2).bg).toBe(1);
    expect(cardBeats(0.2).title).toBe(0);
    expect(cardBeats(0.45).title).toBe(1);
    expect(cardBeats(0.7).name).toBe(0);
    expect(cardBeats(0.85).name).toBe(1);
    expect(cardBeats(0.85).stat).toBe(0);
    expect(cardBeats(1)).toEqual({ bg: 1, title: 1, photo: 1, name: 1, stat: 1, confetti: 1 });
  });

  it('clamps t outside [0,1]', () => {
    expect(cardBeats(-1).bg).toBe(0);
    expect(cardBeats(2).stat).toBe(1);
  });

  it('easings', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1);
    expect(easeOutBack(1)).toBeCloseTo(1);
  });

  it('reduced motion: everything visible, no confetti', () => {
    expect(cardBeats(0.1, true)).toEqual({ bg: 1, title: 1, photo: 1, name: 1, stat: 1, confetti: 0 });
  });
});
```

```ts
// src/awards/card/confetti.test.ts
import { describe, expect, it } from 'vitest';
import { confettiAt, mulberry32, seedFrom } from './confetti';

describe('confetti', () => {
  it('PRNG is deterministic', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('seedFrom is stable and differs per text', () => {
    expect(seedFrom('mvp')).toBe(seedFrom('mvp'));
    expect(seedFrom('mvp')).not.toBe(seedFrom('server'));
  });

  it('same seed and progress → identical particles', () => {
    expect(confettiAt(7, 0.5, ['#f00'])).toEqual(confettiAt(7, 0.5, ['#f00']));
  });

  it('no particles at 0, they fall and fade', () => {
    expect(confettiAt(7, 0, ['#f00'])).toEqual([]);
    const early = confettiAt(7, 0.2, ['#f00']);
    const late = confettiAt(7, 0.9, ['#f00']);
    expect(late[0].y).toBeGreaterThan(early[0].y);
    expect(late[0].alpha).toBeLessThan(early[0].alpha);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/card/cardTimeline.test.ts src/awards/card/confetti.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/awards/card/cardTimeline.ts
export const CARD_DURATION_MS = 3500;

export interface Beats { bg: number; title: number; photo: number; name: number; stat: number; confetti: number }

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export function easeOutBack(x: number): number {
  const c1 = 1.70158, c3 = c1 + 1, v = clamp(x);
  return 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2);
}

/** Raw (linear) progress per layer; the renderer applies the easing per layer. */
export function cardBeats(t: number, reducedMotion = false): Beats {
  if (reducedMotion) return { bg: 1, title: 1, photo: 1, name: 1, stat: 1, confetti: 0 };
  return {
    bg: seg(t, 0, 0.2),
    title: seg(t, 0.2, 0.45),
    photo: seg(t, 0.45, 0.7),
    name: seg(t, 0.7, 0.85),
    stat: seg(t, 0.85, 1),
    confetti: seg(t, 0.85, 1),
  };
}
```

```ts
// src/awards/card/confetti.ts
export interface Particle { x: number; y: number; rot: number; size: number; color: string; alpha: number }

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Particles in card space (1080×1920) at burst progress p ∈ [0,1]; pure in (seed, p). */
export function confettiAt(seed: number, p: number, colors: string[], count = 120): Particle[] {
  if (p <= 0) return [];
  const rnd = mulberry32(seed);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.2;
    const speed = 900 + rnd() * 900;
    const spin = (rnd() - 0.5) * 12;
    const size = 12 + rnd() * 16;
    const color = colors[Math.floor(rnd() * colors.length)];
    const x0 = 540, y0 = 1000;
    out.push({
      x: x0 + Math.cos(angle) * speed * p,
      y: y0 + Math.sin(angle) * speed * p + 2200 * p * p,
      rot: spin * p,
      size,
      color,
      alpha: Math.max(0, 1 - p * 0.9),
    });
  }
  return out;
}
```

Check the "they fall" test: particle 0's y at p=0.2 vs 0.9 — with upward initial velocity (sin(angle) ≈ −1 × ~1350) and gravity 2200p²: y(0.2) ≈ 1000 − 270 + 88 = 818; y(0.9) ≈ 1000 − 1215 + 1782 = 1567 ✓ (generally true since gravity term dominates by 0.9; if a particular seed's particle 0 fails, raise gravity to 2600).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/awards/card/cardTimeline.test.ts src/awards/card/confetti.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/card/cardTimeline.ts src/awards/card/cardTimeline.test.ts src/awards/card/confetti.ts src/awards/card/confetti.test.ts
git commit -m "feat(awards): card animation timeline and deterministic seeded confetti"
```

---

### Task 18: `fitName` + `drawAwardCard` (+ title card) with a recording test context

**Files:**
- Create: `src/awards/card/testCtx.ts`, `src/awards/card/fitName.ts`, `src/awards/card/fitName.test.ts`, `src/awards/card/drawAwardCard.ts`, `src/awards/card/drawAwardCard.test.ts`

**Interfaces:**
- Consumes: `CardTheme` (Task 16), `cardBeats`, `easeOutCubic`, `easeOutBack` (Task 17), `confettiAt`, `seedFrom` (Task 17).
- Produces:
  - `CARD_W = 1080`, `CARD_H = 1920`
  - `interface CardModel { key: string; awardTitle: string; name: string; number: number | null; statLine: string | null; footer: string; teamName: string; note: string }`
  - `interface CardArt { photo: ImageBitmap | HTMLCanvasElement | null; background: ImageBitmap | HTMLCanvasElement | null }`
  - `drawAwardCard(ctx: CanvasRenderingContext2D, card: CardModel, theme: CardTheme, art: CardArt, t: number, reducedMotion?: boolean): void`
  - `drawTitleCard(ctx: CanvasRenderingContext2D, title: string, theme: CardTheme, art: CardArt, pulse: number): void` (pulse 0..1, for the suspense glow)
  - `fitName(ctx, text: string, maxWidth: number, maxSize?: number, minSize?: number): { size: number; lines: string[] }`
  - test helper `recordingCtx(): { ctx: CanvasRenderingContext2D; calls: { method: string; args: unknown[] }[]; texts: () => string[] }`

- [ ] **Step 1: Recording context helper**

```ts
// src/awards/card/testCtx.ts
/** A fake 2D context recording every call; measureText ≈ 0.55 em per char of the current font size. */
export function recordingCtx() {
  const calls: { method: string; args: unknown[] }[] = [];
  const state: Record<string, unknown> = { font: '10px Inter' };
  const sizeOf = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10);
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: s.length * sizeOf() * 0.55 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return gradient;
      };
      return (...args: unknown[]) => calls.push({ method: prop, args });
    },
    set(target, prop: string, value) {
      target[prop] = value;
      calls.push({ method: `set:${prop}`, args: [value] });
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const texts = () => calls.filter((c) => c.method === 'fillText').map((c) => String(c.args[0]));
  return { ctx, calls, texts };
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/awards/card/fitName.test.ts
import { describe, expect, it } from 'vitest';
import { fitName } from './fitName';
import { recordingCtx } from './testCtx';

describe('fitName', () => {
  it('keeps a short name at max size on one line', () => {
    const { ctx } = recordingCtx();
    expect(fitName(ctx, 'Lena P.', 900)).toEqual({ size: 120, lines: ['Lena P.'] });
  });

  it('shrinks a longer name before wrapping', () => {
    const { ctx } = recordingCtx();
    const r = fitName(ctx, 'Maria Fernanda', 900); // 14 chars × 0.55 × size ≤ 900 → size ≤ 116
    expect(r.lines).toHaveLength(1);
    expect(r.size).toBeLessThan(120);
    expect(r.size).toBeGreaterThanOrEqual(64);
  });

  it('wraps to two lines at min size, then ellipsis', () => {
    const { ctx } = recordingCtx();
    const r = fitName(ctx, 'Maria-Fernanda Van den Broeck-Oliveira de la Cruz y Santos', 900);
    expect(r.size).toBe(64);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[1].endsWith('…')).toBe(true);
    for (const l of r.lines) expect(l.length * 64 * 0.55).toBeLessThanOrEqual(900);
  });

  it('handles an unbreakable token and non-Latin text', () => {
    const { ctx } = recordingCtx();
    const r = fitName(ctx, 'Wolfeschlegelsteinhausenbergerdorffvoralternwarengewissenhaftschaferswessen', 900);
    expect(r.lines.every((l) => l.length * r.size * 0.55 <= 900)).toBe(true);
    expect(fitName(ctx, 'Zoë Ünal', 900).lines).toEqual(['Zoë Ünal']);
  });
});
```

```ts
// src/awards/card/drawAwardCard.test.ts
import { describe, expect, it } from 'vitest';
import { PRESETS } from './cardTheme';
import { CARD_H, CARD_W, drawAwardCard, drawTitleCard, type CardModel } from './drawAwardCard';
import { recordingCtx } from './testCtx';

const card: CardModel = {
  key: 'mvp', awardTitle: 'MVP', name: 'Lena P.', number: 12, statLine: '6.2 MVP pts', footer: 'vs Rivals · 12 Oct 2026', teamName: 'U17 Girls', note: '',
};
const fakeImage = { width: 800, height: 600 } as unknown as ImageBitmap;

describe('drawAwardCard', () => {
  it('at t=1 draws title, name, stat line, footer, team name', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, card, PRESETS[0], { photo: null, background: null }, 1);
    const all = texts();
    for (const s of ['MVP', 'Lena P.', '6.2 MVP pts', 'vs Rivals · 12 Oct 2026', 'U17 GIRLS']) expect(all).toContain(s);
  });

  it('draws the jersey number when there is no photo, the photo otherwise', () => {
    const a = recordingCtx();
    drawAwardCard(a.ctx, card, PRESETS[0], { photo: null, background: null }, 1);
    expect(a.texts()).toContain('12');
    expect(a.calls.some((c) => c.method === 'drawImage')).toBe(false);

    const b = recordingCtx();
    drawAwardCard(b.ctx, card, PRESETS[0], { photo: fakeImage, background: null }, 1);
    expect(b.texts()).not.toContain('12');
    expect(b.calls.filter((c) => c.method === 'drawImage')).toHaveLength(1);
  });

  it('a background image is drawn cover-fit with a scrim', () => {
    const { ctx, calls } = recordingCtx();
    drawAwardCard(ctx, card, PRESETS[0], { photo: null, background: fakeImage }, 1);
    const draw = calls.find((c) => c.method === 'drawImage')!;
    // 800×600 into 1080×1920 cover → scale 3.2 → 2560×1920, centred: x = (1080-2560)/2
    expect(draw.args.slice(1)).toEqual([(CARD_W - 2560) / 2, 0, 2560, CARD_H]);
    expect(calls.some((c) => c.method === 'set:fillStyle' && c.args[0] === 'rgba(0,0,0,0.45)')).toBe(true);
  });

  it('is deterministic for the same t', () => {
    const a = recordingCtx(), b = recordingCtx();
    drawAwardCard(a.ctx, card, PRESETS[1], { photo: null, background: null }, 0.93);
    drawAwardCard(b.ctx, card, PRESETS[1], { photo: null, background: null }, 0.93);
    expect(a.calls).toEqual(b.calls);
  });

  it('at t=0 nothing but the background is visible', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, card, PRESETS[0], { photo: null, background: null }, 0);
    expect(texts()).toEqual([]);
  });

  it('omits the stat line when null and shows the note for custom awards', () => {
    const { ctx, texts } = recordingCtx();
    drawAwardCard(ctx, { ...card, statLine: null, note: 'Always cheering' }, PRESETS[0], { photo: null, background: null }, 1);
    expect(texts()).toContain('Always cheering');
    expect(texts()).not.toContain('6.2 MVP pts');
  });

  it('title card shows only the award title', () => {
    const { ctx, texts } = recordingCtx();
    drawTitleCard(ctx, 'Best server', PRESETS[0], { photo: null, background: null }, 0.5);
    expect(texts()).toContain('Best server');
    expect(texts()).not.toContain('Lena P.');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/awards/card/fitName.test.ts src/awards/card/drawAwardCard.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `fitName`**

```ts
// src/awards/card/fitName.ts
const ELLIPSIS = '…';

function setSize(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + ELLIPSIS).width > maxWidth) s = s.slice(0, -1);
  return s.trimEnd() + ELLIPSIS;
}

/** Shrink from maxSize to minSize; if still too wide, wrap to 2 lines at minSize; then ellipsis. */
export function fitName(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxSize = 120, minSize = 64) {
  const clean = text.trim().replace(/\s+/g, ' ');
  for (let size = maxSize; size >= minSize; size -= 4) {
    setSize(ctx, size);
    if (ctx.measureText(clean).width <= maxWidth) return { size, lines: [clean] };
  }
  setSize(ctx, minSize);
  const words = clean.split(' ');
  let first = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = first ? `${first} ${words[i]}` : words[i];
    if (ctx.measureText(next).width > maxWidth) break;
    first = next;
  }
  if (!first) return { size: minSize, lines: [truncate(ctx, clean, maxWidth)] }; // one unbreakable token
  const rest = words.slice(i).join(' ');
  return { size: minSize, lines: rest ? [first, truncate(ctx, rest, maxWidth)] : [first] };
}
```

For the Wolfeschlegel… case: no size fits, no word fits on line 1 → single truncated line ✓.

- [ ] **Step 5: Implement `drawAwardCard`**

```ts
// src/awards/card/drawAwardCard.ts
import type { CardTheme } from './cardTheme';
import { cardBeats, easeOutBack, easeOutCubic } from './cardTimeline';
import { confettiAt, seedFrom } from './confetti';
import { fitName } from './fitName';

export const CARD_W = 1080;
export const CARD_H = 1920;
const CX = CARD_W / 2;
const CIRCLE_Y = 860;
const CIRCLE_R = 300;
const TEXT_W = 920;

export interface CardModel {
  key: string; awardTitle: string; name: string; number: number | null;
  statLine: string | null; footer: string; teamName: string; note: string;
}
type Img = ImageBitmap | HTMLCanvasElement;
export interface CardArt { photo: Img | null; background: Img | null }

function drawBackground(ctx: CanvasRenderingContext2D, theme: CardTheme, art: CardArt, alpha: number) {
  ctx.save();
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, theme.bgFrom);
  g.addColorStop(1, theme.bgTo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (art.background) {
    ctx.globalAlpha = alpha;
    const s = Math.max(CARD_W / art.background.width, CARD_H / art.background.height);
    const w = art.background.width * s, h = art.background.height * s;
    ctx.drawImage(art.background, (CARD_W - w) / 2, (CARD_H - h) / 2, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, y: number, font: string, color: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, CX, y);
  ctx.restore();
}

function drawHeader(ctx: CanvasRenderingContext2D, card: Pick<CardModel, 'teamName'>, theme: CardTheme, alpha: number) {
  text(ctx, 'VOLLEY CLUB BELAIR', 150, '700 34px Inter, system-ui, sans-serif', theme.muted, alpha);
  text(ctx, card.teamName.toUpperCase(), 200, '600 30px Inter, system-ui, sans-serif', theme.muted, alpha);
}

export function drawAwardCard(ctx: CanvasRenderingContext2D, card: CardModel, theme: CardTheme, art: CardArt, t: number, reducedMotion = false): void {
  const b = cardBeats(t, reducedMotion);
  drawBackground(ctx, theme, art, easeOutCubic(b.bg));
  drawHeader(ctx, card, theme, easeOutCubic(b.bg));

  // Award title: slides up 60px while fading in
  const tt = easeOutCubic(b.title);
  if (tt > 0) {
    ctx.save();
    ctx.translate(0, (1 - tt) * 60);
    text(ctx, card.awardTitle, 420, '900 110px Inter, system-ui, sans-serif', theme.accent, tt);
    ctx.restore();
  }

  // Photo / number circle: spring scale
  if (b.photo > 0) {
    const s = Math.max(0, easeOutBack(b.photo));
    ctx.save();
    ctx.translate(CX, CIRCLE_Y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(0, 0, CIRCLE_R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = theme.accent;
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.strokeStyle = theme.text;
    ctx.stroke();
    ctx.clip();
    if (art.photo) {
      const ps = Math.max((CIRCLE_R * 2) / art.photo.width, (CIRCLE_R * 2) / art.photo.height);
      const w = art.photo.width * ps, h = art.photo.height * ps;
      ctx.drawImage(art.photo, -w / 2, -h / 2, w, h);
    } else if (card.number !== null) {
      ctx.font = '900 300px Inter, system-ui, sans-serif';
      ctx.fillStyle = theme.bgTo;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(card.number), 0, 10);
    }
    // light sweep while the circle settles
    if (!reducedMotion && b.photo < 1) {
      const sweepX = -CIRCLE_R + b.photo * CIRCLE_R * 2;
      const g = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-CIRCLE_R, -CIRCLE_R, CIRCLE_R * 2, CIRCLE_R * 2);
    }
    ctx.restore();
  }

  // Name: letter-by-letter reveal
  if (b.name > 0) {
    const { size, lines } = fitName(ctx, card.name, TEXT_W);
    const totalChars = lines.join('').length;
    let shown = Math.ceil(totalChars * b.name);
    lines.forEach((line, i) => {
      const visible = line.slice(0, Math.max(0, shown));
      shown -= line.length;
      if (visible) text(ctx, visible, 1330 + i * (size * 1.1), `800 ${size}px Inter, system-ui, sans-serif`, theme.text, 1);
    });
  }

  // Stat line or note
  const st = easeOutCubic(b.stat);
  const sub = card.statLine ?? (card.note || null);
  if (sub) text(ctx, sub, 1560, '600 52px Inter, system-ui, sans-serif', theme.muted, st);
  text(ctx, card.footer, 1780, '500 36px Inter, system-ui, sans-serif', theme.muted, st);

  // Confetti
  if (b.confetti > 0) {
    for (const p of confettiAt(seedFrom(card.key), b.confetti, [theme.accent, theme.text, '#F5C542'])) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  }
}

/** The pre-reveal card: award title only, with a pulsing glow (pulse 0..1). */
export function drawTitleCard(ctx: CanvasRenderingContext2D, title: string, theme: CardTheme, art: CardArt, pulse: number): void {
  drawBackground(ctx, theme, art, 1);
  ctx.save();
  const r = 340 + 40 * Math.sin(pulse * Math.PI * 2);
  const g = ctx.createRadialGradient(CX, CARD_H / 2, 0, CX, CARD_H / 2, r);
  g.addColorStop(0, `${theme.accent}66`);
  g.addColorStop(1, `${theme.accent}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.restore();
  text(ctx, title, CARD_H / 2 + 40, '900 120px Inter, system-ui, sans-serif', theme.text, 1);
}
```

Test check — "at t=0 nothing but the background": header alpha = easeOutCubic(0) = 0 → `text` returns early ✓; title tt=0 ✓; photo 0 ✓; name 0 ✓; st=0 → stat/footer skipped ✓. Note `theme.accent` with `66` suffix assumes 6-digit hex accents (all presets are) ✓.

The "photo" test: with a photo, `drawImage` is called once (no background) ✓ and `'12'` not drawn ✓.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/awards/card`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/awards/card
git commit -m "feat(awards): canvas award card renderer — fitted names, photo or jersey number, confetti"
```

---

### Task 19: Device-only photos — load, crop math, crop dialog

**Files:**
- Create: `src/awards/photo.ts`, `src/awards/photo.test.ts`, `src/awards/PhotoCropDialog.tsx`, `src/awards/PhotoCropDialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog` from `src/components/Dialog.tsx` (check its props: `open`, `onClose`, `title`, children — adapt).
- Produces:
  - `interface Crop { cx: number; cy: number; zoom: number }` (centre as 0..1 of source, zoom ≥ 1)
  - `cropRect(srcW: number, srcH: number, crop: Crop): { sx: number; sy: number; size: number }` — square source rect, clamped inside the image
  - `loadImageFile(file: File): Promise<ImageBitmap>` (EXIF-aware, rejects non-images)
  - `renderCrop(src: ImageBitmap, crop: Crop, out?: number): HTMLCanvasElement` (≤ 1080 square)
  - `PhotoCropDialog({ open, file, onCancel, onDone }: { open: boolean; file: File | null; onCancel: () => void; onDone: (img: HTMLCanvasElement) => void })`

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/photo.test.ts
import { describe, expect, it } from 'vitest';
import { cropRect, loadImageFile } from './photo';

describe('photo', () => {
  it('centre crop of a landscape image at zoom 1 is the full height square', () => {
    expect(cropRect(1600, 1000, { cx: 0.5, cy: 0.5, zoom: 1 })).toEqual({ sx: 300, sy: 0, size: 1000 });
  });

  it('zoom shrinks the square and clamps inside the image', () => {
    expect(cropRect(1000, 1000, { cx: 0.5, cy: 0.5, zoom: 2 })).toEqual({ sx: 250, sy: 250, size: 500 });
    expect(cropRect(1000, 1000, { cx: 0, cy: 1, zoom: 2 })).toEqual({ sx: 0, sy: 500, size: 500 });
  });

  it('rejects non-image files', async () => {
    await expect(loadImageFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('Choose an image file.');
  });
});
```

```tsx
// src/awards/PhotoCropDialog.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoCropDialog } from './PhotoCropDialog';

describe('PhotoCropDialog', () => {
  it('shows an error for a non-image and cancels', async () => {
    const onCancel = vi.fn();
    render(<PhotoCropDialog open file={new File(['x'], 'a.txt', { type: 'text/plain' })} onCancel={onCancel} onDone={vi.fn()} />);
    expect(await screen.findByText('Choose an image file.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('says photos stay on the device', () => {
    render(<PhotoCropDialog open file={null} onCancel={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByText(/stays on this device/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/photo.test.ts src/awards/PhotoCropDialog.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/awards/photo.ts
export interface Crop { cx: number; cy: number; zoom: number }

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function cropRect(srcW: number, srcH: number, crop: Crop): { sx: number; sy: number; size: number } {
  const size = Math.min(srcW, srcH) / Math.max(1, crop.zoom);
  const sx = clamp(crop.cx * srcW - size / 2, 0, srcW - size);
  const sy = clamp(crop.cy * srcH - size / 2, 0, srcH - size);
  return { sx: Math.round(sx), sy: Math.round(sy), size: Math.round(size) };
}

/** Decodes in the browser only; the file never leaves the device. */
export async function loadImageFile(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image could not be opened.');
  }
}

export function renderCrop(src: ImageBitmap, crop: Crop, out = 1080): HTMLCanvasElement {
  const { sx, sy, size } = cropRect(src.width, src.height, crop);
  const side = Math.min(out, size);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  canvas.getContext('2d')!.drawImage(src, sx, sy, size, size, 0, 0, side, side);
  return canvas;
}
```

Photos are stored as `HTMLCanvasElement` after cropping (a canvas is a valid `drawImage` source and `CardArt` accepts it); the decoded `ImageBitmap` is `close()`d right after cropping.

```tsx
// src/awards/PhotoCropDialog.tsx
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Dialog } from '../components/Dialog';
import { Button } from '../components/Button';
import { cropRect, loadImageFile, renderCrop, type Crop } from './photo';

const PREVIEW = 280;

export function PhotoCropDialog({ open, file, onCancel, onDone }: { open: boolean; file: File | null; onCancel: () => void; onDone: (img: HTMLCanvasElement) => void }) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ cx: 0.5, cy: 0.5, zoom: 1 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  useEffect(() => {
    setError(null);
    setBitmap(null);
    setCrop({ cx: 0.5, cy: 0.5, zoom: 1 });
    if (!file) return;
    let cancelled = false;
    let loaded: ImageBitmap | null = null;
    loadImageFile(file)
      .then((b) => {
        loaded = b;
        if (!cancelled) setBitmap(b);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      loaded?.close();
    };
  }, [file]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !bitmap) return;
    const { sx, sy, size } = cropRect(bitmap.width, bitmap.height, crop);
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    ctx.save();
    ctx.beginPath();
    ctx.arc(PREVIEW / 2, PREVIEW / 2, PREVIEW / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, PREVIEW, PREVIEW);
    ctx.restore();
  }, [bitmap, crop]);

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop };
  }
  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !bitmap) return;
    const { size } = cropRect(bitmap.width, bitmap.height, drag.current.crop);
    const k = size / PREVIEW; // source px per preview px
    setCrop({
      ...drag.current.crop,
      cx: Math.max(0, Math.min(1, drag.current.crop.cx - ((e.clientX - drag.current.x) * k) / bitmap.width)),
      cy: Math.max(0, Math.min(1, drag.current.crop.cy - ((e.clientY - drag.current.y) * k) / bitmap.height)),
    });
  }

  return (
    <Dialog open={open} onClose={onCancel} title="Position the photo">
      <p className="mb-3 text-sm text-slate">The photo stays on this device and is forgotten when you leave this page.</p>
      {error && <p role="alert" className="mb-3 text-red">{error}</p>}
      {bitmap && (
        <>
          <canvas
            ref={canvasRef} width={PREVIEW} height={PREVIEW}
            className="mx-auto block touch-none cursor-grab rounded-full bg-bg"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
            aria-label="Drag to position the photo"
          />
          <label className="mt-3 block text-sm text-slate">
            Zoom
            <input type="range" min={1} max={4} step={0.05} value={crop.zoom} className="ml-2 w-48 align-middle"
              onChange={(e) => setCrop({ ...crop, zoom: Number(e.target.value) })} />
          </label>
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={!bitmap} onClick={() => bitmap && onDone(renderCrop(bitmap, crop))}>Use photo</Button>
      </div>
    </Dialog>
  );
}
```

Check `Dialog` and `Button` prop names/variants in `src/components/Dialog.tsx` and `Button.tsx` and adapt (`variant="ghost"` may be named differently, e.g. `secondary`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/awards/photo.test.ts src/awards/PhotoCropDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/photo.ts src/awards/photo.test.ts src/awards/PhotoCropDialog.tsx src/awards/PhotoCropDialog.test.tsx
git commit -m "feat(awards): device-only photo loading and crop dialog"
```

---

### Task 20: PNG export + share

**Files:**
- Create: `src/awards/exportCards.ts`, `src/awards/exportCards.test.ts`

**Interfaces:**
- Consumes: `drawAwardCard`, `CardModel`, `CardArt`, `CARD_W`, `CARD_H` (Task 18); `CardTheme`; `fileSlug`.
- Produces:
  - `cardFileName(awardKey: string, ctx: { kind: 'match'; date: string; opponent: string } | { kind: 'season'; season: string }): string`
  - `ensureCardFonts(): Promise<void>`
  - `renderCardPng(card: CardModel, theme: CardTheme, art: CardArt): Promise<Blob>`
  - `shareOrDownload(files: File[], title: string): Promise<'shared' | 'downloaded' | 'cancelled'>`

- [ ] **Step 1: Write the failing test**

```ts
// src/awards/exportCards.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardFileName, shareOrDownload } from './exportCards';

describe('exportCards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error test cleanup
    delete navigator.share; // @ts-expect-error test cleanup
    delete navigator.canShare;
  });

  it('file names', () => {
    expect(cardFileName('mvp', { kind: 'match', date: '2026-10-12', opponent: 'VC Rivals / B' })).toBe('vcb-mvp-2026-10-12-vs-VC-Rivals-B.png');
    expect(cardFileName('c-123', { kind: 'season', season: '2026-27' })).toBe('vcb-c-123-season-2026-27.png');
  });

  it('shares when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    expect(await shareOrDownload([f], 'MVP')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [f], title: 'MVP' });
  });

  it('treats a dismissed share sheet as cancelled', async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), canShare: () => true });
    expect(await shareOrDownload([new File(['x'], 'a.png')], 'MVP')).toBe('cancelled');
  });

  it('falls back to downloads', async () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const p = shareOrDownload([new File(['x'], 'a.png'), new File(['y'], 'b.png')], 'Awards');
    await vi.runAllTimersAsync();
    expect(await p).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/exportCards.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/awards/exportCards.ts
import { fileSlug } from '../export/exportJson';
import type { CardTheme } from './card/cardTheme';
import { CARD_H, CARD_W, drawAwardCard, type CardArt, type CardModel } from './card/drawAwardCard';

export function cardFileName(
  awardKey: string,
  c: { kind: 'match'; date: string; opponent: string } | { kind: 'season'; season: string },
): string {
  return c.kind === 'match'
    ? `vcb-${awardKey}-${c.date}-vs-${fileSlug(c.opponent)}.png`
    : `vcb-${awardKey}-season-${fileSlug(c.season)}.png`;
}

/** Text drawn before Inter loads silently falls back to another font. */
export async function ensureCardFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  await Promise.all(
    ['900 120px Inter', '800 120px Inter', '700 34px Inter', '600 52px Inter', '500 36px Inter'].map((f) => document.fonts.load(f).catch(() => [])),
  );
}

export async function renderCardPng(card: CardModel, theme: CardTheme, art: CardArt): Promise<Blob> {
  await ensureCardFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  drawAwardCard(canvas.getContext('2d')!, card, theme, art, 1);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareOrDownload(files: File[], title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files }) && typeof navigator.share === 'function') {
    try {
      await navigator.share({ files, title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // otherwise fall through to download
    }
  }
  for (let i = 0; i < files.length; i++) {
    download(files[i]);
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 300));
  }
  return 'downloaded';
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/awards/exportCards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/exportCards.ts src/awards/exportCards.test.ts
git commit -m "feat(awards): PNG card export with Web Share and download fallback"
```

---

### Task 21: Present-mode step machine

**Files:**
- Create: `src/awards/presentSteps.ts`, `src/awards/presentSteps.test.ts`

**Interfaces:**
- Produces:
  - `type Step = { kind: 'title' | 'suspense' | 'reveal'; index: number } | { kind: 'final' }`
  - `FIRST_STEP: Step`
  - `nextStep(s: Step, count: number): Step`, `prevStep(s: Step, count: number): Step`

- [ ] **Step 1: Write the failing test**

```ts
// src/awards/presentSteps.test.ts
import { describe, expect, it } from 'vitest';
import { FIRST_STEP, nextStep, prevStep, type Step } from './presentSteps';

describe('presentSteps', () => {
  it('walks title → suspense → reveal per award, then final', () => {
    const seq: Step[] = [FIRST_STEP];
    for (let i = 0; i < 6; i++) seq.push(nextStep(seq[seq.length - 1], 2));
    expect(seq).toEqual([
      { kind: 'title', index: 0 }, { kind: 'suspense', index: 0 }, { kind: 'reveal', index: 0 },
      { kind: 'title', index: 1 }, { kind: 'suspense', index: 1 }, { kind: 'reveal', index: 1 },
      { kind: 'final' },
    ]);
    expect(nextStep({ kind: 'final' }, 2)).toEqual({ kind: 'final' });
  });

  it('goes back, stopping at the first step', () => {
    expect(prevStep({ kind: 'final' }, 2)).toEqual({ kind: 'reveal', index: 1 });
    expect(prevStep({ kind: 'title', index: 1 }, 2)).toEqual({ kind: 'reveal', index: 0 });
    expect(prevStep(FIRST_STEP, 2)).toEqual(FIRST_STEP);
  });

  it('zero awards → straight to final', () => {
    expect(nextStep(FIRST_STEP, 0)).toEqual({ kind: 'final' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/presentSteps.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/awards/presentSteps.ts
export type Step = { kind: 'title' | 'suspense' | 'reveal'; index: number } | { kind: 'final' };
export const FIRST_STEP: Step = { kind: 'title', index: 0 };

export function nextStep(s: Step, count: number): Step {
  if (count === 0 || s.kind === 'final') return { kind: 'final' };
  if (s.kind === 'title') return { kind: 'suspense', index: s.index };
  if (s.kind === 'suspense') return { kind: 'reveal', index: s.index };
  return s.index + 1 < count ? { kind: 'title', index: s.index + 1 } : { kind: 'final' };
}

export function prevStep(s: Step, count: number): Step {
  if (s.kind === 'final') return count === 0 ? FIRST_STEP : { kind: 'reveal', index: count - 1 };
  if (s.kind === 'reveal') return { kind: 'suspense', index: s.index };
  if (s.kind === 'suspense') return { kind: 'title', index: s.index };
  return s.index > 0 ? { kind: 'reveal', index: s.index - 1 } : FIRST_STEP;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/awards/presentSteps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/presentSteps.ts src/awards/presentSteps.test.ts
git commit -m "feat(awards): present-mode step machine (title, suspense, reveal, final)"
```

---

### Task 22: `AwardsPrepare` view

**Files:**
- Create: `src/awards/AwardsPrepare.tsx`, `src/awards/AwardsPrepare.test.tsx`, `src/awards/CardThumbnail.tsx`

**Interfaces:**
- Consumes: `ResolvedAward` (Task 15), `Person`, `NameStyle`/`NAME_STYLE_LABELS`, `PRESETS`/`ThemePrefs`, `PhotoCropDialog`, `MAX_CUSTOM_AWARDS`, `CUSTOM_TITLE_MAX`, `CUSTOM_NOTE_MAX`, `CardModel`, `drawAwardCard`.
- Produces:

```ts
export type PrepareAction =
  | { type: 'pick'; key: string; playerId: string | null }   // null = back to stats' choice
  | { type: 'hide'; key: string; hidden: boolean }
  | { type: 'move'; key: string; dir: -1 | 1 }
  | { type: 'addCustom'; title: string; playerId: string; note: string }
  | { type: 'removeCustom'; key: string };

export interface AwardsPrepareProps {
  heading: string;                         // "Season 2026–27" / "vs Rivals · 12 Oct 2026"
  awards: ResolvedAward[];
  people: Person[];                        // picker options, current roster first
  saveState: 'saved' | 'saving' | 'offline' | 'error';
  nameStyle: NameStyle; onNameStyle: (s: NameStyle) => void;
  themePrefs: ThemePrefs; onThemePrefs: (p: ThemePrefs) => void;
  hasBackground: boolean; onBackground: (file: File | null) => void;
  photos: Map<string, HTMLCanvasElement>;  // key = awardKey
  onPhoto: (key: string, img: HTMLCanvasElement | null) => void;
  cardFor: (a: ResolvedAward) => CardModel | null;   // for thumbnails / export
  onAction: (a: PrepareAction) => void;
  onPresent: () => void; onExportAll: () => void; onExportOne: (key: string) => void; onClose: () => void;
}
export function AwardsPrepare(props: AwardsPrepareProps): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
// src/awards/AwardsPrepare.test.tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedAward } from './resolveAwards';
import { AwardsPrepare, type AwardsPrepareProps } from './AwardsPrepare';

const ana = { playerId: 'a', name: 'Ana Lopez', number: 7, current: true };
const bea = { playerId: 'b', name: 'Bea Smit', number: 9, current: true };
const award = (over: Partial<ResolvedAward>): ResolvedAward => ({
  key: 'attacker', title: 'Best attacker', kind: 'stats', winner: ana, statLine: '+40% att. eff. · 40 att.',
  suggested: { playerId: 'a', value: 0.4, display: '+40% att. eff.', attempts: 40, rank: 1 },
  runnersUp: [{ playerId: 'b', value: 0.3, display: '+30% att. eff.', attempts: 33, rank: 2 }],
  overridden: false, hidden: false, note: '', ...over,
});

function setup(over: Partial<AwardsPrepareProps> = {}) {
  const props: AwardsPrepareProps = {
    heading: 'Season 2026–27', awards: [award({}), award({ key: 'mvp', title: 'MVP' })], people: [ana, bea], saveState: 'saved',
    nameStyle: 'firstInitial', onNameStyle: vi.fn(), themePrefs: { presetId: 'navy', custom: null }, onThemePrefs: vi.fn(),
    hasBackground: false, onBackground: vi.fn(), photos: new Map(), onPhoto: vi.fn(), cardFor: () => null,
    onAction: vi.fn(), onPresent: vi.fn(), onExportAll: vi.fn(), onExportOne: vi.fn(), onClose: vi.fn(), ...over,
  };
  render(<AwardsPrepare {...props} />);
  return props;
}

describe('AwardsPrepare', () => {
  it('lists awards with suggested winner and runners-up', () => {
    setup();
    const row = screen.getByRole('region', { name: 'Best attacker' });
    expect(within(row).getByText('+40% att. eff. · 40 att.')).toBeInTheDocument();
    expect(within(row).getByText(/Runners-up: #9 Bea Smit/)).toBeInTheDocument();
  });

  it('picking a winner and hiding dispatch actions', () => {
    const p = setup();
    const row = screen.getByRole('region', { name: 'Best attacker' });
    fireEvent.change(within(row).getByLabelText('Winner'), { target: { value: 'b' } });
    expect(p.onAction).toHaveBeenCalledWith({ type: 'pick', key: 'attacker', playerId: 'b' });
    fireEvent.change(within(row).getByLabelText('Winner'), { target: { value: '' } });
    expect(p.onAction).toHaveBeenCalledWith({ type: 'pick', key: 'attacker', playerId: null });
    fireEvent.click(within(row).getByRole('checkbox', { name: 'Hide' }));
    expect(p.onAction).toHaveBeenCalledWith({ type: 'hide', key: 'attacker', hidden: true });
  });

  it('shows the stats suggestion when overridden', () => {
    setup({ awards: [award({ winner: bea, overridden: true, statLine: null })] });
    expect(screen.getByText('Stats suggest: #7 Ana Lopez')).toBeInTheDocument();
  });

  it('reorders with buttons; first cannot move up', () => {
    const p = setup();
    const first = screen.getByRole('region', { name: 'Best attacker' });
    expect(within(first).getByRole('button', { name: 'Move Best attacker up' })).toBeDisabled();
    fireEvent.click(within(first).getByRole('button', { name: 'Move Best attacker down' }));
    expect(p.onAction).toHaveBeenCalledWith({ type: 'move', key: 'attacker', dir: 1 });
  });

  it('adds a custom award; limit of 5', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Custom award' }));
    fireEvent.change(screen.getByLabelText('Award title'), { target: { value: 'Spirit of the team' } });
    fireEvent.change(screen.getByLabelText('Player'), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add award' }));
    expect(p.onAction).toHaveBeenCalledWith({ type: 'addCustom', title: 'Spirit of the team', playerId: 'b', note: '' });
  });

  it('disables custom award when 5 exist', () => {
    const customs = Array.from({ length: 5 }, (_, i) => award({ key: `c${i}`, kind: 'custom', title: `C${i}` }));
    setup({ awards: customs });
    expect(screen.getByRole('button', { name: '+ Custom award' })).toBeDisabled();
  });

  it('save indicator and present', () => {
    const p = setup({ saveState: 'offline' });
    expect(screen.getByText('Offline — will sync')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Present/ }));
    expect(p.onPresent).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/AwardsPrepare.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/awards/CardThumbnail.tsx
import { useEffect, useRef } from 'react';
import type { CardTheme } from './card/cardTheme';
import { CARD_H, CARD_W, drawAwardCard, type CardArt, type CardModel } from './card/drawAwardCard';

/** Small static preview (t = 1); scaled canvas, no animation. */
export function CardThumbnail({ card, theme, art, width = 108 }: { card: CardModel; theme: CardTheme; art: CardArt; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const s = width / CARD_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawAwardCard(ctx, card, theme, art, 1, true);
  }, [card, theme, art, width]);
  return <canvas ref={ref} width={width} height={Math.round((width * CARD_H) / CARD_W)} className="rounded-sm shadow-card" aria-hidden="true" />;
}
```

```tsx
// src/awards/AwardsPrepare.tsx
import { useState } from 'react';
import { ArrowDown, ArrowUp, Download, ImagePlus, Play, Share2, X } from 'lucide-react';
import { Button } from '../components/Button';
import type { Person } from '../teams/stats/rosterIndex';
import { CUSTOM_NOTE_MAX, CUSTOM_TITLE_MAX, MAX_CUSTOM_AWARDS } from '../types/awards';
import { PRESETS, themeFromPrefs, type ThemePrefs } from './card/cardTheme';
import type { CardModel } from './card/drawAwardCard';
import { CardThumbnail } from './CardThumbnail';
import { NAME_STYLE_LABELS, type NameStyle } from './nameStyle';
import { PhotoCropDialog } from './PhotoCropDialog';
import type { ResolvedAward } from './resolveAwards';

export type PrepareAction =
  | { type: 'pick'; key: string; playerId: string | null }
  | { type: 'hide'; key: string; hidden: boolean }
  | { type: 'move'; key: string; dir: -1 | 1 }
  | { type: 'addCustom'; title: string; playerId: string; note: string }
  | { type: 'removeCustom'; key: string };

export interface AwardsPrepareProps {
  heading: string;
  awards: ResolvedAward[];
  people: Person[];
  saveState: 'saved' | 'saving' | 'offline' | 'error';
  nameStyle: NameStyle; onNameStyle: (s: NameStyle) => void;
  themePrefs: ThemePrefs; onThemePrefs: (p: ThemePrefs) => void;
  hasBackground: boolean; onBackground: (file: File | null) => void;
  photos: Map<string, HTMLCanvasElement>;
  onPhoto: (key: string, img: HTMLCanvasElement | null) => void;
  cardFor: (a: ResolvedAward) => CardModel | null;
  onAction: (a: PrepareAction) => void;
  onPresent: () => void; onExportAll: () => void; onExportOne: (key: string) => void; onClose: () => void;
}

const SAVE_LABEL = { saved: 'Saved', saving: 'Saving…', offline: 'Offline — will sync', error: 'Could not save' } as const;
const label = (p: Person) => `${p.number !== null ? `#${p.number} ` : ''}${p.name}`;

export function AwardsPrepare(props: AwardsPrepareProps) {
  const { awards, people, onAction } = props;
  const [cropFor, setCropFor] = useState<{ key: string; file: File } | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', playerId: '', note: '' });
  const customCount = awards.filter((a) => a.kind === 'custom').length;
  const byId = new Map(people.map((p) => [p.playerId, p]));
  const theme = themeFromPrefs(props.themePrefs);

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold text-ink">Awards</h1>
          <p className="text-slate">{props.heading}</p>
        </div>
        <span role="status" className={`text-sm ${props.saveState === 'error' ? 'text-red' : 'text-slate'}`}>{SAVE_LABEL[props.saveState]}</span>
        <Button variant="secondary" onClick={props.onExportAll}><Share2 size={16} aria-hidden="true" /> Export cards</Button>
        <Button onClick={props.onPresent}><Play size={16} aria-hidden="true" /> Present</Button>
        <Button variant="ghost" onClick={props.onClose} aria-label="Close awards"><X size={16} aria-hidden="true" /></Button>
      </header>

      <section aria-label="Card settings" className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <label className="text-sm text-slate">Theme
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.themePrefs.presetId}
            onChange={(e) => props.onThemePrefs({ ...props.themePrefs, presetId: e.target.value })}>
            {PRESETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate">Custom colours
          <input type="checkbox" className="ml-2" checked={!!props.themePrefs.custom}
            onChange={(e) => props.onThemePrefs({ ...props.themePrefs, custom: e.target.checked ? { from: theme.bgFrom, to: theme.bgTo } : null })} />
        </label>
        {props.themePrefs.custom && (
          <>
            <label className="text-sm text-slate">Top <input type="color" value={props.themePrefs.custom.from}
              onChange={(e) => props.onThemePrefs({ ...props.themePrefs, custom: { ...props.themePrefs.custom!, from: e.target.value } })} /></label>
            <label className="text-sm text-slate">Bottom <input type="color" value={props.themePrefs.custom.to}
              onChange={(e) => props.onThemePrefs({ ...props.themePrefs, custom: { ...props.themePrefs.custom!, to: e.target.value } })} /></label>
          </>
        )}
        <label className="text-sm text-slate">Background image
          <input type="file" accept="image/*" className="ml-2 text-sm" onChange={(e) => props.onBackground(e.target.files?.[0] ?? null)} />
        </label>
        {props.hasBackground && <Button variant="ghost" size="sm" onClick={() => props.onBackground(null)}>Remove background</Button>}
        <label className="text-sm text-slate">Names on cards
          <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={props.nameStyle} onChange={(e) => props.onNameStyle(e.target.value as NameStyle)}>
            {(Object.keys(NAME_STYLE_LABELS) as NameStyle[]).map((s) => <option key={s} value={s}>{NAME_STYLE_LABELS[s]}</option>)}
          </select>
        </label>
        <p className="w-full text-xs text-slate">Photos stay on this device and are forgotten when you leave.</p>
      </section>

      <ol className="space-y-3">
        {awards.map((a, i) => {
          const titleId = `award-${a.key}`;
          const card = props.cardFor(a);
          const photo = props.photos.get(a.key) ?? null;
          return (
            <li key={a.key}>
              <section aria-labelledby={titleId} className={`flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4 shadow-card ${a.hidden ? 'opacity-60' : ''}`}>
                {card && <CardThumbnail card={card} theme={theme} art={{ photo, background: null }} />}
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 id={titleId} className="font-semibold text-ink">{a.title}</h2>
                  {a.kind === 'stats' ? (
                    <label className="block text-sm text-slate">Winner
                      <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={a.overridden ? a.winner?.playerId ?? '' : ''}
                        onChange={(e) => onAction({ type: 'pick', key: a.key, playerId: e.target.value || null })}>
                        <option value="">{a.suggested ? `Stats' choice (${label(byId.get(a.suggested.playerId) ?? a.winner!)})` : "Stats' choice (none)"}</option>
                        {people.map((p) => <option key={p.playerId} value={p.playerId}>{label(p)}</option>)}
                      </select>
                    </label>
                  ) : (
                    <p className="text-sm text-ink">{a.winner ? label(a.winner) : '—'}{a.note && <span className="text-slate"> · {a.note}</span>}</p>
                  )}
                  {a.winner === null && <p className="text-sm text-orange-strong">No winner — pick one or hide</p>}
                  {a.statLine && <p className="text-sm tabular-nums text-slate">{a.statLine}</p>}
                  {a.overridden && a.suggested && <p className="text-sm text-slate">Stats suggest: {label(byId.get(a.suggested.playerId) ?? { playerId: a.suggested.playerId, name: 'Unknown player', number: null, current: false })}</p>}
                  {a.runnersUp.length > 0 && (
                    <p className="text-xs text-slate">Runners-up: {a.runnersUp.map((r) => label(byId.get(r.playerId) ?? { playerId: r.playerId, name: 'Unknown player', number: null, current: false })).join(', ')}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {a.kind === 'stats' && (
                      <label className="inline-flex items-center gap-1 text-sm text-slate">
                        <input type="checkbox" checked={a.hidden} onChange={(e) => onAction({ type: 'hide', key: a.key, hidden: e.target.checked })} /> Hide
                      </label>
                    )}
                    <Button variant="ghost" size="sm" aria-label={`Move ${a.title} up`} disabled={i === 0} onClick={() => onAction({ type: 'move', key: a.key, dir: -1 })}><ArrowUp size={16} aria-hidden="true" /></Button>
                    <Button variant="ghost" size="sm" aria-label={`Move ${a.title} down`} disabled={i === awards.length - 1} onClick={() => onAction({ type: 'move', key: a.key, dir: 1 })}><ArrowDown size={16} aria-hidden="true" /></Button>
                    <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-blue">
                      <ImagePlus size={16} aria-hidden="true" /> {photo ? 'Change photo' : 'Add photo'}
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFor({ key: a.key, file: f }); e.target.value = ''; }} />
                    </label>
                    {photo && <Button variant="ghost" size="sm" onClick={() => props.onPhoto(a.key, null)}>Remove photo</Button>}
                    {card && <Button variant="ghost" size="sm" onClick={() => props.onExportOne(a.key)}><Download size={16} aria-hidden="true" /> PNG</Button>}
                    {a.kind === 'custom' && <Button variant="dangerGhost" size="sm" onClick={() => onAction({ type: 'removeCustom', key: a.key })}>Remove</Button>}
                  </div>
                </div>
              </section>
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        {!adding ? (
          <Button variant="secondary" disabled={customCount >= MAX_CUSTOM_AWARDS} onClick={() => setAdding(true)}>+ Custom award</Button>
        ) : (
          <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.title.trim() || !draft.playerId) return;
              onAction({ type: 'addCustom', title: draft.title.trim(), playerId: draft.playerId, note: draft.note.trim() });
              setDraft({ title: '', playerId: '', note: '' });
              setAdding(false);
            }}>
            <label className="text-sm text-slate">Award title
              <input className="ml-2 rounded-md border border-border px-2 py-1 text-ink" maxLength={CUSTOM_TITLE_MAX} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="text-sm text-slate">Player
              <select className="ml-2 rounded-md border border-border px-2 py-1 text-ink" value={draft.playerId} onChange={(e) => setDraft({ ...draft, playerId: e.target.value })}>
                <option value="">Choose…</option>
                {people.map((p) => <option key={p.playerId} value={p.playerId}>{label(p)}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate">Note
              <input className="ml-2 rounded-md border border-border px-2 py-1 text-ink" maxLength={CUSTOM_NOTE_MAX} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
            <Button type="submit">Add award</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </form>
        )}
      </div>

      <PhotoCropDialog open={!!cropFor} file={cropFor?.file ?? null} onCancel={() => setCropFor(null)}
        onDone={(img) => { if (cropFor) props.onPhoto(cropFor.key, img); setCropFor(null); }} />
    </div>
  );
}
```

Check `Button` supports `variant` values `secondary`, `ghost`, `dangerGhost` and `size="sm"` (MatchPage uses `dangerGhost` + `sm`); map to the nearest existing variants if names differ. jsdom: `CardThumbnail` calls `getContext` which returns `null` in jsdom — guarded.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/awards/AwardsPrepare.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/AwardsPrepare.tsx src/awards/AwardsPrepare.test.tsx src/awards/CardThumbnail.tsx
git commit -m "feat(awards): prepare view — winners, overrides, hide, reorder, custom awards, theme, photos"
```

---

### Task 23: `AwardsPresent` full-screen ceremony

**Files:**
- Create: `src/awards/AwardsPresent.tsx`, `src/awards/AwardsPresent.test.tsx`

**Interfaces:**
- Consumes: `presentSteps` (Task 21), `drawAwardCard`, `drawTitleCard`, `CARD_W`, `CARD_H`, `CardModel`, `CardArt` (Task 18), `CARD_DURATION_MS` (Task 17), `CardTheme`.
- Produces: `AwardsPresent({ cards, theme, artFor, background, onExit }: { cards: { key: string; title: string; model: CardModel }[]; theme: CardTheme; artFor: (key: string) => CardArt; onExit: () => void })`

- [ ] **Step 1: Write the failing test**

```tsx
// src/awards/AwardsPresent.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESETS } from './card/cardTheme';
import type { CardModel } from './card/drawAwardCard';
import { AwardsPresent } from './AwardsPresent';

const model = (key: string, name: string): CardModel => ({ key, awardTitle: key, name, number: 7, statLine: null, footer: '', teamName: 'U17', note: '' });
const cards = [
  { key: 'server', title: 'Best server', model: model('server', 'Ana L.') },
  { key: 'mvp', title: 'MVP', model: model('mvp', 'Bea S.') },
];

describe('AwardsPresent', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('announces the current step for screen readers and advances with keys', () => {
    render(<AwardsPresent cards={cards} theme={PRESETS[0]} artFor={() => ({ photo: null, background: null })} onExit={vi.fn()} />);
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('Best server');
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(live).toHaveTextContent('Best server: Ana L.');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(live).not.toHaveTextContent('Ana L.');
  });

  it('final slide lists all winners; Escape exits', () => {
    const onExit = vi.fn();
    render(<AwardsPresent cards={cards} theme={PRESETS[0]} artFor={() => ({ photo: null, background: null })} onExit={onExit} />);
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Winners' })).toBeInTheDocument();
    expect(screen.getByText('Ana L.')).toBeInTheDocument();
    expect(screen.getByText('Bea S.')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  it('never shows runners-up (only winners are in cards)', () => {
    render(<AwardsPresent cards={cards} theme={PRESETS[0]} artFor={() => ({ photo: null, background: null })} onExit={vi.fn()} />);
    expect(screen.queryByText(/Runners-up/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/AwardsPresent.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/awards/AwardsPresent.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react';
import type { CardTheme } from './card/cardTheme';
import { CARD_DURATION_MS } from './card/cardTimeline';
import { CARD_H, CARD_W, drawAwardCard, drawTitleCard, type CardArt, type CardModel } from './card/drawAwardCard';
import { FIRST_STEP, nextStep, prevStep, type Step } from './presentSteps';

interface PresentCard { key: string; title: string; model: CardModel }

function useReducedMotion(): boolean {
  const [reduced] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return reduced;
}

function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const acquire = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    void acquire();
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

export function AwardsPresent({ cards, theme, artFor, onExit }: { cards: PresentCard[]; theme: CardTheme; artFor: (key: string) => CardArt; onExit: () => void }) {
  const [step, setStep] = useState<Step>(cards.length ? FIRST_STEP : { kind: 'final' });
  const [controlsVisible, setControlsVisible] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stepStart = useRef(performance.now());
  const reduced = useReducedMotion();
  useWakeLock();

  const next = useCallback(() => setStep((s) => nextStep(s, cards.length)), [cards.length]);
  const back = useCallback(() => setStep((s) => prevStep(s, cards.length)), [cards.length]);
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    stepStart.current = performance.now();
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); back(); }
      else if (e.key === 'f' || e.key === 'F') fullscreen();
      else if (e.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, fullscreen, onExit]);

  // Auto-hide controls after 2 s without pointer movement.
  useEffect(() => {
    if (!controlsVisible) return;
    const id = window.setTimeout(() => setControlsVisible(false), 2000);
    return () => window.clearTimeout(id);
  }, [controlsVisible]);

  // One rAF loop; draws to the canvas, never sets React state per frame.
  useEffect(() => {
    if (step.kind === 'final') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const card = cards[step.index];
    const art = artFor(card.key);
    let raf = 0;
    const frame = (now: number) => {
      const elapsed = now - stepStart.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (step.kind === 'reveal') {
        const t = reduced ? 1 : Math.min(1, elapsed / CARD_DURATION_MS);
        drawAwardCard(ctx, card.model, theme, art, t, reduced);
        if (t < 1) raf = requestAnimationFrame(frame);
      } else {
        const pulse = step.kind === 'suspense' && !reduced ? (elapsed % 1600) / 1600 : 0;
        drawTitleCard(ctx, card.title, theme, art, pulse);
        if (step.kind === 'suspense' && !reduced) raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [step, cards, theme, artFor, reduced]);

  const announce =
    step.kind === 'final' ? 'All winners'
    : step.kind === 'reveal' ? `${cards[step.index].title}: ${cards[step.index].model.name}`
    : cards[step.index].title;

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: theme.bgTo }}
      onPointerMove={() => setControlsVisible(true)}>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      {step.kind === 'final' ? (
        <div className="max-h-full w-full max-w-4xl overflow-auto p-8" style={{ color: theme.text }}>
          <h1 className="mb-8 text-center text-5xl font-black" style={{ color: theme.accent }}>Winners</h1>
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {cards.map((c) => (
              <li key={c.key} className="text-center">
                <p className="text-sm uppercase tracking-wide opacity-75">{c.title}</p>
                <p className="text-2xl font-extrabold">{c.model.name}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // Letterboxed 9:16; tap halves = back / next.
        <div className="relative aspect-[9/16] h-full max-w-full">
          <canvas ref={canvasRef} width={CARD_W} height={CARD_H} className="h-full w-full" aria-hidden="true" />
          <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize" onClick={back} />
          <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize" onClick={next} />
        </div>
      )}

      <div className={`absolute right-4 top-4 flex gap-2 transition-opacity ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <button type="button" onClick={back} aria-label="Previous award" className="rounded-full bg-black/40 p-3 text-white"><ChevronLeft size={20} /></button>
        <button type="button" onClick={next} aria-label="Next award" className="rounded-full bg-black/40 p-3 text-white"><ChevronRight size={20} /></button>
        <button type="button" onClick={fullscreen} aria-label="Fullscreen" className="rounded-full bg-black/40 p-3 text-white"><Maximize size={20} /></button>
        <button type="button" onClick={onExit} aria-label="Exit presentation" className="rounded-full bg-black/40 p-3 text-white"><X size={20} /></button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/awards/AwardsPresent.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/AwardsPresent.tsx src/awards/AwardsPresent.test.tsx
git commit -m "feat(awards): full-screen ceremony — title, suspense, animated reveal, winners grid"
```

---

### Task 24: `AwardsPage` — routes, loading, saving, wiring

**Files:**
- Create: `src/awards/AwardsPage.tsx`, `src/awards/AwardsPage.test.tsx`, `src/awards/awardsReducer.ts`, `src/awards/awardsReducer.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: everything in `src/awards/*`; `getTeam`; `getMatch`, `listFinishedMatches`, `loadTeamRoster`; `getSeasonAwards`, `saveSeasonAwards`, `saveMatchAwards`; `latestRosterIndex`, `withCurrentRoster`; `isTeamAdmin`; `NotFoundState`; `useAuth`; `usePageMeta`.
- Produces:
  - `applyPrepareAction(cfg: AwardsInput, a: PrepareAction, ordered: string[], newId: () => string): AwardsInput` (pure)
  - `AwardsPage({ scope }: { scope: AwardScope })` (default export for `lazy`)
  - Routes `/teams/:teamId/awards` and `/teams/:teamId/matches/:matchId/awards`

- [ ] **Step 1: Write the failing reducer test**

```ts
// src/awards/awardsReducer.test.ts
import { describe, expect, it } from 'vitest';
import { EMPTY_AWARDS } from '../types/awards';
import { applyPrepareAction } from './awardsReducer';

const ordered = ['attacker', 'server', 'mvp'];
const id = () => 'c-1';

describe('applyPrepareAction', () => {
  it('pick sets and clears an override, keeping hidden', () => {
    const a = applyPrepareAction(EMPTY_AWARDS, { type: 'pick', key: 'mvp', playerId: 'p' }, ordered, id);
    expect(a.picks.mvp).toEqual({ playerId: 'p', hidden: false });
    const b = applyPrepareAction({ ...a, picks: { mvp: { playerId: 'p', hidden: true } } }, { type: 'pick', key: 'mvp', playerId: null }, ordered, id);
    expect(b.picks.mvp).toEqual({ playerId: null, hidden: true });
  });

  it('removes a pick entry when it returns to defaults', () => {
    const a = applyPrepareAction({ ...EMPTY_AWARDS, picks: { mvp: { playerId: 'p', hidden: false } } }, { type: 'pick', key: 'mvp', playerId: null }, ordered, id);
    expect(a.picks).toEqual({});
  });

  it('hide', () => {
    expect(applyPrepareAction(EMPTY_AWARDS, { type: 'hide', key: 'server', hidden: true }, ordered, id).picks.server).toEqual({ playerId: null, hidden: true });
  });

  it('move writes the full order', () => {
    expect(applyPrepareAction(EMPTY_AWARDS, { type: 'move', key: 'server', dir: -1 }, ordered, id).order).toEqual(['server', 'attacker', 'mvp']);
    expect(applyPrepareAction(EMPTY_AWARDS, { type: 'move', key: 'mvp', dir: 1 }, ordered, id).order).toEqual(ordered);
  });

  it('add / remove custom', () => {
    const a = applyPrepareAction(EMPTY_AWARDS, { type: 'addCustom', title: 'Spirit', playerId: 'p', note: '' }, ordered, id);
    expect(a.custom).toEqual([{ id: 'c-1', title: 'Spirit', playerId: 'p', note: '' }]);
    expect(a.order).toEqual(['attacker', 'server', 'c-1', 'mvp']);
    const b = applyPrepareAction(a, { type: 'removeCustom', key: 'c-1' }, a.order, id);
    expect(b.custom).toEqual([]);
    expect(b.order).toEqual(ordered);
  });

  it('refuses a 6th custom award', () => {
    const custom = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, title: 'x', playerId: 'p', note: '' }));
    const out = applyPrepareAction({ ...EMPTY_AWARDS, custom }, { type: 'addCustom', title: 'y', playerId: 'p', note: '' }, ordered, id);
    expect(out.custom).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/awardsReducer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the reducer**

```ts
// src/awards/awardsReducer.ts
import { MAX_CUSTOM_AWARDS, type AwardId, type AwardPick, type AwardsInput } from '../types/awards';
import type { PrepareAction } from './AwardsPrepare';

function setPick(cfg: AwardsInput, key: string, patch: Partial<AwardPick>): AwardsInput {
  const prev = cfg.picks[key as AwardId] ?? { playerId: null, hidden: false };
  const next = { ...prev, ...patch };
  const picks = { ...cfg.picks };
  if (next.playerId === null && !next.hidden) delete picks[key as AwardId];
  else picks[key as AwardId] = next;
  return { ...cfg, picks };
}

/** `ordered` is the current resolved order (what the coach sees). */
export function applyPrepareAction(cfg: AwardsInput, a: PrepareAction, ordered: string[], newId: () => string): AwardsInput {
  switch (a.type) {
    case 'pick':
      return setPick(cfg, a.key, { playerId: a.playerId });
    case 'hide':
      return setPick(cfg, a.key, { hidden: a.hidden });
    case 'move': {
      const order = [...ordered];
      const i = order.indexOf(a.key);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= order.length) return { ...cfg, order };
      [order[i], order[j]] = [order[j], order[i]];
      return { ...cfg, order };
    }
    case 'addCustom': {
      if (cfg.custom.length >= MAX_CUSTOM_AWARDS) return cfg;
      const id = newId();
      const order = [...ordered];
      const mvpAt = order.indexOf('mvp');
      order.splice(mvpAt < 0 ? order.length : mvpAt, 0, id);
      return { ...cfg, custom: [...cfg.custom, { id, title: a.title, playerId: a.playerId, note: a.note }], order };
    }
    case 'removeCustom':
      return { ...cfg, custom: cfg.custom.filter((c) => c.id !== a.key), order: ordered.filter((k) => k !== a.key) };
  }
}
```

Run: `npx vitest run src/awards/awardsReducer.test.ts` → PASS.

- [ ] **Step 4: Write the failing page test**

```tsx
// src/awards/AwardsPage.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue } from '../test/authValue';
import type { Team } from '../types/team';
import * as teamsApi from '../teams/teamsApi';
import * as matchesApi from '../matches/matchesApi';
import * as awardsApi from './awardsApi';
import { finished, player } from './testMatches';
import AwardsPage from './AwardsPage';

vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../teams/teamsApi');
vi.mock('./awardsApi');
vi.mock('../matches/matchesApi', async (orig) => ({
  ...(await orig<typeof import('../matches/matchesApi')>()),
  getMatch: vi.fn(), listFinishedMatches: vi.fn(), loadTeamRoster: vi.fn(),
}));
const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const team = { id: 't1', name: 'U17 Girls', season: '2026-27', adminEmails: ['user@example.com'] } as unknown as Team;
const m = finished('m1', '2026-10-12', [player('a', { A: '########' })]);

function renderAt(path: string, scope: 'season' | 'match') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/teams/:teamId/awards" element={<AwardsPage scope={scope} />} />
        <Route path="/teams/:teamId/matches/:matchId/awards" element={<AwardsPage scope={scope} />} />
        <Route path="/teams/:teamId" element={<p>team page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AwardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(authValue());
    vi.mocked(teamsApi.getTeam).mockResolvedValue(team);
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([m]);
    vi.mocked(matchesApi.getMatch).mockResolvedValue(m);
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue([]);
    vi.mocked(awardsApi.getSeasonAwards).mockResolvedValue(null);
    vi.mocked(awardsApi.saveSeasonAwards).mockResolvedValue();
    vi.mocked(awardsApi.saveMatchAwards).mockResolvedValue();
  });

  it('season: loads, shows awards, saves an override (debounced)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/teams/t1/awards', 'season');
    const row = await screen.findByRole('region', { name: 'Best attacker' });
    fireEvent.change(row.querySelector('select')!, { target: { value: 'a' } });
    await vi.advanceTimersByTimeAsync(900);
    expect(awardsApi.saveSeasonAwards).toHaveBeenCalledWith('t1', expect.objectContaining({ picks: { attacker: { playerId: 'a', hidden: false } } }), 'u-1');
    vi.useRealTimers();
  });

  it('match: unfinished match shows a message', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...m, status: 'live' });
    renderAt('/teams/t1/matches/m1/awards', 'match');
    expect(await screen.findByText('Awards are available once the match is finished.')).toBeInTheDocument();
  });

  it('non-admins get not-found', async () => {
    vi.mocked(teamsApi.getTeam).mockResolvedValue({ ...team, adminEmails: ['other@x.be'] });
    renderAt('/teams/t1/awards', 'season');
    expect(await screen.findByRole('heading', { name: 'Awards not found' })).toBeInTheDocument();
  });

  it('Present switches to the ceremony and Escape returns', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    renderAt('/teams/t1/awards', 'season');
    await screen.findByRole('region', { name: 'Best attacker' });
    fireEvent.click(screen.getByRole('button', { name: /Present/ }));
    expect(screen.getByRole('button', { name: 'Exit presentation' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByRole('region', { name: 'Best attacker' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 5: Run to verify failure**

Run: `npx vitest run src/awards/AwardsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 6: Implement the page**

```tsx
// src/awards/AwardsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotFoundState } from '../components/NotFoundState';
import { usePageMeta } from '../layout/usePageMeta';
import { getMatch, listFinishedMatches, loadTeamRoster } from '../matches/matchesApi';
import { latestRosterIndex, withCurrentRoster, type Person } from '../teams/stats/rosterIndex';
import { isTeamAdmin } from '../teams/teamAccess';
import { getTeam } from '../teams/teamsApi';
import { EMPTY_AWARDS, type AwardScope, type AwardsInput } from '../types/awards';
import type { Match } from '../types/match';
import type { Team } from '../types/team';
import { AwardsPrepare } from './AwardsPrepare';
import { AwardsPresent } from './AwardsPresent';
import { getSeasonAwards, saveMatchAwards, saveSeasonAwards } from './awardsApi';
import { applyPrepareAction } from './awardsReducer';
import { readThemePrefs, themeFromPrefs, writeThemePrefs, type ThemePrefs } from './card/cardTheme';
import type { CardModel } from './card/drawAwardCard';
import { cardFileName, renderCardPng, shareOrDownload } from './exportCards';
import { readNameStyle, styleName, writeNameStyle, type NameStyle } from './nameStyle';
import { loadImageFile, renderCrop } from './photo';
import { resolveAwards, revealable, type ResolvedAward } from './resolveAwards';

type Load =
  | { state: 'loading' }
  | { state: 'notFound' }
  | { state: 'notFinished' }
  | { state: 'error' }
  | { state: 'ready'; team: Team; matches: Match[]; match: Match | null; people: Map<string, Person> };

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function AwardsPage({ scope }: { scope: AwardScope }) {
  const { teamId = '', matchId = '' } = useParams();
  const { firebaseUser, access } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [config, setConfig] = useState<AwardsInput>(EMPTY_AWARDS);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'error'>('saved');
  const [mode, setMode] = useState<'prepare' | 'present'>('prepare');
  const [nameStyle, setNameStyle] = useState<NameStyle>(readNameStyle);
  const [themePrefs, setThemePrefs] = useState<ThemePrefs>(readThemePrefs);
  const [photos, setPhotos] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [background, setBackground] = useState<HTMLCanvasElement | null>(null);
  const dirty = useRef(false);
  usePageMeta({ title: scope === 'season' ? 'Season awards' : 'Match awards' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const team = await getTeam(teamId);
        if (!team || !isTeamAdmin(team, firebaseUser?.email, access)) return !cancelled && setLoad({ state: 'notFound' });
        const [roster, matches, match, saved] = await Promise.all([
          loadTeamRoster(teamId).catch(() => []),
          scope === 'season' ? listFinishedMatches(teamId) : Promise.resolve([] as Match[]),
          scope === 'match' ? getMatch(teamId, matchId) : Promise.resolve(null),
          scope === 'season' ? getSeasonAwards(teamId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (scope === 'match' && !match) return setLoad({ state: 'notFound' });
        if (scope === 'match' && match!.status !== 'finished') return setLoad({ state: 'notFinished' });
        const all = scope === 'match' ? [match!] : matches;
        setConfig((scope === 'match' ? match!.awards : saved) ?? EMPTY_AWARDS);
        setLoad({ state: 'ready', team, matches: all, match, people: withCurrentRoster(latestRosterIndex(all), roster) });
      } catch {
        if (!cancelled) setLoad({ state: 'notFound' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, matchId, scope, firebaseUser?.email, access]);

  // Debounced save, not awaited for UI (offline-safe persistent cache).
  useEffect(() => {
    if (!dirty.current || load.state !== 'ready') return;
    setSaveState(navigator.onLine === false ? 'offline' : 'saving');
    const id = window.setTimeout(() => {
      const uid = firebaseUser?.uid ?? '';
      const write = scope === 'season' ? saveSeasonAwards(teamId, config, uid) : saveMatchAwards(teamId, matchId, config, uid);
      write.then(() => setSaveState('saved')).catch(() => setSaveState('error'));
    }, 800);
    return () => window.clearTimeout(id);
  }, [config, load.state, scope, teamId, matchId, firebaseUser?.uid]);

  // Release in-memory images on leave.
  useEffect(() => () => { photos.forEach((c) => { c.width = 0; }); }, [photos]);

  const ready = load.state === 'ready' ? load : null;
  const awards: ResolvedAward[] = useMemo(
    () => (ready ? resolveAwards(scope, ready.matches, config, ready.people) : []),
    [ready, scope, config],
  );
  const theme = themeFromPrefs(themePrefs);
  const heading = ready ? (scope === 'season' ? `Season ${ready.team.season}` : `vs ${ready.match!.opponent} · ${fmtDate(ready.match!.date)}`) : '';
  const footer = heading;

  const cardFor = useCallback((a: ResolvedAward): CardModel | null => {
    if (!ready || !a.winner) return null;
    return {
      key: a.key, awardTitle: a.title, name: styleName(a.winner, nameStyle), number: a.winner.number,
      statLine: a.statLine, footer, teamName: ready.team.name, note: a.note,
    };
  }, [ready, nameStyle, footer]);

  const artFor = useCallback((key: string) => ({ photo: photos.get(key) ?? null, background }), [photos, background]);

  async function exportKeys(keys: string[]) {
    if (!ready) return;
    const files: File[] = [];
    for (const a of awards.filter((x) => keys.includes(x.key))) {
      const card = cardFor(a);
      if (!card) continue;
      const blob = await renderCardPng(card, theme, artFor(a.key));
      const name = cardFileName(a.key, scope === 'match' ? { kind: 'match', date: ready.match!.date, opponent: ready.match!.opponent } : { kind: 'season', season: ready.team.season });
      files.push(new File([blob], name, { type: 'image/png' }));
    }
    if (files.length) await shareOrDownload(files, heading);
  }

  if (load.state === 'loading') return <p className="p-6 text-slate">Loading awards…</p>;
  if (load.state === 'notFound') return <NotFoundState title="Awards not found" message="The team or match may not exist, or you don't have access." backTo={`/teams/${teamId}`} backLabel="Back to team" />;
  if (load.state === 'notFinished') return <NotFoundState title="Match awards" message="Awards are available once the match is finished." backTo={`/teams/${teamId}/matches/${matchId}`} backLabel="Back to match" />;
  if (!ready) return null;

  if (mode === 'present') {
    const cards = revealable(awards).map((a) => ({ key: a.key, title: a.title, model: cardFor(a)! }));
    return <AwardsPresent cards={cards} theme={theme} artFor={artFor} onExit={() => setMode('prepare')} />;
  }

  return (
    <AwardsPrepare
      heading={heading}
      awards={awards}
      people={[...ready.people.values()].sort((a, b) => Number(b.current) - Number(a.current) || (a.number ?? 999) - (b.number ?? 999))}
      saveState={saveState}
      nameStyle={nameStyle}
      onNameStyle={(s) => { setNameStyle(s); writeNameStyle(s); }}
      themePrefs={themePrefs}
      onThemePrefs={(p) => { setThemePrefs(p); writeThemePrefs(p); }}
      hasBackground={!!background}
      onBackground={(file) => {
        if (!file) return setBackground(null);
        void loadImageFile(file).then((bmp) => {
          const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
          const c = renderCrop(bmp, { cx: 0.5, cy: 0.5, zoom: 1 }, Math.round(Math.min(bmp.width, bmp.height) * scale));
          bmp.close();
          setBackground(c);
        }).catch(() => undefined);
      }}
      photos={photos}
      onPhoto={(key, img) => setPhotos((prev) => { const next = new Map(prev); if (img) next.set(key, img); else next.delete(key); return next; })}
      cardFor={cardFor}
      onAction={(a) => {
        dirty.current = true;
        setConfig((c) => applyPrepareAction(c, a, awards.map((x) => x.key), () => `c-${Date.now().toString(36)}`));
      }}
      onPresent={() => setMode('present')}
      onExportAll={() => void exportKeys(revealable(awards).map((a) => a.key))}
      onExportOne={(key) => void exportKeys([key])}
      onClose={() => navigate(scope === 'season' ? `/teams/${teamId}?tab=stats` : `/teams/${teamId}/matches/${matchId}`)}
    />
  );
}
```

Background note: `renderCrop` produces a square; for a portrait card a square background still cover-fits (drawBackground scales to cover). Acceptable; a non-square background path is not required by the spec.

`src/App.tsx` — outside `AppShell`, next to the scout route:

```tsx
const AwardsPage = lazy(() => import('./awards/AwardsPage'));
// …
<Route path="/teams/:teamId/awards" element={<RequireAuth><Suspense fallback={<div className="p-6 text-slate">Loading awards…</div>}><AwardsPage scope="season" /></Suspense></RequireAuth>} />
<Route path="/teams/:teamId/matches/:matchId/awards" element={<RequireAuth><Suspense fallback={<div className="p-6 text-slate">Loading awards…</div>}><AwardsPage scope="match" /></Suspense></RequireAuth>} />
```

These two must be declared **before** the authenticated layout's `*` catch-all is reached — React Router ranks by specificity, so placement doesn't matter, but keep them next to the scout route for readability.

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/awards src/App.test.tsx`
Expected: PASS. If the "Present" test's `getByRole('status', …)` is ambiguous with the prepare save indicator (also `role="status"`), the prepare view is unmounted in present mode so only one exists — keep `getByRole('status')`.

- [ ] **Step 8: Commit**

```bash
git add src/awards src/App.tsx
git commit -m "feat(awards): awards page — load, debounced offline-safe saves, prepare/present, export"
```

---

### Task 25: Entry points — match page button, home MVP line, privacy sentence

**Files:**
- Modify: `src/matches/MatchPage.tsx`, `src/matches/MatchPage.test.tsx`, `src/home/HomePage.tsx`, `src/home/HomePage.test.tsx`, `src/legal/PrivacyPage.tsx`
- Create: `src/awards/matchMvp.ts`, `src/awards/matchMvp.test.ts`

**Interfaces:**
- Produces: `matchMvpLabel(match: Match): string | null` — saved MVP override (unless hidden) else `rankAward('mvp','match',[match]).ranked[0]`, formatted `#7 L. Name`-style via `styleName(person, 'firstInitial')` with number prefix; `null` when none or hidden.

- [ ] **Step 1: Write the failing tests**

```ts
// src/awards/matchMvp.test.ts
import { describe, expect, it } from 'vitest';
import { matchMvpLabel } from './matchMvp';
import { finished, player } from './testMatches';

describe('matchMvpLabel', () => {
  const m = finished('m1', '2026-10-12', [player('a', { A: '###' }), player('b', { A: '#' })]);

  it('computed from the summary', () => {
    expect(matchMvpLabel(m)).toBe('#1 Player a.');
  });

  it('saved override wins; hidden → null', () => {
    const withPick = { ...m, awards: { picks: { mvp: { playerId: 'b', hidden: false } }, custom: [], order: [], updatedBy: '', updatedAt: null } };
    expect(matchMvpLabel(withPick)).toBe('#2 Player b.');
    const hidden = { ...m, awards: { picks: { mvp: { playerId: null, hidden: true } }, custom: [], order: [], updatedBy: '', updatedAt: null } };
    expect(matchMvpLabel(hidden)).toBeNull();
  });

  it('null when nothing is scouted', () => {
    expect(matchMvpLabel(finished('x', '2026-10-01', null))).toBeNull();
  });
});
```

(Fixture names are "Player a"/"Player b" with numbers 1/2 from `finished()`; `styleName(…, 'firstInitial')` gives "Player a.".)

Append to `MatchPage.test.tsx`:

```tsx
it('finished match links to match awards', async () => {
  vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...match, status: 'finished' });
  renderPage();
  expect(await screen.findByRole('link', { name: /Match awards/ })).toHaveAttribute('href', '/teams/t1/matches/m1/awards');
});
```

Append to `HomePage.test.tsx`:

```tsx
it('recent results show the MVP', async () => {
  vi.mocked(matchesApi.listMatchesInRange).mockResolvedValue([finished('m9', '2026-10-12', [player('a', { A: '###' })])]);
  renderHome();
  expect(await screen.findByText('MVP: #1 Player a.')).toBeInTheDocument();
});
```

(import `finished`, `player` from `'../awards/testMatches'`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/awards/matchMvp.test.ts src/matches/MatchPage.test.tsx src/home/HomePage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/awards/matchMvp.ts
import { latestRosterIndex, UNKNOWN_PERSON } from '../teams/stats/rosterIndex';
import type { Match } from '../types/match';
import { rankAward } from './awardRules';
import { styleName } from './nameStyle';

export function matchMvpLabel(match: Match): string | null {
  const pick = match.awards?.picks.mvp;
  if (pick?.hidden) return null;
  const id = pick?.playerId ?? rankAward('mvp', 'match', [match]).ranked[0]?.playerId ?? null;
  if (!id) return null;
  const p = latestRosterIndex([match]).get(id) ?? UNKNOWN_PERSON(id);
  return `${p.number !== null ? `#${p.number} ` : ''}${styleName(p, 'firstInitial')}`;
}
```

`HomePage.tsx`: `<RecentResultsBlock items={…} failed={…} mvpFor={(fm) => matchMvpLabel(fm.match)} />`.

`MatchPage.tsx`: in the finished-report header actions (next to the Export `Menu`, inside the `print:hidden` block):

```tsx
<Link to={`/teams/${teamId}/matches/${matchId}/awards`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-orange px-4 font-medium text-white hover:bg-orange-strong">
  <Trophy size={16} aria-hidden="true" /> Match awards
</Link>
```

(rendered only when `match.status === 'finished'`; import `Trophy` from lucide-react, `Link` already imported).

`PrivacyPage.tsx`: in the section describing data processing, add the sentence: "Photos added to award cards are processed only in your browser to create the image; they are never uploaded or stored by Volley Skills."

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/awards/matchMvp.ts src/awards/matchMvp.test.ts src/matches/MatchPage.tsx src/matches/MatchPage.test.tsx src/home src/legal/PrivacyPage.tsx
git commit -m "feat(awards): match awards entry point, MVP on home results, privacy note on card photos"
```

---

### Task 26: Final verification + docs

**Files:**
- Modify: `CLAUDE.md` (routes + awards mention), `docs/PRODUCTION-READINESS.md` (set `VITE_SITE_URL` in prod env; verify robots/sitemap after first deploy)

- [ ] **Step 1: Update docs**

`CLAUDE.md` → "Auth & routing": add `/` (home dashboard), the `*` 404, and the two lazy full-screen awards routes (`/teams/:teamId/awards`, `/teams/:teamId/matches/:matchId/awards`, outside `AppShell`, team-admin only). "Firestore model shape": add `teams/{teamId}/awards/season` and `matches/{id}.awards`. Add the spec to the docs table.

`docs/PRODUCTION-READINESS.md` → pre-prod: "Set `VITE_SITE_URL` for the production build (canonical, robots.txt, sitemap.xml)"; post-deploy: "Check `/robots.txt`, `/sitemap.xml` and an `X-Robots-Tag` header on `/teams` with `curl -I`".

- [ ] **Step 2: Run everything**

```bash
npm run lint
npm test
npm run test:rules
npm run build
```

Expected: lint clean; all unit/component tests PASS; rules suite PASS; build succeeds with `dist/robots.txt`, `dist/sitemap.xml`, `dist/manifest.webmanifest`. Fix anything that fails before continuing.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/PRODUCTION-READINESS.md
git commit -m "docs: home, 404/SEO, stats and awards in CLAUDE.md and production checklist"
```
