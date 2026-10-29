# UI Redesign 4g: Sign-in, Club Gate, Legal and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the parts of area 01 that plan 2 did not touch: the public sign-in frame and its pages, the email-link and status screens, the ClubGate screens, the legal pages and review flow, the banners, Settings with its AI subpage, and the 404 and no-access states. They move to the v2 system and match the approved sign-in mockup. Every inventory-01 invariant holds, and no legal text changes.

**Architecture:**
- **Two new primitives.**
  - `StatusLayout` (icon tile, h1 title, body, actions) is used by every status screen, in and out of the app.
  - `BrandMark` (mark plus "Volley Skills" wordmark) is the only brand element on these screens. The cleanup increment switches to the new logo by changing `BrandMark` alone (brand README §8).
- **`AuthShell` keeps its props** (`title`, `navAction`, `children`) and gains `legalLinks`.
  - **Desktop (≥ 1100 px):** two panes. On the left, the `bg` stage holds the brand, the `AuthCourt` stage court, a glow, the tagline and the pitch. On the right, a `bg-sidebar` pane (white, or `#0D0D0F` in dark) holds the language switch and nav pill, a centred 340 px column and the legal links.
  - **Phone:** one column. A top row with the brand and the pill, then the `AuthCourt` strip (form pages only), then the column and the legal links.
  - **Status pages** pass no `title` and render a `StatusLayout` as children.
- **In-app states.** `NotFoundPage`, `NotFoundState` and the section/club-admin denial render `StatusLayout` in the page, never the public frame. Only the platform denial, which sits outside AppShell, keeps `AuthShell`.
- **Settings.** It becomes grouped lists:
  - Appearance: Theme, a `SegmentedControl` System · Light · Dark on `useThemePreference`;
  - Language: a row that opens a picker `Sheet`;
  - AI provider: a row that opens the AI subpage at `/settings?view=ai` (same route, so no SEO or hosting change).

**Precondition:** none. `MinimalShell` is restyled by plan 4f. If 4f has not landed, this plan still doesn't touch `MinimalShell`, and `LegalReviewScreen` and `SignupPage` restyle only their own content.

**Not in this plan:**
- The new logo, favicon and OG image (cleanup).
- AppShell, sidebar, toolbar, tab bar, `MorePage` and ⌘K (plan 2).
- `MinimalShell` and the platform shell (4f).
- Legal content files and `published.test.ts` hashes. Nothing under `src/legal/content/` changes.
- Mockup items the spec text doesn't agree to:
  - the mockup's pitch sentence (today's `auth.shell.pitch` stays);
  - the "We'll email you a link…" subtitle under "Welcome back";
  - an "EN ▾" dropdown (`LanguageToggle` keeps its EN/IT pressed buttons);
  - the "Check your inbox" motion.
- Inventory-01 pain points that §4 never agreed:
  - no resend or "use a different email" on Check your email;
  - no button on FinishSignIn errors;
  - no step indicator on the legal review;
  - no redirect for a signed-in visitor to `/login`;
  - no "Go home" on the no-access state.

**Tech Stack:** React 18, TypeScript strict (noUnusedLocals/Parameters), React Router v7, Tailwind 3.4 with CSS-variable tokens (no `dark:`; arbitrary breakpoint `min-[1100px]:`), Vitest + Testing Library (jsdom), lucide-react.

**Spec:**
- `docs/superpowers/specs/2026-10-28-ui-redesign-design.md`: §8.1, §5 (theme System option), §6.3 (sheets), §6.7, §4.6 (theme key stays `theme`; signed-out unknown URLs keep redirecting), §10, §11.
- Parity contract: `docs/superpowers/specs/ui-redesign-inventory/01-shell-auth-settings.md` §6, §8–10, §12–13, §17–37, §55, invariants 6–14, 21, 23–44, 50, 52, 55–56, plus the README's cross-cutting rules.
- Visual target:
  - `docs/design/design-system/mockups/volley-skills-v2.html`: "Sign in" CSS at lines 213–255, markup at 500–608;
  - `volley-skills-v2-light.png` and `-dark.png` ("Sign in");
  - `screens-set.html` screen 9 (phone direction only; v2.html wins where they differ).
- Design rules: `docs/design/design-system/README.md` (grouped list, status layout, 720 px forms and long text).

## Global Constraints

**Parity**
- Every inventory-01 invariant listed above holds. Existing tests change only selectors or setup. An assertion changes only where a task maps it to §5 or §8.1.
- **Legal texts.** They are rendered from the same strings through `LegalMarkdown`/`legalText`/`specificClauses`. Clause `h2` ids (`t12`, `d5`) stay. `published.test.ts`, `content.test.ts`, `acceptance.test.ts` and `legalDocs.test.ts` pass untouched. Restyling changes class names only, never text nodes or their order.
- **Auth flows untouched.**
  - Same providers (email link, Google popup), same `sendSignInLinkToEmail` options, and `auth.languageCode` set before sending.
  - Same `emailForSignIn`, `vcb.auth.returnTo` and `vcb.signDraft` handling, nonce rules and redirects.
  - No edits to `AuthContext.tsx`, `returnTo.ts`, `emailLinkStorage.ts`, `reauth.ts`, `signDraft.ts`, `signingApi.ts` or `clubView.ts`.
- **SEO unchanged.** Every `usePageMeta` call keeps its arguments. No change to `seoRoutes.ts`, `robots.txt`, the sitemap or `firebase.json`.
- Storage keys frozen: `theme` (System = key absent, via `setThemePreference`), `vcb.locale`, `vcb.legalNoticeDismissed.*`, `vcb.ai.*`. Every access tolerates blocked storage.

**Visual**
- Colour only from tokens. Retire `navy`, `slate`, `border-border`, `bg-blue/…`, `text-blue-strong`, `bg-orange/…`, `text-white`, `bg-bg` (use `bg-surface-2`), `ring-blue`, `border-blue` and `uppercase` in every file this plan touches.
- Links and selection are ink. Blue appears nowhere in these screens. Orange marks only the contract-ending and ended-instead warnings. Red marks only errors and destructive actions.
- The court is inline SVG only (no `<img>`, no raster). It is `aria-hidden="true"` and coloured by `text-ink-3`, `stroke-ink` and `fill-ink`, so it follows the theme. The old `player-spike.webp` and `ball-mikasa.webp` are deleted.
- Type roles:
  - form and status titles `text-title-1` (phone form title `text-large-title`);
  - tagline `text-display`;
  - body `text-body`;
  - labels `text-footnote font-medium text-ink-2`;
  - legal links `text-caption text-ink-3`;
  - long legal text `text-base leading-[1.625rem]` (16/26) in a `max-w-[720px]` column.

  Sentence case; `tabular-nums` on dates and versions.
- Touch targets at least 44 px (`min-h-11`), with full-width form buttons at `min-h-12`. Grouped rows are at least 52 px (`ListRow`). Fields stay ≥ 16 px on phones (`formFieldSize.test.ts`).

**Data, strings, gates**
- No new reads or writes, no rules change, no index change. `npm run test:rules` is not needed.
- Every new string goes in `src/i18n/en/*.ts` and `src/i18n/it/*.ts` (`satisfies Catalog[...]`). The app ships en and it; legal texts keep their own five languages.
- Never commit `serviceAccountKey.json` (or `.enc`), `*.vsbackup`, private keys, `.env.local` or `reference/`. Commit only as the steps say. Don't push or merge, and add no dependency.
- Gates per group: `npm test`, `npm run lint` (0 errors), `npm run build`.

## Review Focus

1. **A long, unbreakable email address** in "Check your email" (for example `a.very.long.coach.name@some-really-long-club-domain.example`). It wraps inside the 340 px column and the phone width, with no horizontal scroll.
   - Pinned in Task 3 by "a long email wraps inside the status layout".
2. **Specific-approval ticks after a language change.** The coach goes Back from step 3, switches the legal language and returns. The clause texts are new, so every tick is cleared and Approve is disabled again.
   - Pinned in Task 8 by "ticks reset when the legal language changes".
3. **A pasted `/settings?view=ai`** in a club with AI off, or after AI was turned off. It shows the root Settings with no AI group and no error.
   - Pinned in Task 9 by "view=ai with AI off shows the root settings".
4. **Blocked storage (private mode) on Settings.** The Theme control shows System, and choosing Dark still paints dark for the session.
   - Pinned in Task 9 by "with storage blocked it shows System and Dark still paints".
5. **An in-app no-access page reached by a route change.** Focus moves to a real heading, and the alert is still announced.
   - Pinned in Task 4 by "a denied section page shows the no-access status with a heading".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/StatusLayout.tsx` (create) | Icon tile, h1, body, actions, optional role |
| `src/components/Logo.tsx` (modify) | Adds `BrandMark`; `Logo` stays for `MinimalShell` until 4f/cleanup |
| `src/auth/AuthCourt.tsx` (create) | Decorative perspective court (stage, strip) |
| `src/auth/AuthShell.tsx` (modify) | Two-pane / one-column public frame |
| `src/i18n/LanguageToggle.tsx`, `src/legal/LegalLinks.tsx` (modify) | Token restyle |
| `src/auth/LoginPage.tsx`, `src/auth/FinishSignInPage.tsx` (modify) | Form and status states |
| `src/auth/NoAccess.tsx` (create), `src/auth/{RequireAuth,RequireSection,RequireClubAdmin,RequirePlatformAdmin}.tsx`, `src/layout/NotFoundPage.tsx`, `src/components/NotFoundState.tsx` (modify) | Loading, error, denial and not-found states |
| `src/interest/RequestAccessPage.tsx`, `src/signup/{SignupInfoPage,SignCompletePage,SignupPage}.tsx` (modify) | Public forms and signing status |
| `src/clubs/{ClubStatusScreen,WelcomePage,ClubGate,ContractEndingBanner}.tsx`, `src/legal/LegalNoticeBanner.tsx` (modify) | Gate screens and strips |
| `src/legal/{LegalDocPage,LegalMarkdown,LegalLangSwitcher}.tsx` (modify) | Legal page frame and reading column |
| `src/legal/LegalReviewScreen.tsx`, `src/signup/{DocumentsStep,SpecificApprovalStep}.tsx` (modify) | Review flow, grouped clause box with checkboxes |
| `src/settings/{SettingsPage,LanguageSettings,AiProviderSettings}.tsx` (modify), `src/settings/SettingsSection.tsx` (delete), `src/index.css` (modify) | Grouped Settings, picker sheet, AI subpage, §6.7 canvas ease |
| `src/i18n/{en,it}/{auth,settings,signup}.ts` (modify) | Strings |

---

### Task 1: `StatusLayout` and `BrandMark`

**Files:**
- Create: `src/components/StatusLayout.tsx`, `src/components/StatusLayout.test.tsx`, `src/components/Logo.test.tsx`
- Modify: `src/components/Logo.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function StatusLayout(props: {
    icon?: LucideIcon; illustration?: ReactNode; // illustration replaces the icon tile
    title?: ReactNode; children?: ReactNode;      // children = body
    actions?: ReactNode; role?: 'alert' | 'status'; tone?: 'neutral' | 'error'; className?: string;
  }): JSX.Element;
  export function BrandMark({ className }: { className?: string }): JSX.Element;
  ```
- **`StatusLayout` markup** (mockup "Check your email"):
  - root `div`, carrying `role` when given: `mx-auto flex w-full max-w-[400px] flex-col items-center gap-4 text-center`;
  - tile: `grid h-14 w-14 place-items-center rounded-[16px] bg-surface-2`, the icon at 26 px, `strokeWidth 1.75`, `aria-hidden`, coloured `text-ink`, or `text-red-strong` when `tone="error"`;
  - title: `<h1 tabIndex={-1} className="text-title-1 text-ink">`, only when given;
  - body: `div text-body text-ink-2 [overflow-wrap:anywhere]`;
  - actions: `div mt-2 flex w-full flex-col gap-2`.
- **`BrandMark`:** `span inline-flex items-center gap-2.5`, containing:
  - `<img src={appIcon} alt="" className="h-7 w-7">` from `src/assets/brand/volley-skills-app-icon.svg`. Its fixed navy tile reads in both themes; brand artwork is not tokenised;
  - `<span className="text-headline text-ink">Volley Skills</span>` (brand name, not translated, like today's `alt`).

  The doc comment says that the cleanup swaps the image for the new mono mark here, and nowhere else.

- [ ] **Step 1: Failing tests.**
  - `StatusLayout.test.tsx`:
    - `it('renders the icon tile, a focusable h1 title, the body and the actions')`: the h1 has `tabindex="-1"`; the tile's svg is `aria-hidden="true"`; the actions are inside the root.
    - `it('omits the tile and the heading when not given')`: no `h1`, no svg.
    - `it('puts the role on the root so a heading inside an alert is announced')`: `getByRole('alert')` contains `getByRole('heading')`.
    - `it('colours the icon red for errors')`: the tile has `text-red-strong`.
  - `Logo.test.tsx`: `it('BrandMark shows the wordmark and a decorative mark')`: the text "Volley Skills" is present, and the img has `alt=""`.
- [ ] **Step 2:** Run `npx vitest run src/components/StatusLayout.test.tsx src/components/Logo.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): status layout and brand mark primitives`

### Task 2: `AuthCourt` and the v2 `AuthShell`

**Files:**
- Create: `src/auth/AuthCourt.tsx`, `src/auth/AuthShell.test.tsx`
- Modify: `src/auth/AuthShell.tsx`, `src/i18n/LanguageToggle.tsx`, `src/legal/LegalLinks.tsx`
- Delete: `src/assets/player-spike.webp`, `src/assets/ball-mikasa.webp`

**Interfaces:**
- Consumes `BrandMark` (Task 1).
- Produces:
  - `AuthCourt({ variant }: { variant: 'stage' | 'strip' })`;
  - `AuthShell({ title?: string; navAction?: { to: string; label: string }; legalLinks?: boolean; children: ReactNode })`.

  Callers keep their props; `legalLinks` replaces each page's own `<LegalLinks />` child (Tasks 3, 5).
- **`AuthCourt`:** one `<svg viewBox="0 0 180 360" aria-hidden="true" focusable="false" data-testid={variant === 'stage' ? 'auth-court' : 'auth-court-strip'} className="h-full w-full overflow-visible text-ink-3">`.
  - Its children are the `<symbol id="court">` children from `volley-skills-v2.html` lines 503–517, verbatim, with two replacements: `style="stroke:var(--ink)"` becomes `className="stroke-ink"`, and `style="fill:var(--ink)"` becomes `className="fill-ink"`. That gives:
    - the court outline;
    - the attack lines at 120 and 240;
    - the net at 180 with its posts;
    - zone numbers 4 3 2 / 5 6 1;
    - the dashed serve path `M150 384 Q 70 230 46 74` with the ball and its shadow.
  - `stage`: wrapped in `div pointer-events-none absolute left-1/2 top-[46%] -ml-[150px] -mt-[300px] h-[600px] w-[300px] opacity-90 [transform:perspective(1100px)_rotateX(58deg)_rotateZ(-24deg)]`.
  - `strip`: wrapped in `div pointer-events-none relative -mx-5 h-[150px] overflow-hidden` with an inner `absolute left-1/2 -top-10 -ml-[75px] h-[300px] w-[150px] [transform:perspective(700px)_rotateX(60deg)_rotateZ(-24deg)]`, plus a fade `absolute inset-x-0 bottom-0 h-[60px] bg-gradient-to-b from-transparent to-bg`.
- **`AuthShell` layout:**
  - root `min-h-dvh bg-bg text-ink min-[1100px]:grid min-[1100px]:grid-cols-[1.15fr_1fr]`;
  - **stage** `section`: `relative hidden overflow-hidden px-8 pb-8 pt-7 min-[1100px]:sticky min-[1100px]:top-0 min-[1100px]:flex min-[1100px]:h-dvh min-[1100px]:flex-col min-[1100px]:justify-between`. It holds:
    - the glow `div aria-hidden` (`absolute left-1/2 top-[40%] -ml-[260px] -mt-[260px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(var(--color-ink)/0.07),transparent)]`);
    - `<AuthCourt variant="stage"/>`;
    - `<BrandMark className="relative"/>`;
    - the claim `div relative flex max-w-[420px] flex-col gap-2.5`: `<p className="text-display text-ink">{tagline1}<br/><span className="text-ink-3">{tagline2}</span></p>` and `<p className="text-body text-ink-2">{pitch}</p>`;
  - **pane** `div`: `flex min-h-dvh flex-col bg-bg px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))] min-[1100px]:border-l min-[1100px]:border-separator min-[1100px]:bg-sidebar min-[1100px]:px-7`. It holds:
    - the top row, a `<header>` so print hides it: `flex min-h-11 items-center gap-2`. It contains `<BrandMark className="min-w-0 min-[1100px]:hidden"/>` and a `div ml-auto flex shrink-0 items-center gap-2` with `<LanguageToggle/>` and the nav `Link` (`inline-flex min-h-9 items-center whitespace-nowrap rounded-full bg-surface-2 px-4 text-callout font-semibold text-ink hover:bg-surface-3`);
    - `{title && <div className="min-[1100px]:hidden"><AuthCourt variant="strip"/></div>}`;
    - `<main className="mx-auto flex w-full max-w-[340px] flex-1 flex-col justify-center gap-[22px] py-8">`, holding `{title && <h1 className="text-large-title text-ink min-[1100px]:text-title-1">{title}</h1>}{children}`;
    - `{legalLinks && <LegalLinks/>}`.
- **`LanguageToggle`:** same group, buttons and `aria-pressed`, and it still renders nothing while Italian is off. Track `inline-flex rounded-full bg-surface-2 p-0.5`. Each button is `min-h-9 min-w-11 rounded-full px-2 text-caption`: pressed `bg-surface text-ink shadow-card`, otherwise `text-ink-2`.
- **`LegalLinks`:** same links and order. `nav mt-6 flex flex-wrap justify-center gap-x-4`, each link `inline-flex min-h-11 items-center text-caption text-ink-3 hover:text-ink hover:underline`.

- [ ] **Step 1: Failing tests** in `AuthShell.test.tsx` (MemoryRouter):
  - `it('draws the court as decorative inline svg and shows no image but the brand mark')`: `auth-court` is an `svg` with `aria-hidden="true"`, and `container.querySelectorAll('img:not([alt=""])')` is empty.
  - `it('shows the title as h1 and the nav action as a link')`: heading "Welcome back"; link "Request access" → `/request-access`.
  - `it('renders the tagline with Together. in ink-3')`: `getByText('Together.')` has `text-ink-3`, and no element has `uppercase`.
  - `it('adds the phone court strip only on pages with a title')`: `auth-court-strip` is present with a title and absent without one.
  - `it('pins the legal links when asked')`: `getByRole('navigation', { name: 'Legal' })` only with `legalLinks`.
- [ ] **Step 2:** Run `npx vitest run src/auth/AuthShell.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above, and delete the two webp files (no other importer).
- [ ] **Step 4:** Run `npx vitest run src/auth src/settings/LanguageSettings.test.tsx src/settings/LanguageSettingsOff.test.tsx src/legal`. Expected: PASS, with existing tests unchanged.
- [ ] **Step 5: Commit** `feat(auth): v2 sign-in frame with the perspective court`

### Task 3: Login and finish sign-in

**Files:**
- Modify: `src/auth/LoginPage.tsx`, `src/auth/FinishSignInPage.tsx`, `src/i18n/{en,it}/auth.ts`
- Test: `src/auth/LoginPage.test.tsx`, `src/auth/FinishSignInPage.test.tsx`

**Interfaces:**
- Consumes `AuthShell` (Task 2) and `StatusLayout` (Task 1).
- **Form** (`AuthShell title={welcomeBack} navAction=… legalLinks`):
  - the email label `text-footnote font-medium text-ink-2 mb-1.5 block`;
  - `Input` (unchanged props);
  - a `flex flex-col gap-3` with "Send sign-in link" (`primary`, `min-h-12 w-full gap-2`, ArrowRight `aria-hidden`), the "or" divider (`flex items-center gap-3 text-caption text-ink-3` with `before:`/`after:` hairlines `border-t border-separator`) and "Continue with Google" (`secondary`, same size, the glyph unchanged);
  - the error `role="alert" text-footnote text-red-strong`;
  - the alt links `flex flex-col items-center gap-1.5 text-callout text-ink-2`: `{noAccessYet} <Link className="font-semibold text-ink hover:underline">{requestEarlyAccess}</Link>`, then the `createClub` link (same classes).
- **Sent state:** `AuthShell legalLinks` with no title and no nav action, and `<StatusLayout icon={Mail} title={checkEmail}>`. The body is `{sentTo}<b className="break-all font-semibold text-ink">{email}</b>.<br/>{openOnThisDevice}`.
- **`FinishSignInPage`:** `AuthShell` with no title. It renders `StatusLayout` with the hard-coded title "Volley Skills" (parity, inventory §10):
  - working: icon `LogIn`, body `t.signingIn`;
  - error: icon `AlertTriangle`, `tone="error"`, body `<p role="alert">{t[error]}</p>`, and no actions (parity).
- Strings, en / it:
  - `auth.loginPage.noAccessYet` becomes `"Don't have access yet?"` / `"Non hai ancora l'accesso?"`;
  - new `requestEarlyAccess`: `'Request early access'` / `"Richiedi l'accesso anticipato"`;
  - new `openOnThisDevice`: `'Open it on this device.'` / `'Aprilo su questo dispositivo.'`.

- [ ] **Step 1: Failing tests.**
  - `LoginPage.test.tsx`:
    - `it('check your email tells the coach to open the link on this device')`: after sending, the h1 is "Check your email" and "Open it on this device." shows.
    - `it('a long email wraps inside the status layout')`: with `a.very.long.coach.name@some-really-long-club-domain.example`, the `b` holding it has `break-all`.
    - `it('links Request early access to the request form')`: link "Request early access" → `/request-access`.
  - `FinishSignInPage.test.tsx`: `it('an email-link error shows the alert with no action')`. With `isSignInWithEmailLink` false, the alert reads "This sign-in link is invalid or has expired.", and there is no button and no link.
- [ ] **Step 2:** Run `npx vitest run src/auth/LoginPage.test.tsx src/auth/FinishSignInPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS, with every existing test unchanged (link sent, `languageCode`, errors, Google, return-to, nonce routing).
- [ ] **Step 5: Commit** `feat(auth): v2 login and email-link status screens`

### Task 4: Loading, errors, no-access and not-found states

**Files:**
- Create: `src/auth/NoAccess.tsx`
- Modify: `src/auth/RequireAuth.tsx`, `src/auth/RequireSection.tsx`, `src/auth/RequireClubAdmin.tsx`, `src/auth/RequirePlatformAdmin.tsx`, `src/layout/NotFoundPage.tsx`, `src/components/NotFoundState.tsx`
- Test: `src/auth/guards.test.tsx`, `src/auth/RequirePlatformAdmin.test.tsx`, `src/layout/NotFoundPage.test.tsx`, `src/components/NotFoundState.test.tsx`, `src/auth/RequireAuth.test.tsx`

**Interfaces:**
- Consumes `StatusLayout` and `AuthShell`.
- **`NoAccess({ framed = false }: { framed?: boolean })`:** `<StatusLayout role="alert" icon={Lock} title={t.auth.shared.noAccess} />`. Unframed, it sits in `div w-full px-4 py-16`; `framed` wraps it in `<AuthShell>`.
  - `RequireSection` and `RequireClubAdmin` render `<NoAccess />`, which replaces the full public frame inside AppShell.
  - `RequirePlatformAdmin` renders `<NoAccess framed />`.
  - Each file's local `Denied` is deleted.
- **`RequireSignedIn`:**
  - loading: `<AuthShell><StatusLayout role="status">{t.loading}</StatusLayout></AuthShell>`;
  - auth error: `<AuthShell><StatusLayout role="alert" tone="error" icon={AlertTriangle}>{t.wentWrong}<a href="/login" className="font-semibold text-ink underline">{t.tryAgain}</a>.</StatusLayout></AuthShell>`.

  The plain `<a>` (full page load) stays.
- **`NotFoundPage`:** `div w-full px-4 py-16` holding `StatusLayout`:
  - `illustration`: `OutOfBounds`, restyled to tokens — court lines `stroke-ink-3`, ball `fill-ink`, seams `stroke-bg`, trajectory `stroke-ink-2`, `aria-hidden` kept;
  - `title={t.heading}`;
  - body `{t.nothingLivesAt}<code className="rounded-sm bg-surface-2 px-1 text-ink">{pathname}</code>`;
  - actions: the "Go home" `Link` (`inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink text-on-ink font-semibold`) and the Back `Button variant="secondary" className="min-h-12 w-full rounded-full"` with the same history logic.

  `usePageMeta({ title })` is unchanged.
- **`NotFoundState`:** same props and logic. `StatusLayout icon={SearchX}`, or `illustration` when given. Body: message, then the other-club line with secondary Switch buttons. Actions: the back `Link` as the ink pill above.

- [ ] **Step 1: Failing tests.**
  - `guards.test.tsx`: `it('a denied section page shows the no-access status with a heading')`: `getByRole('heading', { name: "You don't have access to this page." })` is inside `getByRole('alert')`, and no "Players. Progress." text is rendered.
  - `RequirePlatformAdmin.test.tsx`: `it('a non-operator gets the framed no-access status')`: the alert text is as before, and `getByTestId('auth-court')` is present.
  - `NotFoundPage.test.tsx`: `it('Go home is an ink pill next to Back')`: link "Go home" has `bg-ink`, and button "Back" is present.
- [ ] **Step 2:** Run `npx vitest run src/auth src/layout/NotFoundPage.test.tsx src/components/NotFoundState.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command plus `src/App.test.tsx`. Expected: PASS, with `RequireAuth.test.tsx` and `NotFoundState.test.tsx` unchanged.
- [ ] **Step 5: Commit** `feat(auth): in-app no-access and not-found use the status layout`

### Task 5: Request access, sign-up info, sign-up form and signing status

**Files:**
- Modify: `src/interest/RequestAccessPage.tsx`, `src/signup/SignupInfoPage.tsx`, `src/signup/SignCompletePage.tsx`, `src/signup/SignupPage.tsx`
- Test: `src/interest/RequestAccessPage.test.tsx`, `src/signup/SignupInfoPage.test.tsx`, `src/signup/SignCompletePage.test.tsx`, `src/signup/SignupPage.test.tsx`

**Interfaces:**
- Consumes `AuthShell` (`legalLinks`) and `StatusLayout`.
- **`RequestAccessPage`:**
  - Form: `AuthShell title={heading} navAction={signIn} legalLinks`.
    - Intro `text-body text-ink-2`.
    - Labels in the login label style.
    - The role `select` uses `` `${FIELD_CLASS} w-full` ``.
    - Privacy note `text-footnote text-ink-2`, with the `/privacy` link `text-ink underline`.
    - Submit `primary min-h-12 w-full` (disabled while submitting, unchanged).
    - "Already have access? Sign in" in the alt-link style.
  - Success: `AuthShell` with `StatusLayout icon={CheckCircle2} title={thanks}`, body `gotRequest`, and as the action the `Link` "Back to sign in" (ink pill). No `legalLinks` (parity: the success state has none today).
- **`SignupInfoPage`:** `AuthShell title navAction legalLinks`.
  - The ordered list `list-decimal space-y-2 pl-5 text-body text-ink`.
  - Note `text-footnote text-ink-2`.
  - "Start" `Link` is the ink pill (`min-h-12 w-full rounded-full bg-ink text-on-ink font-semibold`).
- **`SignCompletePage`:** `AuthShell` with no title, and one `StatusLayout title={t.title}` whose icon, body and actions follow the view. The `role` placements stay exactly as today, on the same text.

  | View | Icon | Body | Action |
  |---|---|---|---|
  | working | `Loader2` | `<p role="status">` | — |
  | linkExpired | `Clock` | text | primary Send a new link |
  | linkSent | `Mail` | `<p role="status">` | — |
  | noDraft, wrongLink | `Info` | text | — |
  | wrongAccount | `UserX` | text | secondary Sign out |
  | error | `AlertTriangle`, `tone="error"` | `<p role="alert">` | primary Try again |

  `resendError` stays a `role="alert"` paragraph under the body.
- **`SignupPage`** (inside `MinimalShell`): content column `mx-auto max-w-[720px] px-4 py-8 sm:px-6`.
  - "Step N of 3" `text-footnote text-ink-2 tabular-nums`; `h1` `text-large-title md:text-title-1`.
  - Fields: labels as above; the country and language `select`s use `FIELD_CLASS`; authority checkbox row `min-h-11`.
  - Retire the legacy tokens; logic is unchanged.

- [ ] **Step 1: Failing tests.**
  - `RequestAccessPage.test.tsx`: `it('thanks is a status screen with a way back to sign in')`: after submit, heading "Thanks!" and link "Back to sign in" → `/login` with `bg-ink`.
  - `SignupInfoPage.test.tsx`: `it('Start is an ink pill to the club form')`: link "Start" → `/signup/club` with `bg-ink`.
  - `SignCompletePage.test.tsx`: `it('every view keeps the Completing sign-up heading')`: in the `wrongLink` case, heading "Completing sign-up" with `tabindex="-1"` (the status layout's h1).
- [ ] **Step 2:** Run `npx vitest run src/interest/RequestAccessPage.test.tsx src/signup`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run the same command. Expected: PASS, with the existing sign-complete outcomes, the StrictMode single commit and the sign-up validation tests unchanged.
- [ ] **Step 5: Commit** `feat(signup): v2 request access, sign-up and signing status`

### Task 6: ClubGate screens and the app strips

**Files:**
- Modify: `src/clubs/ClubStatusScreen.tsx`, `src/clubs/WelcomePage.tsx`, `src/clubs/ClubGate.tsx`, `src/clubs/ContractEndingBanner.tsx`, `src/legal/LegalNoticeBanner.tsx`
- Test: `src/clubs/ClubStatusScreen.test.tsx`, `src/clubs/WelcomePage.test.tsx`, `src/legal/LegalNoticeBanner.test.tsx`, `src/clubs/ClubGate.test.tsx`, `src/auth/RequireAuth.test.tsx`

**Interfaces:**
- Consumes `AuthShell` and `StatusLayout`.
- **`ClubStatusScreen`:** `AuthShell` (no title) with `StatusLayout` and `title`/`body` from the same `copy` map. Icons: pending `Hourglass`, locked `PauseCircle`, ended `Archive`.
  - The pending extras stay in the body: `emailWhenActive`, then the accepted line with links `text-ink underline` and versions `tabular-nums`.
  - Actions: one `Button variant="primary" className="min-h-12 w-full"` per other usable club, then Sign out `secondary` with the same size.
- **`WelcomePage`:** `AuthShell` with `StatusLayout icon={Users} title={w.title}` and the same body rule. Actions, in today's order:
  - the platform `Link` (ink pill) for an operator, else the "Create a club" `Link` (`secondary` pill classes `bg-surface-2 text-ink`);
  - the Switch buttons;
  - Sign out.
- **Strips.** Same roles, text, dates and `print:hidden`.
  - `ClubGate`'s ended-instead strip and `ContractEndingBanner`: `border-b border-separator bg-orange-tint px-4 py-2.5 text-footnote text-ink`.
  - `LegalNoticeBanner`: `flex items-start justify-between gap-3 border-b border-separator bg-surface-2 px-4 py-2.5 text-footnote text-ink`.
    - Links are `font-semibold text-ink underline`.
    - Dismiss is a `Button variant="ghost" size="icon"` with `aria-label={components.dismiss}`, an `X` icon at 16 px, and `min-h-11 min-w-11`.
    - Storage and dismissal logic are unchanged.

- [ ] **Step 1: Failing tests.**
  - `ClubStatusScreen.test.tsx`: `it('offers switching before signing out, full width')`: with one other club, the button order is ["Switch to Other Club", "Sign out"], and both have `w-full`.
  - `LegalNoticeBanner.test.tsx`: `it('is a neutral strip with ink links, never blue')`: the status `className` has no `blue`, and the review link has `text-ink`.
- [ ] **Step 2:** Run `npx vitest run src/clubs src/legal/LegalNoticeBanner.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/clubs src/legal src/auth src/layout/AppShell.test.tsx`. Expected: PASS. Unchanged: the ClubGate state table, timer boundaries, the ended-instead `role="status"` text, the welcome variants and the banner session dismissal.
- [ ] **Step 5: Commit** `feat(clubs): gate screens share the status layout; neutral strips`

### Task 7: Legal pages and the reading column

**Files:**
- Modify: `src/legal/LegalDocPage.tsx`, `src/legal/LegalMarkdown.tsx`, `src/legal/LegalLangSwitcher.tsx`
- Test: `src/legal/LegalMarkdown.test.tsx`, `src/legal/LegalDocPage.test.tsx`, `src/legal/PrivacyPage.test.tsx`

**Interfaces:**
- Consumes `BrandMark` and `LegalLinks` (Tasks 1–2).
- **`LegalDocView` frame:**
  - root `min-h-dvh bg-bg text-ink`;
  - `<header className="glass sticky top-0 z-10">` holding `div mx-auto flex h-[52px] max-w-[720px] items-center justify-between gap-3 px-4 sm:px-6`: `BrandMark` on the left; on the right `LanguageToggle` and the "Back to the app" / "Sign in" `Link` (nav pill classes from Task 2);
  - `<main className="mx-auto max-w-[720px] px-4 py-8 sm:px-6">`.

  The meta, `?v`/`?lang` logic, version line and not-found branch are unchanged.
  - Version line: `mt-3 text-footnote text-ink-2 tabular-nums`.
  - Text container: `<div lang={lang} className="mt-6 text-base leading-[1.625rem]">`.
  - The not-found branch is `h1 text-title-1` plus `text-body text-ink-2`.
- **`LegalMarkdown`:** class names only; the parser, ids, elements, order and link rules are unchanged.
  - h1 `text-large-title md:text-title-1`;
  - h2 `mt-10 scroll-mt-16 text-title-3` (keeps `id`);
  - h3 `mt-6 text-headline`;
  - p `mt-4`;
  - lists `mt-4 space-y-1.5 pl-6`;
  - links `text-ink underline underline-offset-2 hover:text-ink-2`;
  - code `rounded-sm bg-surface-2 px-1 text-[0.9em]`;
  - blockquote `mt-4 rounded-md bg-orange-tint p-4 text-callout text-ink`;
  - table cells `border border-separator px-2 py-1.5`, th `bg-surface-2 text-footnote font-semibold`, table `text-callout`.

  Paragraphs inherit size from the container, so the review boxes (Task 8) set their own.
- **`LegalLangSwitcher`:** same group, endonyms, `lang` and `aria-pressed`. Each button is `min-h-11 rounded-full px-3.5 text-callout`: pressed `bg-ink text-on-ink font-semibold`, otherwise `bg-surface-2 text-ink hover:bg-surface-3`.

- [ ] **Step 1: Failing tests.**
  - `LegalMarkdown.test.tsx`: `it('links are ink and underlined, never blue')`: an internal link has `text-ink` and `underline`, and none has `blue`. Also `it('keeps clause ids on the restyled h2')`: `## T12. Liability` gives `#t12`. Keep it if an equivalent exists; otherwise add it.
  - `LegalDocPage.test.tsx`: `it('reads in a 720 px column at 16/26')`: `main` has `max-w-[720px]`, and the `[lang]` container has `leading-[1.625rem]`.
- [ ] **Step 2:** Run `npx vitest run src/legal/LegalMarkdown.test.tsx src/legal/LegalDocPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4:** Run `npx vitest run src/legal src/seo`. Expected: PASS, with `published.test.ts`, `content.test.ts`, `legalDocs.test.ts`, `PrivacyPage.test.tsx` and `seoRoutes.test.ts` unchanged.
- [ ] **Step 5: Commit** `feat(legal): v2 legal pages with a 720 px reading column`

### Task 8: Legal review, documents step and specific approval

**Files:**
- Modify: `src/legal/LegalReviewScreen.tsx`, `src/signup/DocumentsStep.tsx`, `src/signup/SpecificApprovalStep.tsx`, `src/i18n/{en,it}/signup.ts`
- Test: `src/signup/SpecificApprovalStep.test.tsx`, `src/signup/DocumentsStep.test.tsx`, `src/legal/LegalReviewScreen.test.tsx`, `src/legal/LegalReviewScreenItalian.test.tsx`, `src/signup/SignupPage.test.tsx`

**Interfaces:**
- Consumes `LegalMarkdown` (Task 7 classes).
- **`LegalReviewScreen`** (content only, inside `MinimalShell`):
  - column `mx-auto max-w-[720px] px-4 py-8 sm:px-6`;
  - h1 `text-large-title md:text-title-1`;
  - summaries `mt-2 list-disc pl-5 text-body text-ink-2`;
  - step 1 fields in a `rounded-lg bg-surface p-4 shadow-card` block: labels as Task 3, authority row `min-h-11`;
  - Back is `ghost`;
  - Switch buttons are `secondary`;
  - the "Don't agree?" block: `mt-10 border-t border-separator pt-6`, the text `text-footnote text-ink-2`, and the `destructive` button.

  The logic, frozen versions, nonce and `ConfirmDialog` are unchanged.
- **`DocumentsStep`:**
  - each region `max-h-72 overflow-y-auto rounded-lg bg-surface p-4 text-base leading-[1.625rem] shadow-card` (focus ring `focus-visible:ring-2 ring-focus`);
  - title `h3 text-headline`;
  - links `text-callout text-ink underline`;
  - checkbox label `flex min-h-11 items-start gap-3 text-body`;
  - hint `text-footnote text-ink-2`.

  The read and reset rules are unchanged.
- **`SpecificApprovalStep`** (§8.1 "grouped box, each with its checkbox"):
  - intro `text-body text-ink-2`;
  - one `<ul lang={lang} className="overflow-hidden rounded-lg bg-surface shadow-card">`;
  - each clause an `<li>` holding an `<article className="p-4">` with:
    - `h3 text-headline` `{c.id}. {c.heading}`;
    - `<LegalMarkdown text={c.text}/>` in `div text-base leading-[1.625rem]`;
    - a checkbox `<label className="mt-3 flex min-h-11 items-start gap-3 text-body">`, with `id={`approve-${c.id}`}` and label `t.approveClause(c.id)`;
  - hairlines between items (`border-t border-separator` on all but the first).
- **Approve gating:** "Approve these clauses specifically" is disabled while `sending` **or** while any clause is unticked. Ticks are `Set<string>` state, cleared whenever `lang`, `termsVersion` or `dpaVersion` changes (`useEffect` on those three).
  - The rendered clause strings are unchanged, so the hashes in `buildAcceptance` are unaffected.
  - Ticks are not stored or written.
- Strings: `signup.approval.approveClause`: en `` (id: string) => `I specifically approve clause ${id}` ``, it `` (id: string) => `Approvo specificamente la clausola ${id}` ``.

- [ ] **Step 1: Failing tests** in `SpecificApprovalStep.test.tsx`:
  - `it('lists the 13 clauses in one group, each with its own checkbox')`: 13 `h3`s in order T2 … D11, and 13 checkboxes named "I specifically approve clause T2" … "D11".
  - `it('Approve stays disabled until every clause is ticked')`: disabled after 12 ticks, enabled after the 13th.
  - `it('ticks reset when the legal language changes')`: tick all, `rerender` with `lang="it"`; every box is unchecked and Approve is disabled.
- [ ] **Step 2:** Run `npx vitest run src/signup/SpecificApprovalStep.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Setup-only changes mapped to §8.1.** These tests now tick the 13 boxes before pressing Approve, through a `tickAllClauses()` helper (`getAllByRole('checkbox', { name: /specifically approve clause/ })` → click each):
  - the existing send success and failure tests in `SpecificApprovalStep.test.tsx`;
  - the step-3 send tests in `LegalReviewScreen.test.tsx` and `SignupPage.test.tsx`.

  Their assertions (draft fields, status and alert copy, single flight) are unchanged.
- [ ] **Step 5:** Run `npx vitest run src/signup src/legal`. Expected: PASS, including `DocumentsStep.test.tsx`, `LegalReviewScreenItalian.test.tsx`, `acceptance.test.ts` and `published.test.ts` unchanged.
- [ ] **Step 6: Commit** `feat(legal): v2 review flow; specific-approval clauses grouped with checkboxes (§8.1)`

### Task 9: Settings: grouped lists, theme, language sheet, canvas ease

**Files:**
- Modify: `src/settings/SettingsPage.tsx`, `src/settings/LanguageSettings.tsx`, `src/index.css`, `src/i18n/{en,it}/settings.ts`
- Test: `src/settings/SettingsPage.test.tsx`, `src/settings/LanguageSettings.test.tsx`, `src/settings/LanguageSettingsOff.test.tsx`, `src/theme/systemSettings.test.ts`

**Interfaces:**
- Consumes:
  - `useThemePreference` (`src/theme/useTheme.ts`);
  - `GroupedList`/`ListRow`, `SegmentedControl` (`semantics="radio"`) and `Sheet` (`detent="content"`);
  - `providerName` and `readAiSettings` (`src/ai/aiSettings.ts`).
- **Page:** `div mx-auto flex w-full max-w-[720px] flex-col gap-8 p-4 sm:p-6 lg:p-8`. `view = useSearchParams()[0].get('view') === 'ai' && aiEnabled ? 'ai' : 'root'`.
  - **root:** `PageHeader title={t.title}`, then:
    1. `GroupedList header={t.appearanceTitle}` with `ListRow title={t.theme} trailing={<SegmentedControl label={t.theme} options=[system, light, dark] value={pref} onChange={setPref}/>}`;
    2. `<LanguageSettings/>`;
    3. when `aiEnabled`: `GroupedList header={t.ai.title} footer={t.ai.description}` with `ListRow to="/settings?view=ai" title={t.ai.provider} trailing={providerName(readAiSettings().provider)}`.
  - **ai:** `PageHeader title={t.ai.title} eyebrow={<Link to="/settings" className="inline-flex min-h-11 items-center gap-1 text-ink-2 hover:text-ink"><ChevronLeft size={16} aria-hidden/>{t.title}</Link>}`, then `<AiProviderSettings/>`. Task 10 restyles its body.
  - Both views still have no sign-out and no navigation duplicates (invariant 39).
- **`LanguageSettings`:** returns `null` while `!ITALIAN_ENABLED`.
  - It renders `GroupedList header={t.settings.languageTitle} footer={t.settings.languageDescription}` with `ListRow onClick={open} title={t.settings.languageLabel} trailing={current endonym}`.
  - The sheet is `Sheet title={t.settings.languageLabel} detent="content"`, a `GroupedList` of two `ListRow onClick` rows (English / Italiano) with a trailing `Check` (`aria-hidden`) and `rowProps={{ 'aria-current': selected ? 'true' : undefined }}`.
  - Picking calls `setLocale(id)` and closes. Escape and Cancel close with no change.
- **`index.css`** (§6.7):
  - in `@layer base`, `html, body { transition: background-color 200ms ease; }`;
  - inside the existing `prefers-reduced-motion: reduce` block, `html, body { transition: none; }`;
  - a new `@media (forced-colors: active) { :focus-visible { outline: 2px solid CanvasText; } }`.
- Strings, en / it:
  - `settings.theme`: `'Theme'` / `'Tema'`;
  - `themeSystem`: `'System'` / `'Sistema'`;
  - `themeLight`: `'Light'` / `'Chiaro'`;
  - `themeDark`: `'Dark'` / `'Scuro'`.

  `appearanceDescription` is deleted in en and it.

- [ ] **Step 1: Failing tests.**
  - `SettingsPage.test.tsx`, with a `MemoryRouter` that takes `initialEntries`:
    - `it('theme is a System, Light and Dark choice that stores it')`: radio "Dark" sets `localStorage.theme` to `dark` and `html.dark`; "System" removes the key and its radio is `aria-checked="true"`.
    - `it('with storage blocked it shows System and Dark still paints')`: spy `Storage.prototype.getItem` and `setItem` to throw; System is checked; clicking Dark adds `html.dark`.
    - `it('the AI row opens the AI subpage')`: link with href `/settings?view=ai` showing "Groq". At `/settings?view=ai`: h1 "AI provider", button "Test connection", link "Settings" → `/settings`.
    - `it('view=ai with AI off shows the root settings')`: `aiEnabled` false at `/settings?view=ai` gives h1 "Settings" and no "Test connection".
  - `systemSettings.test.ts`:
    - `it('the canvas eases a theme change over 200 ms, instantly with reduced motion')`;
    - `it('forced colors keep a visible focus outline')`.
- [ ] **Step 2:** Run `npx vitest run src/settings src/theme/systemSettings.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above.
- [ ] **Step 4: Assertion changes mapped to §5 and §8.1.**
  - "shows the theme toggle, full width on phones" and "renders each section as a settings row that becomes a 3-column grid on desktop" are deleted; the new theme tests replace them.
  - `LanguageSettings.test.tsx` changes selectors only: click the row button "Language English", then "Italiano"; the `Lingua` heading, `vcb.locale` and `<html lang>` assertions stay.
- [ ] **Step 5:** Run `npx vitest run src/settings src/theme src/i18n`. Expected: PASS. Unchanged: `useThemePreference.test.tsx`, `theme.test.ts`, `LanguageSettingsOff.test.tsx`, the no-links/no-sign-out test and `AiProviderSettings.test.tsx`.
- [ ] **Step 6: Commit** `feat(settings): grouped settings with System theme, language sheet and AI subpage`

### Task 10: AI provider subpage body

Runs after Task 9 in the same group (it deletes the `SettingsSection` file that Task 9 stops using in `LanguageSettings`).

**Files:**
- Modify: `src/settings/AiProviderSettings.tsx`
- Delete: `src/settings/SettingsSection.tsx`
- Test: `src/settings/AiProviderSettings.test.tsx`

**Interfaces:**
- Same export and `testFn` prop; every control, label, `aria-*` and behaviour is unchanged (invariant 41). Only the frame and classes change.
  - The root is `div flex flex-col gap-6` (no `SettingsSection`).
  - Fields sit in one `rounded-lg bg-surface p-4 shadow-card` block (`grid grid-cols-1 gap-4 md:grid-cols-2`).
  - Labels are `text-footnote font-medium text-ink-2`.
  - External links are `text-callout text-ink underline`.
  - The eye button is `text-ink-2 hover:text-ink`.
  - The remember row is `min-h-11`; Forget key is `ghost`.
- The notes follow in a `flex flex-col gap-2 px-4 text-footnote text-ink-2`: provider note, DPA note, own-key line, privacy line with the "What's sent" link, then the polite live line.
- Test connection is `secondary`. The status colours stay `text-green-strong`, `text-red-strong` and `text-ink-2`; testing replaces `text-slate`.

- [ ] **Step 1: Failing test:** `it('renders without a settings card heading, inside one grouped block')`. No `heading` named "AI provider" inside the component (the subpage h1 owns it); the provider `select` has an ancestor with `bg-surface`.
- [ ] **Step 2:** Run `npx vitest run src/settings/AiProviderSettings.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement as specified above, and delete `SettingsSection.tsx` (no importer is left: `grep -rn SettingsSection src` is empty).
- [ ] **Step 4:** Run `npx vitest run src/settings src/ai`. Expected: PASS, with every existing `AiProviderSettings` test unchanged (save on change, provider reset clears the key, session vs remembered key, Forget key, the Test connection messages and colours).
- [ ] **Step 5: Commit** `feat(settings): v2 AI provider subpage`

### Task 11: Gate and user checklist

**Files:** none new.

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all green, with 0 lint errors. If a known flaky load-timeout test fails (the Italian smoke test), rerun that file alone and report both results.
- [ ] **Step 2: Greps.** Each should print nothing:
  - `grep -rnE "dark:|navy|slate|border-border|bg-blue/|text-blue-strong|bg-orange/|text-white|uppercase|ring-blue|border-blue|bg-bg\b" src/auth src/signup src/settings src/legal/*.tsx src/clubs/ClubGate.tsx src/clubs/ClubStatusScreen.tsx src/clubs/WelcomePage.tsx src/clubs/ContractEndingBanner.tsx src/layout/NotFoundPage.tsx src/components/NotFoundState.tsx src/components/StatusLayout.tsx src/interest/RequestAccessPage.tsx src/i18n/LanguageToggle.tsx --include=*.tsx | grep -v test`;
  - `git diff --stat main -- src/legal/content firestore.rules firestore.indexes.json firebase.json src/seo public/robots.txt`;
  - `grep -rn "player-spike\|ball-mikasa" src`.
- [ ] **Step 3: Commit** any lint-only fix-ups as `chore(auth): gate fix-ups`, if there are any.
- [ ] **Step 4: User checklist** for the group report. The user runs it on a real phone and a desktop, in light and dark mode.
  - **Sign in vs the mockup** (v2.html "Sign in").
    - Desktop at 1100 px or wider: the hairline court in perspective with zones 1–6, the ink net, the dashed serve from zone 1 and the faint glow; "Players. Progress." in ink with "Together." in grey; the right pane white, or near-black `#0D0D0F` in dark; the Request access pill top-right; the 340 px form; the legal links at the bottom.
    - Phone: the brand and pill row, then the cropped court strip fading into the background, then the large title, the form, the links and the legal links.
    - Resize across 1100 px; there is no horizontal scroll at 320 px.
  - **Email link.** Send a link and check that "Check your email" shows the mail tile, your address and "Open it on this device." Open the link in another browser: the error status with no button.
  - **Gate.** Sign in as `pending@example.com`, `rival@example.com` (when paused) and an account with no club. Each shows the status layout inside the sign-in frame, with Switch and Sign out.
  - **No access and 404.**
    - As a member without the exercises section, open `/exercises`: the lock status inside the app frame, not the sign-in page.
    - Open `/nope`: the out-of-bounds status with Go home and Back.
  - **Legal.**
    - `/legal/terms`: the glass header and a readable 720 px column; the language chips switch the text; `#t12` deep-links to the clause.
    - Sign in as `review@example.com`: the review flow, where step 3 shows one grouped box whose Approve unlocks only after all 13 ticks. Go Back, change the language, and confirm the ticks are cleared.
  - **Settings.**
    - Theme System · Light · Dark: System follows the OS live, and the canvas eases between themes (instant with Reduce motion on).
    - The AI provider row opens the subpage, and its back link returns.
    - With `ITALIAN_ENABLED` switched on locally, the Language row opens the picker sheet.
  - `tailwind.config.js` did not change, so no dev-server restart is needed.
