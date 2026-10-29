# App shell, navigation, auth, gates, settings and shared primitives

Parity inventory for the UI redesign (branch `feature/ui-redesign`, written 2026-10-28 from the code
and its tests). It describes **what the app does today**; the redesign may change every pixel but
must keep every behaviour listed here. Where something is inferred rather than read directly from
code or a test, it says so.

This area is everything that wraps the feature pages:

- **Routing** (`src/App.tsx`): which URL renders what, which gate protects it, which routes are lazy.
- **Shells**: `AppShell` (navy sidebar on desktop, bottom tab bar on phones), `MorePage` (the phone
  "More" tab), `MinimalShell` (bare frame for restricted states, sign-up, legal review, platform),
  `AuthShell` (the blue "court" marketing frame for public and status pages), `PageHeader`,
  `NotFoundPage`, page metadata / SEO.
- **Auth**: passwordless email link + Google popup sign-in, the `AuthProvider` session (memberships,
  active club, role, access, platform-admin flag), the route guards, return-to-deep-link, the
  re-authentication used for legal signing, and sign-out (which wipes local data).
- **Club gate**: what a signed-in person sees from the active club's live status and their role
  (welcome, pending, paused, ended, restricted export-only area, legal review, the app).
- **Legal UI**: blocking legal review for club admins, upcoming-version banner, the public legal
  document pages and their language switcher (behaviour only, not the legal text itself).
- **Self-service sign-up** (`/signup`, `/signup/club`, `/sign/complete`) and the public
  "request access" form.
- **Settings**: theme, language, AI provider; i18n and theme plumbing.
- **Shared primitives** in `src/components/` whose behavioural contracts (focus, Escape, roles,
  disabled/loading) every redesigned component must keep.
- Startup cache reset (`schemaVersion`) and print styles.

Who uses it: everyone. Roles that matter here: **club admin** (`role === 'admin'` in the active
club; has every section), **member** (`role === 'member'`; sections resolved by probing the rules),
**section admin** (a member whose email is in `sectionAccess/{exercises|trainings|guides}.adminEmails`;
seen by the UI only as `access.sections[x] === true`), **team admin** (resolved per team inside
feature pages, not in this area), **platform operator** (`isPlatformAdmin`, an email in
`platformAdmins/{email}`; may have no club at all), and **signed-out visitors**.

---

## Route table (`src/App.tsx`)

Provider order (outer to inner): `BrowserRouter` → `AuthProvider` → `I18nProvider` (reads the
active club's locale, so it must sit inside `AuthProvider`) → `NoticeProvider` → `Routes`.

| Path | Element | Gate | Shell | Notes |
|---|---|---|---|---|
| `/login` | `LoginPage` | none (public) | `AuthShell` | indexable, canonical `/login` |
| `/finish-sign-in` | `FinishSignInPage` | none | `AuthShell` | email-link landing |
| `/privacy` | `PrivacyPage` | none | own legal frame | indexable when found |
| `/legal/:doc` | `LegalDocPage` | none | own legal frame | `doc` ∈ terms, dpa, subprocessors, dpia-pack |
| `/request-access` | `RequestAccessPage` | none | `AuthShell` | indexable |
| `/signup` | `SignupInfoPage` | none | `AuthShell` | indexable |
| `/signup/club` | `SignupPage` | `RequireSignedIn` (no club gate) | `MinimalShell` | |
| `/sign/complete` | `SignCompletePage` | `RequireSignedIn` | `AuthShell` | signing-link landing |
| `/platform` | `PlatformPage` | `RequirePlatformAdmin` (signed in, no club needed) | `MinimalShell` titled "Platform" | operator page (documented in the platform inventory) |
| `/admin/interest` | `<Navigate to="/platform?tab=leads" replace>` | none itself; `/platform` then gates | — | legacy link |
| *(layout route)* | `AuthenticatedLayout` = `RequireAuth` → `AppShell` → `<Outlet/>` | `RequireAuth` = `RequireSignedIn` + `ClubGate` | `AppShell` | all routes below |
| `/` | `HomePage` | | AppShell | |
| `/teams` | `TeamsListPage` | | AppShell | |
| `/settings` | `SettingsPage` | | AppShell | |
| `/more` | `MorePage` | | AppShell | phone "More" tab (reachable on desktop by URL too) |
| `/teams/:teamId` | `TeamPage` | | AppShell | |
| `/teams/:teamId/players/:playerId` | `PlayerCardPage` | | AppShell | |
| `/teams/:teamId/matches/:matchId` | `MatchPage` | | AppShell | |
| `/admin/guides` | `GuidesPage` | `RequireSection section="guides"` | AppShell | |
| `/exercises` | `ExercisesPage` | `RequireSection section="exercises"` | AppShell | |
| `/trainings` | `TrainingsPage` | `RequireSection section="trainings"` | AppShell | |
| `/exercises/:exerciseId/diagram` | `DiagramEditorPage` (**lazy**) | `RequireSection section="exercises"` | AppShell | fallback "Loading editor…" |
| `/club` | `ClubAreaPage` | `RequireClubAdmin` | AppShell | club area (separate inventory) |
| `/admin/access` | `<Navigate to="/club?tab=people" replace>` | inside the layout (so needs auth + club) | — | legacy link |
| `*` | `NotFoundPage` | inside the layout | AppShell | 404 only for signed-in people with a usable club |
| `/teams/:teamId/matches/:matchId/scout` | `ScoutPage` (**lazy**) | `RequireAuth` | none (full screen) | fallback "Loading scouting…" |
| `/teams/:teamId/awards` | `AwardsPage scope="season"` (**lazy**) | `RequireAuth` | none | fallback "Loading awards…"; team-admin check is inside the page |
| `/teams/:teamId/matches/:matchId/awards` | `AwardsPage scope="match"` (**lazy**) | `RequireAuth` | none | same |

`LazyFallback` renders `<div class="p-6 text-slate">` with `layout.lazyLoading[what]`:
"Loading editor…", "Loading scouting…", "Loading awards…" (Italian: "Caricamento dei premi…" etc.).

Hosting: `firebase.json` rewrites `**` to `/index.html` (clean URLs, `BrowserRouter`).

Startup (`src/main.tsx`): Inter 400/500/600/700/800 are imported from `@fontsource/inter`;
`resetCacheIfSchemaChanged()` runs **before** React renders (see schemaVersion below);
the app renders inside `React.StrictMode`. `index.html` loads `/theme-init.js` and
`/locale-init.js` before first paint (external files so the CSP stays `script-src 'self'`).

**Tests:** `src/App.test.tsx`.

---

## Screens and components

### 1. AppShell (`src/layout/AppShell.tsx`, wraps every route in the authenticated layout)

- **Purpose**: the frame of the app for a person with a usable club: navigation, club identity and
  switcher, account menu, banners, the `<main>` landmark.
- **Who sees what**:
  - Navigation entries come from `navGroups(access, isPlatformAdmin)` (see navModel). Members see
    only the sections granted; club admins see Club items; the platform operator sees the Platform
    group with a pending sign-ups badge.
  - Club switcher only when the person has at least one *other usable* membership
    (`otherUsableClubs`: status ≠ `deleted`, id ≠ active).
- **Elements**:
  - Skip link (first focusable): "Skip to content" → `href="#main"`, visually hidden until focused.
  - **Sidebar** (`<aside>`, visible only `lg` ≥ 1024 px, sticky full height, navy, `print:hidden`):
    - Logo (link to `/`, `aria-label="Volley Skills home"`).
    - Under the logo: active club name. With other usable clubs it is a `Menu` button labelled
      `Club: <club name>` (shows the name + a chevrons icon) whose items are
      `Switch to <club>` (Repeat icon), one per other usable club; otherwise plain text.
    - `<nav aria-label="Main">` with the groups. The ungrouped first group (Home) has no label;
      other groups are `role="group"` labelled by a visible uppercase heading ("Coaching", "Club",
      "Platform"). Items are `NavLink`s with icon + label; active item gets the highlighted style
      (`NavLink` sets `aria-current="page"`). Home uses exact matching (`end`) so `/` is not active
      everywhere. The Platform item carries the pending sign-ups count badge when > 0.
    - Footer: account `Menu` labelled `Account: <email>`, opening **upward**, trigger shows
      initials avatar (first two characters of the email local part, upper-cased; `?` fallback),
      the email (truncated) and a chevrons icon. Items, in order: "Settings" (→ `/settings`),
      "Terms & privacy" (→ `/legal/terms`), divider, "Sign out" (danger style).
  - **Content column**: `ContractEndingBanner`, then `LegalNoticeBanner`, then
    `<main id="main" tabIndex={-1}>` capped at `max-w-screen-xl`, centred. The column has bottom
    padding (`pb-16`) on phones so the fixed bottom bar does not cover content.
  - **Phone bottom bar** (`<nav aria-label="Main (phone)">`, fixed bottom, hidden from `lg`,
    `print:hidden`): one tab per `phoneTabs(...)` item (Home + Coaching items the person can see)
    plus a final **More** tab (→ `/more`) with a Menu icon and the pending sign-ups badge when > 0.
    Every tab shows icon **and** a visible text label (never icon-only); max 5 tabs (Home, Teams,
    Trainings, Exercises, More).
  - The sign-out "unsynced" confirm dialog (from `useSignOut`).
- **Actions → results**:
  - Nav link → client-side navigation.
  - Club menu → `Switch to X` → `switchClub(id)`: stores `vcb.activeClub` and **reloads the page**.
  - Account menu → Settings / Terms & privacy navigate; Sign out → `useSignOut().signOut()` (see
    sign-out below).
  - **Focus on route change**: when `pathname` changes (not on first load), focus moves to the first
    `<h1>` inside `<main>` (it is given `tabindex="-1"` if missing) with `preventScroll`; if the page
    has no `h1`, `<main>` itself is focused.
  - **Dropped club notice**: if `droppedClub` is true (the stored club was no longer usable and
    another was opened), shows the success notice "You no longer have access to your previous club."
    exactly once per mount.
- **States**: pending sign-ups count is fetched only for platform admins (`usePendingSignups`),
  re-counted whenever the window event `interest-signups-changed` fires.
- **Edge cases**: a member with no sections sees only Home and Teams (bottom bar: Home, Teams, More).
  A deleted club in memberships never appears in the switcher. Wide content is constrained by
  `min-w-0` so tables do not stretch the page.
- **Tests**: `src/layout/AppShell.test.tsx`, `src/layout/navModel.test.ts`.

### 2. navModel (`src/layout/navModel.ts`)

- Single source of truth for destinations; the sidebar and the More page both render from it
  ("nothing else lists pages").
- `navGroups(access, isPlatformAdmin)` returns, with empty groups removed:
  1. `main` (label `null`): Home `/` (exact).
  2. `coaching` "Coaching": Teams `/teams` (always); Trainings `/trainings` if
     `access.sections.trainings`; Exercises `/exercises` if `access.sections.exercises`.
  3. `club` "Club": Guides `/admin/guides` if `access.sections.guides`; "Members & settings" `/club`
     if `access.isClubAdmin`.
  4. `platform` "Platform": "Clubs & sign-ups" `/platform` (pending badge) if `isPlatformAdmin`.
- Every path appears exactly once. Icons: House, Users, ClipboardList, Dumbbell, BookOpen, KeyRound,
  Building2.
- `phoneTabs` = items of `main` + `coaching` only; Club and Platform live on More.
- Labels are read through `getT()` at call time (follow the active language).
- The Italian label budget test caps `home/teams/trainings/exercises/more` at max(EN × 1.5, 12)
  characters because they sit in the 375 px bottom bar.
- **Tests**: `navModel.test.ts`, `src/i18n/italianLabelBudget.test.ts`.

### 3. MorePage (`src/layout/MorePage.tsx`, `/more`)

- **Purpose**: the phone's home for everything not on the bottom bar.
- **Elements**: page title meta "More"; `h1` = active club name (only when a club exists); one card
  section per remaining nav group (`club`, `platform`) titled with the same group label as the
  sidebar, rendered as `<section aria-labelledby>` (so each is a named region); rows are links with
  icon, label, optional pending badge (with sr-only text " pending sign-ups") and a chevron. Then an
  **Account** section: "Settings" (`/settings`), "Terms & privacy" (`/legal/terms`), one
  "Switch to <club>" button per other usable club, and "Sign out" (red).
- **Actions**: links navigate; Switch → `switchClub` (reload); Sign out → `useSignOut`.
- **Rules**: never repeats a bottom-bar page (Home, Teams, Trainings, Exercises); a member without
  club/platform access sees only the Account section. Rows are ≥ 48 px tall (`min-h-12`).
- **Tests**: `src/layout/MorePage.test.tsx`.

### 4. MinimalShell (`src/layout/MinimalShell.tsx`)

- **Purpose**: bare frame for people who cannot use the full app or are mid-process: navy header
  with Logo, a title text, optional `actions`, the signed-in email and a "Sign out" button
  (secondary); `<main>` capped at `max-w-screen-xl`.
- **Used by**: `/platform` (title "Platform"), the restricted club area (title = club name or
  "Club"), `LegalReviewScreen` (club name), `SignupPage` (title "Create your club", actions =
  `LanguageToggle`).
- Includes the `useSignOut` unsynced dialog. No navigation, no banners.
- **Tests**: `src/layout/MinimalShell.test.tsx`, `src/App.test.tsx` (platform shows Sign out).

### 5. PageHeader (`src/layout/PageHeader.tsx`)

- The one page-title treatment: optional `eyebrow` (small muted line above), the page `<h1>`
  (`text-title`, `break-words`), optional `description`, optional `actions`.
- Actions sit right of the title from `sm`; on phones they are an equal-width grid row under it.
  No actions → no actions container.
- Renders a `<div data-page-header>`, **not** `<header>`, because print CSS hides every `<header>`;
  the page title must print.
- **Tests**: `src/layout/PageHeader.test.tsx`.

### 6. NotFoundPage (`src/layout/NotFoundPage.tsx`, route `*` inside the layout)

- **Elements**: illustration (ball out of a court, decorative SVG), `h1` "This page is out of
  bounds" (`tabIndex=-1`), "Nothing lives at `<pathname>`" with the path in `<code>`, "Go home"
  link (→ `/`), and a "Back" button.
- **Actions**: Back → `navigate(-1)` when `history.length > 1`, else `navigate('/')`.
- Meta title "Not found", `noindex, nofollow`.
- **Edge cases**: because it lives inside the authenticated layout, a signed-out visitor at an
  unknown URL is redirected to `/login` (and the path is remembered as return-to); a signed-in
  person with no usable club sees the Welcome page instead.
- **Tests**: `src/layout/NotFoundPage.test.tsx`, `src/App.test.tsx`.

### 7. usePageMeta and SEO (`src/layout/usePageMeta.ts`, `src/seo/seoRoutes.ts`)

- `usePageMeta({ title, description?, robots='noindex', canonicalPath? })`:
  - `document.title = "<title> · Volley Skills"`.
  - `<meta name="description">` = given or default "Volley Skills — team, player, training and match
    scouting tool for volleyball clubs."
  - `<meta name="robots">` = `index, follow` only when `robots: 'index'`, else `noindex, nofollow`.
  - `<link rel="canonical">` = `VITE_SITE_URL` (or `window.location.origin`) + `canonicalPath`,
    removed when no path.
  - On unmount restores title "Volley Skills", default description, `noindex, nofollow`, no canonical.
- Pages passing `index`: `/login`, `/request-access`, `/signup`, and legal pages **only when found
  and no `?v=`** (terms, dpa, subprocessors, dpia-pack, privacy). Everything else is noindex.
- `seoRoutes.ts` (build-time artefacts): `PUBLIC_ROUTES` = `/login, /privacy, /request-access,
  /signup, /legal/terms, /legal/dpa, /legal/subprocessors, /legal/dpia-pack`; `PRIVATE_PREFIXES` =
  `/teams, /exercises, /trainings, /admin, /settings, /finish-sign-in, /club, /platform, /signup/,
  /sign/, /welcome` (a trailing `/` covers only what is below it, so `/signup` stays public).
  `robots.txt` lists `Allow:` for public routes, **no `Disallow`** (so crawlers see the noindex
  header), and the sitemap link; the sitemap lists exactly the public routes; `firebase.json` must
  send `X-Robots-Tag: noindex, nofollow` for `/` and every private prefix (test reads
  `firebase.json`).
- Page titles currently set: Sign in, Signing in, Request access, Create your club, Completing
  sign-up, Not found, More, Settings, legal doc titles; feature pages set their own.
- **Tests**: `src/layout/usePageMeta.test.ts`, `src/seo/seoRoutes.test.ts`,
  `src/signup/SignupInfoPage.test.tsx`, `src/layout/NotFoundPage.test.tsx`.

### 8. AuthShell (`src/auth/AuthShell.tsx`)

- **Purpose**: the public/status frame: full-height court-blue background (fixed hex `#2356A8`, so
  it does not darken in dark mode) with decorative court lines; a `<header>` with Logo,
  `LanguageToggle` (renders nothing while Italian is off) and an optional `navAction` outlined link;
  a hero (`tagline1` "Players. Progress." / `tagline2` "Together." uppercase, and the pitch
  sentence); a decorative spiking-player + ball image (only `lg`, `aria-hidden`); and a white card
  (`max-w-sm`) with an optional centred `<h1>` title and the children.
- **Used by**: LoginPage, FinishSignInPage, RequestAccessPage, SignupInfoPage, SignCompletePage,
  ClubStatusScreen, WelcomePage, RequireSignedIn loading/error, and the "no access" denial of every
  guard.
- **Tests**: covered indirectly by the pages' tests.

### 9. LoginPage (`src/auth/LoginPage.tsx`, `/login`)

- **Who**: anyone. A signed-in person who opens `/login` is **not** redirected (no auth check on
  this page).
- **Elements**: AuthShell titled "Welcome back", navAction "Request access" (→ `/request-access`);
  form with label "Email" + email input (placeholder "coach@yourclub.com", `required`), primary
  full-width "Send sign-in link" (arrow icon); divider "or"; secondary full-width "Continue with
  Google" (Google glyph); inline error; links "Don't have access yet? Request early access"
  (→ `/request-access`) and "Create your club" (→ `/signup`); `LegalLinks` footer.
- **Actions → results**:
  - Submit: sets `auth.languageCode` to the active app locale, calls
    `sendSignInLinkToEmail(email, { url: <origin>/finish-sign-in, handleCodeInApp: true })`, saves the
    email in `localStorage.emailForSignIn`, then switches the card to **"Check your email"** with
    "We sent a sign-in link to **<email>**." and the legal links (no resend, no back).
  - Google: `signInWithPopup`; on success `navigate(takeReturnTo(), { replace: true })` (return-to
    path or `/`).
- **Validation & messages**: native `required`/`type=email`. Errors (`role="alert"`): "Could not send
  sign-in link. Please check the email address and try again." / "Could not sign in with Google.
  Please try again." Errors clear on the next attempt.
- **Meta**: title "Sign in", description "Sign in to Volley Skills, the team tool for volleyball
  clubs.", indexable, canonical `/login`.
- **Tests**: `src/auth/LoginPage.test.tsx`, `src/App.test.tsx`.

### 10. FinishSignInPage (`src/auth/FinishSignInPage.tsx`, `/finish-sign-in`)

- **Purpose**: completes an email-link sign-in, once, on mount.
- **Flow**: if the URL is not an email sign-in link → error `invalidLink`. Reads and **removes**
  `localStorage.emailForSignIn`; missing → `emailNotFound`. `signInWithEmailLink`; then consumes the
  return-to path and, if the URL has a valid `sign` nonce (32 lowercase hex), navigates
  (`replace`) to `/sign/complete?sign=<nonce>`, otherwise to the return-to path (default `/`). A
  malformed `sign` is ignored (goes to the return-to path). Sign-in failure → `linkFailed`.
- **Elements**: AuthShell titled "Volley Skills" (hard-coded, not translated); "Signing you in..."
  or the error (`role="alert"`):
  - invalidLink "This sign-in link is invalid or has expired."
  - emailNotFound "Could not find the email this link was sent to. Please request a new link from
    the same browser."
  - linkFailed "This sign-in link could not be used. Please request a new one."
- No button on the error states (no link back to `/login`).
- **Edge cases**: a stale return-to is consumed (dropped) even when the signing link wins; an
  ordinary sign-in after an abandoned signing attempt goes to its return-to path, never to
  `/sign/complete`.
- **Tests**: `src/auth/FinishSignInPage.test.tsx`.

### 11. AuthProvider / useAuth (`src/auth/AuthContext.tsx`)

- **Exposes**: `firebaseUser`, `appUser` (`{uid, email}`), `access`, `loading`, `authError`,
  `memberships` (`{clubId, role, clubName, status}[]`), `activeClubId`, `club` (live club doc),
  `role`, `isPlatformAdmin`, `droppedClub`, `switchClub(id)`.
- **On every auth change** (generation counter: an older, slower sign-in never lands):
  1. No user or no email → signed-out state (active club cleared for the API layer), loading false.
  2. Email lower-cased; `ensureUserDoc(uid, email)` (creates `users/{uid}` with email + createdAt
     if missing; no role); then in parallel `listMyMemberships(email)` (collection-group query) and
     `probePlatformAdmin(email)`.
  3. `pickActiveClub(memberships, stored vcb.activeClub)`: keep the stored club if still a non-deleted
     membership, else the first non-deleted by club name; `dropped` = a stored club was let go.
     Stores the result in `vcb.activeClub` and sets the API-layer active club id.
  4. `resolveAccess(role)`: admin → everything; member → probes `sectionAccess/{section}` reads
     (permission-denied = no access).
  5. With a club: subscribes to the club doc; **loading ends on the first club snapshot**. Each
     status change re-probes section access (latest probe wins; failures keep the previous access).
     Without a club: club null, loading false.
  6. Any failure → signed-out session state with `authError = 'Could not finish signing you in.'`
     (note: `firebaseUser` stays set).
- `switchClub(id)`: `storeClub(id)` then `window.location.reload()`.
- On sign-out the club subscription stops and the active club is cleared.
- **Tests**: `src/auth/AuthContext.test.tsx`, `src/clubs/activeClub.test.ts`, `src/auth/access.test.ts`,
  `src/auth/usersApi.test.ts`.

### 12. RequireSignedIn / RequireAuth (`src/auth/RequireAuth.tsx`)

- `RequireSignedIn`:
  - `loading` → AuthShell card with "Loading..." (full court screen, no title).
  - `authError` → AuthShell with `role="alert"`: "Something went wrong signing you in. **Try again**."
    where "Try again" is a plain `<a href="/login">` (full page load).
  - no `firebaseUser` → remembers `pathname + search` as return-to, then `<Navigate to="/login" replace>`.
  - else renders children (no club checks).
- `RequireAuth` = `RequireSignedIn` + `ClubGate`.
- **Tests**: `src/auth/RequireAuth.test.tsx`.

### 13. RequireClubAdmin, RequireSection, RequirePlatformAdmin (`src/auth/*.tsx`)

- `RequireClubAdmin` = `RequireAuth` + `access.isClubAdmin`.
- `RequireSection section` = `RequireAuth` + `access.sections[section]`.
- `RequirePlatformAdmin` = `RequireSignedIn` (no club gate, so an operator with no membership works)
  + `isPlatformAdmin`.
- Denied → AuthShell card with `role="alert"` "You don't have access to this page." (no title, no
  link). For `RequireSection`/`RequireClubAdmin` this renders **inside** AppShell's `<main>` (the
  full court-blue AuthShell appears within the app frame).
- These checks are UX only; Firestore rules are the real boundary.
- **Tests**: `src/auth/guards.test.tsx`, `src/auth/RequirePlatformAdmin.test.tsx`, `src/App.test.tsx`.

### 14. returnTo and emailLinkStorage (`src/auth/returnTo.ts`, `src/auth/emailLinkStorage.ts`)

- Return-to key `vcb.auth.returnTo` in **localStorage** (the email link may open in a new tab).
  Only same-origin app paths are kept: must start with `/` not followed by `/` or `\`, contain no
  `\`, and not start with `/login` or `/finish-sign-in`. `takeReturnTo()` reads and removes it,
  returns `/` when missing/unsafe; storage errors fall back to `/`.
- `emailForSignIn` (unprefixed, localStorage) holds the address between sending and opening the
  email link; read-and-removed on finish.
- **Tests**: `src/auth/returnTo.test.ts`, `LoginPage.test.tsx`, `FinishSignInPage.test.tsx`.

### 15. reauth (`src/auth/reauth.ts`)

- `sendSigningLink(email, nonce)`: sets `auth.languageCode` to the app locale and sends an email
  link to `/finish-sign-in?sign=<nonce>`; on success stores `emailForSignIn` only (never a
  return-to). On failure stores nothing and rejects.
- `currentAuthTime(user)`: `auth_time` claim from a force-refreshed token.
- `signingWindowOpen(authTime, now)`: true when less than **14 minutes** since `auth_time` (rules
  allow 15).
- **Tests**: `src/auth/reauth.test.ts`.

### 16. Sign-out (`src/auth/useSignOut.tsx`, `src/firebase/signOut.ts`)

- `useSignOut()` returns `{ signOut, unsyncedDialog }`; every sign-out button in the app uses it
  (AppShell account menu, MorePage, MinimalShell, WelcomePage, ClubStatusScreen, SignCompletePage).
- `signOutAndClearLocalData({ force })`:
  1. Unless `force`, waits up to **1.5 s** for pending Firestore writes; if still pending returns
     `'unsynced'` without signing out → the hook shows a `ConfirmDialog` "Unsynced scouting actions" /
     "Some scouting actions haven't synced yet. Sign out anyway? They will be lost." / confirm
     "Sign out anyway" (Cancel closes it). Confirm re-runs with `force: true`.
  2. Before signing out: clears AI local data (`vcb.ai.settings`, `vcb.ai.sessionKey`, every
     `vcb.textDraft.*`), `vcb.activeClub`, and `vcb.signDraft`.
  3. Firebase sign-out, terminate Firestore and clear its IndexedDB cache (errors ignored, e.g.
     another tab holds it).
  4. Full page navigation to `/login` (`window.location.assign`).
- Not cleared on sign-out: `theme`, `vcb.locale`, `vcb.schemaVersion`, `vcb.legalNoticeDismissed.*`
  (sessionStorage), other feature keys.
- **Tests**: `src/auth/useSignOut.test.tsx`, `src/firebase/signOut.test.ts`, `AppShell.test.tsx`.

### 17. ClubGate (`src/clubs/ClubGate.tsx`, inside every `RequireAuth`)

Decides from `clubView(club, role, now)` (`src/clubs/clubView.ts`, same strict comparisons as the
rules) what a signed-in person sees:

| Club state | Admin | Member |
|---|---|---|
| no active club, or status `deleted` | Welcome page | Welcome page |
| `pending` | Pending screen | Pending screen |
| `active` | app (legal review check below) | app |
| `terminating`, now < `effectiveAt` (or no `effectiveAt`) | app + contract-ending banner (legal review check applies) | app + banner |
| `suspended` | **restricted club area** (`MinimalShell` + `ClubAreaPage restricted`) | Locked screen |
| `terminating`, `effectiveAt` ≤ now < `retrievalEndsAt` | restricted club area | Locked screen |
| `terminating`, now ≥ `retrievalEndsAt` (or no `retrievalEndsAt`) | **Ended** screen | Ended screen |

- Locked vs ended: in the `locked` view the screen is `ended` when the club is `terminating` and
  the retrieval window is over or missing; otherwise `locked` (so a suspended club is always
  "locked").
- **Legal review** (only in the app/ending views): if `role === 'admin'` and
  `needsReview(club.legal, now)` (no acceptance, unparsable key, or a *material* Terms/DPA version
  in force that is newer than the accepted one):
  - if the club has already requested termination (`termination.requestedAt`), the app renders with
    a `role="status"` orange strip above it: "Your club ended the contract instead of accepting the
    updated terms. The terms you accepted apply until it ends.";
  - otherwise the blocking `LegalReviewScreen` replaces the app.
  - Members are never blocked. A club admin who is also the platform operator gets the same screen.
- **Live behaviour**: the club doc is subscribed, so a status change switches screens in open tabs.
  A timer (`nextBoundaryDelay`) re-renders exactly when `effectiveAt` / `retrievalEndsAt` passes,
  clamped to `setTimeout`'s max (~24.8 days) and rescheduled, so a boundary 60 days away still flips.
- Restricted area details (owned by the club-area inventory): opens on the **Contract** tab, the
  People & access tab is hidden, Profile inputs are disabled.
- **Tests**: `src/clubs/ClubGate.test.tsx`, `src/clubs/clubView.test.ts`,
  `src/clubs/nextBoundary.test.ts`, `src/auth/RequireAuth.test.tsx`.

### 18. ClubStatusScreen (`src/clubs/ClubStatusScreen.tsx`)

- AuthShell card; `kind` ∈ `pending | locked | ended` (club name falls back to "Your club"):
  - pending: title "Your club is waiting for activation", body "<club> has been set up and will be
    available as soon as it is activated.", then "We'll email you when it's active." and, when the
    club has an acceptance, "Accepted: Terms of Service <v> and Data Processing Agreement <v>" with
    links to `/legal/terms?v=<v>` and `/legal/dpa?v=<v>`.
  - locked: "Your club's access is paused" / "Access to <club> is paused for now. Contact your club
    admin to find out more."
  - ended: "Your club's contract has ended" / "The contract for <club> has ended and its data is no
    longer available."
- Buttons: one primary "Switch to <club>" per other usable club (→ reload), then secondary
  "Sign out".
- **Tests**: `src/clubs/ClubStatusScreen.test.tsx`, `RequireAuth.test.tsx`, `ClubGate.test.tsx`.

### 19. WelcomePage (`src/clubs/WelcomePage.tsx`, rendered by ClubGate at any URL; there is no `/welcome` route)

- AuthShell titled "Welcome to Volley Skills".
- Body: if the person has another usable club: "You no longer have access to this club."; else
  "Ask your club admin to add <email> to your club, then sign in again." (email from `appUser` or
  `firebaseUser`).
- Buttons/links: platform operator → navy link "Open the platform page" (`/platform`); everyone else →
  outlined link "Create a club" (`/signup/club`); primary "Switch to <club>" per other usable club;
  secondary "Sign out".
- **Tests**: `src/clubs/WelcomePage.test.tsx`, `RequireAuth.test.tsx`.

### 20. ContractEndingBanner (`src/clubs/ContractEndingBanner.tsx`, top of AppShell content)

- Only when `club.status === 'terminating'` and `effectiveAt` is set. `role="status"`, orange strip,
  `print:hidden`.
- Admin with a `retrievalEndsAt`: "Your contract ends on <long date>. Export your data before
  <long date>." Otherwise: "Your club's contract ends on <long date>."
- Not dismissible. Dates via `formatDateValue(d, 'long')` in the app locale.
- **Tests**: `AppShell.test.tsx` ("club state").

### 21. activeClub and useClubFeatures (`src/clubs/activeClub.ts`, `src/clubs/useClubFeatures.ts`)

- `vcb.activeClub` (localStorage) holds the chosen club id; storage errors are swallowed (the choice
  lasts for the page). `otherUsableClubs` excludes deleted clubs and the active one.
- `useClubFeatures()` → `{ aiEnabled, growthTestsEnabled }` from the club doc; both false without a
  club. Settings hides the AI section when `aiEnabled` is false (other features documented in
  their own areas).
- **Tests**: `activeClub.test.ts`, `useClubFeatures.test.ts`.

### 22. LegalReviewScreen (`src/legal/LegalReviewScreen.tsx`, rendered by ClubGate)

- **Who**: club admins whose club needs a (re-)acceptance and has not requested termination.
- **Frame**: `MinimalShell` titled with the club name (fallback "Club").
- **Elements**: `h1` "Accept the Terms and DPA" (no acceptance yet) or "Review the updated Terms and
  DPA" (an older version accepted); a bullet list with the in-force Terms and DPA version summaries
  (Italian summaries when the app locale is `it` and they exist). Three steps, **no step indicator**:
  1. Form (`noValidate`): "Your name" input (`autocomplete=name`) and checkbox "I am authorised to
     act for this club and accept these terms on its behalf"; "Next".
  2. `DocumentsStep` + ghost "Back".
  3. `SpecificApprovalStep` + ghost "Back".
  Then secondary "Switch to <club>" buttons for other usable clubs, and, when the club is `active`
  or `suspended` and has not requested termination, a "Don't agree?" section with destructive
  "End our contract".
- **Actions → results**:
  - Next (step 1): validates name 1–100 trimmed characters ("Enter your name (1 to 100 characters).")
    and authority ("Confirm that you are authorised to act for this club."); errors are
    `role="alert"` with `aria-invalid` / `aria-describedby` on the fields; both shown at once.
  - Step 3 send: saves a `reaccept` sign draft (`vcb.signDraft`: club id, lower-cased email, trimmed
    name, the three versions **frozen at mount**, legal language, timestamp, nonce generated once
    per visit) then sends the signing link. After opening the link, `/sign/complete` commits.
  - End our contract → ConfirmDialog "End your club's contract?" / "We'll be told you want to leave.
    Your club keeps full use and a window to export your data until the end date we confirm." /
    confirm "Request end of contract". Confirm writes `termination.requestedAt/requestedBy` on the
    club; success closes the dialog and notifies "End of contract requested" (the live club update
    then lets the admin into the app with the "ended the contract instead" strip). Failure shows the
    inline error "Couldn't send the request. Try again." inside the dialog; Cancel clears it.
- **Edge cases**: legal document language is independent of app language (defaults to the browser
  language if it is one of en/it/fr/de/es, else en).
- **Tests**: `src/legal/LegalReviewScreen.test.tsx`, `src/legal/LegalReviewScreenItalian.test.tsx`,
  `ClubGate.test.tsx`.

### 23. LegalNoticeBanner (`src/legal/LegalNoticeBanner.tsx`, top of AppShell content)

- **Who**: club admins only (`role === 'admin'`); rendered only inside AppShell.
- One `role="status"` blue strip per upcoming version (announced, not yet effective), `print:hidden`:
  - Terms: "Updated Terms of Service take effect on <long date> — **review**" (link to
    `/legal/terms?v=<v>`; accessible name "review the Terms of Service").
  - DPA: "Updated Data Processing Agreement takes effect on <date> — review" (→ `/legal/dpa?v=<v>`).
  - Sub-processors: "The sub-processor list changes on <date>. You can object within 15 days of this
    notice." + "See the list" (→ `/legal/subprocessors?v=<v>`) · "Contact the operator" (`mailto:`).
- Each strip has a "×" button (`aria-label="Dismiss"`); dismissal is stored per document+version in
  **sessionStorage** `vcb.legalNoticeDismissed.<doc>.<version>` = `1` (so it returns in a new
  session); blocked storage still hides it for the current render tree.
- **Tests**: `src/legal/LegalNoticeBanner.test.tsx`.

### 24. LegalDocPage, PrivacyPage, LegalDocView (`src/legal/LegalDocPage.tsx`, `/legal/:doc`, `/privacy`)

- **Who**: public (signed in or not).
- **Frame**: own page: navy `<header>` with Logo, `LanguageToggle`, and "Back to the app" (→ `/`) when
  signed in or "Sign in" (→ `/login`) when not; `<main>` `max-w-2xl`; `LegalLinks` at the bottom.
- **Content**: `LegalLangSwitcher`; a version line for versioned docs (terms, dpa, subprocessors) or
  when `?v=` is given: "Version <v>, in force since <date>" (no `?v`, date formatted with
  `Intl.DateTimeFormat`, `en-GB` for English, UTC) or "Version <v>"; then the Markdown text in a
  container with `lang=<legal lang>`.
- **Query params**: `?v=<version>` picks a version (else the version in force today; privacy and
  dpia-pack use a fixed current version); `?lang=` picks en/it/fr/de/es (else browser language, else
  en). Changing language rewrites `?lang` with `replace` (no new history entry).
- **Not found** (unknown doc, unknown version, or missing text): `h1` "Not found" + "We could not find
  that legal text.", noindex.
- **Meta**: title = document title ("Terms of Service", "Data Processing Agreement",
  "Sub-processors", "Privacy", "DPIA pack"), description "<title> of Volley Skills.", indexable with
  canonical `/legal/<doc>` or `/privacy` only when found and no `?v`.
- `PrivacyPage` = `LegalDocView doc="privacy" canonicalPath="/privacy"` (its h1 is "Privacy notice",
  from the Markdown).
- **Tests**: `src/legal/LegalDocPage.test.tsx`, `src/legal/PrivacyPage.test.tsx`, `App.test.tsx`.

### 25. LegalLangSwitcher (`src/legal/LegalLangSwitcher.tsx`)

- `role="group"` labelled "Language of the legal text"; five toggle buttons with endonyms (English,
  Italiano, Français, Deutsch, Español), each with `lang=<code>` and `aria-pressed` for the current
  one. Always shows all five, independent of `ITALIAN_ENABLED`.
- **Tests**: `LegalDocPage.test.tsx`, `DocumentsStep.test.tsx`, `LegalReviewScreenItalian.test.tsx`.

### 26. LegalLinks (`src/legal/LegalLinks.tsx`)

- `<nav aria-label="Legal">` footer: Terms (`/legal/terms`), DPA (`/legal/dpa`), Sub-processors,
  Privacy (`/privacy`), DPIA pack (`/legal/dpia-pack`), and "Report content" (`mailto:` operator
  contact; promised by Terms T24).
- Shown on LoginPage (both states), RequestAccessPage (form state), SignupInfoPage, legal pages.
- **Tests**: `LegalDocPage.test.tsx`, `PrivacyPage.test.tsx`.

### 27. LegalMarkdown (`src/legal/LegalMarkdown.tsx`)

- Builds React elements only (no raw HTML). Supports `#`/`##`/`###`, paragraphs, `-`/`1.` lists,
  `**bold**`, `` `code` ``, links, `>` quotes (orange callout box), `|` tables (`th scope="col"`).
- Level-2 clause headings `## T12. …` / `## D5. …` get `id="t12"` / `id="d5"` (deep-linkable).
- Links: `/…` → router `Link`; `https://…` → new tab with `rel="noopener noreferrer"`; `mailto:` →
  plain anchor; anything else (`javascript:`, `//`, `http:`) renders as plain text.
- **Tests**: `src/legal/LegalMarkdown.test.tsx`.

### 28. SignupInfoPage (`src/signup/SignupInfoPage.tsx`, `/signup`)

- Public. AuthShell titled "Create your club", navAction "Sign in" (→ `/login`).
- Ordered list: "Sign in with your email." / "Enter your club's details." / "Read and accept the Terms
  of Service and the Data Processing Agreement." / "Confirm the clauses that need a specific approval
  through a link we email you."; note "We activate new clubs by hand, and we'll email you when yours is
  ready."; full-width navy link "Start" → `/signup/club` (signed-out visitors are sent to `/login`
  with `/signup/club` remembered as return-to); `LegalLinks`.
- Indexable, canonical `/signup`, description "Set up your volleyball club on Volley Skills."
- **Tests**: `src/signup/SignupInfoPage.test.tsx`.

### 29. SignupPage (`src/signup/SignupPage.tsx`, `/signup/club`)

- **Who**: any signed-in person (no club gate). Frame: MinimalShell "Create your club" with
  `LanguageToggle`.
- **If any membership has status `pending`**: only "You already have a club waiting for activation"
  and "We'll email you when it's active." (no form). Members of active clubs may create another club.
- **Elements**: "Step N of 3" line, `h1` per step: "Your club" / "Terms and data processing" /
  "Specific approval".
  - Step 1 form (`noValidate`): "Club name" (input, `maxLength=120`), "Country" (select with
    placeholder "Select a country"; 36 codes: EU-27 + GB, CH, NO, IS, US, CA, MX, BR, AR; option text
    from `Intl.DisplayNames` in the app locale, order sorted by English name), "Club language"
    (English; "Italiano" only when `ITALIAN_ENABLED`), "Your name" (`autocomplete=name`), authority
    checkbox; primary "Next".
  - Step 2: `DocumentsStep` + ghost "Back" (to step 1).
  - Step 3: `SpecificApprovalStep` + ghost "Back" (to step 2).
- **Validation** (all errors at once, `role="alert"`, `aria-invalid`, `aria-describedby`):
  club name 2–80 trimmed ("Enter a club name of 2 to 80 characters."); country in the list ("Choose a
  country."); name 1–100 ("Enter your name (1 to 100 characters)."); authority ("Confirm that you are
  authorised to act for this club.").
- **Send** (step 3): club id is generated once per attempt (a Firestore auto id), nonce once per
  visit; saves a `signup` draft to `vcb.signDraft` (club name trimmed, country, locale, lower-cased
  email, trimmed name, versions frozen at mount, legal language, savedAt, nonce) and sends the signing
  link. Re-sending reuses the same club id and nonce (never a second club).
- Form state is lost on reload (not persisted until the send step) — inferred from code.
- **Tests**: `src/signup/SignupPage.test.tsx`, `src/signup/SignupPageItalian.test.tsx`.

### 30. DocumentsStep (`src/signup/DocumentsStep.tsx`, used by SignupPage and LegalReviewScreen)

- `LegalLangSwitcher` at top; then for Terms and DPA a block with `h3` title, an "Open in a new tab"
  link (`/legal/<doc>?v=<v>&lang=<lang>`, `target=_blank`, sr-only "(<title>)"), a scrollable
  focusable `role="region"` (named by the title, `tabIndex=0`, `lang=<lang>`, max ~18 rem tall) with
  the full text, and a checkbox "I have read and accept the <title>".
- **Rules**: each checkbox is **disabled until its document is read**: scrolled to within 8 px of the
  end, or its "Open in a new tab" link clicked. While disabled, a hint "Scroll to the end of the text,
  or open it in a new tab, to enable this box." is shown and linked by `aria-describedby`.
  Changing the legal language resets read and accepted state for both documents. "The list of
  Sub-processors is part of what you accept." links to `/legal/subprocessors?lang=<lang>` (new tab).
  "Next" is disabled until both boxes are ticked.
- **Tests**: `src/signup/DocumentsStep.test.tsx`.

### 31. SpecificApprovalStep (`src/signup/SpecificApprovalStep.tsx`)

- Intro "These clauses limit liability, set how the service can change or end, or decide how disputes
  are handled. Each one needs your specific approval."; the 13 clauses in order (T2, T8, T9, T11,
  T12, T13, T14, T15, T20, T21, D5, D9, D11), each an `<article>` with `h3` "<id>. <heading>" and the
  clause text extracted from the documents (never copied), in the legal language.
- Primary "Approve these clauses specifically": disabled while sending; on success replaced by
  `role="status"` "We've sent a confirmation link to <email>. Open it in this browser to sign.";
  on failure the button returns and `role="alert"` "Could not send the confirmation link. Please try
  again." appears.
- The texts hashed into the acceptance record are exactly the strings these screens render
  (`buildAcceptance` hashes `legalText` and the clause texts), so the rendered source text must stay
  the same strings.
- **Tests**: `src/signup/SpecificApprovalStep.test.tsx`, `src/legal/acceptance.test.ts`.

### 32. SignCompletePage (`src/signup/SignCompletePage.tsx`, `/sign/complete?sign=<nonce>`)

- Signed in required. AuthShell titled "Completing sign-up"; meta title same.
- On mount (exactly once, even under StrictMode) calls `commitSignDraft(nonce)`:
  - no/expired/malformed draft → `noDraft`; nonce ≠ draft nonce → `wrongLink`; signed-in email ≠ draft
    email → `wrongAccount`; `auth_time` older than 14 min → `linkExpired`; otherwise one batch:
    sign-up = pending club doc + own admin member doc + acceptance; re-acceptance = acceptance + club
    `legal` update. A `permission-denied` retry whose acceptance already exists by this email counts as
    `alreadyDone`. On done/alreadyDone the draft is removed and, for a sign-up, `vcb.activeClub` is set
    to the new club.
  - Uses `auth.currentUser` at commit time, never the context user.
- **Views**:
  - working: `role="status"` "Completing your sign-up...".
  - done / alreadyDone: full navigation to `/` (`window.location.assign`), so memberships reload (a
    new club then shows its pending screen).
  - linkExpired: "The link is older than 15 minutes. Send a new link to confirm again." + primary
    "Send a new link" (disabled while sending; re-reads the draft, sends to its email with the same
    nonce → `role="status"` "We've sent a new link. Open it in this browser to sign."; no draft →
    noDraft view; failure → `role="alert"` "Could not send a new link. Please try again.").
  - noDraft: "There is no signing in progress in this browser. If you started in another browser, open
    the link there." (also what a second visit after success shows).
  - wrongLink: "This link doesn't match the signing in progress in this browser. Open the latest link we
    sent you."
  - wrongAccount: "Signed in as another account than the one that started this sign-up. Sign out and use
    the link again." + secondary "Sign out".
  - error: `role="alert"` "We could not complete the sign-up. Please try again." + primary "Try again"
    (re-runs the commit).
- **Tests**: `src/signup/SignCompletePage.test.tsx`, `src/signup/signingApi.test.ts`,
  `src/legal/signDraft.test.ts`.

### 33. RequestAccessPage (`src/interest/RequestAccessPage.tsx`, `/request-access`)

- Public. AuthShell titled "Let's get you set up", navAction "Sign in".
- Intro "Tell us a bit about you and we'll reach out when your access is ready."; form: "Name"
  (required, placeholder "Jamie Smith"), "Email" (type email, required, placeholder
  "you@example.com"), "I am a..." select (Coach default, Guardian, Player, Other); privacy note
  ("We use your name and email only to review this request … If you are under 16, ask a parent or
  guardian … See the privacy policy." with link to `/privacy`); primary full-width "Request access"
  (disabled while submitting); "Already have access? Sign in" (→ `/login`); `LegalLinks`.
- Submit writes `interestSignups/{auto}` `{ name (trimmed), email (trimmed), role, reviewed: false,
  createdAt }`. Success → card "Thanks!" / "We've got your request and will be in touch about early
  access." / "Back to sign in". Failure → `role="alert"` "Could not submit your request. Please try
  again."
- Indexable, canonical `/request-access`.
- **Tests**: `src/interest/RequestAccessPage.test.tsx`.

### 34. SettingsPage and SettingsSection (`src/settings/SettingsPage.tsx`, `/settings`)

- Personal settings only: no page links that duplicate the navigation and no sign-out button (the test
  asserts both).
- `PageHeader` "Settings"; sections (each `SettingsSection`: card with `h2` title + description,
  stacked on phones, a 3-column grid from `lg` with title/description left and controls right):
  1. **Appearance** "Switch between light and dark mode." → `ThemeToggle` (full width on phones).
  2. **Language** (only when `ITALIAN_ENABLED`).
  3. **AI provider** (only when the club has `aiEnabled`).
- **Tests**: `src/settings/SettingsPage.test.tsx`.

### 35. ThemeToggle and theme (`src/theme/*`, `public/theme-init.js`)

- Storage key **`theme`** (unprefixed) in localStorage: `light` | `dark`. Initial theme = stored value,
  else system `prefers-color-scheme`. Invalid stored values are ignored.
- `applyTheme` toggles the `dark` class on `<html>`, persists, and fires `theme-changed` on `window`
  when it actually changes; every `useTheme` instance follows that event.
- `theme-init.js` applies the class before first paint (no flash).
- Button shows the **next** action: Moon + "Dark mode" when light, Sun + "Light mode" when dark;
  `compact` hides the text visually (sr-only).
- All colours are CSS variables per theme (`src/index.css`); components never use `dark:` variants.
  `color-scheme` is set per theme for native controls.
- **Tests**: `src/theme/theme.test.ts`, `src/theme/ThemeToggle.test.tsx`, `src/theme/contrast.test.ts`.

### 36. Language: I18nProvider, LanguageSettings, LanguageToggle (`src/i18n/*`, `src/settings/LanguageSettings.tsx`)

- Locales `en` and `it`. **`ITALIAN_ENABLED = false`**: while off the resolved locale is always `en`
  (except dev `?lang=it` in a dev build). Resolution order when on: stored `vcb.locale` → club
  `locale` → any browser language starting with `it` → `en`. Unknown values are ignored.
- The Italian catalog is lazy-loaded; English stays on screen until it arrives; `getT()`/`getLocale()`
  (non-component code) follow the catalog actually shown. `<html lang>` follows the chosen locale
  (`locale-init.js` sets it before paint from `vcb.locale`).
- `setLocale` writes `vcb.locale` and re-renders immediately (no reload).
- `LanguageSettings` (Settings card "Language" / "The language of the app. It applies at once on this
  device.", select with sr-only label "Language": English / Italiano) and `LanguageToggle` (EN/IT
  pressed-buttons group "App language" on public frames) both render **nothing** while Italian is off.
  `LanguageToggle` drives app chrome only, never the legal text language.
- Dates are never formatted with the browser locale outside `src/i18n` (test-enforced).
- **Tests**: `src/i18n/I18nProvider.test.tsx`, `src/i18n/locales.test.ts`,
  `src/settings/LanguageSettings.test.tsx`, `src/settings/LanguageSettingsOff.test.tsx`,
  `src/i18n/noBrowserLocale.test.ts`, `src/i18n/italian.smoke.test.tsx`.

### 37. AiProviderSettings (`src/settings/AiProviderSettings.tsx`)

- **Who**: anyone in a club with `aiEnabled`.
- **Elements**: "Provider" select (`aria-label="AI provider"`: Groq default, OpenRouter, Local, Custom);
  "Model" input (provider placeholder; for OpenRouter a "Free models" link to
  `openrouter.ai/models?max_price=0`); "Base URL" input only for Local and Custom; for providers that
  need a key: "API key" password input with a show/hide eye button (`aria-label` "Show API key" /
  "Hide API key", `aria-pressed`), "Get a key" link (Groq/OpenRouter consoles, new tab,
  `noopener noreferrer`), checkbox "Remember on this device" (default **off**), ghost "Forget key"
  (disabled with no key). Then the provider note, the DPA note (key providers only), "With your own
  key, the AI provider you choose works for your club, not for us.", the privacy line with a "What's
  sent" link to `/privacy`, a polite live line, and secondary "Test connection" + result.
- **Actions → results**:
  - Every change is saved immediately (no Save button) and the live line shows "Saved on this device".
  - Changing provider resets base URL and model to that provider's defaults and **clears the key**.
  - Key storage: remember on → whole settings incl. key in localStorage `vcb.ai.settings`; off →
    settings without key in `vcb.ai.settings`, key in sessionStorage `vcb.ai.sessionKey`. Legacy
    settings without `rememberKey` are read as remembering.
  - Forget key: clears the key from both storages and notifies "API key removed from this device."
  - Test connection (disabled while testing): `role="status"` "Testing…", then green check
    "Connected — AI features are ready." or red warning with the mapped error: rate limit "<Provider>
    rate limit reached — try again in a moment."; unreachable "Could not reach the provider." plus the
    "Is Ollama / LM Studio running…" hint only for Local; unauthorized "Key rejected — check it in your
    provider account."; others from the catalog; non-AiError "Connection failed."
- **Tests**: `src/settings/AiProviderSettings.test.tsx`, `src/ai/aiSettings.test.ts`.

### 38. Button (`src/components/Button.tsx`)

- Real `<button>`, `type="button"` by default (forwardRef; all native props pass through).
- Variants: `primary` (navy fill), `secondary` (blue outline on surface), `ghost` (blue text),
  `dangerGhost` (red text, row-level delete/remove), `destructive` (red fill, confirm / danger zone).
- Sizes: `sm` and `md` keep a **44 px minimum height** (touch target); `icon` is a 36 px square for
  dense desktop toolbars.
- Always pointer cursor and a 2 px blue `:focus-visible` ring; disabled = not-allowed cursor + 50 %
  opacity.
- **Tests**: `src/components/Button.test.tsx`.

### 39. Input / Textarea / FIELD_CLASS (`src/components/Input.tsx`)

- Thin wrappers over native elements with the shared field class (border, surface, blue focus ring,
  `min-w-0` so fields shrink in flex rows); default `w-full`.
- Fields must never use text under 16 px on phones (iOS focus zoom); `text-sm` only with an `sm:`
  breakpoint (test scans every `.tsx`).
- **Tests**: `src/theme/formFieldSize.test.ts`.

### 40. Dialog (`src/components/Dialog.tsx`)

- Modal: backdrop (`data-testid="dialog-backdrop"`, black/50, z-50) + panel `role="dialog"`,
  `aria-modal="true"`, `aria-label=<title>`, `tabIndex=-1`. Header with `h2` title (truncated) and a
  close button `aria-label="Close"` (44 px on phones, 36 px from `sm`); scrollable body; optional
  pinned `footer` (for Save/Cancel; forms wire submit via the `form` attribute).
- Sizes `md` (max-w-md) / `lg` (max-w-2xl); `mobileSheet` fills the viewport edge-to-edge below `sm`
  (safe-area insets respected) and is a centred card from `sm`.
- **Behaviour**:
  - Focuses the panel once on mount (not on re-render, so typing focus is never stolen).
  - Escape, backdrop click and the close button all call "request close"; clicks inside the panel do
    not close.
  - `dirty` (or `guardUnsaved` + any `change` event bubbling from body/footer) turns request close into
    a nested ConfirmDialog "Discard changes?" / "Your changes haven't been saved." / "Discard";
    Escape then closes only the confirm (top layer). Explicit Cancel buttons call `onClose` directly.
  - Through `useModalLayer`: Tab/Shift+Tab wrap inside the panel; body scroll locked; focus returns to
    the opener on close.
- **Tests**: `src/components/Dialog.test.tsx`.

### 41. ConfirmDialog (`src/components/ConfirmDialog.tsx`)

- `role="alertdialog"`, `aria-modal`, `aria-label=<title>`, z-60 (above Dialog). `h2` title, message,
  ghost "Cancel" and destructive confirm button; optional inline `error` (`role="alert"`) below.
- **Initial focus on Cancel** (the safe choice). Escape = Cancel (topmost layer only). Tab is trapped,
  focus returns to the opener. **Backdrop click does nothing** (no handler).
- **Tests**: via `Dialog.test.tsx`, `AppShell.test.tsx`, `LegalReviewScreen.test.tsx`.

### 42. useModalLayer (`src/components/useModalLayer.ts`)

- A global stack of open layers: only the **topmost** reacts to Escape and Tab; `document.body` overflow
  is hidden while any layer is open and restored when the last closes; given a panel ref, Tab wraps
  first↔last focusable (focus goes to the panel if it has none); on unmount focus returns to the element
  focused before the layer opened (if still connected). The opener is captured during first render.
- Listens on `window` keydown.
- **Tests**: `Dialog.test.tsx` (stacking, trap, focus return).

### 43. Menu (`src/components/Menu.tsx`)

- WAI-ARIA menu button: trigger `<button aria-haspopup="menu" aria-expanded aria-controls>` with
  `aria-label=<label>`; popup `role="menu"` with the same label; items `role="menuitem"` (optional icon,
  `danger` = red-strong text, optional `hint`), `role="menuitemcheckbox"` with `aria-checked` and a check
  mark, and `role="separator"` dividers. Items are `tabIndex=-1` (roving by arrows).
- **Behaviour**: click toggles; on open the first item is focused; ArrowDown/ArrowUp cycle (wrap), Home/End
  jump; Escape closes and refocuses the trigger (and stops propagation so a surrounding modal stays open);
  Tab closes without refocus; pointer-down outside closes; choosing an item closes, refocuses the trigger,
  then runs it. `align` start/end, `placement` down/up (up used in the sidebar footer). Minimum item height
  44 px.
- **Tests**: `src/components/Menu.test.tsx`.

### 44. Notice / useNotify (`src/components/Notice.tsx`)

- The only success-feedback mechanism. `useNotify()(message, { durationMs? })`; outside the provider it is
  a no-op.
- A `role="status" aria-live="polite"` region is **always mounted** (so every message is announced),
  fixed bottom-centre, above the phone bottom bar (`bottom-20`; `lg:bottom-6`), `print:hidden`, not
  blocking clicks except on the toast itself.
- One message at a time: a new message replaces the current one and restarts the timer (default 4 s);
  dismiss button `aria-label="Dismiss"`; timer cleared on unmount. Dark toast with green check icon.
- Errors are never toasts; they stay inline with `role="alert"`.
- **Tests**: `src/components/Notice.test.tsx`.

### 45. SectionTabs and Tab (`src/components/SectionTabs.tsx`, `src/components/Tab.tsx`)

- `SectionTabs`: below `sm` a full-width native `<select>` (sr-only `<label>` = `label`, so it is a
  combobox with that name) with a chevron; from `sm` a `role="tablist"` (`aria-label=label`) of `Tab`s.
  Same sections, same order, both call `onChange(id)`.
- `Tab`: `<button role="tab" aria-selected>`; active = blue underline/text, inactive slate. They switch
  panels in place (tabs, not navigation: no `aria-current`). No arrow-key roving, no `aria-controls` /
  `tabpanel` wiring today.
- Used by club area, platform page, player card, team page (which also hides it in print).
- **Tests**: `src/components/SectionTabs.test.tsx`, `src/components/Tab.test.tsx`.

### 46. PageSkeleton (`src/components/Skeleton.tsx`)

- `role="status"` with an sr-only `label`; layouts `player`, `team`, `match` approximating the coming
  page; blocks are `aria-hidden` and pulse only with `motion-safe`.
- Used by HomePage, TeamPage, MatchPage, PlayerCardPage.
- **Tests**: `src/components/Skeleton.test.tsx`.

### 47. StatTile (`src/components/StatTile.tsx`)

- Flat card (border, no shadow): uppercase small label above, big `text-stat` extrabold `tabular-nums`
  value (truncated, no wrap), optional hint; optional native `title`; `break-inside-avoid` for print.
- Used by player KPI tiles, team stats, bulk import.

### 48. LevelPill (`src/components/LevelPill.tsx`)

- Pill with the localised level label (gendered via `gender`, default `mixed`): Beginner red, Developing
  orange, Advanced blue, Elite green, always tint background + `-strong` text; `null` → "—" muted.
- **Tests**: `src/theme/contrast.test.ts` (classes).

### 49. SkillMeter (`src/components/SkillMeter.tsx`)

- `role="meter"`, `aria-valuemin=1`, `aria-valuemax=10`, `aria-valuenow=score` (absent when null).
  Ten segments; filled count = score; filled colour by band (<4 red, <6 orange, <8 blue, else green);
  unfilled = neutral border; visual gaps after segments 3, 5, 7.
- `suggested`: segments a higher suggestion would add are pulsing green ghosts (`data-ghost="up"`);
  segments a lower one would remove get a pulsing orange border (`down`); pulse only `motion-safe`.
- **Tests**: `src/components/SkillMeter.test.tsx`.

### 50. StatusChip (`src/components/StatusChip.tsx`)

- `STATUS_OPTIONS` order: Not started, In progress, Active, Attention, Completed. Chips: Active green tint,
  In progress blue tint, Completed **solid self-inverting** (`bg-ink text-bg`), Not started muted,
  Attention orange tint. Label always shown (never colour alone).
- **Tests**: `src/components/StatusChip.test.tsx`.

### 51. InfoTooltip (`src/components/InfoTooltip.tsx`)

- ⓘ button with `aria-label=<label>`; opens on hover (wrapper mouseenter/leave) or keyboard focus,
  closes on blur/leave; `aria-describedby` points to the panel while open. The panel (`role="tooltip"`)
  is portalled to `<body>`, fixed-positioned below the trigger, flipped above when there is no room,
  clamped 8 px inside the viewport, max width 256 px, `pointer-events-none`.
- No tap-to-toggle; whether touch users can open it depends on the browser focusing the button on tap
  (inference).

### 52. HealthHint (`src/components/HealthHint.tsx`)

- Caption "Don't record health, injury or medical information." with an optional `id` the caller wires via
  `aria-describedby` to free-text fields.
- **Tests**: `src/components/HealthHint.test.tsx`.

### 53. EditButton (`src/components/EditButton.tsx`)

- Small pencil + label button (default "Edit"; specific labels when several are near each other), blue,
  focus ring.
- **Tests**: `src/components/EditButton.test.tsx`.

### 54. useSave (`src/components/useSave.ts`)

- One save at a time: a second `save()` while one is in flight returns `false` without writing (no double
  submit). `saving` reflects in-flight state. Write errors are rethrown (form shows its inline message) and a
  later try is allowed.
- Offline: default `queue` starts the write and resolves `true` immediately (Firestore cache syncs later);
  `offline: 'block'` throws `OfflineError` before writing (for transactions / returned ids).
- **Tests**: `src/components/useSave.test.tsx`.

### 55. NotFoundState (`src/components/NotFoundState.tsx`)

- In-page "not found" for a missing/unreadable record: icon (or custom illustration), `h1` (`tabIndex=-1`),
  optional message, a primary link back (`backTo`/`backLabel`). If the person has other usable clubs:
  "This may belong to another of your clubs." + secondary "Switch to <club>" buttons.
- `isNotFoundError(e)`: `permission-denied` **and** `not-found` both count as not found (existence is not
  leaked).
- **Tests**: `src/components/NotFoundState.test.tsx`.

### 56. Logo and small helpers (`src/components/Logo.tsx`, `CodeBlock.tsx`, `AttemptsInput.tsx`, `useMediaQuery.ts`, `useDebouncedValue.ts`)

- `Logo`: fixed SVG lockup for navy surfaces (`alt="Volley Skills"`), sized in `em` via a text-size class;
  never theme-tinted.
- `CodeBlock` (used by bulk import / AI drafting areas): language label + copy button; states "Copy code" →
  "Copied" / "Copy failed" (polite live text), reset after 2 s.
- `AttemptsInput` (physical tests): numbered number inputs "<label> N", "+ Add attempt" while below
  `maxCount`, "Remove last attempt" while above `minCount`.
- `useMediaQuery(query, fallback=true)`: used where layouts differ structurally (calendar ≥ 768 px, diagram
  editor and scouting ≥ 1024 px, trend chart ≥ 640 px).
- `useDebouncedValue`: delays free-text filters before querying.
- `DevelopmentPlanEditor` also lives in `src/components/` but belongs to the player-card inventory.
- **Tests**: `CodeBlock.test.tsx`, `AttemptsInput.test.tsx`, `useDebouncedValue.test.ts`.

### 57. schemaVersion startup reset (`src/firebase/schemaVersion.ts`)

- Before React mounts: if `localStorage['vcb.schemaVersion']` ≠ `'2'`, clears the Firestore IndexedDB cache
  (pre-club-platform cache) then stores `'2'`. Gives up after 3 s (another tab holding the database) and
  retries on a later load; blocked storage → does nothing.
- **User-visible effect**: on the first load after the migration the first paint can be delayed up to ~3 s
  (blank page, no spinner); other open tabs' Firestore shuts down until reloaded; if a frozen tab holds the
  database the app renders but its data calls wait until that tab closes.
- **Tests**: `src/firebase/schemaVersion.test.ts`.

### 58. Print styles (`src/index.css`)

- `@media print`: **every `header`, `nav`, `footer` is hidden** (app chrome); body background white;
  `.match-report` keeps colours (`print-color-adjust: exact`) and does not split table rows.
- Plus `print:hidden` on the sidebar, phone bottom bar, contract and legal banners, the Notice region, and the
  team page tabs. `PageHeader` is a `div` so page titles print; `StatTile` avoids breaking.
- Side effects (inferred): `Dialog`'s title bar and footer are `<header>`/`<footer>` and so do not print;
  `LegalLinks` is a `<nav>` and AuthShell/legal-page headers are `<header>`, all hidden in print.
- Base rule: every `:focus-visible` element gets a 2 px blue outline (offset 2 px).

---

## Must-keep invariants

Routing and gating

1. Every path in the route table above keeps resolving to the same screen with the same gate; the lazy
   routes (diagram editor, scout, both awards routes) keep a visible loading fallback.
2. `/admin/access` redirects (replace) to `/club?tab=people`; `/admin/interest` to `/platform?tab=leads`
   (Leads tab selected).
3. Scout and awards routes render **without** AppShell but **with** `RequireAuth` (club gate applies).
4. `/platform` requires only a signed-in platform admin (no membership, no club gate) and renders in
   MinimalShell with a Sign out button; a non-operator sees "You don't have access to this page.".
5. `/signup/club` and `/sign/complete` require sign-in but **not** a club (no ClubGate).
6. Public routes (`/login`, `/finish-sign-in`, `/privacy`, `/legal/:doc`, `/request-access`, `/signup`)
   render without sign-in.
7. An unauthenticated visit to any gated URL stores `pathname+search` in `vcb.auth.returnTo` and redirects
   to `/login` (replace); after Google sign-in or email-link sign-in the user lands on that path (or `/`).
8. Return-to accepts only safe same-origin paths (no `//`, `\`, protocol, `/login`, `/finish-sign-in`) and
   is consumed once.
9. While auth resolves, gated routes show a loading state, never the app; an auth failure shows a
   recoverable error with a way back to `/login`.
10. ClubGate mapping is exactly the table in §17 (welcome / pending / app / app+banner / restricted area /
    locked / ended), evaluated with strict `now < effectiveAt` and `now >= retrievalEndsAt` comparisons,
    and re-evaluated live on club doc changes **and** when a boundary time passes while the page is open.
11. Club admins (only) with an outdated or missing material acceptance are blocked by the legal review
    screen, unless their club has requested termination, in which case they get the app plus the
    "ended the contract instead" status notice. Members are never blocked.
12. The restricted (export-only) club area opens on Contract, hides People & access, and makes Profile
    read-only.
13. Section pages require `access.sections[x]`; `/club` requires `access.isClubAdmin`; denial shows
    "You don't have access to this page." with `role="alert"`.
14. The 404 page shows the requested path, "Go home" (→ `/`) and Back (history back, or `/` with no
    history), and is `noindex`.

Navigation

15. Every destination appears exactly once in navigation, grouped Home / Coaching / Club / Platform, with
    the visibility rules of navModel; empty groups are not shown.
16. Phone bottom bar = Home + visible Coaching pages + More, max 5 items, each with a visible text label;
    Club/Platform destinations and the account live on More, never duplicated on the bar.
17. Platform admins see an unreviewed access-request count badge on the Platform item (sidebar) and the
    More tab / More row (phone), recounted on the `interest-signups-changed` window event.
18. The club switcher is offered only when there is another non-deleted membership; switching stores
    `vcb.activeClub` and reloads the whole page. It is reachable on desktop (club name under the logo)
    and on phones (More → Account), and on Welcome / status / legal review / not-found screens.
19. When the stored club was dropped, a one-time "You no longer have access to your previous club."
    notice appears.
20. The account area contains only personal items: Settings, Terms & privacy (`/legal/terms`), Sign out
    (plus club switching on More).
21. A "Skip to content" link targets `<main id="main">`; on every route change (not first load) focus moves
    to the page `h1` (or `main`).
22. Page content shares one max width (`max-w-screen-xl`) and wide content never widens the page.

Auth, sign-out, storage

23. Sign-in methods: passwordless email link (to `/finish-sign-in`, `handleCodeInApp`) and Google popup.
    Firebase `auth.languageCode` is set to the app locale before any email link is sent.
24. The email-link address is kept in `localStorage.emailForSignIn` and removed when used; opening the
    link in another browser yields the "Could not find the email…" error.
25. A signing link (`?sign=<32 hex>`) goes to `/sign/complete?sign=…`; any other sign-in goes to the
    return-to path; a malformed `sign` is ignored.
26. Sign-out waits ≤ 1.5 s for pending writes and, if any remain, asks "Sign out anyway?" before
    discarding them; on proceeding it clears AI settings/key/text drafts, `vcb.activeClub`,
    `vcb.signDraft`, the Firestore IndexedDB cache, then full-navigates to `/login`.
27. Storage keys keep their exact names and semantics: `vcb.activeClub`, `vcb.auth.returnTo`, `vcb.locale`,
    `vcb.signDraft` (24 h TTL, removed when expired/malformed), `vcb.schemaVersion`, `vcb.ai.settings`,
    `vcb.ai.sessionKey` (sessionStorage), `vcb.textDraft.<matchId>`, `vcb.legalNoticeDismissed.<doc>.<v>`
    (sessionStorage), `theme`, `emailForSignIn`. Every storage access tolerates blocked storage.
28. Emails are lower-cased before any membership lookup, draft or write.

Legal and sign-up

29. Legal documents and clauses are rendered from the source texts unchanged (the acceptance stores SHA-256
    hashes of exactly the rendered strings); clause headings keep their `t12`/`d5` anchors.
30. The legal-text language (en/it/fr/de/es, from `?lang`, else browser, else en) is independent of the app
    language; the switcher is a labelled group of `aria-pressed` buttons and changes `?lang` with replace.
31. Each Terms/DPA acceptance checkbox stays disabled until that document is scrolled to its end or opened
    in a new tab; changing the legal language resets both reads and acceptances; Next needs both ticked.
32. The 13 specific-approval clauses appear in order and the signing link is sent only from that step;
    sending is single-flight (button disabled), and success/failure are announced (`status`/`alert`).
33. Versions shown are frozen at mount; one nonce per visit; for sign-up one club id per attempt, so
    re-sending never creates a second club.
34. A person with a pending club cannot start another sign-up (notice only).
35. `/sign/complete` commits once (StrictMode-safe), with the outcomes and copy in §32; success
    full-navigates to `/`.
36. Club admins see dismissible (per session, per version) notices of upcoming Terms/DPA/sub-processor
    versions with review links and, for sub-processors, the objection window and operator contact.
37. A terminating club shows the contract-ending banner (admin variant with the export deadline).
38. Public pages carry `LegalLinks` including "Report content" (mailto).

Settings and i18n

39. Settings contains only personal settings (no duplicated navigation, no sign-out); the AI section only
    when the club has AI on; the Language section only when Italian is enabled.
40. Theme: stored choice or system preference, applied before first paint, kept in sync across every toggle
    on screen; the toggle is labelled with the action it performs.
41. AI settings save on every change; changing provider clears the key and resets URL/model; the key is in
    sessionStorage unless "Remember on this device" is ticked (off by default); Forget key clears both;
    Test connection reports a coloured `role="status"` result with provider-specific messages.
42. With `ITALIAN_ENABLED` false the UI is always English and no language controls are shown; when on,
    switching applies without reload, updates `<html lang>`, and persists `vcb.locale`; English shows until
    the Italian chunk loads.
43. Tight labels (bottom bar, KPI tiles, scout buttons) must fit Italian strings within the label budget.

SEO

44. Only `/login`, `/request-access`, `/signup` and found legal pages without `?v` are `index, follow` with a
    canonical; all others `noindex, nofollow`; unmount restores defaults. `seoRoutes.ts`, `robots.txt`,
    sitemap and the `X-Robots-Tag` headers in `firebase.json` stay in sync (test-enforced).

Shared primitive contracts

45. Buttons default to `type="button"`, keep ≥ 44 px height (except `icon`), a visible focus ring, and
    disabled styling; variants keep their meaning (destructive only for confirms/danger zones).
46. Dialog: `role="dialog"` + `aria-modal` + accessible name = title; initial focus on the panel (once);
    Escape / backdrop / close button request close; dirty guard asks "Discard changes?"; Tab trapped; body
    scroll locked; focus returns to the opener; phone sheet mode and pinned footer available.
47. ConfirmDialog: `role="alertdialog"`, initial focus on Cancel, Escape = cancel, stacks above Dialog,
    inline error slot, no backdrop dismissal.
48. Only the topmost modal layer handles Escape/Tab.
49. Menu: menu-button ARIA (`aria-haspopup`, `aria-expanded`, `menu`, `menuitem`, `menuitemcheckbox`,
    `separator`), first item focused on open, arrows/Home/End, Escape returns focus to the trigger, outside
    pointer-down and Tab close.
50. Success feedback only via `useNotify` (always-mounted polite live region, one message, 4 s default,
    dismissible, above the bottom bar); errors inline with `role="alert"`.
51. SectionTabs offer the same sections as a labelled select on phones and as a labelled tablist from `sm`;
    tabs expose `role="tab"` + `aria-selected`.
52. Loading skeletons announce a label via `role="status"`; all pulsing animation is `motion-safe` only.
53. SkillMeter is `role="meter"` 1–10 with band colours and 3|5|7 band marks; level and status colours keep
    their mapping and always pair colour with a text label; brand-hue text uses `-strong` tokens (WCAG AA,
    test-enforced in both themes).
54. useSave blocks double submits and handles offline queue/block modes.
55. NotFoundState treats permission-denied as not found and offers club switching when relevant.
56. Form fields are ≥ 16 px text on phones; table header cells have `scope`; rows are never labelled with
    `aria-label` (tests scan all sources).
57. Print hides app chrome (header/nav/footer, sidebar, bottom bar, banners, toasts) but keeps the page
    title; the match report keeps its colours.
58. Startup clears a pre-migration Firestore cache once (`vcb.schemaVersion = '2'`), never blocking more
    than ~3 s.

---

## Current UX pain points / redesign opportunities

*Observations only; none of these are requirements.*

- **Denied pages inside the app look like the login page.** `RequireSection` / `RequireClubAdmin`
  render the full court-blue `AuthShell` (marketing tagline, hero) inside AppShell's `<main>`; there is
  no title, no link back, and the shell's focus logic falls back to `main` because there is no `h1`.
- **Loading is a full marketing screen.** Auth resolution shows `AuthShell` with "Loading..." before the
  app frame appears; the lazy-route fallbacks and many pages show plain "Loading…" text, while four pages
  use skeletons.
- **Login flow gaps**: a signed-in visitor to `/login` still sees the form; the "Check your email" state
  has no resend or "use a different email"; an email link opened in another browser fails with no way to
  type the address; FinishSignIn errors have no button back to `/login`; its card title "Volley Skills" is
  hard-coded English. "Request access" appears twice on the login card (header action + bottom link).
- **404 only for signed-in members.** Unknown URLs redirect signed-out visitors to `/login` (and remember the
  bad path as return-to) and show the Welcome page to people without a club.
- **Two language systems** (app `vcb.locale` vs legal-text `?lang`/browser language) can confuse; the country
  list in sign-up is sorted by English names but labelled in the app locale.
- **Legal review screen has no step indicator**, unlike sign-up ("Step N of 3"), and no explanation of the
  three steps up front.
- **AI settings autosave** with a permanent "Saved on this device" line; there is no explicit save moment and
  the provider change silently drops the key.
- **Tabs lack keyboard roving** (arrow keys) and `aria-controls`/`tabpanel` wiring.
- **InfoTooltip is hover/focus only**; touch users may not be able to open it.
- **Single toast slot**: a second success message replaces the first.
- **ConfirmDialog ignores backdrop taps**, while Dialog closes on them; may feel inconsistent (possibly
  intentional for destructive confirms).
- **Bottom bar width varies** (3–5 tabs) with the person's section access.
- **Club switching reloads the page** with no transition or confirmation.
- **Dialog title/footer do not print** (they are `<header>`/`<footer>`), inferred side effect of the global
  print rule.
- **Startup reset** can show a blank page for up to 3 s on the first load after the migration.
- **Spec drift**: the design-system spec §7 "Navigation" still describes Settings on the bottom bar, the
  Admin group on the Settings page and the theme toggle in the account menu; the code has a More tab, the
  Club group on More, and the theme toggle only on Settings. `PRIVATE_PREFIXES` lists `/welcome`, but no
  such route exists (Welcome renders at whatever URL was requested).

---

## Open questions

1. Which is the source of truth for navigation: the code (More tab, theme toggle only in Settings) or the
   design-system spec §7 text? The redesign should update one to match the other.
2. Should in-app denials and loading keep the `AuthShell` look, or get an in-shell treatment (title + link
   back)? Behaviourally only the "You don't have access to this page." alert is asserted by tests.
3. Should the storage key `theme` be kept unprefixed? (Renaming would reset everyone's theme, like the
   `vcb.` prefix rationale in CLAUDE.md.)
4. Is `ITALIAN_ENABLED` expected to flip during the redesign? Language controls and the club-language option
   must keep their conditional rendering either way.
5. Should signed-out visitors to unknown URLs get the 404 page rather than a login redirect?
6. Is the inert backdrop of `ConfirmDialog` a deliberate safety choice to preserve?
7. Should the success toast support queuing several messages, or is "latest wins" intended?
8. Should `/welcome` remain in `PRIVATE_PREFIXES` although no route exists?
