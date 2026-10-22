# Volley Skills — Legal documents (Terms, DPA, sub-processors, privacy, specific approval)

Date: 2026-10-20
Status: Design — awaiting approval
Programme: `feature/club-platform` (see `2026-10-20-volley-skills-club-platform-design.md`)
Evidence: `docs/research/2026-10-20-legal-framework.md` and its notes in `docs/research/notes/legal-framework/`.

> **These documents are drafts written by a non-lawyer from research.** Having a lawyer review them is a **launch gate**: no club other than the migrated one is activated on these texts until an Italian lawyer (and, while the operator is in Luxembourg, a Luxembourg-qualified one or a fiduciaire's referral) has reviewed them. Every text carries "Draft — under legal review" until then.

## 1. Intent

Each club that signs up becomes the data controller for its players, guardians and staff; the operator becomes its processor. The operator needs a contract set that (a) is legally sufficient — GDPR Art. 28, the Data Act switching rules, Italian rules on standard terms, (b) is as favourable to the operator as the law allows, (c) can be accepted online without the operator, and (d) survives the operator turning from an individual into a company.

### Goals
1. **Terms of Service** (the commercial contract), **DPA** (Art. 28 processor terms, with annexes), **sub-processor list**, updated **privacy notice**, a **DPIA support pack** for clubs.
2. English and Italian versions of each.
3. Versioned, hashed, rendered in the app from one source, accepted through the sign-up flow of the club-platform design (§6 there).
4. A defined list of clauses that need **specific approval** (art. 1341–1342 c.c.), consumed by the signature step.
5. The product guardrails the documents promise (health data, photos, AI, export), so the texts are true.

### Non-goals
- US documents (FERPA addendum, HECVAT, state processor terms): later phase, when the first US college is real.
- Payment terms tied to a provider (Paddle/Stripe) — a placeholder clause only.
- Support-access terms — written when that mechanism is designed.
- Employment, cookie banner (none needed: storage is strictly necessary; no analytics).

### Anti-goals
- Promising something the system does not do (EU storage before it is verified; "operator never sees data" without the rules tests passing; a deletion window the scripts do not honour).
- Terms that are void and give the operator false comfort (e.g. excluding liability for gross negligence in Italy; capping guardians' Art. 82 claims).

## 2. Parties and identity

- **Operator** today: Alberto Valdes Rey, individual (sole trader status per the operator's Luxembourg registration, to be confirmed with a fiduciaire), resident in Luxembourg. One source of truth: `src/legal/operator.ts` exporting `OPERATOR = { name, legalForm, address, country, registration?, vat?, contactEmail, privacyEmail }` — used by the privacy page (replacing the constants in `PrivacyPage.tsx`), Terms, DPA and the platform contact info. Placeholders are filled by the operator; the builder must not invent an address or registration number.
- **Club**: the legal entity named at sign-up, acting through the person who confirms authority.
- **Assignment**: the operator may assign the Terms and DPA to a successor entity the operator controls (the future company), with notice by email and in-app; the club may terminate if it objects. This is the key right that lets the move from individual → company happen without re-signing.
- **Governing law and courts**: the law of the operator's place of establishment and its courts (Luxembourg now). When the operator moves to Italy, a new version names Italian law and courts, and clubs re-accept under the club-platform §6.4 flow. Rationale in the report: Luxembourg has no art. 1341 equivalent; an Italy–Italy contract cannot escape it by choosing a foreign law, so the specific-approval step is built now anyway.

## 3. Terms of Service — required content and operator-favourable choices

| # | Clause | Content (decisions) | Specific approval? |
|---|---|---|---|
| T1 | Definitions, scope | Service for organisations only (sports clubs, associations, schools); not for consumers. Signing person confirms authority. (Keeps consumer law out and the European Accessibility Act's consumer scope out.) | — |
| T2 | Account and club | Pending until activation; operator may refuse activation without reason. | yes (refusal = operator discretion) |
| T3 | Term | One season (1 September – 31 August, or from activation to the next 31 August). **No tacit renewal**: renewal is an explicit action (payment later). | — (no tacit renewal avoids the onerous clause) |
| T4 | Fees | Placeholder: per-season price as published at purchase; free during the pilot. Prepaid. Contractual late-payment interest at the statutory B2B rate (Italian rate H2 2026: 10.40%) because statutory interest may not reach non-business associations. | — |
| T5 | Licence | Non-exclusive, non-transferable right for the club's staff to use the service during the term. Operator owns the software, design, the default guides and diagrams shipped with the app. | — |
| T6 | Club content | The club owns its content (exercises, diagrams, trainings, scouting data, player data). It grants the operator only the licence needed to host and process it under the DPA. Club scouting data from its own matches is the club's (raw match facts are not protected by database right per the research). | — |
| T7 | Acceptable use | No unlawful content; no health or medical data (see §6) other than growth measurements in clubs that enable them; no publishing live match data feeds or offering data for betting; no attempts to access other clubs; imports only of files the club is entitled to use. | — |
| T8 | Suspension | Operator may suspend (export-only state) for: non-payment after 14 days' notice; serious breach of T7; security threat (immediately). Suspension is reversible. | **yes** |
| T9 | Termination | Club: at any time, by "End our contract" (no refund of the current season except where T13 or DPA sub-processor objection applies). Operator: at season end; immediately for serious breach; with 30 days' notice otherwise (pro-rata refund). | **yes** (operator withdrawal) |
| T10 | Exit (Data Act) | Notice ≤ 2 months; transition ≤ 30 days; **data retrieval ≥ 30 days** after the transition, through the free export (all data listed in the export README); erasure after the retrieval period; no switching charges; the exportable data list and formats are in the export README. Matches club-platform §4 and §7.2. | — (mandatory, favourable to club) |
| T11 | Service level | Best effort, no uptime guarantee; planned maintenance announced in-app; operator may change features (no removal of the export). | **yes** (limits on obligations) |
| T12 | Liability | Total liability of the operator under the Terms and DPA together, per season, is capped at the **fees paid for that season** (for free use: €100 — placeholder, lawyer to set). No liability for indirect loss, lost profit, lost revenue, data the club failed to export. **Not excluded or capped**: wilful misconduct and gross negligence (art. 1229 c.c.), death or personal injury, anything the law forbids capping. The cap applies between operator and club only; it does not limit data subjects' rights (GDPR Art. 82) or regulators. | **yes** |
| T13 | Changes to the Terms | 30 days' notice by an in-app banner to club admins and an email to the club's contact address (`ownerEmail`, sent by the operator); material changes need re-acceptance by a club admin from the effective date; a club that rejects may terminate with pro-rata refund. Mechanism: club-platform §6.4. Price changes take effect from the next season only. | **yes** (unilateral amendment) |
| T24 | Illegal content (DSA) | The service is a hosting service under the Digital Services Act: a single point of contact (operator email) for authorities and users; a notice-and-action route — "Report content" email address on `/legal/terms` and the footer; when the operator restricts a club or content it gives a statement of reasons (the suspension `statusReason` plus an email). The T&Cs describe these restrictions. Platform-tier DSA duties do not apply (not an online platform; micro-enterprise). | — |
| T14 | Assignment | Operator may assign to a successor entity the operator controls, with notice; club may terminate if it objects. Club may not assign without consent. | **yes** |
| T15 | References | Operator may name the club as a customer (name only, no logo) unless the club opts out in Contract settings (a checkbox `club.referenceOptOut`, default false) — builder adds the field. | yes (restricts club's position) |
| T16 | Anonymous usage metrics | Operator may compute non-personal, aggregated product metrics (counts of clubs, teams, feature use) — **no player-level data, no cross-club benchmarks** (those would make the operator a controller of player data, Art. 28(10), and risk re-identification in small squads). | — |
| T17 | AI features | AI is optional and **off by default**: a club admin switches it on for the club (`club.aiEnabled`, club-platform §3.1), which is the club's decision as controller. Staff then use AI providers of their choosing with their own keys; such a provider is **the club's own processor**, outside the operator's sub-processor list. The app's provider presets (including any "recommended" label) are convenience defaults, not an operator engagement — wording to be checked by the lawyer. The app strips player names to jersey numbers before text is sent. AI output is a draft the coach reviews; AI is never used to rate, rank or select players. | — |
| T18 | Third-party file formats | DataVolley-compatible import is provided for interoperability; the service is not affiliated with Data Project or Genius Sports; trademarks belong to their owners. | — |
| T19 | Force majeure | Standard. | — |
| T20 | No set-off / exceptions | The club may not withhold fees against claims (operator-favourable). | **yes** (limits on raising exceptions) |
| T21 | Law and courts | §2 above. | **yes** (forum clause) |
| T22 | Language | English and Italian versions; the version the club accepted prevails for that club (lawyer to confirm). | — |
| T23 | Entire agreement, severability, notices (email to the club's owner email and in-app) | Standard. | — |

## 4. DPA — required content (Art. 28(3)) and choices

Custom DPA following Art. 28(3) item by item (more room than the Commission's Decision 2021/915 clauses, per the research). Structure:

| # | Item | Decision |
|---|---|---|
| D1 | Subject, duration, nature, purpose | Hosting and processing club data to provide the service, for the term plus the exit periods (T10). |
| D2 | Documented instructions | The Terms + DPA + the club's use of the app's features are the instructions. Operator informs the club if an instruction infringes the law. |
| D3 | Confidentiality | The operator alone has administrative access to infrastructure; no personnel; anyone added later is bound by confidentiality. **The operator has no application-level access to club data** (rules-enforced; referenced to the rules tests) — except where the club itself adds the operator's personal account as one of its own members (as the operator's home club does), in which case that access is the club's grant, under the club's control, and outside the operator role. |
| D4 | Security (Art. 32) | Annex II: club isolation in security rules with automated tests; TLS in transit and Google encryption at rest; passwordless email-link sign-in; App Check; role-based access (club admin, team admin, section access); minimal data model; names stripped before AI; photos processed on-device only, never stored; export and deletion tools; weekly encrypted backups (AES-256-GCM, sealed with the operator's key, held on the operator's encrypted devices in the EU, kept at most 35 days); Firestore data access audit logs; the operator access policy (access only to run the service, on the club's documented request, or when the law requires it, each access logged); incident response procedure (below). Source: backup and operator access design (2026-10-22). |
| D5 | Sub-processors | **General written authorisation** for the list in Annex III, which is the separately versioned `/legal/subprocessors` page (not hashed into the DPA, so changes need notice, not re-signature — club-platform §6.4). New ones: 30 days' notice by in-app banner and the operator's email to `ownerEmail`; club may object within 15 days on reasonable data-protection grounds; if not resolved, the club's sole remedy is termination with pro-rata refund. Same Art. 28 obligations flowed down. Public list at `/legal/subprocessors` (EDPB Opinion 22/2024). |
| D6 | Assistance with data-subject rights | Self-service tools are the assistance: edit/delete players, export, delete teams. Further assistance at a published hourly rate (placeholder €80/h). |
| D7 | Assistance with security, breaches, DPIA, consultations | Breach notice to the club **without undue delay and, where feasible, within 48 hours** of becoming aware (leaves the club its 72h). DPIA: the operator provides the DPIA support pack (§7); further help charged as D6. |
| D8 | End of processing | Club chooses: export (free, self-service, ≥ 30 days) then deletion. Deletion within 30 days after the retrieval period ends; backups expire within 35 days (the operator's encrypted backups are pruned at 35 days; no Google-managed backups on the free plan). Operator keeps the contract tombstone (club name, owner email, dates, acceptances, status log) as its own evidence, no player data. |
| D9 | Information and audits | Audits are met first by documentation: this DPA, Annex II, the rules test suite summary, Google's certifications, a written questionnaire answered within 30 days. On-site or remote audits only if a supervisory authority requires it or after a confirmed breach affecting the club, at the club's cost, 30 days' notice, at most once a year. |
| D10 | Transfers | Primary storage in the EU (Firestore EU location — **must be verified first**, club-platform §11). Google services that may process outside the EU (Firebase Auth, reCAPTCHA for App Check) rely on the EU-US Data Privacy Framework and Google's SCCs. Status note: DPF still valid (General Court, Latombe, 3 Sept 2025; appeal C-703/25 P pending). |
| D11 | Liability | As T12 (one aggregate cap across Terms and DPA). |
| D12 | Club obligations | Lawful basis for every record; guardian information and consent where needed (e.g. photos, which the app gates — §6); no special-category data; the club does its own DPIA where required (Italy's Garante list includes ongoing processing of minors' data and AI); appoints its contact. |
| Annex I | Processing description | Data subjects: players (incl. minors), guardians, coaches/staff, opponents' jersey numbers only. Data: identity and contact (players' names, date of birth, position, jersey; guardians' contacts; staff emails), sports performance (skill ratings 1–10, development plans, physical tests such as jump/sprint, match statistics, awards), access records. **No special categories intended, with one club-controlled exception:** if the club enables growth tests, height and body mass are processed and may constitute health data (Art. 9); the club is responsible for the Art. 9 condition and the DPIA. Retention: term + exit periods. |
| Annex II | Technical and organisational measures | D4, written so each line can be shown true. |
| Annex III | Sub-processors | §5. |

## 5. Sub-processor list (initial)

| Sub-processor | Service | Data | Location / transfer basis |
|---|---|---|---|
| Google Ireland Ltd (Google Cloud / Firebase) | Cloud Firestore, Hosting | all club data | EU location (to verify) |
| Google (Firebase Authentication) | sign-in, email links | staff emails, sign-in metadata | may process in US — DPF / SCCs |
| Google (reCAPTCHA via App Check) | abuse protection | device/browser signals, IP | US — DPF / SCCs |

Not sub-processors (stated on the page): AI providers chosen by the club with its own key (club's processor); the payment provider when added (operator's own controller processing for billing; listed in the privacy notice instead).

## 6. Product guardrails the documents rely on

These are small app changes, part of this design so the texts are true:

1. **Health data out by design.** Audit every free-text field (player notes, development plan objectives/notes, physical test fields, team notes, awards notes, match notes). Add the inline hint "Don't record health, injury or medical information" (Italian per the Italian design) under each. No field asks for an injury or absence reason; where availability is shown, use a neutral "unavailable". Builder lists the fields found.
2. **Photo consent per player.** Player doc gains `photoConsent: boolean` (default false), `photoConsentAt`, `photoConsentBy` — set by team admins on the player card ("Guardian consent to use photos in award cards recorded"). The awards photo / cut-out step is enabled only for players with consent; others use the no-photo design. The existing session-level consent gate stays. Rules: field shape on player writes; rules test.
3. **AI labelling.** AI drafts carry a visible "AI draft" badge until saved; the AI settings screen states that a club's own key makes the provider the club's processor; AI features are not offered for rating or selecting players (policy; no such feature exists).
4. **Export and deletion** exist (club-platform §7).
5. **DataVolley import** drops opponents' names (DVW design §4).
6. **Growth tests are a club opt-in** (operator decision 2026-10-20). Height and body mass of minors can be health data under the CJEU's broad reading (Lindenapotheke, C-21/23). `club.growthTestsEnabled` is off by default (club-platform §3.1); while off, the growth quality is hidden from physical tests and testing sessions, and the rules refuse new growth-test writes (rules test). Switching it on shows the club admin a short explanation: this may be health data, the club needs an Art. 9 condition (typically explicit guardian consent) and should cover it in its DPIA. Existing growth data stays readable when the switch is turned off.

## 7. Privacy notice and DPIA support pack

**Privacy notice** (`/privacy`, rewritten): two roles stated plainly.
- Operator as **controller** for: accounts of club staff (email, sign-in metadata), sign-up and acceptance records, interest/lead sign-ups, platform status logs, security signals (App Check), billing data later. Bases: contract, legitimate interest (security, evidence), legal obligation (accounting). Retention per category (e.g. acceptance records: contract + limitation period; leads: 12 months).
- Operator as **processor** for club data: "Your club is responsible for the player data it enters; contact your club." Link to the club contact on request.
- Rights, lead supervisory authority (Luxembourg CNPD while established there), sub-processor link, transfers, no tracking or analytics, strictly-necessary storage list (localStorage/sessionStorage keys by purpose).

**DPIA support pack** (`/legal/dpia-pack`, public): description of the processing, data flows (diagram optional), risks typical for clubs (minors, skill scoring as profiling, AI drafting, photos) and the measures built in (§6, D4), and a checklist for the club's own assessment. Not a DPIA itself.

## 8. Specific approval (art. 1341–1342 c.c.)

The clauses marked "yes" in §3 (T2, T8, T9, T11, T12, T13, T14, T15, T20, T21) plus the DPA's D5 remedy limitation, D9 audit limits and D11 cap form the **specific-approval list**. It lives as data: `src/legal/content/specificClauses.ts` → `[{ id: 'T12', heading, text }]` per language, so the signature screen (club-platform §6.1 step 5) renders exactly these and the acceptance record stores their ids and hash. The Terms text references the same ids.

**For the lawyer to settle** (collected, so the review is one sitting):
- Is fresh email-link re-authentication a sufficient "specific written approval" after Cass. ord. 20945/2026, or is a qualified/advanced e-signature needed?
- Is the T12 cap amount and the free-use floor acceptable; is T20 enforceable against amateur associations; Data Act Art. 13 (unfair data terms) exposure for any clause.
- Which language prevails (T22).
- Whether non-business ASDs can be treated as consumers in any scenario.
- Governing law/forum choice while in Luxembourg for Italian clubs.

## 9. Storage, rendering, versioning

- Texts: `src/legal/content/<lang>/<doc>-<version>.md` (Markdown, `?raw` imports), docs `terms`, `dpa`, `subprocessors`, `privacy`, `dpia-pack`. Old versions are kept forever (hash re-verification).
- `src/legal/versions.ts`: a list of published versions per document — `{ doc, version, announcedAt, effectiveFrom, material }` — for `terms`, `dpa`, `subprocessors`; helpers `inForce(doc, date)`, `upcoming(doc, date)`, `versionKey()` (Terms + DPA only). Behaviour in club-platform §6.4.
- Rendering: a minimal Markdown subset renderer (headings, paragraphs, lists, bold, links, tables) or a small dependency — builder's call; it must render the exact string that is hashed.
- `{{OPERATOR_NAME}}`-style placeholders are substituted from `src/legal/operator.ts` **before** hashing, so the hash covers the text the club actually read.
- Routes: `/legal/terms`, `/legal/dpa`, `/legal/subprocessors`, `/legal/dpia-pack`, `/privacy` — public, indexable, language follows the app language with an EN/IT toggle on the page.
- Footer links on public pages and in the account menu.

## 10. Testing
- Unit: placeholder substitution, hash stability (same input → same hash, golden value), `specificClauses` ids all referenced in the Terms text, both languages have the same clause ids.
- Component: legal page renders each doc in both languages; the signature screen lists exactly the specific clauses.
- Rules: `photoConsent` shape; the acceptance-record rules are in the club-platform tests.

## 11. Left to the builder
- Wording of every clause within the decisions above, in plain English, then Italian (Italian reviewed per the Italian design and by the lawyer).
- Renderer choice; page layout per the design system.
- The free-text field audit list (§6.1).
