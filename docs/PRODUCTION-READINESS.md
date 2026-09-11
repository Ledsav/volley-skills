# Production readiness checklist

Living checklist of what must happen **before** the first real deploy, **at/after**
that deploy, and **ongoing**. Add items here whenever work leaves something for
later. Tick items as they land.

> **How this gets used:** when you mention deploying, hosting, going live, or a
> prod URL, Claude re-reads this file and proposes the items that now make sense
> to do. You own the file — edit it freely.

Status legend: `[ ]` todo · `[x]` done · `[~]` in progress / partial

Last reviewed: 2026-09-09

## Decisions locked (2026-09-09)

- **One Firebase project** — `volley-skills` serves dev and prod. No separate
  `volley-skills-prod`.
- **Custom domain** — `volley.albertovaldesrey.com` (apex stays on GitHub Pages).
- **CI/CD** — GitHub Actions. `ci.yml` on every PR (lint / build / unit tests /
  rules tests); `deploy.yml` on merge to `main` (build + `firebase deploy --only
  hosting,firestore:rules,firestore:indexes`).
- **Firebase web config is committed** (`.env.production`) rather than held as six
  GitHub secrets — not secret per spec §11, repo is public by design. The only
  real CI secret is `FIREBASE_SERVICE_ACCOUNT`.
- **App Check / reCAPTCHA / monitoring alerts deferred** to section B — lean v1,
  app is effectively private to the operator for now.

---

## A. Before the first deploy (blocking)

- [x] **Hosting config in `firebase.json`** — `hosting` block added: `public:
      "dist"`, SPA rewrite, security headers, cache headers.
- [x] **CSP headers via `firebase.json`** — `Content-Security-Policy` +
      `X-Content-Type-Options` / `Referrer-Policy` / `X-Frame-Options` /
      `Permissions-Policy` in the `headers` block. `script-src 'self'` (the
      no-flash theme script was moved to `public/theme-init.js` to keep it
      inline-free); `connect-src` scoped to `*.googleapis.com` + the auth-helper
      frame. **Verify against the deployed app** — tighten/loosen if the console
      logs a violation.
- [x] **Deployment path** — `.github/workflows/ci.yml` + `deploy.yml`.
- [x] **CI secret** — `VITE_FIREBASE_*` committed in `.env.production`; the
      service-account JSON was uploaded by `firebase init hosting:github` as the
      GitHub secret **`FIREBASE_SERVICE_ACCOUNT_VOLLEY_SKILLS`**, which
      `deploy.yml` references.
- [x] **Deploy Firestore rules + indexes to the live project** — done once from
      the CLI on 2026-09-09; `deploy.yml` keeps them in sync on every merge.
- [x] **Decide: one project or two** — one (`volley-skills`). See decisions above.
- [ ] **Prod seed (one-time)** — `node scripts/seed/seed.mjs --prod --admin
      alberto.valdes.rey.official@gmail.com`. Needs a gitignored
      `serviceAccountKey.json` at the repo root (console → Project Settings →
      Service Accounts → Generate new private key). Seeds one team,
      `skillGuide/config`, `adminAllowlist/<email>`, and the 20 player docs.
- [ ] **Run `node scripts/migrate/2026-09-11-section-access.mjs --prod`** after
      deploying the new `firestore.rules` and before shipping the new client
      (creates `sectionAccess/*`, back-fills existing admins, relabels
      `users.role`).
- [x] **Verify no analytics/tracking slipped in** — grepped source on 2026-09-09:
      no gtag / GA / GTM / Sentry / posthog / segment / `firebase/analytics`.
      Re-grep the built `dist/` before shipping a bundle with new deps.
- [x] **Enable Auth sign-in providers** — a fresh Firebase project has every
      provider off. Enabled in the console on 2026-09-10: **Google** (with a
      support email) and **Email/Password** with **Email link (passwordless)**.
      Both are used by `src/auth/LoginPage.tsx`.
- [x] **CSP must allow the Google Identity origins** — `signInWithPopup`
      (`GoogleAuthProvider`) injects `https://apis.google.com/js/api.js`, so the
      first tight CSP broke Google sign-in. `firebase.json` now allows
      `apis.google.com` / `www.gstatic.com` (script), `apis.google.com` /
      `accounts.google.com` (frame), `apis.google.com` (connect),
      `*.googleusercontent.com` (img avatars). Verified sign-in works
      2026-09-10.

## B. At / right after the first deploy

Need a real URL to exist. See `docs/superpowers/runbooks/2026-09-09-quota-protection-setup.md`
for the detailed steps.

- [ ] **reCAPTCHA v3 key pair** for the real domain(s) — site key + secret key.
- [ ] **Register App Check** in the Firebase console (paste the **secret** key).
- [ ] **`VITE_APPCHECK_RECAPTCHA_KEY`** (the **site** key) → GitHub Actions
      secret + wire it into the deploy build step. Re-deploy so the bundle sends
      App Check tokens.
- [ ] **App Check: monitor → enforce** — watch Metrics for a few days, then
      Enforce on Cloud Firestore, then Authentication.
- [ ] **Cloud Monitoring alert** — alerting policy on
      `firestore.googleapis.com/document/{read,write,delete}_count` at ~60% of
      the daily Spark cap. Notification channel = your email.
- [ ] **Confirm Firebase quota-warning emails** reach the project owners.
- [~] **Privacy policy content review** — `src/legal/PrivacyPage.tsx` at
      `/privacy` now has a real data-request contact
      (`alberto.valdes.rey.official@gmail.com`) and an "internal use, parent
      access not enabled" banner. A **formal legal review is still owed** before
      any guardian sign-in (app design spec §10.1).

### Custom domain + auth (console — no CLI for these)

- [ ] **Connect `volley.albertovaldesrey.com`** — Firebase console → Hosting →
      Add custom domain. It issues a TXT (verification) + an A record.
- [ ] **Add the DNS records** it gives you at the `albertovaldesrey.com`
      registrar. Apex + GitHub Pages records are untouched; this only adds the
      `volley` subdomain.
- [ ] **Authorized domains** — Firebase console → Authentication → Settings →
      Authorized domains → add `volley.albertovaldesrey.com`. Magic-link sign-in
      rejects a continue URL whose domain isn't listed.
- [ ] **Smoke-test the deployed app** — sign in with the magic link on the real
      domain, load each page, run one bulk import, check the browser console for
      CSP violations.

## C. Ongoing / when it makes sense

- [ ] **Viewer (guardian) invite flow** — per CLAUDE.md this is still TBD; only
      `admin` works end to end today. Needed before you tell any parent they can
      log in. Its own design + build.
      *Trigger: when you want parents to have read access to their child's card.*
- [ ] **`firestore.rules` per-query `limit` caps** — split `read` into
      `get` + `list`, add `request.query.limit <= 50` on the broad collections.
      The lever against a rogue signed-in admin. Skipped by decision while the
      admin allowlist is a small trusted set.
      *Trigger: when the allowlist grows beyond people you personally vouch for,
      or you enable the viewer role at scale.*
- [ ] **Full client rate limiter + guarded-DB facade** — parked. Only worth it
      if the app grows many concurrent users or you keep hitting quota from your
      own traffic despite the debounce + retry already in place.

## D. Deferred polish (no deadline, safe to ship without)

From the bulk-import and quota-protection reviews:

- [ ] **F7** — `BulkImportDialog` async-validate error copy is lower-case
      (`'could not validate the data…'`), inconsistent with the sentence-case
      commit error. Only shows if a validator throws, which none currently can.
- [ ] **F10** — no `tests/rules/` test for the trainings bulk-create
      transaction (teams + trainings write-shapes are rule-safe by inspection).
- [ ] **F14** — the 4s `setTimeout(() => setNotice(null))` on the Exercises /
      Trainings / Teams import notices isn't cleared on unmount. React 18 no-ops
      the stale `setState`; harmless timer leak.
- [ ] **F15** — `SKILL_KEYS` in `src/types/player.ts` is a mutable exported
      array; `readonly` / `as const` would harden it.
- [ ] **F16** — app design / bulk-import spec §8 says a failed commit "writes
      nothing"; a lost response can land server-side, and "always create new"
      means a retry duplicates. One sentence of doc.
- [ ] **QP review minor** — `TrainingsPage` tests and the api retry tests now
      spend ~350ms / ~300ms of real time inside `waitFor` because of the debounce
      and `withBackoff` default `baseMs`. Not flaky, but fake timers (or a shared
      delay constant) would keep them fast and decoupled from the constants.
- [ ] **Build chunk > 500 kB** — `vite build` warns the main JS chunk is ~1 MB.
      Route-level `React.lazy` / `manualChunks` when load time matters.
- [ ] **Unbounded delete cascades** — `deleteTeam` / `deletePlayer` do a
      `getDocs` with no `limit` over their subcollections. Bounded in practice by
      roster size; a `limit` + loop makes it safe at any scale.
