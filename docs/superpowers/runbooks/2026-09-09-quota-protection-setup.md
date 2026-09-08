# Quota protection — one-time console setup

Date: 2026-09-09
Owner: club admin (whoever holds the Firebase project)

The code side (App Check init, `withBackoff` retry on transient overload, the
debounced Trainings filter) ships with the `feat/quota-protection` branch. This
runbook is the console/GCP work that code cannot do. Do the steps in order.

---

## 1. Create a reCAPTCHA v3 site key

1. Go to <https://www.google.com/recaptcha/admin/create>.
2. Label: `volley-skills`. Type: **reCAPTCHA v3**.
3. Domains: your production host (e.g. `volley-skills-app.web.app` and any custom
   domain). Add `localhost` too if you want App Check to work in a non-emulator
   local run.
4. Accept the terms, submit. Copy the **site key** (public) — the secret key is
   not needed for Firebase App Check.

## 2. Register App Check in the Firebase console

1. Firebase console → your project → **Build → App Check**.
2. On the **Apps** tab, select the web app, click **Register**.
3. Provider: **reCAPTCHA v3**. Paste the site key from step 1. Save.
4. Leave enforcement **off** for now (that's step 5).

## 3. Wire the key into the app

- **Local (optional, non-emulator runs only):** add to `.env.local`
  ```
  VITE_APPCHECK_RECAPTCHA_KEY=<site key>
  ```
  With `VITE_USE_EMULATOR=true` the app skips App Check regardless, so you only
  need this if you point a local dev server at real Firebase.
- **CI / production:** add `VITE_APPCHECK_RECAPTCHA_KEY` as a GitHub Actions
  secret (repo → Settings → Secrets and variables → Actions) and expose it to the
  build step in the deploy workflow the same way the other `VITE_FIREBASE_*`
  values are passed. Without it the deployed app runs exactly as it does today
  (App Check simply not initialised).

Deploy once with the key set. The app now sends App Check tokens; nothing is
rejected yet because enforcement is still off.

## 4. Debug token for local non-emulator work (optional)

If you run `npm run dev` against real Firebase (no emulator) and see App Check
errors in the console, add this **before** the app loads (e.g. a `<script>` in
`index.html` gated on dev, or a `localStorage` flag) — never in production:

```js
self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
```

The console prints a debug token on first load; register it under
**App Check → Apps → (app) → Manage debug tokens**.

## 5. Turn on enforcement — gradually

1. In **App Check**, watch the **Metrics** for each product (Firestore, Auth) for
   a few days after step 3 ships. You want "Verified requests" at or near 100%
   and "Outdated client" / "Unknown" near zero.
2. When it looks clean, click **Enforce** for **Cloud Firestore** first, then
   **Authentication**. From that point, requests without a valid App Check token
   are rejected.
3. If legitimate traffic breaks, un-enforce, check the metrics for what's
   failing (usually a missing domain in the reCAPTCHA key or a stale deploy).

## 6. Usage alerting

The project is on the Spark (free) plan, so there is no Cloud Billing budget to
set. Use quota-based alerting instead.

**Firebase built-in emails (confirm they're on):**
- Firebase console → **Project settings → Integrations**, and the **Usage and
  billing → Details & settings** page — make sure the project owners receive the
  "approaching Spark limits" emails. These fire around 80–90% of the daily
  Firestore read/write/delete caps.

**Cloud Monitoring alert (explicit early warning):**
1. Google Cloud console (same project) → **Monitoring → Alerting → Create
   policy**.
2. Add condition → metric `firestore.googleapis.com/document/read_count`
   (resource type: *Cloud Firestore*), aligner **rate**, then a second condition
   for `.../document/write_count` and `.../document/delete_count`.
3. Threshold: set each to roughly **60% of the daily cap spread over a day** —
   e.g. reads 50 000/day → alert if the 1-hour rate implies > ~1 250/hour
   sustained. Tune after you see a week of normal traffic; the point is to hear
   about a runaway loop within the hour, not at the wall.
4. Notification channel: your email. Save.

## 7. If you outgrow this

The residual risk that none of the above covers is a **signed-in admin or
viewer** (someone on `adminAllowlist`, or an invited parent) scripting Firestore
directly. On Spark with no Cloud Functions there is no per-user server-side rate
limit. If that ever becomes a real concern:

- Add `request.query.limit <= 50` guards to the broad `list` rules in
  `firestore.rules` (needs the `read` rule split into `get` + `list`, and every
  existing `tests/rules/` test re-verified).
- Or move to the Blaze plan and route reads/writes through a Cloud Function that
  enforces per-user quotas.

Both are out of scope here by decision — the allowlist is a small set of trusted
people.
