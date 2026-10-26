# Production readiness checklist

Living checklist of what must happen **before** the first real deploy, **at/after**
that deploy, and **ongoing**. Add items here whenever work leaves something for
later. Tick items as they land.

> **How this gets used:** when you mention deploying, hosting, going live, or a
> prod URL, Claude re-reads this file and proposes the items that now make sense
> to do. You own the file — edit it freely.

Status legend: `[ ]` todo · `[x]` done · `[~]` in progress / partial

Last reviewed: 2026-10-26

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
      `connect-src` also allows the text-scouting AI providers
      (`api.groq.com`, `openrouter.ai`, `http://localhost:*` /
      `http://127.0.0.1:*` for Ollama / LM Studio). The **Custom** provider can't
      be pre-allowed, so it only works on the local dev server — its Settings
      note says so. Add a host here if another provider becomes a preset.
- [x] **Deployment path** — `.github/workflows/ci.yml` + `deploy.yml`.
- [x] **CI secret** — `VITE_FIREBASE_*` committed in `.env.production`; the
      service-account JSON was uploaded by `firebase init hosting:github` as the
      GitHub secret **`FIREBASE_SERVICE_ACCOUNT_VOLLEY_SKILLS`**, which
      `deploy.yml` references.
- [x] **Deploy Firestore rules + indexes to the live project** — done once from
      the CLI on 2026-09-09; `deploy.yml` keeps them in sync on every merge.
- [x] **Decide: one project or two** — one (`volley-skills`). See decisions above.
- [~] **Production backups and operator security** (2026-10-26: key rotated, backup key pair made, two
      production backups taken and checked; the service-account key is still unencrypted at the repo root) — production has no backup until
      the first `npm run backup -- --prod` (`scripts/ops/README.md`). Do the first-time
      setup (encrypt and rotate the service-account key, backup key pair), take a backup
      weekly and before every risky change, and work through `docs/SECURITY-OPERATIONS.md`.
      Watch the reads each backup prints: once scouting events push it near the 20,000
      budget, move to Google's managed backups (billing) or a quiet-day budget.
- [x] **Club platform: migrate production before deploying this branch** — DONE 2026-10-26:
      backup `volley-skills-2026-10-26T14-26-17Z.vsbackup` (265 docs, checked), indexes deployed and
      READY, 268 docs migrated to `clubs/7lxvfD8x4INAx2E0i9wN` ("Volley Club Belair", owner and operator
      the operator's gmail: one account with roles), merged and deployed (`6279480`). **Drop the old
      collections on or after 2026-11-09** (`dropLegacy.mjs --prod --club 7lxvfD8x4INAx2E0i9wN`). — the
      `feature/club-platform` branch reads and writes only under `clubs/{clubId}`, so
      deploying it before the migration locks everyone out. Follow the runbook in
      `scripts/migrate/README.md`: dry run → rehearse on the emulator → freeze → migrate
      prod → merge (deploys rules + app) → check → drop the old collections after 14 days.
- [x] **Firestore region verified: `eur3`** (club platform spec §11) —
      `firebase firestore:databases:get "(default)" --project volley-skills` reported
      `eur3`, verified 2026-10-20.
- [~] **Rules require a verified token email** — membership and `platformAdmins` are
      matched by `request.auth.token.email`, and email-link sign-in needs the
      Email/Password provider on, so anyone could create a password account for an
      address that has none yet. Fixed on `feature/club-platform` (2026-10-26):
      `signedIn()` requires `email_verified == true` (email link and Google verify),
      covered by `tests/rules/emailVerified.rules.test.ts`. **`main` (live today) still
      has the gap** (`adminAllowlist` / `adminEmails` keyed on the email alone) until the
      branch is merged or the check is backported.
- [x] ~~**Prod seed (one-time)**~~ — obsolete: production already holds the club's data
      and is migrated (above), not seeded.
- [x] ~~**Run `scripts/migrate/2026-09-11-section-access.mjs --prod`**~~ — obsolete:
      superseded by the club platform migration, which reads `adminAllowlist`, team
      `adminEmails` and `sectionAccess` directly.
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

- [x] **Set `VITE_SITE_URL` for the production build** (`.env.production` → `https://volley.albertovaldesrey.com`) (canonical links, `robots.txt`, `sitemap.xml`).

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
- [ ] **Trusted Types: report-only → enforce** — `firebase.json` sends
      `Content-Security-Policy-Report-Only: require-trusted-types-for 'script'`.
      After deploy, sign in (email link), open a player card, scout a match and
      draft with AI with DevTools open; if no Trusted Types violations appear,
      move the directive into the enforced `Content-Security-Policy`.
- [~] **Privacy policy content review** — `src/legal/PrivacyPage.tsx` at
      `/privacy` now has a real data-request contact
      (`alberto.valdes.rey.official@gmail.com`) and an "internal use, parent
      access not enabled" banner. Expanded 2026-10-14 (region-agnostic, EU-wide):
      operator as the responsible party (clubs are tenants), legal basis,
      Firebase as processor, text-scouting transfers to US providers,
      retention incl. access requests, full GDPR rights + complaint to the
      user's national DPA. A **formal legal review is still owed** before any
      guardian sign-in (app design spec §10.1). Ask the reviewer specifically:
      (1) ~~physical measurements as Art. 9 health data~~ — decided 2026-10-14:
      they are sports performance measurements, not medical data (operator's
      call; the privacy page says so);
      (2) operator vs club roles (controller/processor) once more clubs join —
      a data-processing agreement per club is likely needed;
      (3) Groq/OpenRouter terms for text scouting — mitigated 2026-10-14:
      OpenRouter requests carry `provider: { data_collection: 'deny', zdr:
      true }`; Settings tells coaches to use a club/work account and accept the
      provider's DPA. Each coach's own key means the provider contract is the
      coach's — confirm that is acceptable. Follow-up: an EU-hosted preset
      (e.g. Mistral) once its CORS + DPA are verified;
      (4) ~~retention period~~ — decided 2026-10-14: 12 months after the
      player leaves (`leftClubAt`, `src/players/retention.ts`). No server, so
      deletion is admin-confirmed from the team overview's "due for deletion"
      notice, not automatic.
- [x] **Offline cache of minors' data** — Firestore uses a persistent
      (IndexedDB) cache so matches can be scouted without signal, so match and
      player data stays on the device while signed in. Sign-out
      (`signOutAndClearLocalData` in `src/firebase/signOut.ts`) waits ~1.5s for
      pending writes (asks before discarding unsynced scouting actions), then
      signs out, terminates Firestore, clears the IndexedDB cache and reloads.
      The privacy page says so. Caveat: clearing fails while another tab of the
      app is open; that tab's cache is cleared on a later sign-out.

- [ ] **Check SEO headers after the first deploy**: `/robots.txt`, `/sitemap.xml`, and an `X-Robots-Tag` header on `/teams` with `curl -I`.

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

- [ ] **Player `shirtSize` backfill** (after the branch adding shirt size is
      deployed) — optional, the app already treats a missing field as "not
      set": `node scripts/seed/backfillPlayers.mjs --prod` (dry run, prints
      counts) then `--prod --yes` to write `shirtSize: ''` on existing players.
      No rules change or index needed.

- [ ] **Revoking a super-admin needs a manual follow-up** — removing an email
      from `adminAllowlist` is not enough on its own: their cached
      `users/{uid}` doc still has `role: 'superadmin'` (that field is
      immutable by design, `allow update, delete: if false`), so their client
      keeps showing the full super-admin UI, though every write is now
      silently denied by the rules (the security boundary holds; only the UX
      is confusing). To fully revoke, also delete (or edit) their
      `users/{uid}` doc via the Firebase console or Admin SDK so they get
      re-resolved as `member` on next sign-in.
      *Trigger: whenever someone is removed from `adminAllowlist`.*
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

- [x] **F7** — `BulkImportDialog` async-validate error copy is lower-case — fixed 2026-10-20
      (`'could not validate the data…'`), inconsistent with the sentence-case
      commit error. Only shows if a validator throws, which none currently can.
- [x] **F10** — no `tests/rules/` test for the trainings bulk-create — fixed 2026-10-20
      transaction (teams + trainings write-shapes are rule-safe by inspection).
- [x] **F14** — the 4s `setTimeout(() => setNotice(null))` on the Exercises / — fixed 2026-10-20
      Trainings / Teams import notices isn't cleared on unmount. React 18 no-ops
      the stale `setState`; harmless timer leak.
- [x] **F15** — `SKILL_KEYS` in `src/types/player.ts` is a mutable exported — fixed 2026-10-20
      array; `readonly` / `as const` would harden it.
- [ ] **F16** — app design / bulk-import spec §8 says a failed commit "writes
      nothing"; a lost response can land server-side, and "always create new"
      means a retry duplicates. One sentence of doc.
- [x] **QP review minor** — `TrainingsPage` tests and the api retry tests now — fixed 2026-10-20
      spend ~350ms / ~300ms of real time inside `waitFor` because of the debounce
      and `withBackoff` default `baseMs`. Not flaky, but fake timers (or a shared
      delay constant) would keep them fast and decoupled from the constants.
- [ ] **Build chunk > 500 kB** — `vite build` warns the main JS chunk is ~1.28 MB (335 kB gzip, 2026-10-14).
      Route-level `React.lazy` / `manualChunks` when load time matters.
- [ ] **Unbounded delete cascades** — `deleteTeam` / `deletePlayer` do a
      `getDocs` with no `limit` over their subcollections. Bounded in practice by
      roster size; a `limit` + loop makes it safe at any scale.
- [x] **Player erasure + export cover data outside the player doc** (2026-10-14)
      — `deletePlayer` now runs `erasePlayerFootprint` first
      (`src/players/playerFootprintApi.ts`): deletes the player's
      testing-session entries in every session (team admins may now delete
      entries, any session status — rules test added), strips their name and
      number from every match roster ("Removed player", #0; stats stay keyed by
      an id nothing points to), and drops them from `scoutProfile/usage`. The
      player JSON export includes testing-session entries and per-match roster
      + report stats. `deleteTeam` already cascades into testing sessions.
      Raw scouting events are not exported per player (they hold only the
      pseudonymous `playerId`; the report stats cover them).
- [ ] **Physical testing session mobile layout is functional but not fully
      polished per spec** — the 2026-09-16 spec (§6) envisioned a fuller mobile
      treatment than shipped. What's done: the roster picker is a search-only
      combobox (no full list by default), the recording panel is a full-screen
      sheet below the `sm` breakpoint, and the stopwatch is one big toggle
      button. Still open: quality tiles show only "Not started"/"In
      progress"/"Done" rather than "In progress (n of required)"; the past
      sessions list on the no-active-session screen isn't expandable to show
      what was recorded, as the spec asked. Low priority — the feature is
      usable on a phone today.
      *Trigger: pick up opportunistically, or when a coach reports it's hard to
      use one-handed in the gym.*

## E. Club platform: legal launch gate and operator actions

- [x] **Fill the operator address in `src/legal/operator.ts`** — DONE 2026-10-26 (pins updated in place;
      no production acceptance existed yet) — the legal texts
      show a marker while `address` is null. Registration and VAT stay empty (the
      operator is an individual) and their lines are omitted.
- [ ] **Fill the address and pass the lawyer gate BEFORE the first production
      acceptance** — the migrated club's owner accepts on first visit, and from then on
      a signed version must never change (its hash is stored with the acceptance). A
      version id covers the file, the `operator.ts` values and the fixed country names
      in `legalDocs.ts`; `src/legal/published.test.ts` pins the SHA-256 of every
      published text. Before the first acceptance, update the pins in place; after it,
      ship any change (address, lawyer edits) as a new version id in `versions.json`.
- [ ] **Lawyer review of each language a club signs in, before any outside club is
      activated (launch gate).** Questions collected while building:
  - Is fresh email-link re-authentication enough as "specific written approval"
    (Cass. ord. 20945/2026), or is an advanced/qualified e-signature needed?
  - T4: the Italian B2B late-interest rate under Luxembourg law.
  - DSA Art. 11-12 contact languages and the Art. 14 moderation/complaints description
    (not decided by the spec); the "Report content" mailto in `LegalLinks`.
  - T9: no refund when a club terminates over an assignment (T14).
  - T21: law tied to the "place of establishment"; governing law/forum for Italian clubs.
  - T12 cap and free-use floor, T20 enforceability against amateur associations, Data Act
    Art. 13 exposure, and whether non-business ASDs can be consumers.
  - Italian texts carry no explicit "artt. 1341-1342 c.c." reference beyond the sentence
    that closes each specifically approved clause.
  - German: "Kündigungsfrist" vs "Frist" in T10; "Salvatorische Klausel" as the T23 heading.
  - reCAPTCHA v3 as a sub-processor vs Google as controller; which Google entity
    contracts Auth and reCAPTCHA.
  - The EUR 80/h assistance rate against Art. 28(3)(e).
  - DataVolley import: whether the Data Project EULA restricts use of exported .dvw files. Assumed to bind the club, not the operator; Terms T7 says the club imports only files it may use.
  - A fixed retention period for acceptance records.
  - Whether the cookie-banner exemption covers the preference keys in localStorage.
- [~] **Verify in the Auth emulator that `auth_time` is fresh after the signing link**
      (club-platform spec §11); record the result here. Do the same check once in
      production (decode the ID token after a signing link; read `auth_time` and
      `firebase.sign_in_provider`). Do the production check while already signed in
      as the same account: the emulator derives `auth_time` from the user's last
      login on every refresh, production keeps it per session, so a stale `User`
      object only shows its old `auth_time` in production.
      Emulator DONE 2026-10-26: a second email link 3 s later gave a new `auth_time`
      (= `iat`), `sign_in_provider: password`, `email_verified: true`; a REST password
      sign-up for another address gave `email_verified: false`. Production check owed.
- [x] ~~**Keep Email/Password sign-in DISABLED in the Firebase console**~~ — not
      possible: email-link sign-in requires the Email/Password provider. Instead the
      rules require `email_verified` (section A), so a password account made for an
      address nobody proved control of can neither read club data nor sign.
- [ ] **Tick SECURITY-OPERATIONS rows 6-8** (BitLocker, external drive, weekly backup)
      before publishing: Annex II of the DPA states them. Two promises are manual:
      leads are deleted within 12 months, and accounts are deleted on request.
- [ ] **Production: the migrated club's owner (`--owner`) accepts on first visit** — the
      migrated club has `legal: null`, so its owner sees the review screen once. The
      operator (a platform admin) cannot accept for the club.
