# Production readiness checklist

Living checklist of what must happen **before** the first real deploy, **at/after**
that deploy, and **ongoing**. Add items here whenever work leaves something for
later. Tick items as they land.

> **How this gets used:** when you mention deploying, hosting, going live, or a
> prod URL, Claude re-reads this file and proposes the items that now make sense
> to do. You own the file — edit it freely.

Status legend: `[ ]` todo · `[x]` done · `[~]` in progress / partial

Last reviewed: 2026-09-09

---

## A. Before the first deploy (blocking)

These make a hosted build possible and correct. None are done yet.

- [ ] **Hosting config in `firebase.json`** — add a `hosting` block: `public`
      pointing at the Vite build output (`dist`), and an SPA rewrite
      (`"rewrites": [{ "source": "**", "destination": "/index.html" }]`) — the
      app uses `BrowserRouter`, so without this every deep link 404s.
      *Trigger: the moment you decide to host.*
- [ ] **CSP headers via `firebase.json`** — `headers` block with a
      Content-Security-Policy (app design spec §10.4). Scope it to Firebase +
      Google auth/reCAPTCHA origins.
- [ ] **Deployment path** — either a `firebase deploy` you run by hand, or the
      intended GitHub Actions workflow (`.github/workflows/` does not exist yet)
      that builds and deploys on merge to `main`.
- [ ] **CI build secrets** — `VITE_FIREBASE_*` (all six) as GitHub Actions
      secrets, passed into the build step. Without them the deployed bundle has
      no Firebase config.
- [ ] **Deploy Firestore rules + indexes to the live project** —
      `firebase deploy --only firestore:rules,firestore:indexes`. Today only the
      emulator has them applied; the live `volley-skills` project may be stale.
- [ ] **Decide: one project or two** — dev currently talks to the live
      `volley-skills` project directly (unless `VITE_USE_EMULATOR=true`). Decide
      whether prod is the same project or a separate `volley-skills-prod`. If
      separate: second `.firebaserc` alias, second set of CI secrets, second
      App Check registration.
- [ ] **Prod seed (one-time)** — `node scripts/seed/seed.mjs --prod --admin <email>`
      with a gitignored `serviceAccountKey.json` at the repo root. Guarded to run
      once (`--force` to override). Seeds one team, `skillGuide/config`, and the
      20 player docs from the `.xlsx`.
- [ ] **Verify no analytics/tracking slipped in** — hard constraint (minors'
      data). Grep the bundle for gtag / analytics / Sentry / posthog before the
      first deploy.

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
- [ ] **Privacy policy content review** — `src/legal/PrivacyPage.tsx` is wired at
      `/privacy`; confirm its text actually covers what data is collected, why,
      who sees it, retention, a data-request contact, and that subjects are
      minors / guardians are the consent party (app design spec §10.1).
- [ ] **Smoke-test the deployed app** — sign in with the magic link on the real
      domain (email-link needs the prod `authDomain` in the allowed list), load
      each page, run one bulk import.

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
