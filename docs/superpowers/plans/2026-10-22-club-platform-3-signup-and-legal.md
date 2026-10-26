# Club Platform Plan 3: Sign-up and Legal Acceptance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A club can sign itself up and accept the Terms and DPA, with a specific-approval step confirmed by a fresh email link. Existing clubs review and accept new versions. The legal texts are published in five languages, and the product guardrails those texts promise are in place.

**Architecture:**
- Legal texts are versioned Markdown files per language, rendered by a small in-house renderer and hashed client-side (Web Crypto) after operator placeholders are filled in.
- Sign-up and re-acceptance share one signing core: a draft saved in localStorage, a fresh email link, and an atomic batch the rules accept only within 15 minutes of that sign-in.
- Rules gain the sign-up create, the acceptance create (the operator is excluded) and the club admin's `legal` update. Each is pinned by rules tests that build their docs with the app's own builders.

**Tech Stack:** React 18 + TS + Vite, Firebase Auth email link, Firestore rules, vitest, @firebase/rules-unit-testing.

**Specs:**
- `docs/superpowers/specs/2026-10-20-volley-skills-club-platform-design.md`: §3.1 club fields, §5, §6, §7.1 Contract, §8.3, §8.6, §10.
- `docs/superpowers/specs/2026-10-20-volley-skills-legal-documents-design.md`: all of it. The backup design (2026-10-22) already corrected D4 and D8.

## Global Constraints

- No new npm dependency. The Markdown renderer is written here: no `dangerouslySetInnerHTML`.
- **Legal languages:** `LEGAL_LANGS = ['en','it','fr','de','es']` (operator, 2026-10-23).
  - Every document exists in every language, with identical clause ids.
  - T22 says the **English version prevails** if versions differ; this is flagged for the lawyer.
  - The app's own UI stays English (the Italian plan translates it later). Only the legal texts and their language switcher are multilingual.
- Every legal text shows its draft banner until the lawyer gate is passed:

  | Lang | Draft banner |
  |---|---|
  | en | Draft — under legal review |
  | it | Bozza — in corso di revisione legale |
  | fr | Projet — en cours de revue juridique |
  | de | Entwurf — in rechtlicher Prüfung |
  | es | Borrador — en revisión jurídica |

- Operator identity comes from `src/legal/operator.ts` only. The operator is an **individual** (no company, no registration, no VAT, operator 2026-10-23).
  - A null registration or VAT is **omitted** (its placeholder renders empty).
  - A null address renders the visible marker `[to be completed: operator address]`, never an invented value.
- Hashes are SHA-256 hex of the **exact strings rendered** (after placeholder substitution, in the language shown), computed with `crypto.subtle`.
- Emails are compared and stored lowercased.
- Sign-up code builds `clubs/<newId>/…` paths explicitly (`doc(db, 'clubs', id, …)`), because `clubDoc()`/`clubCol()` throw without an active club.
- The sign-up creates no `sectionAccess` docs (ruling: `accessApi` creates them with `set(…, {merge: true})` on first grant, and rules already treat missing docs as no grant).
- Every rules change has a rules test (`tests/rules/`, run on port 8181 with the scratch config `{"firestore": {}, "emulators": {"firestore": {"port": 8181}, "ui": {"enabled": false}}}` via `npx firebase emulators:exec --only firestore --config <it> "npx vitest run --config vitest.rules.config.ts <files>"`; the dev emulator holds 8080 and must not be touched).
- UI per the design system: page titles via `PageHeader`/shell titles, success via `useNotify()`, errors inline `role="alert"`.
- No analytics or tracking. Logs carry no personal data.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `serviceAccountKey.json*`, `.env.local`, `reference/`.

## Decisions this plan fixes

| # | Decision |
|---|---|
| P1 | Version ids are ISO dates. First version of `terms`, `dpa`, `subprocessors`: `2026-10-22`, announced and effective `2026-10-22`, `material: true`. `privacy` and `dpia-pack` are single files with the same date in the name, not versioned for acceptance. |
| P2 | `versionKey = 'terms-<termsVersion>_dpa-<dpaVersion>'` (spec §6.2). |
| P3 | Clause format in the Markdown: each clause is a level-2 heading `## T12. <Heading>` (`## D5. <Heading>` in the DPA), with the heading in the document's language, and its text runs to the next level-2 heading. Ids are the same in every language. The specific-approval texts are **extracted** from the documents, never duplicated. |
| P4 | Specific-approval ids: `terms`: T2, T8, T9, T11, T12, T13, T14, T15, T20, T21; `dpa`: D5, D9, D11 (legal design §8). Each such clause ends with the sentence in the table under P4a. |
| P4a | en "This clause is approved specifically at signature." · it "Questa clausola è approvata specificamente alla firma." · fr "Cette clause est approuvée spécifiquement lors de la signature." · de "Diese Klausel wird bei der Unterzeichnung gesondert genehmigt." · es "Esta cláusula se aprueba específicamente en la firma." |
| P5 | `clausesSha256` hashes `clausesText(clauses)`: for each clause in id order, `<id>. <heading>\n\n<text>`, joined with `\n\n---\n\n`. |
| P6 | Re-auth: before sending the signing link, `rememberReturnTo('/sign/complete')` and `saveEmailForSignIn(email)`. The link lands on the existing `/finish-sign-in`, which signs in again (fresh `auth_time`) and returns to `/sign/complete`. |
| P7 | The draft (`vcb.signDraft` in localStorage) carries the new club id, chosen when the draft is saved, so a second commit of the same draft fails on "club exists" instead of creating a second club. The draft expires after 24 hours. |
| P8 | The client commits only while `now − auth_time < 14 min` (one minute short of the rules' 15) and otherwise offers "Send a new link". |
| P9 | After a successful commit the app does `window.location.assign('/')`. The same-uid re-sign-in fires no `onAuthStateChanged`, so a reload is what refreshes memberships and the club. |
| P10 | The review screen blocks club admins whose accepted version is outdated. A club admin who is also a platform admin (the operator in the home club) cannot accept (rules, kept by the operator 2026-10-23), so they see a non-blocking notice naming `ownerEmail` instead. Members are never blocked. |
| P11 | New clubs: `aiEnabled: false`, `growthTestsEnabled: false`, `referenceOptOut: false` (spec §3.1 defaults), enforced by the create rule. The Firestore auto-id is the club id. |
| P12 | Award photos and cut-outs for **minors** are gated on the new `player.photoConsent === true`. A player with no valid date of birth counts as a minor. **Adults (18+) need no photo consent toggle** (operator 2026-10-23); the texts say photos of adults rely on the club's own basis. Existing minors start without photo consent (by design). |
| P13 | The language of the texts a person signs is chosen on the signing screens: default from `navigator.language` if it is in `LEGAL_LANGS`, else `en`, with a switcher. It is stored in the draft and the acceptance (`language`). |
| P14 | Operator placeholders: `{{OPERATOR_NAME}}`, `{{OPERATOR_ADDRESS}}` (marker when null), `{{OPERATOR_COUNTRY}}` (country name in the document's language via `Intl.DisplayNames`, from ISO `LU`), `{{OPERATOR_REGISTRATION}}` and `{{OPERATOR_VAT}}` (localized "Registration: X." / "VAT: X." sentence, or empty when null), `{{OPERATOR_CONTACT_EMAIL}}`, `{{OPERATOR_PRIVACY_EMAIL}}`, `{{SUPPORT_HOURLY_RATE}}` (`€80`), `{{FREE_USE_LIABILITY_CAP}}` (`€100`). The texts describe the operator as a natural person in their own words. |
| P15 | Seeds: the `demo` club is accepted by a seeded officer `president@example.com` (an admin member, not the operator), so the operator (demo admin) sees neither the review screen nor the notice (operator 2026-10-23). A separate `review` club shows the blocking screen. |

## Review Focus

1. **The signing link is opened in another browser or device** (no draft there). Nothing is written, and the page says to open the link in the browser where the sign-up started. Test in Task 11.
2. **The link is opened more than 14 minutes after the fresh sign-in, or the page is left open that long.** The page refuses and offers a new link; the rules refuse past 15 minutes. Tests in Tasks 9 and 11.
3. **A reload, double click or second tab on `/sign/complete`** must not create two clubs or two acceptances: a stable club id in the draft, the draft cleared on success, and an "already done" outcome when the club or acceptance exists. Test in Task 10.
4. **The operator's account tries to sign** (sign-up or re-accept). The client explains before sending a link; the rules refuse. Tests in Tasks 9, 11 and 12.
5. **A text in one language drifts from another**: a clause id missing or extra, or a placeholder misspelled, in one translation. The per-language content tests (identical clause ids, no unknown placeholders, banner present) catch it. Tests in Tasks 4–7.

---

### Task 1: Legal content core (versions, loading, placeholders, clauses, hashing)

**Files:**
- Create:
  - `src/legal/content/versions.json`
  - `src/legal/versions.ts`
  - `src/legal/legalDocs.ts`
  - `src/legal/specificClauses.ts`
  - `src/legal/hash.ts`
  - stub files `src/legal/content/<lang>/{terms,dpa,subprocessors,privacy,dpia-pack}-2026-10-22.md` for each of the 5 languages, each holding only `> **<draft banner>.**` (Tasks 2–7 fill them)
- Modify:
  - `src/legal/operator.ts`
  - `src/types/club.ts` (add `Acceptance`)
- Test:
  - `src/legal/versions.test.ts`
  - `src/legal/legalDocs.test.ts`
  - `src/legal/hash.test.ts` (`// @vitest-environment node`)

**Interfaces (produces):**
- `operator.ts`:
  - `OPERATOR: { name: string; country: string /* ISO */; address: string | null; registration: string | null; vat: string | null; contactEmail: string; privacyEmail: string }`.
  - Values: name `Alberto Valdes Rey`, country `LU`, address `null` (the operator supplies it), registration `null`, vat `null`, both emails `alberto.valdes.rey.official@gmail.com` (today's privacy contact).
  - Keep `OPERATOR_CONTACT_EMAIL` as an alias of `OPERATOR.contactEmail`.
- `versions.ts`:
  - `LEGAL_LANGS = ['en','it','fr','de','es'] as const`, `type LegalLang = typeof LEGAL_LANGS[number]`
  - `type LegalDocId = 'terms' | 'dpa' | 'subprocessors' | 'privacy' | 'dpia-pack'`
  - `type VersionedDoc = 'terms' | 'dpa' | 'subprocessors'`
  - `interface LegalVersion { version: string; announcedAt: string; effectiveFrom: string; material: boolean; summary: string }`
  - Pure cores `inForceIn(list, date)`, `upcomingIn(list, date)`, `needsReviewIn(versions, legal, date)`. The public helpers call them with the JSON:
    - `inForce(doc: VersionedDoc, date: Date): LegalVersion` (latest with `effectiveFrom ≤ date`; throws if none)
    - `upcoming(doc, date): LegalVersion | null` (`announcedAt ≤ date < effectiveFrom`)
    - `needsReview(legal: ClubLegal | null, date: Date): boolean`
  - `versionKey(terms: string, dpa: string): string`
  - `parseVersionKey(key: string): { terms: string; dpa: string } | null`
  - `CURRENT_DOC_VERSION: Record<'privacy' | 'dpia-pack', string>`
  - `DRAFT_BANNER: Record<LegalLang, string>` (table above)
  - `SPECIFIC_SENTENCE: Record<LegalLang, string>` (P4a)
  - `defaultLegalLang(navigatorLanguage: string | undefined): LegalLang`
  - Dates compare as `YYYY-MM-DD` strings in UTC.
- `legalDocs.ts`:
  - `rawLegalText(doc: LegalDocId, version: string, lang: LegalLang): string | null`, from `import.meta.glob('./content/*/*.md', { query: '?raw', import: 'default', eager: true })`
  - `substitutePlaceholders(text: string, lang: LegalLang, operator = OPERATOR): string` (P14; an unknown `{{…}}` throws `Unknown legal placeholder {{X}}`)
  - `legalText(doc, version, lang): string` (raw, then substituted; throws if missing)
  - `extractClause(md: string, id: string): { id: string; heading: string; text: string } | null`
  - `clauseIds(md: string): string[]` (ids matching `^[TD]\d+$` only)
- `specificClauses.ts`:
  - `SPECIFIC_CLAUSE_IDS = { terms: [...P4], dpa: [...P4] } as const`
  - `interface SpecificClause { id: string; heading: string; text: string }`
  - `specificClauses(termsVersion, dpaVersion, lang): SpecificClause[]` (Terms ids, then DPA ids; throws naming any missing id)
  - `clausesText(clauses: SpecificClause[]): string` (P5)
- `hash.ts`: `sha256Hex(text: string): Promise<string>`.
- `types/club.ts`: `Acceptance { versionKey; termsVersion; dpaVersion; subprocessorsVersion; language: LegalLang; termsSha256; dpaSha256; clausesSha256; specificClauses: string[]; acceptedBy; acceptedByName; authorityConfirmed: true; acceptedAt: Timestamp | null; authTime: number; userAgent: string }`.

- [ ] **Step 1: Write the failing tests:**
  - **Versions:**
    - `inForce('terms', new Date('2026-10-22T00:00:00Z')).version === '2026-10-22'`; it throws before every version.
    - `upcoming('terms', today)` → null.
    - A fixture version announced `2026-11-01` and effective `2026-12-01` is upcoming on `2026-11-15` and in force on `2026-12-01`.
    - `needsReviewIn`:
      - `null` legal → true;
      - accepted `terms-2026-10-22_dpa-2026-10-22` with only a non-material `2026-12-01` terms in force → false;
      - with a material `2026-12-01` dpa in force → true;
      - an unparsable key → true.
    - `versionKey('a','b') === 'terms-a_dpa-b'`; `parseVersionKey` round trip; `parseVersionKey('x')` → null.
    - `defaultLegalLang('it-IT') === 'it'`, `defaultLegalLang('pt-BR') === 'en'`, `defaultLegalLang(undefined) === 'en'`.
  - **Docs:**
    - `substitutePlaceholders('{{OPERATOR_NAME}}, {{OPERATOR_ADDRESS}}, {{OPERATOR_COUNTRY}}.{{OPERATOR_VAT}}', 'en', { ...OPERATOR, address: null, vat: null })` → `'Alberto Valdes Rey, [to be completed: operator address], Luxembourg.'`.
    - With `'it'` the country is `Lussemburgo`. With `vat: 'LU123'` and `'en'` the VAT sentence `VAT: LU123.` appears (leading space as written by the implementer; assert `toContain('VAT: LU123.')`).
    - `{{NOPE}}` throws `/Unknown legal placeholder \{\{NOPE\}\}/`.
    - `extractClause('# T\n\n## T1. Scope\n\nA\n\nB\n\n## T2. Account\n\nC', 'T1')` → `{ id: 'T1', heading: 'Scope', text: 'A\n\nB' }`. The last clause runs to the end; a missing id → null.
    - `clauseIds` of that text → `['T1','T2']`, and `## Annex I. X` is ignored.
    - For every language in `LEGAL_LANGS` and every doc, `rawLegalText(doc, '2026-10-22', lang)` contains `DRAFT_BANNER[lang]`.
    - `rawLegalText('terms','1999-01-01','en')` → null.
  - **Hash:** `sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`, and texts substituted with and without an address hash differently.
- [ ] **Step 2:** Run `npx vitest run src/legal`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/legal`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(legal): versioned multilingual legal texts, placeholders, clause extraction and hashing`.

### Task 2: Terms of Service (English)

**Files:**
- Modify: `src/legal/content/en/terms-2026-10-22.md`
- Test: `src/legal/content.test.ts` (create)

- [ ] **Step 1: Write the failing test** (`describe('terms en')`):
  - `clauseIds(raw)` equals, literally, `['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12','T13','T24','T14','T15','T16','T17','T18','T19','T20','T21','T22','T23']`. That is the legal design §3 table order. Export this list from the test file as `TERMS_IDS` for Tasks 4–7.
  - Every id in `SPECIFIC_CLAUSE_IDS.terms` extracts with non-empty text ending with `SPECIFIC_SENTENCE.en`.
  - `legalText('terms','2026-10-22','en')` does not throw.
  - The text contains `DRAFT_BANNER.en`, `{{OPERATOR_NAME}}`, `{{OPERATOR_ADDRESS}}`, `{{FREE_USE_LIABILITY_CAP}}`, and the phrase `English version prevails`.
- [ ] **Step 2:** Run `npx vitest run src/legal/content.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the Terms in plain English**, one `## Tn. Heading` per row of legal design §3, implementing exactly that row's decision.
  - **Opening:** the title, the banner, and the parties:
    - the operator: `{{OPERATOR_NAME}}`, a natural person, `{{OPERATOR_ADDRESS}}`, `{{OPERATOR_COUNTRY}}`, `{{OPERATOR_REGISTRATION}}`, `{{OPERATOR_VAT}}`;
    - the club: the legal entity named at sign-up, acting through the person who confirms authority;
    - the assignment right.
  - **Fixed values:**
    - season 1 September – 31 August;
    - 14 days' notice before suspension for non-payment;
    - 30 days' notice for operator termination and for changes;
    - a retrieval period of at least 30 days;
    - late interest at the statutory B2B rate (Italian rate H2 2026: 10.40%);
    - the cap is the season's fees, or `{{FREE_USE_LIABILITY_CAP}}` for free use;
    - gross negligence, wilful misconduct, death or injury are not capped;
    - Luxembourg law and courts (§2);
    - the DSA contact: `{{OPERATOR_CONTACT_EMAIL}}`.
  - **T22:** English, Italian, French, German and Spanish versions; the English version prevails if they differ.
  - **T7:** add that photos of minors are used only with recorded guardian consent, and that photos of adults rely on the club's own basis.
  - **Specific-approval clauses** (P4) end with `SPECIFIC_SENTENCE.en`. Write short standard clauses where the spec says "Standard" (T19, T23). Add nothing beyond the spec's decisions.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `docs(legal): Terms of Service draft (EN)`.

### Task 3: DPA, sub-processors, privacy notice, DPIA support pack (English)

**Files:**
- Modify the `src/legal/content/en/{dpa,subprocessors,privacy,dpia-pack}-2026-10-22.md` files.
- Test: `src/legal/content.test.ts` (extend)

- [ ] **Step 1: Write the failing tests** (`describe('other docs en')`):
  - **DPA:**
    - `clauseIds(dpa)` equals `['D1',…,'D12']` (export `DPA_IDS`);
    - it has `## Annex I.`, `## Annex II.`, `## Annex III.` headings;
    - it contains `48 hours`, `35 days`, `{{SUPPORT_HOURLY_RATE}}`;
    - it does **not** contain `audit log` (backup design: audit logs are named only once verified).
  - `specificClauses('2026-10-22','2026-10-22','en').map(c => c.id)` equals the P4 order, and every text ends with `SPECIFIC_SENTENCE.en`.
  - **Sub-processors:** contains `Google Ireland`, `Firebase Authentication`, `reCAPTCHA`, and a section on AI providers not being sub-processors.
  - **Privacy:** contains `controller`, `processor`, `CNPD`, `{{OPERATOR_PRIVACY_EMAIL}}`, and the storage keys `vcb.activeClub`, `vcb.signDraft`, `emailForSignIn`.
  - **DPIA pack:** contains `minors`, `profiling`, `photos`, `AI`, `checklist`.
  - All render through `legalText(…, 'en')` without throwing.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Write the texts:**
  - **DPA:** D1–D12 per legal design §4 (D4 and D8 as corrected; D12 also says photos of minors require recorded guardian consent). Annex I, Annex II (D4 measures written so each line is true today: no audit logs), Annex III (points to `/legal/subprocessors`).
  - **Sub-processors:** the §5 table plus the "not sub-processors" paragraph.
  - **Privacy:** per legal design §7, covering:
    - the two roles, the bases, retention per category;
    - rights, CNPD as lead authority, transfers, "no tracking or analytics";
    - the storage keys by purpose. Get the list with `grep -rhoE "'vcb\.[a-zA-Z.]+'|'emailForSignIn'" src`, and add `vcb.signDraft` and `vcb.legalNoticeDismissed.*` (introduced in this plan).
  - **DPIA pack:** per §7.
  - Every file starts with the title and the banner.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `docs(legal): DPA, sub-processors, privacy notice and DPIA pack drafts (EN)`.

### Tasks 4–7: Translations (IT, FR, DE, ES)

One task per language, same shape: **Task 4 = `it`, Task 5 = `fr`, Task 6 = `de`, Task 7 = `es`.**

**Files:**
- Modify: `src/legal/content/<lang>/{terms,dpa,subprocessors,privacy,dpia-pack}-2026-10-22.md`
- Test: `src/legal/content.test.ts`, extended with `describe.each` over the language

- [ ] **Step 1: Write the failing test** for `<lang>`:
  - `clauseIds(terms)` equals `TERMS_IDS` and `clauseIds(dpa)` equals `DPA_IDS`;
  - the five docs contain `DRAFT_BANNER[lang]`;
  - every specific clause extracts with text ending in `SPECIFIC_SENTENCE[lang]`;
  - all five render through `legalText(…, lang)` without throwing;
  - the set of `{{…}}` placeholders in each doc equals the set in the English doc;
  - the DPA has three `## Annex` headings.
- [ ] **Step 2:** Run. Expected: FAIL (stubs).
- [ ] **Step 3: Translate** each English document faithfully into `<lang>`, in formal legal register (it: "Lei" form; fr: "vous"; de: "Sie"; es: "usted").
  - Keep ids, Markdown structure, placeholders, numbers, dates, the storage-key names and email addresses unchanged.
  - Translate headings.
  - Use the jurisdiction-neutral legal terms of that language for GDPR concepts (e.g. it "titolare del trattamento" / "responsabile del trattamento"; fr "responsable du traitement" / "sous-traitant"; de "Verantwortlicher" / "Auftragsverarbeiter"; es "responsable del tratamiento" / "encargado del tratamiento").
  - Italian: the specific-approval wording refers to "approvazione specifica (artt. 1341–1342 c.c.)" where the English mentions specific approval.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `docs(legal): <language> translations of the legal texts`.

### Task 8: Legal pages, Markdown renderer, language switcher, footer links, SEO

**Files:**
- Create:
  - `src/legal/LegalMarkdown.tsx`
  - `src/legal/LegalDocPage.tsx`
  - `src/legal/LegalLinks.tsx`
  - `src/legal/LegalLangSwitcher.tsx`
- Modify:
  - `src/legal/PrivacyPage.tsx` (renders the privacy Markdown)
  - `src/App.tsx` (public route `/legal/:doc`)
  - `src/auth/LoginPage.tsx`, `src/interest/RequestAccessPage.tsx` (footer `LegalLinks`)
  - `src/layout/AppShell.tsx` (account menu "Legal" to `/legal/terms`)
  - `src/seo/seoRoutes.ts`, `firebase.json`
- Test:
  - `LegalMarkdown.test.tsx`
  - `LegalDocPage.test.tsx`
  - `PrivacyPage.test.tsx` (update)
  - `src/seo/seoRoutes.test.ts` (update)

**Interfaces (produces):**
- `LegalMarkdown({ text }: { text: string })` renders the subset:
  - `#`/`##`/`###` headings (a level-2 clause heading gets `id` = the clause id lowercased, e.g. `t12`);
  - paragraphs, `-` and `1.` lists, `**bold**`;
  - `[label](href)`: `href` limited to `/…`, `https://…`, `mailto:…`; anything else renders as plain text;
  - `> ` blockquote;
  - `|` tables with a header row.
- `LegalLangSwitcher({ lang, onChange })`: five buttons labelled `English`, `Italiano`, `Français`, `Deutsch`, `Español`, with `aria-pressed`.
- `LegalDocPage` reads:
  - `:doc`;
  - `?v=<version>` (optional; an unknown doc or version shows "Not found");
  - `?lang=<lang>` (optional; defaults to `defaultLegalLang(navigator.language)`, and changing it updates the query).
  
  Versioned docs without `?v` show the in-force version and a line "Version <v>, in force since <date>". `usePageMeta`: `robots: 'index'` and `canonicalPath: '/legal/<doc>'` without `?v`; `noindex` with `?v`.
- `LegalLinks()`: links to Terms, DPA, Sub-processors, Privacy, DPIA pack.

- [ ] **Step 1: Write the failing tests:**
  - **Renderer:**
    - `## T12. Liability` renders an `h2#t12`;
    - `[x](javascript:alert(1))` renders the text `x` and no anchor;
    - `[x](/legal/dpa)` renders a link;
    - a table renders `th`/`td`;
    - `**b**` renders `strong`.
  - **`LegalDocPage`:**
    - `/legal/terms?lang=en` shows `DRAFT_BANNER.en` and an `#t12` heading;
    - `/legal/terms?lang=it` shows `DRAFT_BANNER.it`;
    - clicking `Deutsch` shows `DRAFT_BANNER.de`;
    - `/legal/terms?v=1999-01-01` and `/legal/nope` show "Not found".
  - **`PrivacyPage`** shows `controller` and `Alberto Valdes Rey`.
  - **`seoRoutes.test`:**
    - `PUBLIC_ROUTES` equals `['/login','/privacy','/request-access','/signup','/legal/terms','/legal/dpa','/legal/subprocessors','/legal/dpia-pack']`;
    - `PRIVATE_PREFIXES` includes `'/club'`, `'/platform'`, `'/signup/'`, `'/sign/'`, `'/welcome'`.
- [ ] **Step 2:** Run `npx vitest run src/legal src/seo`. Expected: FAIL.
- [ ] **Step 3:** Implement. Make sure the `/signup/` prefix does not mark the public `/signup` as noindex, and adjust `noindexHeaderSources` if it does. Update `firebase.json` to match the parity test.
- [ ] **Step 4:** Run, then run `npm run build`. Expected: PASS, and the `.md` files are bundled.
- [ ] **Step 5:** Commit `feat(legal): public legal pages in five languages and links`.

### Task 9: Acceptance builders and rules (sign-up, acceptance, re-acceptance)

**Files:**
- Create:
  - `src/legal/acceptance.ts`
  - `src/signup/signupDocs.ts`
  - `tests/rules/signup.rules.test.ts`
- Modify:
  - `firestore.rules`
  - `tests/rules/acceptances.rules.test.ts`
  - `tests/rules/clubDoc.rules.test.ts` (the existing legal-update refusal and the create refusal stay, as precise cases)
  - `tests/rules/testEnv.ts` (the acceptance fixture gains `subprocessorsVersion`, `authTime`, `userAgent`; `dbAs(env, email, opts?: { authTime?: number })` passes `auth_time`)

**Interfaces (produces):**
- `acceptance.ts`: `buildAcceptance(input: { termsVersion: string; dpaVersion: string; subprocessorsVersion: string; language: LegalLang; email: string; personName: string; authTime: number; userAgent: string }): Promise<Omit<Acceptance, 'acceptedAt'>>`.
  - It hashes `legalText('terms',…,language)`, `legalText('dpa',…,language)` and `clausesText(specificClauses(…, language))`.
  - It lowercases the email, trims the name, cuts `userAgent` to 300 characters, and sets `authorityConfirmed: true`.
- `signupDocs.ts` (pure; `serverTimestamp()` sentinels):
  - `signupClubDoc(input: { name: string; country: string; locale: ClubLocale }, email: string, versionKey: string): DocumentData`
  - `signupMemberDoc(clubId: string, email: string): DocumentData`
  - `acceptanceDoc(a: Omit<Acceptance,'acceptedAt'>): DocumentData`
  - `legalUpdate(versionKey: string, email: string): { legal: DocumentData }`

**Rules (`firestore.rules`, inside `match /clubs/{clubId}`):**
- **`signUpCreate()`** for `allow create`:
  - signed in;
  - keys exactly `name, country, locale, ownerEmail, aiEnabled, referenceOptOut, growthTestsEnabled, createdAt, status, statusReason, statusChangedAt, statusChangedBy, lastStatusLogId, legal, termination, billing`;
  - `status == 'pending'`, `ownerEmail == email()`, `createdAt == request.time`;
  - the P11 booleans `false`; the status fields and `billing` null; `termination` the four null keys;
  - name, country and locale checks as in `clubAdminProfileChange`;
  - `legal` keys only `versionKey, acceptedAt, acceptedBy`, with `acceptedAt == request.time` and `acceptedBy == email()`;
  - `existsAfter` the member doc for `email()` with role `admin`;
  - `existsAfter` the acceptance at `legal.versionKey` with `acceptedBy == email()`.
  - Use only `getAfter`/`existsAfter`: the club doc does not exist yet.
- **members `create`**, a second branch:
  - `!exists(clubPath())`;
  - `getAfter(clubPath()).data.status == 'pending'` and `.ownerEmail == email()`;
  - `e == email()`, role `admin`, `validMember()`, `addedBy == email()`, `addedAt == request.time`.
- **`validAcceptance(v)`:**
  - keys exactly the `Acceptance` fields;
  - `v == versionKey == 'terms-' + termsVersion + '_dpa-' + dpaVersion`;
  - `acceptedBy == email()`, `acceptedAt == request.time`;
  - `authTime == request.auth.token.auth_time` and `request.time.toMillis() - authTime * 1000 <= 900000`;
  - `authorityConfirmed == true`;
  - `language in ['en','it','fr','de','es']`;
  - the three shas match `^[0-9a-f]{64}$`;
  - `specificClauses is list`;
  - `acceptedByName` a string of 1–100 characters; `userAgent` a string of ≤ 300;
  - `!isPlatformAdmin()`.
- **acceptances `create`:** `validAcceptance(v) && (signUpBranch || reacceptBranch)`.
  - The sign-up branch: `!exists(clubPath())`, and `getAfter` club pending, owner `email()`, `legal.versionKey == v`.
  - The re-accept branch: `isClubAdmin()`, the club `isActive()` or status pending, and `getAfter(clubPath()).data.legal.versionKey == v`.
  - `update` and `delete` stay false.
- **Club `update`**, a new branch `legalReaccept()`:
  - `isClubAdmin()`, and `isActive()` or pending;
  - `changed().hasOnly(['legal'])`;
  - `legal` keys as above, with `acceptedAt == request.time` and `acceptedBy == email()`;
  - `existsAfter` the acceptance at the new `versionKey`, with `getAfter(…).acceptedBy == email()`.

- [ ] **Step 1: Write the failing tests.**
  - **`signup.rules.test.ts`** builds every doc with `signupDocs.ts` and `acceptanceDoc(await buildAcceptance(…))`. It uses `authTime` = now − 60 s, passed as the token's `auth_time`.
    - Passing cases:
      - `a valid sign-up batch creates a pending club, its admin and the acceptance`
      - `accepts an acceptance signed in Italian`
    - Refused cases:
      - `refuses a batch without the acceptance`
      - `refuses an auth_time older than 15 minutes`
      - `refuses an acceptance whose authTime differs from the token`
      - `refuses a club whose ownerEmail is someone else`
      - `refuses status active, or aiEnabled true`
      - `refuses an existing club id` (seeded `club-a`)
      - `refuses adding yourself to an existing club through the sign-up branch`
      - `refuses extra keys on the club, member or acceptance`
      - `refuses the platform admin signing up` (`OPERATOR`)
      - `refuses a versionKey that does not match the versions`
      - `refuses an unsupported language`
  - **`acceptances.rules.test.ts`** keeps the read test, and replaces the write test with:
    - `lets an active club admin re-accept: new acceptance plus legal update in one batch`
    - `refuses re-acceptance by a member`
    - `refuses re-acceptance by a club admin who is the platform admin`
    - `refuses updating or deleting an acceptance`
    - `refuses an acceptance without the matching legal update`
  - **`clubDoc.rules.test.ts`:**
    - `refuses a legal update without a matching acceptance`
    - the single-doc create stays refused
- [ ] **Step 2:** Run these rules files on 8181. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep `isPlatformAdmin()` out of every block except the club doc, acceptances, statusLog and interestSignups (spec §5 rule 1; `platformAdmin.rules.test` holds it).
- [ ] **Step 4:** Run the **whole** rules suite. Expected: all pass (454 before this task, plus the new ones).
- [ ] **Step 5:** Commit `feat(rules): self sign-up, acceptance records and re-acceptance`.

### Task 10: Signing core (draft, fresh link, commit)

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
  - `type SignDraft = { kind: 'signup'; clubId: string; club: { name: string; country: string; locale: ClubLocale } } & Common | { kind: 'reaccept'; clubId: string } & Common`
  - `Common = { email: string; personName: string; termsVersion: string; dpaVersion: string; subprocessorsVersion: string; language: LegalLang; savedAt: number }`
  - `SIGN_DRAFT_KEY = 'vcb.signDraft'`, `DRAFT_TTL_MS = 24 * 60 * 60 * 1000`
  - `saveSignDraft(d, storage = localStorage)`
  - `readSignDraft(now: number, storage = localStorage): SignDraft | null` (null when missing, expired or malformed; never throws)
  - `clearSignDraft(storage = localStorage)`
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
    4. Build the acceptance.
    5. Write the batch with explicit `doc(db,'clubs',clubId,…)` paths: §6.3 for a sign-up, acceptance plus `legalUpdate` for a re-acceptance.
    6. On `permission-denied`, read `clubs/<id>/acceptances/<versionKey>`: if it exists with `acceptedBy == email` → `alreadyDone`, else rethrow.
    7. Clear the draft on `done` or `alreadyDone`.
  - For a sign-up, also `storeClub(clubId)` (`src/clubs/activeClub.ts`).

- [ ] **Step 1: Write the failing tests:**
  - **Draft:**
    - round trip;
    - expired after 24 h → null;
    - malformed JSON → null;
    - storage throwing → null.
  - **`reauth`:**
    - `signingWindowOpen(1000, 1000_000 + 13*60_000)` → true;
    - `(…, + 14*60_000)` → false;
    - `sendSigningLink` calls `sendSignInLinkToEmail` with `url` ending `/finish-sign-in`, and stores the return path `/sign/complete` (mock `firebase/auth` as in `LoginPage.test`).
  - **`signingApi`** (mock the batch, `getIdTokenResult` and the doc read): one test per outcome.
    - A sign-up draft gives exactly three `set` calls, on `clubs/<id>`, `clubs/<id>/members/<email>` and `clubs/<id>/acceptances/<key>`.
    - A `reaccept` draft gives one `set` plus one `update`.
    - A second commit after `permission-denied` with the acceptance present returns `alreadyDone`.
- [ ] **Step 2:** Run `npx vitest run src/legal src/auth src/signup`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(signup): signing draft, fresh email link and commit`.

### Task 11: Sign-up screens

**Files:**
- Create:
  - `src/signup/SignupInfoPage.tsx` (`/signup`, public)
  - `src/signup/SignupPage.tsx` (`/signup/club`)
  - `src/signup/DocumentsStep.tsx`
  - `src/signup/SpecificApprovalStep.tsx`
  - `src/signup/SignCompletePage.tsx` (`/sign/complete`)
- Modify:
  - `src/App.tsx`: `/signup` public; `/signup/club` and `/sign/complete` under `RequireSignedIn`, outside `ClubGate`
  - `src/auth/LoginPage.tsx`: "Create your club" link to `/signup`
  - `src/clubs/WelcomePage.tsx`: "Create a club" button to `/signup/club`
  - `src/clubs/ClubStatusScreen.tsx`: the pending kind shows the accepted versions with links, and "We'll email you when it's active"
- Test: component tests next to each file.

**Interfaces:**
- **Consumes:** Tasks 1, 8, 9, 10; `CLUB_COUNTRY_CODES` from `clubAdminApi`; `useAuth()` (`memberships`, `isPlatformAdmin`, `firebaseUser`).
- **Produces:**
  - `DocumentsStep({ termsVersion, dpaVersion, lang, onLangChange, onDone })`
  - `SpecificApprovalStep({ termsVersion, dpaVersion, lang, email, isOperator, onSend })`
  
  Task 12 reuses both.

**Behaviour:**
- **`SignupPage`, step 1:**
  - Fields: club name (2–80), country select, club language (`en`/`it`, the club's `locale`), the person's name (1–100), and the required checkbox "I am authorised to act for this club and accept these terms on its behalf".
  - With a `pending` membership the page shows "You already have a club waiting for activation" and no form.
- **Step 2 (`DocumentsStep`):**
  - `LegalLangSwitcher`, default per P13.
  - Terms and DPA, each in a scroll box rendered with `LegalMarkdown`. Each has a checkbox ("I have read and accept the Terms of Service" / "… the Data Processing Agreement"), enabled once its box has been scrolled to the end or its "Open in a new tab" link has been clicked.
  - The sub-processors link.
  - Changing the language clears both checkboxes.
- **Step 3 (`SpecificApprovalStep`):**
  - Lists `specificClauses(…, lang)` with id, heading and full text, plus the button "Approve these clauses specifically".
  - It saves the draft (with `clubId` from `doc(collection(db,'clubs')).id` and `language`), calls `sendSigningLink(email)`, and shows "We've sent a confirmation link to <email>. Open it in this browser to sign."
  - `isPlatformAdmin`: no button, and "The platform operator's account cannot sign for a club."
- **`SignCompletePage`:** runs `commitSignDraft` once (a ref guard against StrictMode), then by outcome:
  - `done` / `alreadyDone`: `window.location.assign('/')`;
  - `linkExpired`: "The link is older than 15 minutes" with "Send a new link";
  - `noDraft`: "Open the link in the browser where you started";
  - `wrongAccount`: "Signed in as another account";
  - an error: `role="alert"`.

- [ ] **Step 1: Write the failing tests:**
  - **`SignupPage`:**
    - a name shorter than 2 characters shows an error;
    - authority unchecked blocks Next;
    - a pending membership shows the "already waiting" text.
  - **`DocumentsStep`:**
    - checkboxes are disabled until "Open" is clicked;
    - Next is enabled only with both checked;
    - switching to `Italiano` shows `DRAFT_BANNER.it` and clears the checks.
  - **`SpecificApprovalStep`:**
    - renders exactly 13 clause headings in P4 order;
    - in `it` the texts end with `SPECIFIC_SENTENCE.it`;
    - the button calls `onSend`;
    - with `isOperator` there is no button and the explanation is shown.
  - **`SignCompletePage`:**
    - each outcome renders its text;
    - `done` calls `location.assign('/')`;
    - the commit runs once under StrictMode.
  - **`ClubStatusScreen`** pending: shows the version key with links to `/legal/terms?v=2026-10-22` and `/legal/dpa?v=2026-10-22`, and "We'll email you".
  - **`LoginPage`** has "Create your club"; **`WelcomePage`** has "Create a club".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run, then run `npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(signup): club sign-up with specific approval`.

### Task 12: Review of new versions, notices, Contract tab

**Files:**
- Create:
  - `src/legal/LegalReviewScreen.tsx`
  - `src/legal/LegalNoticeBanner.tsx`
- Modify:
  - `src/clubs/ClubGate.tsx`
  - `src/layout/AppShell.tsx`
  - `src/clubs/area/ContractTab.tsx`
- Test: component tests for each, plus `src/clubs/ClubGate.test.tsx` (extend)

**Behaviour:**
- **`ClubGate`:** when the view is `app` or `ending`, `role === 'admin'` and `needsReview(club.legal, now)`:
  - not a platform admin: render `LegalReviewScreen`;
  - a platform admin: render children, plus the notice "This club has not accepted the current Terms and DPA. Only <ownerEmail> or another club admin can accept them; the platform operator cannot." (P10).
  - Members: children unchanged.
- **`LegalReviewScreen`:**
  - The title "Review the updated Terms and DPA" ("Accept the Terms and DPA" when `legal` is null).
  - The in-force versions' `summary` lines.
  - The person's name and authority checkbox, `DocumentsStep`, then `SpecificApprovalStep`, with a `reaccept` draft for the active club.
  - Below: "Don't agree? End our contract", which uses the existing `requestTermination` behind a `ConfirmDialog`.
- **`LegalNoticeBanner`** (club admins only; dismissible per session with sessionStorage key `vcb.legalNoticeDismissed.<doc>.<version>`):
  - When `upcoming('terms'|'dpa', now)` exists: "Updated terms take effect on <effectiveFrom> — review", linking to `/legal/<doc>?v=<version>`.
  - When `upcoming('subprocessors', now)` exists: "The sub-processor list changes on <date>. You can object within 15 days of this notice", linking to the list and the operator contact.
- **`ContractTab`:** the accepted versions link to `/legal/terms?v=…` and `/legal/dpa?v=…` (via `parseVersionKey`), and a sub-processors link is added.

- [ ] **Step 1: Write the failing tests:**
  - **`ClubGate`:**
    - an admin with `legal: null` sees "Accept the Terms and DPA";
    - a member sees the app;
    - an admin who is a platform admin sees the app plus the notice;
    - an admin with the current key sees the app.
  - **`LegalNoticeBanner`** with an upcoming version injected (module mock of `versions.ts`):
    - shows the date and link;
    - hidden for members;
    - hidden after dismiss.
  - **`ContractTab`** shows both links for `terms-2026-10-22_dpa-2026-10-22`.
  - **`LegalReviewScreen`:** "End our contract" opens the confirm dialog.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(legal): review and notice of new versions; contract links`.

### Task 13: Product guardrails (photo consent for minors, health hints, AI labels)

**Files:**
- Modify:
  - `src/types/player.ts`
  - `firestore.rules` (player writes)
  - the rules test file that holds player writes
  - `src/players/playersApi.ts`
  - `src/players/PlayerCardPage.tsx`
  - `src/awards/AwardsPage.tsx`
  - the free-text fields listed in Step 3
  - `src/aiDraft/ExerciseProposalReview.tsx`, `src/aiDraft/TrainingProposalReview.tsx`
  - `src/settings/AiProviderSettings.tsx`
- Create: `src/components/HealthHint.tsx`, `src/awards/photoGate.ts`
- Test:
  - the rules test
  - `PlayerCardPage.test.tsx`
  - `src/awards/photoGate.test.ts`
  - `HealthHint.test.tsx`
  - the touched components' tests

**Interfaces:**
- `Player.photoConsent?: boolean; photoConsentAt?: Timestamp | null; photoConsentBy?: string | null`.
- `setPhotoConsent(teamId: string, playerId: string, given: boolean, byEmail: string): Promise<void>` writes:
  - when given: `{ photoConsent: true, photoConsentAt: serverTimestamp(), photoConsentBy: byEmail }`;
  - when withdrawn: `{ photoConsent: false, photoConsentAt: null, photoConsentBy: null }`.
- `photoAllowed(player: Pick<Player,'dob'|'photoConsent'>, today: Date): boolean`: true for an adult (18 or over on `today`, from a valid `dob`), otherwise `photoConsent === true`. Reuse the age logic already used by `exportIncludesMinors`.
- Rules on player create and update:
  - if `photoConsent` is present it is a bool;
  - changing it to `true` needs `photoConsentBy == email()` and `photoConsentAt == request.time`;
  - `false` needs both null.
- `HealthHint()` renders `Don't record health, injury or medical information.` (`text-caption`; the caller links it with `aria-describedby`).

- [ ] **Step 1: Write the failing tests:**
  - **Rules:**
    - `lets a team admin record photo consent with their own email and request time`
    - `refuses photo consent recorded in someone else's name`
    - `refuses a non-boolean photoConsent`
    - `withdrawing clears the date and the email`
  - **`photoGate`:**
    - an adult with no consent → true;
    - a minor without consent → false;
    - a minor with consent → true;
    - no or invalid `dob` without consent → false;
    - the 18th birthday counts as adult.
  - **Awards:** a minor with `consent.given: true` but no `photoConsent` gets "No photo consent on file"; an adult gets the photo slot.
  - **`PlayerCardPage`:** for a minor, the privacy tab shows "Guardian consent to use photos in award cards" with a toggle for team admins that calls `setPhotoConsent`. For an adult it shows "Adult: photos follow the club's own agreement with the player" and no toggle.
  - **`HealthHint`:** renders the exact text. `DevelopmentPlanEditor`, `AddPhysicalTestDialog` and `AssignTrainingDialog` render it under their notes fields.
  - **AI:** `ExerciseProposalReview` and `TrainingProposalReview` cards show the badge `AI draft`. `AiProviderSettings` shows "With your own key, the AI provider you choose works for your club, not for us."
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - `AwardsPage` builds the allowed set with `photoAllowed`.
  - Add `HealthHint` under:
    - `DevelopmentPlanEditor` coach comments and general notes;
    - `AddPhysicalTestDialog` notes;
    - `SessionQualityPanel` notes;
    - `TeamSettingsTab` notes;
    - `TeamNotesDialog` general and per-player;
    - `AssignTrainingDialog` notes;
    - `AwardsPrepare` custom note.
  - Run `grep -rniE "injur|absence|sick|illness" src --include=*.tsx` and make any availability wording neutral ("unavailable"). List the fields touched in the commit message.
- [ ] **Step 4:** Run the unit suite and the rules suite. Expected: PASS.
- [ ] **Step 5:** Commit `feat: photo consent for minors, health hints, AI draft labels`.

### Task 14: Seeds, docs, final verification

**Files:**
- Modify:
  - `scripts/seed/clubArg.mjs`, `scripts/seed/seedClubs.mjs`, `scripts/seed/seed.mjs`
  - `scripts/seed/README.md`
  - `CLAUDE.md`
  - `docs/PRODUCTION-READINESS.md`
  - the club-platform spec (a "Resolved (Plan 3)" note before §7)
  - the legal spec (a "Resolved (Plan 3)" note: five languages with English prevailing; P1–P5, P12, P14)
- Test: `scripts/seed/clubArg.test.mjs` (extend)

- [ ] **Step 1: Write the failing test.** Add `seedAcceptance({ versionKey, termsVersion, dpaVersion, subprocessorsVersion, email, name })` to `clubArg.mjs`. It returns an acceptance doc with every rules key, `'0'.repeat(64)` hashes, `language: 'en'`, `authTime: 0` and `userAgent: 'seed-script'`. The test checks that its keys equal the `Acceptance` field list (copied literally into the test).
- [ ] **Step 2:** Run `npx vitest run scripts/seed`. Expected: FAIL.
- [ ] **Step 3:** Implement. Read the version ids from `src/legal/content/versions.json`.
  - **`demo`:**
    - add an admin member `president@example.com`;
    - `ownerEmail: 'president@example.com'`;
    - `legal` plus an acceptance by `president@example.com` (P15: the operator, the demo admin, sees no review screen and no notice).
  - **`rival`:** accepted by `rival@example.com`.
  - **`newclub`:** pending, `legal` plus an acceptance by `pending@example.com`.
  - **New club `review`:** active, admin `review@example.com`, `legal: null` (blocking review screen).
- [ ] **Step 4: Docs.**
  - `CLAUDE.md` gets a "Legal texts and sign-up" paragraph: the files and languages, P3/P6/P9/P10/P12, and the seed sign-ins.
  - The seed README lists the new club and `president@example.com`.
  - PRODUCTION-READINESS gets:
    - "Fill the operator address in `src/legal/operator.ts`";
    - "Lawyer review of each language a club signs in, before any outside club is activated (launch gate)";
    - "Verify in the Auth emulator that `auth_time` is fresh after the signing link" (spec §11; record the result);
    - "Production: the migrated club's owner (`--owner`) accepts on first visit".
  - The spec notes.
- [ ] **Step 5: Verify by hand on the emulator** (`npm run dev:emulator`, which uses port 8080: only if the operator's dev emulator is not running; otherwise list the steps for the operator instead):
  1. Sign in as a new email.
  2. Go through Welcome, then Create a club, the three steps in Italian, and the link from the Auth emulator console.
  3. Check that `/sign/complete` lands on the pending screen.
  4. Sign in as `operator@example.com`, then `/platform`, then Activate.
  5. Sign in as `review@example.com` and check the review screen blocks; accept it.
- [ ] **Step 6: Run everything:** `npm test`, the full rules suite on 8181, `npm run build`, `npm run lint`. Expected: all pass, with no new lint errors.
- [ ] **Step 7:** Commit `docs: sign-up and legal acceptance; seeds`.
