# Club Platform Plan 3: Sign-up and Legal Acceptance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A club can sign itself up and accept the Terms and DPA, with a specific-approval step confirmed by a fresh email link. Existing clubs review and accept new versions. The legal texts are published, and the product guardrails those texts promise are in place.

**Architecture:**
- Legal texts are versioned Markdown files, rendered by a small in-house renderer and hashed client-side (Web Crypto) after operator placeholders are filled in.
- Sign-up and re-acceptance share one signing core: a draft saved in localStorage, a fresh email link, and an atomic batch the rules accept only within 15 minutes of that sign-in.
- Rules gain the sign-up create, the acceptance create (the operator is excluded) and the club admin's `legal` update. Each is pinned by rules tests that build their docs with the app's own builders.

**Tech Stack:** React 18 + TS + Vite, Firebase Auth email link, Firestore rules, vitest, @firebase/rules-unit-testing.

**Specs:**
- `docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md`: §3.1 club fields, §5, §6, §7.1 Contract, §8.3, §8.6, §10.
- `docs/superpowers/specs/2026-10-20-volley-skills-legal-documents-design.md`: all of it. The backup design (2026-10-22) already corrected D4 and D8.

## Global Constraints

- No new npm dependency. The Markdown renderer is written here: no `dangerouslySetInnerHTML`.
- **English only in this plan** (ruling: Italian texts and the EN/IT toggle come with the Italian plan). File names carry the language (`content/en/…`) so Italian slots in. `language` in acceptance records is `'en'`.
- Every legal text and the signing screens show **"Draft — under legal review"** until the lawyer gate is passed (legal design, launch gate).
- Operator identity comes from `src/legal/operator.ts` only. A field the operator has not filled (address, legal form, registration, VAT) renders as a visible marker, never an invented value: `[to be completed: <field>]`.
- Hashes are SHA-256 hex of the **exact strings rendered** (after placeholder substitution), computed with `crypto.subtle`.
- Emails are compared and stored lowercased.
- Sign-up code builds `clubs/<newId>/…` paths explicitly (`doc(db, 'clubs', id, …)`), because `clubDoc()`/`clubCol()` throw without an active club.
- The sign-up creates no `sectionAccess` docs (ruling: `accessApi` creates them with `set(…, {merge: true})` on first grant, and rules already treat missing docs as no grant).
- Every rules change has a rules test (`tests/rules/`, run on port 8181 with the scratch config; the dev emulator holds 8080).
- UI per the design system: page titles via `PageHeader`/shell titles, success via `useNotify()`, errors inline `role="alert"`.
- No analytics or tracking. Logs carry no personal data.

## Decisions this plan fixes

| # | Decision |
|---|---|
| P1 | Version ids are ISO dates. First version of `terms`, `dpa`, `subprocessors`: `2026-10-22`, announced and effective `2026-10-22`, `material: true`. `privacy` and `dpia-pack` are single files with the same date in the name, not versioned for acceptance. |
| P2 | `versionKey = 'terms-<termsVersion>_dpa-<dpaVersion>'` (spec §6.2). |
| P3 | Clause format in the Markdown: each clause is a level-2 heading `## T12. Liability` (`## D5. Sub-processors` in the DPA), and its text runs to the next level-2 heading. The specific-approval texts are **extracted** from the documents, never duplicated. |
| P4 | Specific-approval ids: `terms`: T2, T8, T9, T11, T12, T13, T14, T15, T20, T21; `dpa`: D5, D9, D11 (legal design §8). |
| P5 | `clausesSha256` hashes `clausesText(clauses)`: for each clause in id order, `<id>. <heading>\n\n<text>`, joined with `\n\n---\n\n`. |
| P6 | Re-auth: before sending the signing link, `rememberReturnTo('/sign/complete')` and `saveEmailForSignIn(email)`. The link lands on the existing `/finish-sign-in`, which signs in again (fresh `auth_time`) and returns to `/sign/complete`. |
| P7 | The draft (`vcb.signDraft` in localStorage) carries the new club id, chosen when the draft is saved, so a second commit of the same draft fails on "club exists" instead of creating a second club. The draft expires after 24 hours. |
| P8 | The client commits only while `now − auth_time < 14 min` (one minute short of the rules' 15) and otherwise offers "Send a new link". |
| P9 | After a successful commit the app does `window.location.assign('/')`. The same-uid re-sign-in fires no `onAuthStateChanged`, so a reload is what refreshes memberships and the club. |
| P10 | The review screen blocks club admins whose accepted version is outdated. A club admin who is also a platform admin (the operator in the home club) cannot accept (rules), so they see a non-blocking notice naming `ownerEmail` instead. Members are never blocked. |
| P11 | New clubs: `aiEnabled: false`, `growthTestsEnabled: false`, `referenceOptOut: false` (spec §3.1 defaults), enforced by the create rule. The Firestore auto-id is the club id. |
| P12 | Award photos and cut-outs are gated on the new `player.photoConsent === true`, not on the general `consent.given`. Existing players start without photo consent (by design). |

## Review Focus

1. **The signing link is opened in another browser or device** (no draft there). Nothing is written, and the page says to open the link in the browser where the sign-up started. Test in Task 7.
2. **The link is opened more than 14 minutes after the fresh sign-in, or the page is left open that long.** The page refuses and offers a new link; the rules refuse past 15 minutes. Tests in Tasks 5 and 7.
3. **A reload, double click or second tab on `/sign/complete`** must not create two clubs or two acceptances: a stable club id in the draft, the draft cleared on success, and an "already done" outcome when the club or acceptance exists. Test in Task 7.
4. **The operator's account tries to sign** (sign-up or re-accept). The client explains before sending a link; the rules refuse. Tests in Tasks 5, 7 and 8.
5. **An operator field not filled in yet** shows as a visible `[to be completed: …]` marker in every text and changes the hash, rather than failing to render or inventing a value. Test in Task 1.

---

### Task 1: Legal content core (versions, loading, placeholders, clauses, hashing)

**Files:**
- Create:
  - `src/legal/content/versions.json`
  - `src/legal/versions.ts`
  - `src/legal/legalDocs.ts`
  - `src/legal/specificClauses.ts`
  - `src/legal/hash.ts`
  - stub files `src/legal/content/en/{terms,dpa,subprocessors,privacy,dpia-pack}-2026-10-22.md`, each holding only the draft banner line; Tasks 2 and 3 fill them
- Modify:
  - `src/legal/operator.ts`
  - `src/types/club.ts` (add `Acceptance`)
- Test:
  - `src/legal/versions.test.ts`
  - `src/legal/legalDocs.test.ts`
  - `src/legal/hash.test.ts` (`// @vitest-environment node`)

**Interfaces (produces):**
- `operator.ts`:
  - `OPERATOR: { name: string; legalForm: string | null; address: string | null; country: string; registration: string | null; vat: string | null; contactEmail: string; privacyEmail: string }`.
  - Values: name `Alberto Valdes Rey`, country `Luxembourg`, both emails `alberto.valdes.rey.official@gmail.com` (today's privacy contact); the other fields `null`.
  - Keep `OPERATOR_CONTACT_EMAIL` as an alias of `OPERATOR.contactEmail`.
- `versions.ts`:
  - `type LegalDocId = 'terms' | 'dpa' | 'subprocessors' | 'privacy' | 'dpia-pack'`
  - `type VersionedDoc = 'terms' | 'dpa' | 'subprocessors'`
  - `type LegalLang = 'en'`
  - `interface LegalVersion { version: string; announcedAt: string; effectiveFrom: string; material: boolean; summary: string }`
  - `inForce(doc: VersionedDoc, date: Date): LegalVersion` (latest with `effectiveFrom ≤ date`; throws if none)
  - `upcoming(doc, date): LegalVersion | null` (`announcedAt ≤ date < effectiveFrom`)
  - `versionKey(terms: string, dpa: string): string`
  - `parseVersionKey(key: string): { terms: string; dpa: string } | null`
  - `needsReview(legal: ClubLegal | null, date: Date): boolean`
  - `CURRENT_DOC_VERSION: Record<'privacy' | 'dpia-pack', string>`
  - Dates compare as `YYYY-MM-DD` strings in UTC.
- `legalDocs.ts`:
  - `rawLegalText(doc: LegalDocId, version: string, lang: LegalLang): string | null`, from `import.meta.glob('./content/*/*.md', { query: '?raw', import: 'default', eager: true })`
  - `substitutePlaceholders(text: string, operator = OPERATOR): string`
  - `legalText(doc, version, lang): string` (raw, then substituted; throws if missing)
  - `extractClause(md: string, id: string): { id: string; heading: string; text: string } | null`
  - `clauseIds(md: string): string[]`
- Placeholders:
  - `{{OPERATOR_NAME}}`, `{{OPERATOR_LEGAL_FORM}}`, `{{OPERATOR_ADDRESS}}`, `{{OPERATOR_COUNTRY}}`, `{{OPERATOR_REGISTRATION}}`, `{{OPERATOR_VAT}}`, `{{OPERATOR_CONTACT_EMAIL}}`, `{{OPERATOR_PRIVACY_EMAIL}}`, `{{SUPPORT_HOURLY_RATE}}` (`€80`), `{{FREE_USE_LIABILITY_CAP}}` (`€100`).
  - A null field becomes `[to be completed: <field label>]`.
  - An unknown `{{…}}` throws `Unknown legal placeholder {{X}}`.
- `specificClauses.ts`:
  - `SPECIFIC_CLAUSE_IDS = { terms: [...P4], dpa: [...P4] } as const`
  - `interface SpecificClause { id: string; heading: string; text: string }`
  - `specificClauses(termsVersion, dpaVersion, lang): SpecificClause[]` (Terms ids, then DPA ids; throws naming any missing id)
  - `clausesText(clauses: SpecificClause[]): string` (P5)
- `hash.ts`: `sha256Hex(text: string): Promise<string>`.
- `types/club.ts`: `Acceptance { versionKey; termsVersion; dpaVersion; subprocessorsVersion; language: 'en' | 'it'; termsSha256; dpaSha256; clausesSha256; specificClauses: string[]; acceptedBy; acceptedByName; authorityConfirmed: true; acceptedAt: Timestamp | null; authTime: number; userAgent: string }`.

- [ ] **Step 1: Write the failing tests**
  - `versions.test.ts`:
    - `inForce('terms', new Date('2026-10-22T00:00:00Z')).version === '2026-10-22'`
    - `inForce` throws for a date before every version.
    - `upcoming` returns null today.
    - With a test-only versions fixture (export `inForceIn(list, date)`, `upcomingIn(list, date)` and `needsReviewIn(versions, legal, date)` as the pure cores, which the public helpers call with the JSON):
      - a version announced `2026-11-01`, effective `2026-12-01` is upcoming on `2026-11-15` and in force on `2026-12-01`;
      - `needsReviewIn`:
        - `null` legal → true;
        - accepted `terms-2026-10-22_dpa-2026-10-22`, when only a non-material `2026-12-01` terms is in force → false;
        - when a material `2026-12-01` dpa is in force → true;
        - an unparsable key → true.
    - `versionKey('a','b') === 'terms-a_dpa-b'`; `parseVersionKey('terms-a_dpa-b')` → `{terms:'a', dpa:'b'}`; `parseVersionKey('x')` → null.
  - `legalDocs.test.ts`:
    - `substitutePlaceholders('{{OPERATOR_NAME}} at {{OPERATOR_ADDRESS}}', { ...OPERATOR, address: null })` → `'Alberto Valdes Rey at [to be completed: operator address]'`.
    - `{{NOPE}}` throws `/Unknown legal placeholder \{\{NOPE\}\}/`.
    - `extractClause('# T\n\n## T1. Scope\n\nA\n\nB\n\n## T2. Account\n\nC', 'T1')` → `{ id: 'T1', heading: 'Scope', text: 'A\n\nB' }`.
    - The last clause runs to the end.
    - A missing id → null.
    - `clauseIds` of the same → `['T1','T2']`.
    - `rawLegalText('terms','2026-10-22','en')` contains `Draft — under legal review`.
    - `rawLegalText('terms','1999-01-01','en')` → null.
  - `hash.test.ts`: `sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`, and the hash of a text with a filled address differs from the one with the marker.
- [ ] **Step 2:** Run `npx vitest run src/legal`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement the files above. The stub Markdown files hold `> **Draft — under legal review.**` only.
- [ ] **Step 4:** Run `npx vitest run src/legal`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(legal): versioned legal texts, placeholders, clause extraction and hashing`.

### Task 2: Terms of Service text

**Files:**
- Modify: `src/legal/content/en/terms-2026-10-22.md`
- Test: `src/legal/content.test.ts` (create)

**Interfaces:** consumes `rawLegalText`, `legalText`, `clauseIds`, `specificClauses` (Task 1).

- [ ] **Step 1: Write the failing test** (`content.test.ts`, describe "terms"):
  - `clauseIds(raw terms)` equals, literally, `['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12','T13','T24','T14','T15','T16','T17','T18','T19','T20','T21','T22','T23']`. That is the legal design §3 table order.
  - Every Terms id in `SPECIFIC_CLAUSE_IDS.terms` extracts with non-empty text and ends with "This clause is approved specifically at signature."
  - `legalText('terms', …)` does not throw (no unknown placeholders).
  - The text contains `Draft — under legal review` and `{{OPERATOR_NAME}}`.
  - The full `specificClauses()` check needs the DPA, so it is in Task 3.
- [ ] **Step 2:** Run `npx vitest run src/legal/content.test.ts`. Expected: FAIL (the stub has no clauses).
- [ ] **Step 3: Write the Terms in plain English**, one `## Tn. Heading` per row of legal design §3, implementing exactly that row's decision.
  - **Opening:** a title, the draft banner, and the parties:
    - the operator: `{{OPERATOR_NAME}}`, `{{OPERATOR_LEGAL_FORM}}`, `{{OPERATOR_ADDRESS}}`, `{{OPERATOR_COUNTRY}}`, `{{OPERATOR_REGISTRATION}}`;
    - the club: the legal entity named at sign-up, acting through the person who confirms authority;
    - the assignment right.
  - **Fixed values:**
    - season 1 September – 31 August;
    - 14 days' notice before suspension for non-payment;
    - 30 days' notice for operator termination and for changes;
    - the retrieval period is at least 30 days;
    - late interest at the statutory B2B rate (Italian rate H2 2026: 10.40%);
    - the cap is the fees for the season, or `{{FREE_USE_LIABILITY_CAP}}` for free use;
    - gross negligence, wilful misconduct, death or injury are not capped;
    - Luxembourg law and courts (§2);
    - the DSA contact: `{{OPERATOR_CONTACT_EMAIL}}`.
  - **Clauses that need specific approval** (P4) end with the sentence: "This clause is approved specifically at signature."
  - **No content beyond the spec's decisions:** where the spec says "Standard" (T19, T23), write a short standard clause.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `docs(legal): Terms of Service draft (EN)`.

### Task 3: DPA, sub-processors, privacy notice, DPIA support pack

**Files:**
- Modify the `src/legal/content/en/{dpa,subprocessors,privacy,dpia-pack}-2026-10-22.md` files.
- Test: `src/legal/content.test.ts` (extend).

- [ ] **Step 1: Write the failing tests:**
  - **DPA:**
    - `clauseIds(dpa)` equals `['D1',…,'D12']`;
    - it contains the headings `Annex I`, `Annex II`, `Annex III` (as `## Annex I. Processing description` etc., which `clauseIds` ignores because the id pattern is `^[TD]\d+$`);
    - it contains `48 hours`, `35 days`, `{{SUPPORT_HOURLY_RATE}}`;
    - it does not contain `audit log` (backup design: audit logs are named only once verified).
  - `specificClauses('2026-10-22','2026-10-22','en').map(c => c.id)` equals the P4 order, and every `text` is non-empty.
  - **Sub-processors:** contains `Google Ireland`, `Firebase Authentication`, `reCAPTCHA`, and a "not sub-processors" section mentioning AI providers.
  - **Privacy:** contains `controller`, `processor`, `CNPD`, `{{OPERATOR_PRIVACY_EMAIL}}`, and lists the storage keys `vcb.activeClub`, `vcb.signDraft`, `emailForSignIn`.
  - **DPIA pack:** contains `minors`, `profiling`, `photos`, `AI`, `checklist`.
  - All five render through `legalText` without throwing.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Write the texts:**
  - **DPA:** D1–D12 per legal design §4, with the corrected D4 and D8 wording. Annex I (processing description), Annex II (D4 measures written so each line is true today: no audit logs), Annex III (points to `/legal/subprocessors`).
  - **Sub-processors:** the §5 table plus the "not sub-processors" paragraph.
  - **Privacy:** rewrite per legal design §7, covering the two roles, the bases, retention per category, rights, CNPD as lead authority, transfers, "no tracking or analytics", and the localStorage/sessionStorage keys by purpose. Get the key list with `grep -rhoE "'vcb\.[a-zA-Z.]+'|'emailForSignIn'" src` and include each key found.
  - **DPIA pack:** per §7.
  - Every file starts with the title and the draft banner.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `docs(legal): DPA, sub-processors, privacy notice and DPIA pack drafts (EN)`.

### Task 4: Legal pages, Markdown renderer, footer links, SEO

**Files:**
- Create:
  - `src/legal/LegalMarkdown.tsx`
  - `src/legal/LegalDocPage.tsx`
  - `src/legal/LegalLinks.tsx`
- Modify:
  - `src/legal/PrivacyPage.tsx` (renders the privacy Markdown)
  - `src/App.tsx` (public route `/legal/:doc`)
  - `src/auth/LoginPage.tsx`, `src/interest/RequestAccessPage.tsx` (footer `LegalLinks`)
  - `src/layout/AppShell.tsx` (account menu "Legal" link to `/legal/terms`)
  - `src/seo/seoRoutes.ts`, `firebase.json`
- Test:
  - `src/legal/LegalMarkdown.test.tsx`
  - `src/legal/LegalDocPage.test.tsx`
  - `src/legal/PrivacyPage.test.tsx` (update)
  - `src/seo/seoRoutes.test.ts` (update)

**Interfaces (produces):**
- `LegalMarkdown({ text }: { text: string })` renders the subset:
  - `#`/`##`/`###` headings (a level-2 clause heading gets `id` = the clause id lowercased, e.g. `t12`);
  - paragraphs, `-` and `1.` lists, `**bold**`;
  - `[label](href)`: `href` limited to `/…`, `https://…`, `mailto:…`; anything else renders as plain text;
  - `> ` blockquote (the banner);
  - `|` tables with a header row.
- `LegalDocPage` reads `:doc` and the optional `?v=<version>`, and shows "Not found" for an unknown doc or version. For versioned docs without `?v`, it shows the in-force version and a line "Version <v>, in force since <date>". It uses `usePageMeta({ robots: 'index', canonicalPath: '/legal/<doc>' })` without `?v`, and `noindex` with it.
- `LegalLinks()`: links to Terms, DPA, Sub-processors, Privacy, DPIA pack.

- [ ] **Step 1: Write the failing tests:**
  - **Renderer:**
    - a heading `## T12. Liability` renders an `h2` with `id="t12"`;
    - `[x](javascript:alert(1))` renders the text `x` and no anchor;
    - `[x](/legal/dpa)` renders a link;
    - a two-row table renders `th` and `td`;
    - `**b**` renders `strong`.
  - **`LegalDocPage`** at `/legal/terms` shows the banner text and the `T12` heading; at `/legal/terms?v=1999-01-01` it shows "Not found"; at `/legal/nope` it shows "Not found".
  - **`PrivacyPage`** shows `controller` and the operator name.
  - **`seoRoutes.test`:** `PUBLIC_ROUTES` equals `['/login','/privacy','/request-access','/signup','/legal/terms','/legal/dpa','/legal/subprocessors','/legal/dpia-pack']`, and `PRIVATE_PREFIXES` includes `'/club'`, `'/platform'`, `'/signup/'`, `'/sign/'`, `'/welcome'` (the existing firebase.json parity test then forces the header update).
- [ ] **Step 2:** Run `npx vitest run src/legal src/seo`. Expected: FAIL.
- [ ] **Step 3:** Implement. Make sure the `/signup/` private prefix does not match the public `/signup`, and adjust `noindexHeaderSources` if it does.
- [ ] **Step 4:** Run, then run `npm run build`. Expected: PASS, and the build includes the `.md` files.
- [ ] **Step 5:** Commit `feat(legal): public legal pages and links`.

### Task 5: Acceptance builders and rules (sign-up, acceptance, re-acceptance)

**Files:**
- Create:
  - `src/legal/acceptance.ts`
  - `src/signup/signupDocs.ts`
  - `tests/rules/signup.rules.test.ts`
- Modify:
  - `firestore.rules`
  - `tests/rules/acceptances.rules.test.ts`
  - `tests/rules/clubDoc.rules.test.ts` (the :533 legal-update and :585 create-refused cases become precise refusals)
  - `tests/rules/testEnv.ts` (acceptance fixture gains `subprocessorsVersion`, `authTime`, `userAgent`; `dbAs(env, email, { authTime? })` passes `auth_time`)

**Interfaces (produces):**
- `acceptance.ts`: `buildAcceptance(input: { termsVersion: string; dpaVersion: string; subprocessorsVersion: string; language: 'en'; email: string; personName: string; authTime: number; userAgent: string }): Promise<Omit<Acceptance, 'acceptedAt'>>`.
  - It hashes `legalText('terms',…)`, `legalText('dpa',…)` and `clausesText(specificClauses(…))`.
  - It lowercases the email, trims the name, cuts `userAgent` to 300 characters, and sets `authorityConfirmed: true`.
- `signupDocs.ts` (pure; `serverTimestamp()` sentinels):
  - `signupClubDoc(input: { name: string; country: string; locale: ClubLocale }, email: string, versionKey: string): DocumentData`
  - `signupMemberDoc(clubId: string, email: string): DocumentData`
  - `acceptanceDoc(a: Omit<Acceptance,'acceptedAt'>): DocumentData`
  - `legalUpdate(versionKey: string, email: string): { legal: … }`

**Rules (`firestore.rules`, inside `match /clubs/{clubId}`):**
- **`signUpCreate()`** for `allow create`:
  - signed in;
  - keys exactly `name, country, locale, ownerEmail, aiEnabled, referenceOptOut, growthTestsEnabled, createdAt, status, statusReason, statusChangedAt, statusChangedBy, lastStatusLogId, legal, termination, billing`;
  - `status == 'pending'`, `ownerEmail == email()`, `createdAt == request.time`;
  - P11 booleans all `false`; status fields and `billing` null; `termination` the four null keys;
  - name, country and locale checks as in `clubAdminProfileChange`;
  - `legal` keys only `versionKey, acceptedAt, acceptedBy`, with `acceptedAt == request.time` and `acceptedBy == email()`;
  - `existsAfter` the member doc for `email()` with role `admin`;
  - `existsAfter` the acceptance at `legal.versionKey` with `acceptedBy == email()`.
  - Use only `getAfter`/`existsAfter` (the club doc does not exist yet).
- **members `create`**, a second branch:
  - `!exists(clubPath())`;
  - `getAfter(clubPath()).data.status == 'pending'` and `.ownerEmail == email()`;
  - `e == email()`, role `admin`, `validMember()`, `addedBy == email()`, `addedAt == request.time`.
- **`validAcceptance(v)`:**
  - keys exactly the `Acceptance` fields;
  - `versionKey == v == 'terms-' + termsVersion + '_dpa-' + dpaVersion`;
  - `acceptedBy == email()`, `acceptedAt == request.time`;
  - `authTime == request.auth.token.auth_time` and `request.time.toMillis() - authTime * 1000 <= 900000`;
  - `authorityConfirmed == true`; `language in ['en','it']`;
  - each sha matches `^[0-9a-f]{64}$`;
  - `specificClauses is list`;
  - `acceptedByName` a string of 1–100 characters; `userAgent` a string of ≤ 300 characters;
  - `!isPlatformAdmin()`.
- **acceptances `create`:** `validAcceptance(v) && (signUpBranch || reacceptBranch)`.
  - The sign-up branch: `!exists(clubPath())`, and `getAfter` club pending, owner `email()`, `legal.versionKey == v`.
  - The re-accept branch: `isClubAdmin()`, club status active (`isActive()`) or pending, and `getAfter(clubPath()).data.legal.versionKey == v`.
  - `update` and `delete` stay false.
- **Club `update`**, a new branch `legalReaccept()`:
  - `isClubAdmin()`, and `isActive()` or status pending;
  - `changed().hasOnly(['legal'])`;
  - `legal` keys as above, with `acceptedAt == request.time` and `acceptedBy == email()`;
  - `existsAfter` the acceptance at the new `versionKey`, with `getAfter(…).acceptedBy == email()`.

- [ ] **Step 1: Write the failing tests.**
  - **`signup.rules.test.ts`** builds every doc with `signupDocs.ts` and `acceptanceDoc(await buildAcceptance(…))`. It uses `authTime` = now − 60 s, passed as the token's `auth_time`.
    - Passing case: `a valid sign-up batch creates a pending club, its admin and the acceptance`.
    - Refused cases:
      - `refuses a batch without the acceptance`
      - `refuses an auth_time older than 15 minutes`
      - `refuses an acceptance whose authTime differs from the token`
      - `refuses a club whose ownerEmail is someone else`
      - `refuses status active, or aiEnabled true`
      - `refuses an existing club id` (seeded club `club-a`)
      - `refuses adding yourself to an existing club through the sign-up branch` (a member doc in `club-a` with a pending-looking batch)
      - `refuses extra keys on the club, member or acceptance`
      - `refuses the platform admin signing up` (`OPERATOR`)
      - `refuses a versionKey that does not match the versions`
  - **`acceptances.rules.test.ts`** keeps the read test and replaces the write test with:
    - `lets an active club admin re-accept: new acceptance plus legal update in one batch`
    - `refuses re-acceptance by a member`
    - `refuses re-acceptance by a club admin who is the platform admin`
    - `refuses updating or deleting an acceptance`
    - `refuses an acceptance without the matching legal update`
  - **`clubDoc.rules.test.ts`:**
    - `refuses a legal update without a matching acceptance`
    - the single-doc create stays refused
- [ ] **Step 2:** Run the rules suite for these files on 8181. Expected: FAIL (`allow create: if false`).
- [ ] **Step 3:** Implement `acceptance.ts`, `signupDocs.ts` and the rules. Keep `isPlatformAdmin()` out of every block except the club doc, acceptances, statusLog and interestSignups (spec §5 rule 1; `platformAdmin.rules.test` holds it).
- [ ] **Step 4:** Run the **whole** rules suite. Expected: all pass (the existing 454 plus the new ones).
- [ ] **Step 5:** Commit `feat(rules): self sign-up, acceptance records and re-acceptance`.

### Task 6: Signing core (draft, fresh link, commit)

**Files:**
- Create:
  - `src/legal/signDraft.ts`
  - `src/auth/reauth.ts`
  - `src/signup/signingApi.ts`
- Test:
  - `src/legal/signDraft.test.ts`
  - `src/auth/reauth.test.ts`
  - `src/signup/signingApi.test.ts`

**Interfaces (produces):**
- `signDraft.ts`:
  - `type SignDraft = { kind: 'signup'; clubId: string; club: { name; country; locale }; … } | { kind: 'reaccept'; clubId: string; … }`. Common fields: `email`, `personName`, `termsVersion`, `dpaVersion`, `subprocessorsVersion`, `language: 'en'`, `savedAt: number`.
  - `SIGN_DRAFT_KEY = 'vcb.signDraft'`, `DRAFT_TTL_MS = 24 * 60 * 60 * 1000`
  - `saveSignDraft(d, storage = localStorage)`, `readSignDraft(now: number, storage = localStorage): SignDraft | null` (null when missing, expired or malformed; never throws), `clearSignDraft(storage = localStorage)`
- `reauth.ts`:
  - `sendSigningLink(email: string): Promise<void>` (P6)
  - `currentAuthTime(user: User): Promise<number>` (`getIdTokenResult(true)`, `claims.auth_time` as a number)
  - `SIGNING_WINDOW_MS = 14 * 60 * 1000`
  - `signingWindowOpen(authTimeSec: number, nowMs: number): boolean`
- `signingApi.ts`:
  - `type CommitOutcome = 'done' | 'alreadyDone' | 'linkExpired' | 'noDraft' | 'wrongAccount'`
  - `commitSignDraft(user: User, now = Date.now()): Promise<CommitOutcome>`. In order:
    1. Read the draft; none → `noDraft`.
    2. The user's email ≠ the draft's email → `wrongAccount`.
    3. Window closed → `linkExpired`.
    4. Build the acceptance (Task 5).
    5. Write the batch with explicit `doc(db,'clubs',clubId,…)` paths: §6.3 for a sign-up, acceptance plus `legalUpdate` for a re-acceptance.
    6. On `permission-denied`, check whether `clubs/<id>/acceptances/<versionKey>` already exists with `acceptedBy == email` → `alreadyDone`, else rethrow.
    7. Clear the draft on `done` or `alreadyDone`.
  - For a sign-up, also `storeClub(clubId)` (from `src/clubs/activeClub.ts`), so the reload opens the new club.

- [ ] **Step 1: Write the failing tests:**
  - **Draft:**
    - round trip;
    - expired after 24 h → null;
    - malformed JSON → null;
    - storage throwing → null.
  - **`reauth`:**
    - `signingWindowOpen(1000, 1000_000 + 13*60_000)` → true;
    - `(…, + 14*60_000)` → false;
    - `sendSigningLink` calls `sendSignInLinkToEmail` with `url` ending `/finish-sign-in`, and stores the return path `/sign/complete` (mock `firebase/auth`, as `LoginPage.test` does).
  - **`signingApi`** (mock `firebase/firestore` batch, `getIdTokenResult` and the doc read): one test per outcome. For a sign-up draft the batch receives exactly three `set` calls, on `clubs/<id>`, `clubs/<id>/members/<email>` and `clubs/<id>/acceptances/<key>`.
- [ ] **Step 2:** Run `npx vitest run src/legal src/auth src/signup`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(signup): signing draft, fresh email link and commit`.

### Task 7: Sign-up screens

**Files:**
- Create:
  - `src/signup/SignupInfoPage.tsx` (`/signup`, public)
  - `src/signup/SignupPage.tsx` (`/signup/club`)
  - `src/signup/DocumentsStep.tsx`
  - `src/signup/SpecificApprovalStep.tsx`
  - `src/signup/SignCompletePage.tsx` (`/sign/complete`)
- Modify:
  - `src/App.tsx`: `/signup` public; `/signup/club` and `/sign/complete` under `RequireSignedIn`, outside `ClubGate`
  - `src/auth/LoginPage.tsx`: a "Create your club" link to `/signup`
  - `src/clubs/WelcomePage.tsx`: a "Create a club" button to `/signup/club`
  - `src/clubs/ClubStatusScreen.tsx`: the pending kind shows the accepted versions with links, and "We'll email you when it's active"
- Test: the component tests next to each file.

**Interfaces:**
- **Consumes:** Tasks 1, 5, 6; `CLUB_COUNTRY_CODES` from `clubAdminApi`; `useAuth()` (`memberships`, `isPlatformAdmin`, `firebaseUser`).
- **Produces** `DocumentsStep({ termsVersion, dpaVersion, onDone })` and `SpecificApprovalStep({ termsVersion, dpaVersion, email, isOperator, onSend })`, which Task 8 reuses.

**Behaviour:**
- **`SignupPage`, step 1 (club details):**
  - Fields: club name (2–80), country select, language (`en` only for now, shown read-only "English"), the person's name (1–100), and the required checkbox "I am authorised to act for this club and accept these terms on its behalf".
  - If `memberships` has a club with status `pending`, the page shows "You already have a club waiting for activation" and no form (client prevention, spec §6.3).
- **Step 2 (`DocumentsStep`):** Terms and DPA, each in a scroll box rendered with `LegalMarkdown`. Each has a checkbox ("I have read and accept the Terms of Service" / "… the Data Processing Agreement"), enabled once its box has been scrolled to the end or its "Open in a new tab" link has been clicked. The sub-processors link is shown.
- **Step 3 (`SpecificApprovalStep`):**
  - Lists `specificClauses()` with id, heading and full text, plus one button "Approve these clauses specifically".
  - It saves the draft (with `clubId` from `doc(collection(db,'clubs')).id`), calls `sendSigningLink(email)`, and shows "We've sent a confirmation link to <email>. Open it in this browser to sign."
  - If `isPlatformAdmin`, the button is replaced by "The platform operator's account cannot sign for a club."
- **`SignCompletePage`:** runs `commitSignDraft` once (guard against React StrictMode double effects with a ref), then shows by outcome:
  - `done` / `alreadyDone`: `window.location.assign('/')`;
  - `linkExpired`: "The link is older than 15 minutes" with "Send a new link";
  - `noDraft`: "Open the link in the browser where you started";
  - `wrongAccount`: "Signed in as another account";
  - any error: `role="alert"` with the message.

- [ ] **Step 1: Write the failing tests:**
  - **`SignupPage`:**
    - step 1 validation: a name shorter than 2 characters shows an error;
    - authority unchecked blocks Next;
    - with a pending membership it shows the "already waiting" text.
  - **`DocumentsStep`:** checkboxes are disabled until the "Open" link is clicked; Next is enabled only with both checked.
  - **`SpecificApprovalStep`:**
    - renders exactly 13 clause headings in P4 order;
    - clicking the button calls `onSend`;
    - with `isOperator` there is no button and the explanation is shown.
  - **`SignCompletePage`:**
    - each outcome renders its text (mock `commitSignDraft`);
    - `done` calls `location.assign('/')`;
    - the commit runs once under StrictMode.
  - **`ClubStatusScreen`** pending: shows `terms-2026-10-22_dpa-2026-10-22` with links to `/legal/terms?v=2026-10-22` and `/legal/dpa?v=2026-10-22`, and "We'll email you".
  - **`LoginPage`** has "Create your club"; **`WelcomePage`** has "Create a club".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run, then run `npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(signup): club sign-up with specific approval`.

### Task 8: Review of new versions, notices, Contract tab

**Files:**
- Create:
  - `src/legal/LegalReviewScreen.tsx`
  - `src/legal/LegalNoticeBanner.tsx`
- Modify:
  - `src/clubs/ClubGate.tsx` (the review row of §8.3)
  - `src/layout/AppShell.tsx` (banner for club admins)
  - `src/clubs/area/ContractTab.tsx`
- Test: component tests for each, plus `src/clubs/ClubGate.test.tsx` (extend).

**Behaviour:**
- **`ClubGate`:** when the view is `app` or `ending`, `role === 'admin'` and `needsReview(club.legal, now)`:
  - not a platform admin: render `LegalReviewScreen`;
  - a platform admin: render children, plus a notice "This club has not accepted the current Terms and DPA. Only <ownerEmail> or another club admin can accept them; the platform operator cannot." (P10).
  - Members render children unchanged.
- **`LegalReviewScreen`:**
  - The title "Review the updated Terms and DPA" ("Accept the Terms and DPA" when `legal` is null).
  - The in-force versions' `summary` lines.
  - The person's name and authority checkbox, `DocumentsStep`, then `SpecificApprovalStep`, with a `reaccept` draft for the active club.
  - Below: "Don't agree? End our contract", which uses the existing `requestTermination` behind a `ConfirmDialog`, then signs out to the restricted view.
- **`LegalNoticeBanner`** (club admins only; dismissible per session with sessionStorage key `vcb.legalNoticeDismissed.<version>`):
  - When `upcoming('terms'|'dpa', now)` exists: "Updated terms take effect on <effectiveFrom> — review", linking to `/legal/<doc>?v=<version>`.
  - When `upcoming('subprocessors', now)` exists: "The sub-processor list changes on <date>. You can object within 15 days of this notice", linking to the list and the operator contact.
- **`ContractTab`:** the accepted versions link to `/legal/terms?v=…` and `/legal/dpa?v=…` via `parseVersionKey`, and the sub-processors link is added.

- [ ] **Step 1: Write the failing tests:**
  - **`ClubGate`:**
    - an admin with `legal: null` sees "Accept the Terms and DPA";
    - a member with `legal: null` sees the app;
    - an admin who is a platform admin sees the app plus the notice text;
    - an admin with the current key sees the app.
  - **`LegalNoticeBanner`** with a mocked upcoming version (inject the versions via props or a module mock):
    - shows the date and link;
    - hidden for members;
    - hidden after dismiss.
  - **`ContractTab`** shows the two links for `terms-2026-10-22_dpa-2026-10-22`.
  - **`LegalReviewScreen`:** "End our contract" opens the confirm dialog.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(legal): review and notice of new versions; contract links`.

### Task 9: Product guardrails (photo consent, health hints, AI labels)

**Files:**
- Modify:
  - `src/types/player.ts`
  - `firestore.rules` (player writes)
  - `tests/rules/players.rules.test.ts` (or the file holding the player write rules)
  - `src/players/playersApi.ts`
  - `src/players/PlayerCardPage.tsx`
  - `src/awards/AwardsPage.tsx`
  - the free-text fields listed below
  - `src/aiDraft/ExerciseProposalReview.tsx`, `src/aiDraft/TrainingProposalReview.tsx`
  - `src/settings/AiProviderSettings.tsx`
- Create: `src/components/HealthHint.tsx`
- Test:
  - the rules test
  - `src/players/PlayerCardPage.test.tsx`
  - `src/awards/AwardsPage.test.tsx` (or the existing gating test)
  - `src/components/HealthHint.test.tsx`
  - component tests touching the hint and badges

**Interfaces:**
- `Player.photoConsent?: boolean; photoConsentAt?: Timestamp | null; photoConsentBy?: string | null`.
- `setPhotoConsent(teamId: string, playerId: string, given: boolean, byEmail: string): Promise<void>` writes:
  - when given: `{ photoConsent: true, photoConsentAt: serverTimestamp(), photoConsentBy: byEmail }`;
  - when withdrawn: `{ photoConsent: false, photoConsentAt: null, photoConsentBy: null }`.
- Rules on player create and update:
  - if `photoConsent` is present it is a bool;
  - when it changes to `true`: `photoConsentBy == email()` and `photoConsentAt == request.time`;
  - when `false`: both null.
- `HealthHint()` renders the text `Don't record health, injury or medical information.` (`text-caption`, linked to its field with `aria-describedby` by the caller).

- [ ] **Step 1: Write the failing tests:**
  - **Rules:**
    - `lets a team admin record photo consent with their own email and request time`
    - `refuses photo consent recorded in someone else's name`
    - `refuses a non-boolean photoConsent`
    - `withdrawing clears the date and the email`
  - **`PlayerCardPage`:** the privacy tab shows "Guardian consent to use photos in award cards" with a toggle for team admins, which calls `setPhotoConsent`.
  - **Awards:** a player with `consent.given: true` but no `photoConsent` gets no photo slot ("No photo consent on file"); a player with `photoConsent: true` gets one.
  - **`HealthHint`:** renders the exact text. `DevelopmentPlanEditor`, `AddPhysicalTestDialog` and `AssignTrainingDialog` render the hint under their notes fields.
  - **AI:** `ExerciseProposalReview` and `TrainingProposalReview` cards show the badge `AI draft`. `AiProviderSettings` shows "With your own key, the AI provider you choose works for your club, not for us."
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - Add `HealthHint` under every field in the recon list:
    - `DevelopmentPlanEditor`: coach comments and general notes;
    - `AddPhysicalTestDialog` notes;
    - `SessionQualityPanel` notes;
    - `TeamSettingsTab` notes;
    - `TeamNotesDialog` general and per-player;
    - `AssignTrainingDialog` notes;
    - `AwardsPrepare` custom note.
  - Run `grep -rniE "injur|absence|sick|illness" src --include=*.tsx`, and rename any availability wording to neutral "unavailable". List the fields touched in the commit message.
- [ ] **Step 4:** Run the unit suite and the rules suite. Expected: PASS.
- [ ] **Step 5:** Commit `feat: photo consent per player, health hints, AI draft labels`.

### Task 10: Seeds, docs, final verification

**Files:**
- Modify:
  - `scripts/seed/clubArg.mjs`
  - `scripts/seed/seedClubs.mjs`
  - `scripts/seed/README.md`
  - `CLAUDE.md`
  - `docs/PRODUCTION-READINESS.md`
  - club-platform spec (a "Resolved (Plan 3)" note before §7)
  - legal spec (a "Resolved (Plan 3)" note: English only; ids and format P1–P5)
- Test: `scripts/seed/clubArg.test.mjs` (extend)

- [ ] **Step 1: Write the failing test.** Add `seedAcceptance({ versionKey, email, name })` to `clubArg.mjs`. It returns an acceptance doc with every rules key, the `'0'.repeat(64)` hashes, `authTime: 0` and `userAgent: 'seed-script'`. The test checks that its keys equal the `Acceptance` field list (copied literally into the test).
- [ ] **Step 2:** Run `npx vitest run scripts/seed`. Expected: FAIL.
- [ ] **Step 3:** Implement, and update the seeds.
  - `rival`: accepted (`legal` set plus an acceptance by `rival@example.com`).
  - `newclub`: pending, with `legal` plus an acceptance by `pending@example.com`.
  - `demo`: stays `legal: null`. Its admin is the operator, so the operator notice shows (P10).
  - Add a club `review`: active, admin `review@example.com`, `legal: null`, to see the blocking review screen.
  - Read the version key from `src/legal/content/versions.json`.
- [ ] **Step 4: Docs.**
  - `CLAUDE.md` gets a "Legal texts and sign-up" paragraph: the files, P3/P6/P9/P10, and the seed sign-ins.
  - The seed README lists the new club.
  - PRODUCTION-READINESS gets:
    - "Fill the `[to be completed]` operator fields in `src/legal/operator.ts`";
    - "Lawyer review before any outside club is activated (launch gate)";
    - "Verify in the Auth emulator that `auth_time` is fresh after the signing link" (spec §11; record the result).
  - The spec notes.
- [ ] **Step 5: Verify by hand on the emulator** (`npm run dev:emulator`):
  1. Sign in as a new email.
  2. Go through Welcome, then Create a club, the three steps and the link from the Auth emulator console.
  3. Check that `/sign/complete` lands on the pending screen.
  4. Sign in as `operator@example.com`, then `/platform`, then Activate.
  5. Sign in as `review@example.com` and check the review screen blocks; accept it.

  Record any failure as a fix with a test.
- [ ] **Step 6: Run everything:** `npm test`, the full rules suite on 8181, `npm run build`, `npm run lint`. Expected: all pass, with no new lint errors.
- [ ] **Step 7:** Commit `docs: sign-up and legal acceptance; seeds`.
