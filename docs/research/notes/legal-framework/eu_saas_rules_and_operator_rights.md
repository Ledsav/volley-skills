# EU (non-GDPR) regulation, commercial-contract law and operator rights for a small B2B SaaS sold to sports clubs (status: October 2026)

Scope note: research run on 2026-10-20. Sources are tagged as **[LAW]** (binding text or official journal), **[OFFICIAL]** (Commission or regulator guidance), **[COMMENTARY]** (law firms, vendors, blogs). Several primary-text fetches (EUR-Lex Data Act HTML) failed in this session, so some article-level content rests on commentary that quotes the text. Items stated from background knowledge and not verified in this session are listed under **Gaps**.

---

## 1. EU Data Act (Reg. (EU) 2023/2854): Chapter VI switching and Chapter IV unfair terms

### Takeaway
Chapter VI applies to SaaS in principle, has **no SME or microenterprise exemption in force today**, and so its mandatory contract terms apply to this app: max 2-month notice, 30-day transition, at least 30 days of data retrieval after transition, then erasure, plus cost-based switching charges only until 12 Jan 2027 (none after). "Club loses all access on deactivation" is fine for the *app*, but when a club terminates or switches it must still get a data-export window. The Digital Omnibus would add SME relief, but only for contracts concluded **on or before 12 Sept 2025**, so it would not help a service launched in 2026-27 even if adopted.

### Cited Findings
- The Data Act applies from 12 Sept 2025; the Commission FAQ is at version 1.4 dated 22 Jan 2026 (PDF: https://ec.europa.eu/newsroom/dae/redirection/document/108144) [OFFICIAL] — [Commission Data Act FAQ page](https://digital-strategy.ec.europa.eu/en/library/commission-publishes-frequently-asked-questions-about-data-act)
- "Data processing service" = digital service giving ubiquitous, on-demand network access to a shared pool of configurable computing resources; covers IaaS, PaaS and SaaS, but applying it to business-function SaaS (CRM, project tools) "is far less straightforward" and needs case-by-case assessment [COMMENTARY] — [Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview); the German regulator's glossary also treats the definition as the gate to Chapter VI [OFFICIAL] — [Bundesnetzagentur glossary](https://www.bundesnetzagentur.de/SharedDocs/A_Z_Glossar_DataAct_ENG/D/data-processing-service.html?nn=686258)
- Mandatory contract terms (Art. 25, as summarised): switching without undue delay and within a max **30-calendar-day transitional period**; if technically unfeasible, notify within 14 working days and propose an alternative of **no more than 7 months**; **max 2-month notice period** to start switching; an exhaustive specification of exportable data and digital assets (and categories excluded for trade-secret reasons); **data retrieval period of at least 30 calendar days after the transitional period**; full erasure of exportable data after the retrieval period; reasonable assistance, business continuity and a high level of security during transition [COMMENTARY quoting the Regulation] — [Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)
- Providers must not impose pre-commercial, commercial, technical, contractual or organisational obstacles to termination, switching, porting or unbundling; must publish switching information, an online register of data structures/formats, and the jurisdiction of their ICT infrastructure plus measures against unlawful third-country governmental access to non-personal data [COMMENTARY] — [Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)
- Switching charges: from 11 Jan 2024 to 12 Jan 2027 they may not exceed costs actually incurred; **from 12 Jan 2027 no switching charges at all**. Normal service fees and early-termination penalties are separate and may still apply [COMMENTARY] — [Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)
- Art. 31(1): for services where the majority of main features were custom-built for one customer (or all components developed for one customer) and not offered at broad commercial scale through the service catalogue, only Art. 23(d), Art. 29 and Art. 30(1) and (3) are disapplied. Art. 31(2): Chapter VI does not apply to **non-production versions provided for testing and evaluation for a limited period**. Art. 31(3): providers must tell prospective customers before contracting which obligations do not apply [LAW, reproduced] — [Springlex Art. 31 (OJ L 2023/2854)](https://www.springlex.eu/fr/packages/data-act/data-act-regulation/article-31/)
- Even custom-built services stay subject to Art. 30(5) (open interfaces; export in structured, commonly used, machine-readable format) [OFFICIAL] — [Bundesnetzagentur glossary](https://www.bundesnetzagentur.de/SharedDocs/A_Z_Glossar_DataAct_ENG/D/data-processing-service.html?nn=686258)
- Current law: Chapter VI has **no general exemption for SMEs** [COMMENTARY] — [Privy CDP](https://privycdp.org/regulation/eu-data-act-cloud-switching); [Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)
- **Pending (Digital Omnibus, proposed Nov 2025):** (a) express permission for proportionate early-termination penalties in fixed-term contracts; (b) transitional exemptions for contracts concluded **on or before 12 Sept 2025**, covering adapted standard services and **SME and small mid-cap providers of non-infrastructure services** (Art. 29 charges regime still applies). As of July 2026 this was the Council's consolidated compromise text, still under negotiation [COMMENTARY] — [Greenberg Traurig, July 2026](https://www.gtlaw.com/en/insights/2026/7/eu-digital-omnibus-package-proposes-amendments-to-data-act); as of 15 Aug 2026 still in the co-legislative process [COMMENTARY] — [Privy CDP](https://privycdp.org/regulation/eu-data-act-cloud-switching); the Commission describes the carve-out as covering custom-made services or SME/small-mid-cap services "based on contracts signed before the Data Act's entry into application" [OFFICIAL] — [Commission Digital Package FAQ](https://digital-strategy.ec.europa.eu/en/faqs/digital-package)
- A Council working document discusses a new Art. 31 para. 1b for SMEs and small mid-caps [LAW-in-progress] — [Council WK 17004/2025 ADD 2](https://data.consilium.europa.eu/doc/document/WK-17004-2025-ADD-2/en/pdf)
- The Commission published draft non-binding standard contractual clauses for cloud contracts on 19 Nov 2025 [COMMENTARY] — [Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)

### Inferences
- A per-season multi-tenant app sold off a public sign-up page is a standard (not custom-built) service, so Art. 31(1) does not help. A free **trial/evaluation tier for a limited period** is exempt from Chapter VI under Art. 31(2), and should be labelled as such.
- Design consequence: build a **self-service full export** (structured, machine-readable: JSON/CSV of teams, players, exercises, diagrams, trainings, matches/events) and a **"read-only / export-only" state** that lasts at least 30 days after the end of the transitional period when the club terminates. "Loses all access" should mean losing the *app*, not the right to retrieve its data. Then erase (this also fits GDPR storage limitation).
- Deactivation for **non-payment or breach** initiated by the operator is not literally a customer-initiated switch, but Art. 25 terms must be in the contract anyway, and Art. 26-style "no obstacles to termination" suggests a short export window should be offered in every termination scenario. Commentary is thin on operator-initiated termination; this is the conservative reading.
- No charge for export/switching after 12 Jan 2027; before that, only cost-based. Simplest: never charge for export.
- Per-season fixed terms plus (if Omnibus passes) a proportionate early-termination fee are compatible with Chapter VI; the 2-month max notice means you cannot lock a club in by requiring longer notice to leave.
- The Omnibus SME relief is grandfathering only; a new 2026 business should plan to comply in full.

### Gaps
- Primary-text quotes for Art. 2(8), Art. 13 and Art. 25 could not be fetched from EUR-Lex in this session (blank responses). From background knowledge (not verified here): **Chapter IV (Art. 13)** makes unfair any term "concerning access to and use of data or liability and remedies for breach or termination of data-related obligations" **unilaterally imposed by one enterprise on another** (protection is not limited to SMEs in the final text); black list includes excluding liability for intentional acts or gross negligence and exclusive right to interpret the contract; grey list includes inappropriately limiting remedies and unreasonably short termination notice. Applies to contracts concluded after 12 Sept 2025, and to older long-term contracts from 12 Sept 2027. Verify against EUR-Lex. Relevance: Art. 13 targets *data-related* terms, so a SaaS licence's data-access, data-use and termination-of-data-obligations terms are exposed; if a club is not an "enterprise" (amateur ASD), Art. 13 may not apply to it at all.
- Whether the Digital Omnibus on data was adopted after August 2026 was not found; status must be re-checked.
- The FAQ PDF itself (v1.4) was not read; it may address SaaS scope and termination by the provider.

---

## 2. EU AI Act (Reg. (EU) 2024/1689) as amended by the Digital Omnibus on AI

### Takeaway
The operator is most likely a **provider** of AI systems (it integrates third-party GPAI models into features marketed under its own name) and a deployer-facing supplier; none of the features (exercise/plan drafting, text-scouting of match events) fall into Annex III high-risk categories. Obligations that bite: **Art. 4 AI literacy** (softened by the Omnibus to "take measures"), and **Art. 50 transparency** (in application since 2 Aug 2026; Art. 50(2) machine-readable marking of AI-generated text has a grace period to 2 Dec 2026 for systems already on the market before 2 Aug 2026). High-risk dates moved to 2 Dec 2027 / 2 Aug 2028.

### Cited Findings
- The Digital Omnibus on AI was adopted (Parliament 16 June 2026, Council 29 June 2026 per one source), published in the OJ on 24 July 2026 and in force 27 July 2026 as **Regulation (EU) 2026/1744** [COMMENTARY] — [Aiacto](https://www.aiacto.eu/en/blog/digital-omnibus-ai-act-report-2027); [Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/) (note: one Usercentrics passage contradicts itself, so rely on others); [Orrick, July 2026](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)
- Annex III / Art. 6(2) high-risk obligations now apply from **2 Dec 2027**; Annex I / Art. 6(1) from **2 Aug 2028** [COMMENTARY] — [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes); [Cooley](https://cdp.cooley.com/digital-ai-omnibus-delays-key-deadlines-introduces-new-rules/)
- **Art. 50** transparency obligations stayed on the 2 Aug 2026 schedule; the only relief: providers of systems generating synthetic content placed on the market **before 2 Aug 2026** have until **2 Dec 2026** for Art. 50(2) machine-readable marking; new systems must comply at launch [COMMENTARY] — [Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html); [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)
- The Commission issued draft Art. 50 guidelines for consultation on 8 May 2026 (closed 3 June); final form not confirmed [COMMENTARY] — [Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html)
- **Art. 4 AI literacy** was kept but softened: the duty to "ensure a sufficient level" of AI literacy became a duty to take measures supporting its development, with no duty to guarantee any individual's level; application date (2 Feb 2025) unchanged [COMMENTARY, verify against OJ] — [AI-act service desk Art. 4 (pre-amendment text)](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-4); [Ainora](https://ainora.lt/blog/eu-ai-act-article-4-ai-literacy); [Presencis](https://cdn.presencis.com/regulations/eu-ai-act/article-4/)
- New small mid-cap category (<750 employees, turnover ≤ €150m or balance sheet ≤ €129m) gets SME-style relief; new Art. 5 prohibitions (non-consensual intimate imagery, CSAM generation) apply from 2 Dec 2026 [COMMENTARY] — [Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes)

### Inferences
- **Role:** by putting LLM-backed features into the product under its own name, the operator is plausibly the "provider" of an AI system built on a third-party GPAI model (the GPAI obligations stay with OpenAI/other model vendors); clubs/coaches using it are deployers. Being a provider of a non-high-risk system means essentially Art. 50 + Art. 4.
- **High-risk check:** Annex III covers e.g. education/vocational training (admission, evaluating learning outcomes, steering learning), employment, biometrics, access to essential services. Coaching drafts for volleyball drills and AI-assisted parsing of match narrative into scouting events do not evaluate persons for access to education or employment; the AI does not score players' skills (skill scores are set by coaches). So not high-risk. Keep it that way: do **not** let AI generate player ratings, selection decisions or "talent" scores of minors without re-assessing (education/training evaluation of minors is the closest Annex III analogue). The on-device MediaPipe background removal in the awards feature is image segmentation, not biometric identification or categorisation.
- **Art. 50 practicals:** (1) Art. 50(1) (inform people they interact with an AI system) applies if any feature is conversational; label AI features clearly. (2) Art. 50(2) (machine-readable marking of AI-generated text) is a provider obligation; a pragmatic approach is to store metadata `generatedBy: 'ai'` on drafted exercises/plans and show a visible "AI draft" label until a human edits/approves; check the final Commission guidelines/code of practice for what counts as adequate marking for text, and whether the "assistive function for standard editing / not substantially altering input" exemption applies to text-scouting (which transforms coach input into structured events).
- **Art. 4:** a short "using AI features responsibly" in-app note plus an internal record is a proportionate measure for a solo operator; clubs as deployers have their own Art. 4 duty for their staff.
- **Contract terms to add:** AI outputs are drafts, no warranty of accuracy, user must review; disclose the model vendor as subprocessor; prohibit using AI features to profile or rate minors; state that inputs are sent to a third-party LLM endpoint (already minimised to jersey numbers in text scouting).

### Gaps
- Final OJ text of amended Art. 4 and Art. 50 not read directly.
- Final Commission Art. 50 guidelines / Code of Practice on marking AI-generated content: adoption status as of Oct 2026 not confirmed.

---

## 3. Digital Services Act (Reg. (EU) 2022/2065)

### Takeaway
A SaaS that stores content provided by its users at their request is technically a **hosting service**, but this app stores club content only for the club itself (not disseminated to the public), so it is **not an online platform**. Baseline duties for all intermediaries (single points of contact, legal representative if non-EU, content-moderation info in T&Cs) and hosting duties (notice-and-action, statement of reasons) likely apply in a light form; micro/small enterprises are exempt mainly from platform-tier duties and transparency reporting.

### Cited Findings
- Contact points (Arts. 11-12) apply to all intermediary services; notice-and-action (Art. 16) and statement of reasons (Art. 17) are the hosting-specific duties; micro and small enterprises are exempt from certain obligations including transparency reporting and the online-platform duties (Arts. 19-28) [COMMENTARY, article numbering varies between guides] — [sota.io DSA guide](https://sota.io/blog/eu-digital-services-act-saas-developer-compliance-guide-2026); [YPOG briefing](https://www.ypog.law/hubfs/YPOG%20Briefing%20The%20Digital%20Services%20Act.pdf); [Presencis DSA applicability](https://presencis.com/regulations/dsa/applicability/)
- One guide argues B2B SaaS processing data for a customer without user content visible to others is out of scope; others say DSA applies to all intermediary services including B2B hosting/cloud — conflicting commentary — [sota.io hosting guide](https://sota.io/blog/eu-digital-services-act-2024-hosting-provider-developer-guide); [sota.io SaaS guide](https://sota.io/blog/eu-digital-services-act-saas-developer-compliance-guide-2026)

### Inferences
- Low-cost compliance: publish one email as the point of contact for authorities and users (Arts. 11-12); a T&C section on acceptable use and how content may be restricted (Art. 14); a simple "report illegal content" route (Art. 16) and a reason when the operator removes content or suspends an account (Art. 17). These also support the operator's reserved right to remove content and suspend.
- The exercise library is club-scoped; if a future feature shares exercises across clubs or publicly, the app moves toward "online platform" status (micro/small exemption then matters).

### Gaps
- DSA primary text not fetched; exact scope of the Art. 19 micro/small exemption (platform-only vs Art. 15 transparency reports for hosting) should be confirmed in the Regulation (my background understanding: Art. 15 reporting does not apply to micro/small enterprises that are not VLOPs; Arts. 11, 12, 14, 16, 17 apply to all relevant intermediaries).

---

## 4. European Accessibility Act (Directive (EU) 2019/882)

### Takeaway
The EAA (applicable since 28 June 2025) covers specified **consumer-facing** products and services (incl. e-commerce services). A purely B2B SaaS sold to clubs is generally out of scope; the risk area is a self-serve checkout that a consumer could use. Microenterprises providing services (<10 persons and ≤ €2m turnover or balance sheet) are exempt from the service requirements anyway.

### Cited Findings
- Services aimed only at business users generally fall outside; self-serve signup/checkout flows open to consumers may be read as e-commerce services in scope; the microenterprise exemption (<10 persons and annual turnover or balance sheet ≤ €2m) covers services, not products, and is read restrictively [COMMENTARY, article numbering conflicts between sources] — [buildmvpfast decision tree](https://www.buildmvpfast.com/blog/european-accessibility-act-saas-decision-tree-2026); [Xictron](https://www.xictron.com/en/blog/accessibility-act-exemptions-microenterprises-2026/); [sota.io EAA guide](https://sota.io/blog/european-accessibility-act-eaa-2026-saas-developer-guide-wcag-en-301-549)
- A German-oriented guide says B2B-only shops are out of scope only if the B2B nature is explicit and no consumer contracts are concluded via the shop [COMMENTARY] — [buildmvpfast](https://www.buildmvpfast.com/blog/european-accessibility-act-saas-decision-tree-2026)

### Inferences
- A solo founder is a microenterprise, and the product is B2B: EAA does not apply now. Still, make the B2B-only nature explicit at sign-up ("for clubs/organisations only"), which also supports the "not a consumer" position (see §7).
- Selling to **public universities** later (US: Section 508 / ADA Title II rules; EU public bodies: Web Accessibility Directive / EN 301 549 often required in tenders) will create accessibility requirements by contract even where the EAA does not.

### Gaps
- Directive text and Italian/Spanish transposing acts not read directly.

---

## 5. NIS2 (Directive (EU) 2022/2555) and Cyber Resilience Act (Reg. (EU) 2024/2847)

### Takeaway
Neither is likely to apply. NIS2 covers cloud computing services (including SaaS) but generally only medium and large entities (size-cap rule); the CRA covers products with digital elements and excludes pure SaaS unless it is remote data processing essential to a covered product.

### Cited Findings
- Pure SaaS is generally outside the CRA unless it is "remote data processing" essential to a covered product's function (Art. 3(2) definition); case-by-case [COMMENTARY] — [Presencis CRA SaaS exemption](https://presencis.com/regulations/cra/exemptions/saas); [Kirkland, Sept 2026](https://www.kirkland.com/publications/kirkland-alert/2026/09/the-eu-cyber-resilience-act)
- Council drafting text: cloud services designed and developed outside the responsibility of a manufacturer of a product with digital elements are not in CRA scope [LAW-in-progress, 2023 draft] — [Council ST 5308/2023](https://data.consilium.europa.eu/doc/document/ST-5308-2023-INIT/en/pdf)
- NIS2 applies to cloud computing services, including SaaS service models [LAW-in-progress, Council draft] — same Council source; size thresholds not confirmed in this search.

### Inferences
- The web app is not a "product with digital elements" placed on the market (no downloadable/installed software; PWA served from Firebase). If the operator ever ships a native app or downloadable component, re-check CRA (applies in full from 11 Dec 2027; reporting obligations from 11 Sept 2026 — background knowledge, verify).
- NIS2: a solo/micro operator is below the medium-enterprise threshold (50 employees or €10m turnover/balance sheet) — background knowledge, not verified here. Google Firebase as infrastructure is itself in scope, which helps supply-chain answers in club questionnaires.

### Gaps
- NIS2 Art. 2 size-cap text and CRA application dates not verified in this session.

---

## 6. ePrivacy / cookies (localStorage, sessionStorage)

### Takeaway
Storage on the user's device (cookies **and** localStorage/sessionStorage) falls under Art. 5(3) ePrivacy Directive, but storage **strictly necessary** for the service the user requested (auth session, theme, remembering settings, AI API key in sessionStorage) is exempt from consent; only information is required. Both the Italian Garante (2021) and Luxembourg CNPD (2021) guidelines follow this; neither requires a banner for technical-only storage.

### Cited Findings
- Italian Garante "Linee guida cookie e altri strumenti di tracciamento" (adopted June 2021, operational 9 Jan 2022): technical tools need only information (can be in the general privacy notice), not consent; non-technical tools need prior consent; scrolling is not consent [OFFICIAL, via commentary] — [Legiscope](https://www.legiscope.com/blog/cookie-linee-guida-garante.html); [Osborne Clarke 2021](https://www.osborneclarke.com/wp-content/uploads/2021/07/OC_Insight_TMT_Linee-guida-cookie-luglio-2021_-1.pdf)
- Luxembourg CNPD guidelines on cookies and other trackers (26 Oct 2021, covering fingerprinting, web beacons, shared objects): essential trackers exempt from consent (examples: recording consent choice, authentication, shopping cart, form responses, service customisation, security); CNPD still recommends informing users; first-party audience measurement still needs consent per CNPD [OFFICIAL, via commentary] — [Linklaters](https://www.linklaters.com/knowledge/publications/alerts-newsletters-and-guides/2021/november/11/cnpd-publishes-new-guidelines-on-cookies); [Bird & Bird global cookie review](https://cm.twobirds.com/en/trending-topics/global-cookie-review/luxembourg)

### Inferences
- The app's `vcb.*` localStorage settings, Firebase Auth persistence, Firestore offline cache (IndexedDB) and the AI key in sessionStorage are all functionality the user asked for → exempt; describe them in the privacy notice/"storage" section. Keep the CLAUDE.md rule of **no analytics/tracking**: adding analytics would trigger consent (CNPD in particular).
- "Remember AI key" in localStorage is user-chosen functionality → still strictly necessary.

### Gaps
- The Garante guidelines' explicit treatment of localStorage was not confirmed (search results did not mention it); EDPB Guidelines 2/2023 on the technical scope of Art. 5(3) (which confirm local storage is covered) not fetched.
- Status of the Digital Omnibus proposal to move cookie rules into GDPR (Art. 88a) not checked.

---

## 7. Contract formation and enforceability of click-through B2B terms (Italy, Luxembourg, EU private international law)

### Takeaway
Under Italian law, art. 1341(2) c.c. makes the most operator-favourable clauses (liability limits, right to withdraw or suspend, forfeitures, limits on exceptions, tacit renewal, arbitration, forum derogation) **ineffective unless specifically approved in writing**, and the Cassazione (ord. n. 20945, 20 June 2026) has just held that a **checkbox (even a second "flag") is not enough** in a B2B online contract; an electronic signature step (e.g. OTP) tied to the specific clauses is advised. Luxembourg abolished its equivalent rule in 2004 (art. 1135-1 Civil Code now only requires that the party could know and is deemed to accept the terms), so **Luxembourg law is far friendlier** while the operator is Luxembourg-resident. Once the operator is Italian and sells to Italian clubs, a foreign choice of law does not escape Italian mandatory rules for a purely domestic contract (Rome I Art. 3(3)).

### Cited Findings
- Art. 1341 c.c. text: para. 1 — standard terms bind the other party if at conclusion it knew or should have known them using ordinary diligence; para. 2 — "non hanno effetto, se non sono specificamente approvate per iscritto" terms that establish, in favour of the drafter, "limitazioni di responsabilità, facoltà di recedere dal contratto o di sospenderne l'esecuzione", or impose on the other party "decadenze, limitazioni alla facoltà di opporre eccezioni, restrizioni alla libertà contrattuale nei rapporti coi terzi, tacita proroga o rinnovazione del contratto, clausole compromissorie o deroghe alla competenza dell'autorità giudiziaria" [LAW] — [Brocardi art. 1341](https://www.brocardi.it/codice-civile/libro-quarto/titolo-ii/capo-ii/sezione-i/art1341.html)
- Cass. ord. n. 20945 of 20 June 2026: B2B online electricity supply (hotel company), exclusive forum clause approved by ticking boxes held ineffective; ticking is not a signature and at most expresses acceptance of the whole contract; specific approval online requires an electronic signature, even simple (e.g. OTP by SMS/email), suitable to express specific consent; art. 1341(2) is a formal rule applying to all standard-form contracts regardless of party status; ineffectiveness ("inefficacia"), not nullity [COMMENTARY by G. Coraggio, DLA Piper] — [Diritto al Digitale, 30 June 2026](https://dirittoaldigitale.com/2026/06/30/clausole-vessatorie-contratti-online/); see also [Il Sole 24 Ore NT+ Diritto](https://ntplusdiritto.ilsole24ore.com/art/contratto-telematico-e-approvazione-clausole-vessatorie-pointclick-cassazione-frena-AI3YvQwD); [WST Legal](https://www.wstlegal.eu/clausole-vessatorie-e-contratti-on-line-la-cassazione-supera-il-mero-point-and-click/); one commentator reads it as not excluding point-and-click absolutely but requiring extra safeguards — [Paratore & Partners](https://www.paratore.it/contratto-online-point-and-click-o-con-spunta-e-valido/)
- Practical recommendations: map 1341(2) clauses, isolate them in a dedicated section, add a real signature step (OTP) for specific approval after general acceptance, retain evidence (logs, timestamps, exact clause text shown), re-paper existing checkbox-only contracts [COMMENTARY] — [Diritto al Digitale](https://dirittoaldigitale.com/2026/06/30/clausole-vessatorie-contratti-online/)
- Under eIDAS and the Italian CAD (arts. 20-21) a simple electronic signature is freely assessed by the judge; advanced/qualified signatures have the evidentiary force of art. 2702 c.c. [COMMENTARY] — [Diritto al Digitale](https://dirittoaldigitale.com/2026/06/30/clausole-vessatorie-contratti-online/)
- Luxembourg Civil Code art. 1135-1: general conditions bind the other party only if it could know them at signature and must, in the circumstances, be considered to have accepted them; no signature on the general conditions required; a **2004 amendment abolished the former second paragraph** that made liability limitations, arbitration etc. unenforceable without written acceptance, to ease electronic contracting [LAW via case law/comparative report] — [Justice de paix Luxembourg 2024 decision](https://download.data.public.lu/resources/justice-de-paix-luxembourg-civil/20240827-230244/20240115-jplcivil-182-pseudonymise-accessible.pdf); [Henri Capitant report 2014](https://www.henricapitant.org/wp-content/uploads/2022/05/JI-2014-Espagne-Luxembourg_2.pdf); [Chambre des Métiers guide](https://services.cdm.lu/juridique/cahier/11/fiche/7.pdf)
- Consumer status of ASD/associations: no source found in this session (see Gaps).

### Inferences
- **Design of the sign-up flow (Italy-proof):** (1) general acceptance checkbox for the whole Terms; (2) a separate screen listing the 1341(2) clauses by number and title (limitation of liability, suspension, termination/withdrawal by operator, tacit renewal, forum/jurisdiction, any forfeiture/time bars, unilateral changes) with a separate approval confirmed by an **OTP sent to the signer's email** (cheap simple e-signature; Firebase email-link auth already proves control of the email, which can be framed as part of the SES), storing timestamp, IP, version hash and the clause text shown; (3) send a PDF/durable copy of the terms by email. Manual activation by the operator is a natural place to also collect a signed (FEA/QES or handwritten scan) order form for higher-value clubs.
- **Choice of law:** while the operator is in Luxembourg, choose Luxembourg law (Rome I Art. 3) for EU clubs; under Rome I Art. 4(1)(b) the default for services is the provider's habitual residence anyway. After moving to Italy, a domestic Italy–Italy contract cannot escape art. 1341 by choosing foreign law (Rome I Art. 3(3)), so the OTP flow is needed regardless. For Spanish clubs, check Spain's Ley 7/1998 de Condiciones Generales de Contratación (incorporation requirements) — not researched here.
- **Jurisdiction:** for cross-border B2B (Luxembourg operator ↔ Italian club), Brussels Ia Art. 25 governs the form of the choice-of-court clause, and electronic click-wrap that provides a durable record can satisfy "writing" (CJEU C-322/14 El Majdoub, 2015 — background knowledge); Italian courts have tended to treat Art. 25 as displacing art. 1341 for international clauses (background knowledge). The 2026 Cassazione ruling concerned a domestic forum clause. Belt-and-braces: put the forum clause in the OTP-approved list anyway.
- Even where a clause fails 1341(2), only that clause is ineffective; the rest of the contract stands. Draft so that the business still works if each vexatious clause falls (e.g. suspension also justified by art. 1460 c.c. exception of non-performance, which needs no clause).

### Gaps
- **ASD/SSD as consumers**: not found in this session. Background knowledge (verify): Codice del Consumo art. 3(1)(a) defines consumer as a **natural person** acting outside business purposes; CJEU C-541/99 and C-542/99 (Cape/Idealservice, 2001) held the Unfair Terms Directive's "consumer" is only a natural person; so an ASD (an association, legal or de facto) is not a consumer. Risk remains for **individual coaches or parents** signing up personally (natural persons) — require that the account holder acts on behalf of a club/organisation. Some Italian case law has extended consumer-like protection to non-profit entities in limited contexts; not verified.
- Text of Rome I Arts. 3-4 and Brussels Ia Art. 25, El Majdoub, and Italian case law on Art. 25 vs art. 1341 were not fetched.
- Spanish general-conditions law not researched.
- eIDAS 2 (Reg. 2024/1183) changes not checked; Art. 25(1) eIDAS (non-discrimination of e-signatures in legal proceedings) is the relevant rule (background knowledge).

---

## 8. Payment, suspension and renewal (Late Payment Directive, Italian/Luxembourg rules)

### Takeaway
In Italy, statutory late-payment interest for commercial transactions (D.lgs. 231/2002, implementing Directive 2011/7/EU) is ECB reference rate + 8 points = **10.40% for H2 2026**, accruing automatically from the day after the due date; it applies between businesses/professionals/public administrations, not consumers. Suspension for non-payment and tacit renewal are both 1341(2) clauses (need specific approval in Italy).

### Cited Findings
- H2 2026 (1 Jul–31 Dec): reference rate 2.40% + 8 = 10.40% (published GU n. 163, 16 July 2026); H1 2026 was 2.15% + 8 = 10.15%; interest runs automatically from the day after due date without formal notice; applies to transactions between businesses, professionals and public administrations, not consumers [OFFICIAL via commentary] — [Edotto](https://edotto.com/articolo/ritardi-nei-pagamenti-commerciali-interessi-di-mora-dal-1-luglio-2026); [ANIE](https://anie.it/servizi/affari-legali/ritardi-nei-pagamenti_tassi_1luglio-31-dicembre-2026/); [Fiscal Focus](https://www.fiscal-focus.it/quotidiano/il-quotidiano/articoli-fisco/ritardi-nei-pagamenti-interessi-di-mora-al-10-40-dal-1deg-luglio-2026,3,186713)
- Rights to suspend execution and "tacita proroga o rinnovazione" are listed in art. 1341(2) c.c. [LAW] — [Brocardi art. 1341](https://www.brocardi.it/codice-civile/libro-quarto/titolo-ii/capo-ii/sezione-i/art1341.html)

### Inferences
- Whether D.lgs. 231/2002 applies against an **ASD debtor** depends on whether it counts as an "impresa" carrying on an economic activity; a purely amateur association may not be — so the contract should itself provide late-payment interest (a contractual rate, OTP-approved) rather than rely on the statute.
- Simplest commercial model to avoid many issues: **prepaid per-season licence, no auto-renewal** (club renews by paying); activation only on payment. That avoids tacit-renewal and late-payment fights entirely. If subscriptions with auto-renewal are added later, include renewal reminders and have the renewal clause specifically approved.
- Suspension for non-payment: reserve it expressly (OTP-approved), with notice (e.g. 15 days) and a read-only/export window, which also aligns with the Data Act and with art. 1460 c.c.

### Gaps
- Luxembourg late-payment law (Law of 18 April 2004 as amended) rate for 2026 not checked.
- Italian rules on online subscription renewals for B2B (none specific found) and Spanish rules not checked.

---

## 9. Operator rights worth reserving (and limits)

### Takeaway
Most operator rights are freely negotiable B2B; the hard limits are: no exclusion/limitation of liability for wilful misconduct or gross negligence (art. 1229 c.c.; Data Act Art. 13 black list for data-related terms), 1341(2) formalities in Italy, GDPR processor limits on reuse of club data, and Data Act exit rights.

### Cited Findings
- Liability limitations, rights to withdraw/suspend, forfeitures and forum derogations in standard terms need specific written approval in Italy [LAW] — [Brocardi art. 1341](https://www.brocardi.it/codice-civile/libro-quarto/titolo-ii/capo-ii/sezione-i/art1341.html); online approval requires an e-signature step, not a flag [COMMENTARY] — [Diritto al Digitale](https://dirittoaldigitale.com/2026/06/30/clausole-vessatorie-contratti-online/)
- Luxembourg no longer requires separate written acceptance for liability limitations (2004 reform) [COMMENTARY] — [Henri Capitant report](https://www.henricapitant.org/wp-content/uploads/2022/05/JI-2014-Espagne-Luxembourg_2.pdf)
- Data Act: export must be possible, switching fees banned from 12 Jan 2027 [COMMENTARY] — [Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)

### Inferences (recommended reserved rights, with legal guard-rails)
1. **IP in the software**: all rights in the app, code, design system, court-diagram engine, award-card templates remain the operator's; clubs get a non-exclusive, non-transferable, season-limited licence (SaaS access, no source code). Software is protected by copyright as a literary work (Directive 2009/24/EC; Italy L. 633/1941 arts. 2(8), 64-bis ff. — background knowledge, verify).
2. **Club content** (exercises, diagrams, trainings, player data): club owns it; operator gets a licence limited to hosting, operating, backing up, and providing the service and support. Player data: operator is a **GDPR processor** for the club, so any wider use is barred by Art. 28 GDPR (handled by the GDPR researcher).
3. **Aggregated/anonymised data**: reserve the right to use truly anonymised, aggregated usage statistics and non-personal data (e.g. feature usage counts) to improve the service; avoid reusing club exercises across clubs without an explicit opt-in licence (and Data Act Art. 13 may scrutinise unilateral data-use terms).
4. **Feedback licence**: free, perpetual right to use suggestions.
5. **References/logos**: right to name the club as a customer and show its logo, **with an opt-out** (name/logo are the club's trademarks/identity; consent is the safe route). Never use minors' images.
6. **Suspension**: for non-payment, security threats, illegal content, breach of acceptable use, with notice except emergencies (OTP-approved in Italy; DSA Art. 17 reasons where content is restricted).
7. **Termination/non-renewal** by operator with notice; immediate for material breach; always with a data-export window.
8. **Unilateral changes**: right to modify features (no removal of core functionality mid-season) and terms/prices for the **next** season with notice (e.g. 30-60 days) and a right to terminate; avoid unilateral mid-term price increases (also on the Data Act Art. 13 grey-list logic and Italian 1341).
9. **Liability**: cap at fees paid in the previous 12 months / current season; exclude indirect damages, loss of data beyond restoring from backups, lost profits; carve out wilful misconduct and gross negligence (unenforceable to exclude in Italy under art. 1229 c.c. — background knowledge) and liabilities that cannot be excluded by law.
10. **Warranties**: service "as is" and "as available", no uptime SLA, no guarantee of AI output accuracy; reasonable-efforts backups; beta features flagged. Firebase/Google outages as force majeure (art. 1218/1256 c.c. impossibility also applies by default).
11. **Force majeure** clause including third-party cloud/LLM provider failures.
12. **Account and access**: operator activates clubs at its discretion (right to refuse service — freedom of contract B2B), one deployment per club rules, acceptable-use policy (no uploading of special-category data beyond what the features need, no rating minors with AI).
13. **Governing law/jurisdiction**: Luxembourg law and courts while Luxembourg-based; revisit on moving to Italy.
14. **Assignment**: right to assign the contract to a successor (sale of the business), with notice.

### Gaps
- Art. 1229 c.c. text not fetched (Brocardi URL 404). Background knowledge: para. 1 — any agreement excluding or limiting in advance the debtor's liability for "dolo o colpa grave" is null; para. 2 — also null for acts violating public-order obligations. Verify on Normattiva.
- Italian copyright statute for software not fetched.

---

## 10. Trademark and copyright protection

### Takeaway
An EU trade mark (EUTM) filed online costs **€850 for one class, €900 for two, €1,050 for three** (official EUIPO fees, before any attorney fees); relevant classes for this app are typically 9 (downloadable software) and 42 (SaaS), possibly 41 (sports training/education services). Software copyright arises automatically without registration.

### Cited Findings
- EUTM online: €850 first class, €50 second class, €150 each further class; paper filing €1,000 [OFFICIAL fees via commentary] — [Austrian Patent Office EUTM page](https://www.patentamt.at/en/trademarks/apply-for-trademarks/international-trademark/eu-trademark); [Trama TM](https://www.tramatm.com/en/trademark-questions-and-answers/cost-of-trademark-registration/i-want-to-register-an-eu-trademark-in-one-class-how-much-would-that-cost)

### Inferences
- Classes 9 + 42 = €900 online. Run a clearance search (TMview) before filing; the EUIPO SME Fund has in past years reimbursed part of trademark fees for EU SMEs (status for 2026 not checked).
- For the US later: separate USPTO filing or a Madrid Protocol extension.

### Gaps
- EUIPO's own fees page and the 2026 SME Fund status not fetched.

---

## 11. Italian specifics and public-sector selling

### Takeaway
Electronic invoicing via SdI applies to Italian VAT-registered sellers (relevant after moving to Italy); a Luxembourg seller invoices Italian clubs under VAT B2B/B2C rules depending on whether the ASD has a VAT number. Selling to public universities: EU procurement thresholds for 2026-27 are **€140,000** (central government) and **€216,000** (sub-central authorities, which includes most universities) for services; below them, national low-value procurement rules apply.

### Cited Findings
- Delegated Regulation (EU) 2025/2152 (of 22 Oct 2025) sets 2026-27 thresholds from 1 Jan 2026: supplies/services €140,000 central, €216,000 sub-central (down from €143,000/€221,000), works €5,404,000 [LAW] — [EUR-Lex Del. Reg. 2025/2152](https://eur-lex.europa.eu/eli/reg_del/2025/2152/oj/eng/pdf); [Cuatrecasas](https://www.cuatrecasas.com/en/global/public-law/art/new-eu-public-contract-thresholds-2026-2027); [Commission Public Buyers Community](https://public-buyers-community.ec.europa.eu/news/updated-public-procurement-thresholds-2026-2027-adopted-european-commission)
- ASD tax status depends on actual non-commercial activity, not just statute or CONI/RAS registration [COMMENTARY on Cass. ord. 5132/2025] — [Informazione Fiscale](https://www.informazionefiscale.it/associazioni-sportive-dilettantistiche-regole-giurisprudenza-cassazione)

### Inferences
- An ASD without a VAT number is, for VAT purposes, a non-taxable person: a Luxembourg/Italian seller of electronically supplied services may need to charge VAT of the customer's country (OSS) — coordinate with the tax researcher; this also affects whether the club is treated as "business" for VAT, which is separate from consumer-law status.
- Italian public bodies below €140k can buy by direct award (Italian Codice dei contratti, D.lgs. 36/2023 — background knowledge), typically via MePA; expect requirements for SdI e-invoicing, CIG codes, split payment and accessibility (AgID guidelines). US colleges: separate procurement and FERPA/accessibility (Section 508/ADA Title II) issues — out of EU scope.

### Gaps
- SdI/e-invoicing obligations for a non-resident seller, Italian VAT treatment of ASDs, and MePA onboarding not researched here (tax topic).
- University-specific Italian procurement rules not researched.
