# Build the exit, consent and signature flows first

The law forces the most design changes in three places: how a club leaves, how it signs, and what data it can enter. It does not much limit what the platform does day to day. First, the requirement that a deactivated club "loses access completely" cannot reach the club's own data. The EU Data Act's switching rules apply to SaaS with **no SME exemption in force**. A terminating customer is owed a **transition period of up to 30 days followed by at least 30 days to retrieve its data**, and **from 12 January 2027 no switching charges at all** ([Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)). GDPR Art. 28(3)(g) separately gives the club, as controller, the choice of return or deletion. So the product needs a free self-service export and an "export-only" tenant state. Second, a click-through DPA is valid under GDPR Art. 28(9). The processor carries its own duty to have one (a French processor was fined **€1.5M** in 2022 for lacking it), so acceptance must be a hard, logged gate ([Goodwin](https://www.goodwinlaw.com/en/insights/blogs/2022/06/french-data-protection-authority-fined-medical-software-provider-for-gdpr-violations)). For Italian clubs, the operator-favourable clauses also need **specific written approval** under art. 1341 c.c. On **20 June 2026** the Cassazione held that ticking a box, even a second one, does not count as that approval: an e-signature step such as an OTP is needed ([Diritto al Digitale](https://dirittoaldigitale.com/2026/06/30/clausole-vessatorie-contratti-online/)). Third, minors' data pushes the product toward keeping health information out by design, recording per-player image consent, storing opponents from .dvw files as numbers only, and giving clubs a ready DPIA support pack. Most operator-favourable terms are lawful between operator and club: liability caps, audits by documentation, general sub-processor authorisation, suspension, and next-season price changes. None of them limits claims by players or guardians, or regulators' fines. Business form decides who the contracting party is and how much personal risk the founder carries. A sole trader signs and is liable personally. A Luxembourg business needs a real Luxembourg establishment, so the business should be registered wherever the founder actually lives and re-founded on the move to Italy. The Terms must reserve the right to assign contracts to the successor entity. US colleges come later, and their gate is procurement more than statute: a FERPA addendum, a HECVAT, a WCAG 2.1 AA conformance report, $1M–$5M of insurance, and acceptance that a click-through cannot be the only route to a contract. This report is research, not legal or tax advice. The points that need an Italian lawyer, a commercialista or a Luxembourg fiduciaire are marked throughout and gathered in the checklist.

**How to read the evidence labels.** Each claim carries one of four tags. **[Law]** is a binding statute, regulation, CJEU or national supreme-court ruling, or official journal text. **[Guidance]** comes from the EDPB, a national supervisory authority, the Commission, or a binding federation rule; regulators follow it but it does not bind courts. **[Commentary]** comes from law firms, academics, vendors and the press. **[Unverified]** is the research team's background knowledge, not confirmed against a source in this research; treat it as a lead to check. The researchers cited GDPR articles from the official text but did not re-fetch every article in this session, so check the wording on [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) before quoting it in a contract. Several Data Act article details also rest on commentary that quotes the Regulation, because EUR-Lex fetches failed.

## 1. Eight hard constraints that change the system design

### Deactivation can end the app, but not the club's route to its data

The Data Act (Reg. (EU) 2023/2854) has applied since **12 September 2025**. Its Chapter VI switching rules cover "data processing services", which explicitly includes SaaS. Applying it to business-function SaaS still needs case-by-case assessment, but a standard multi-tenant product sold from a public sign-up page is the clearest case of a standard service **[Commentary]** ([Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview); [Bundesnetzagentur glossary](https://www.bundesnetzagentur.de/SharedDocs/A_Z_Glossar_DataAct_ENG/D/data-processing-service.html?nn=686258)). The Art. 25 contract must contain these terms:

- a notice period to start switching of **no more than 2 months**;
- a transition of **no more than 30 calendar days**, or, if that is technically unfeasible, notice within 14 working days and up to 7 months;
- an exhaustive list of exportable data;
- a **data-retrieval period of at least 30 days after the transition**;
- full erasure after that period;
- no commercial, technical or contractual obstacles to leaving.

These rest on **[Commentary quoting the Regulation]** ([Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)). The provider must also publish switching information, a register of data structures and formats, and the jurisdiction of its ICT infrastructure (same source).

Chapter VI has **no SME exemption today** ([Privy CDP](https://privycdp.org/regulation/eu-data-act-cloud-switching)). The pending Digital Omnibus would add relief for SMEs, but only for contracts concluded **on or before 12 September 2025**. It would not cover a service launched in 2026–27, and as of July–August 2026 it was still under negotiation **[Commentary]** ([Greenberg Traurig](https://www.gtlaw.com/en/insights/2026/7/eu-digital-omnibus-package-proposes-amendments-to-data-act); [Commission Digital Package FAQ](https://digital-strategy.ec.europa.eu/en/faqs/digital-package)). Two carve-outs matter here. Art. 31(2) excludes **non-production versions provided for testing and evaluation for a limited period**. Art. 31(3) requires the provider to tell prospective customers in advance which obligations do not apply **[Law]** ([Springlex, Art. 31](https://www.springlex.eu/fr/packages/data-act/data-act-regulation/article-31/)). A labelled, time-limited trial tier is therefore outside Chapter VI. The paid service is not.

GDPR points the same way. Art. 28(3)(g) obliges the processor, "at the choice of the controller", to delete *or return* all personal data at the end of the service. Art. 28(10) makes a processor that keeps data for its own purposes a controller of that data, which then needs its own legal basis **[Law]** ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). The design consequence is a tenant lifecycle with distinct states. "Loses access" should mean losing the *app*, never the data:

| State | Trigger | What the club can do | Data |
|---|---|---|---|
| Pending | Self-sign-up, DPA + Terms accepted | Nothing beyond the sign-up profile; ideally no player data entry before activation | Only the operator's own controller data (sign-up record) |
| Trial (optional) | Operator labels a time-limited evaluation | Full use, labelled as evaluation (Data Act Art. 31(2)) | Club data under the DPA |
| Active | Manual activation now; payment later | Full use | Club data under the DPA |
| Suspended | Non-payment, security threat, breach of acceptable use | Club admins can sign in only to an **export-only page** | Retained, reversible |
| Terminating | Club or operator ends the contract | Notice of up to 2 months, then up to 30 days' transition, then **≥30 days of export-only access** | Retained until the window closes |
| Deleted | Window closed | Nothing | Firestore and Auth data hard-deleted; backups expire on their normal rotation and are never restored except for disaster recovery; a minimal termination record (club ID, dates, DPA acceptance log, invoices) is kept as operator controller data |

Commentary on terminations started by the provider (for non-payment or breach) is thin. The conservative reading is to offer the export window in every termination scenario **[Inference from Commentary]** ([Maples Group](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview)). Even custom-built services must export in a "structured, commonly used, machine-readable format" **[Guidance]** ([Bundesnetzagentur](https://www.bundesnetzagentur.de/SharedDocs/A_Z_Glossar_DataAct_ENG/D/data-processing-service.html?nn=686258)). So the export should be a free JSON/CSV bundle of everything:

- teams, players and physical tests;
- calendars and trainings;
- the exercise library and its diagrams;
- matches with their full event logs;
- awards choices;
- consent records.

The same feature covers GDPR access and portability requests the club receives, US FERPA "return of data" clauses later, and Art. 28(3)(e) assistance at no bespoke cost. Firestore backup and point-in-time-recovery windows must be stated in the DPA. No regulator has published an acceptable post-termination window. The 30-day export period plus ordinary backup rotation is **market practice, not law**.

### Acceptance must be a logged gate, and for Italy a signature

GDPR Art. 28(9) requires the processor contract to be "in writing, including in electronic form" **[Law]** ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). No source found requires a handwritten or qualified signature. Enforcement makes the gate non-optional. In **CNIL v Dedalus Biologie (April 2022, €1.5M)**, the regulator held that a software vendor's duty to have Art. 28(3) terms is "separate, independent" of the controller's. The vendor alone was liable for its standard contract lacking them, and it was also fined for processing beyond instructions and for weak security **[Law/enforcement]** ([Goodwin](https://www.goodwinlaw.com/en/insights/blogs/2022/06/french-data-protection-authority-fined-medical-software-provider-for-gdpr-violations); [Cooley](https://cdp.cooley.com/breach-of-patients-data-leads-to-heavy-sanctions-in-france/)).

No club should be activated, and no player data written, without an accepted DPA. The acceptance record should hold:

- the DPA and Terms version (with a hash);
- the club ID;
- the accepting admin's email;
- the timestamp and IP address;
- the exact text displayed;
- a confirmation that the person is **authorised to bind the club**, because an association acts through its representatives.

Italian contract law adds a second layer. Under art. 1341(2) c.c., standard terms that favour the drafter **"non hanno effetto, se non sono specificamente approvate per iscritto"** (have no effect unless specifically approved in writing). The article lists these clauses:

- limitations of liability;
- the right to withdraw or to suspend performance;
- forfeitures (*decadenze*) and limits on raising defences;
- restrictions on dealing with third parties;
- tacit extension or renewal;
- arbitration clauses and derogations from court jurisdiction.

That is **[Law]** ([Brocardi, art. 1341](https://www.brocardi.it/codice-civile/libro-quarto/titolo-ii/capo-ii/sezione-i/art1341.html)). In **Cass. ord. n. 20945 of 20 June 2026**, the court found ineffective an exclusive-forum clause in a B2B online contract that had been "approved" by ticking boxes. Ticking is not a signature and at most expresses acceptance of the whole contract. Specific approval online needs at least a simple electronic signature, such as an SMS or email OTP. The rule applies to all standard-form contracts whatever the parties' status. Only the clause fails, not the contract **[Law, reported by Commentary]** ([Diritto al Digitale](https://dirittoaldigitale.com/2026/06/30/clausole-vessatorie-contratti-online/); [Il Sole 24 Ore NT+](https://ntplusdiritto.ilsole24ore.com/art/contratto-telematico-e-approvazione-clausole-vessatorie-pointclick-cassazione-frena-AI3YvQwD); [WST Legal](https://www.wstlegal.eu/clausole-vessatorie-e-contratti-on-line-la-cassazione-supera-il-mero-point-and-click/)). One firm reads the ruling as requiring extra safeguards rather than banning point-and-click outright ([Paratore & Partners](https://www.paratore.it/contratto-online-point-and-click-o-con-spunta-e-valido/)). Building for the stricter reading is the safer choice.

Luxembourg is far friendlier. Art. 1135-1 of its Civil Code binds a party to general conditions it could know and must be taken to have accepted. A **2004 amendment abolished** the former rule that required separate written acceptance of liability limits and arbitration **[Law, via case law and commentary]** ([Justice de paix 2024](https://download.data.public.lu/resources/justice-de-paix-luxembourg-civil/20240827-230244/20240115-jplcivil-182-pseudonymise-accessible.pdf); [Henri Capitant report](https://www.henricapitant.org/wp-content/uploads/2022/05/JI-2014-Espagne-Luxembourg_2.pdf)).

Even so, build the Italian flow from the first release. Once the operator is established in Italy and contracts with Italian clubs, choosing a foreign law cannot displace Italian mandatory rules in a purely domestic contract (Rome I Art. 3(3)) **[Unverified for the article text; reasoning from Commentary]**. Retrofitting later would mean re-papering every club. The flow should run as follows:

1. A general acceptance checkbox for the Terms and DPA.
2. A separate screen listing the 1341(2) clauses by number and title.
3. Approval of that screen by an OTP sent to the signer's email.
4. Storage of the OTP event with the clause text shown.
5. A PDF copy emailed as a durable record.

The Firebase email-link sign-in already proves control of the mailbox and can be framed as part of the simple electronic signature. Simple e-signatures are "freely assessed" by Italian judges under the CAD, while advanced and qualified signatures carry full evidential force **[Commentary]** ([Diritto al Digitale](https://dirittoaldigitale.com/2026/06/30/clausole-vessatorie-contratti-online/)). For larger clubs, the manual activation step is a natural moment to collect a signed order form.

Sign-up should also state that the service is **for clubs and organisations only**. Under Italian consumer law and CJEU case law, only a natural person is a "consumer", so an ASD is not one **[Unverified]**. The residual consumer risk comes from individual coaches or parents signing up in their own name. The same B2B labelling keeps the European Accessibility Act out of scope **[Commentary]** ([buildmvpfast](https://www.buildmvpfast.com/blog/european-accessibility-act-saas-decision-tree-2026)).

### The sub-processor list is a product surface, and bring-your-own-key AI changes who is on it

Art. 28(2) and (4) GDPR allow general written authorisation of sub-processors, provided the club is told of changes and can object. The operator stays fully liable for its sub-processors **[Law]** ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). **EDPB Opinion 22/2024 (7 October 2024)** adds that controllers should have the identity (name, address, contact) of **all** processors and sub-processors, the whole chain, "readily available at all times". The processor should provide this proactively and keep it current, and the controller keeps "the ultimate decision" on each sub-processor **[Guidance]** ([Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/edpb-adopts-opinion-on-processors-and-guidelines-on-legitimate-interests); [EDPB](https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-222024-certain-obligations-following_en)). The design therefore needs a public, versioned sub-processor page, plus an email or in-app notice to club admins before any change, with an objection window.

The AI design matters here. If a club configures its own OpenAI-compatible endpoint and key, the **club chooses the recipient**, so that provider is the club's own processor and not the operator's sub-processor. The DPA and the AI settings screen should say so expressly. If the operator supplies a default key, that provider becomes a listed sub-processor with a stated transfer mechanism **[Inference]**. OpenAI has offered **EU data residency for new API projects since 5 February 2025**, with in-region processing and zero data retention on eligible endpoints. Existing projects cannot be switched **[Commentary/vendor]** ([OpenAI](https://openai.com/index/introducing-data-residency-in-europe/); [TechCrunch](https://techcrunch.com/2025/02/06/openai-launches-data-residency-in-europe)). Groq's customer DPA of 15 October 2025 relies on the **2021/914 SCCs**, and data of non-US users is reported to be stored in the US ([Groq DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum); [ConductAtlas](https://conductatlas.com/platform/groq/groq-privacy-policy/international-data-transfers/)). Stripping names down to jersey numbers keeps the payload **pseudonymous, not anonymous**, because the club holds the key and the text carries context. Transfer rules still apply **[Inference from Recital 26]**.

The EU–US Data Privacy Framework still stands. The General Court dismissed *Latombe* (T-553/23) on **3 September 2025**. The appeal C-703/25 P is pending, with Microsoft admitted as intervener on **4 June 2026** and no hearing date reported **[Law/litigation via Commentary]** ([DataGuidance](https://www.dataguidance.com/news/eu-cjeu-admits-microsoft-intervener-appeal-concerning); [Legal500](https://www.legal500.com/intelligence/france/privacy/appeal-seeking-annulment-of-the-data-privacy-framework-dismissed)). The DPA should let the operator switch transfer mechanisms, for example to SCCs, without fresh consent. Neither the DPF certification status of Google, OpenAI and Groq nor Firebase Authentication's data location was checked; both are **[Unverified]** and should be confirmed on the DPF list and in Firebase's documentation. List Google as a sub-processor with potential US transfers whatever Firestore region is chosen, along with the transactional-email provider. List the payment provider only if it receives club personal data.

### Health data stays out because the schema keeps it out

Skill ratings, development plans and match statistics are ordinary personal data, although they are still sensitive in practice because they concern minors. The CJEU nonetheless reads "data concerning health" broadly. In ***Lindenapotheke* (C-21/23, 4 October 2024)**, data from which health can be established "by mental association or inference" counted as special-category data, whatever the controller intended **[Law, via Commentary]** ([Bird & Bird](https://cm.twobirds.com/en/insights/2024/global/feeling-unwell-after-the-cjeus-lindenapotheke-decision); [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2024/10/ecj-lindenapotheke)). Physical tests such as sprint, jump and endurance are borderline on their own. Combined with free-text notes ("returning from knee injury", "asthma, limit sprints"), injury-related absences, body measurements or medical-certificate status, they become Art. 9 data **[Inference]**. CNIL's May 2024 guidance on athletes' disability data asks for strict necessity, usually consent, and a DPIA as good practice **[Guidance]** ([A&O Shearman](https://aoshearman.com/insights/france-cnil-publishes-guidance-on-the-collection-of-data-relating-to-an-athletes-disability)).

The guardrails are built into the product:

- no free-text notes on physical-test records, or inline warnings not to record health information wherever free text exists (development plans);
- a neutral "unavailable" status instead of injury reasons;
- no height, weight or BMI fields unless they are isolated behind stricter access with recorded explicit guardian consent;
- no medical certificates (even "certificate valid until" arguably reveals fitness);
- a DPA that lists data categories and states that **no special categories are intended**, making the restriction a controller instruction.

### Photo consent is a stored record even though the photo never is

Award photos are processed on the device, kept in memory only, and never uploaded, so the operator never receives the image. That sharply limits its role **[Inference]**. The risk moves to the moment a coach **shares** the story. The Garante's school guidance, the closest analogue found, says publishing minors' images online generally requires informed consent from those with parental responsibility, and that consent can be withdrawn **[Guidance, via press]** ([OrizzonteScuola](https://www.orizzontescuola.it/recite-e-saggi-scolastici-foto-e-video-violano-la-privacy-le-indicazioni-del-garante/)).

Italian clubs have had to adopt organisational models and codes of conduct under art. 16 D.Lgs. 39/2021 and CONI Delibera 255/2023. Models were due by **31 August 2024** and a safeguarding officer had to be appointed by **31 December 2024** **[Law/Federation]** ([CSAIn guidelines](https://www.csain.it/wp-content/uploads/2023/08/LINEE-GUIDA-PER-LA-PREDISPOSIZ.-DEI-MOG.pdf); [club safeguarding document](https://files.supersite.aruba.it/media/38378_0b59dd3a0ffbad6ee308a1080210071af866b8f6.pdf)). Typical codes bar using minors' images except for educational purposes with guardian authorisation ([PGS code](https://files.supersite.aruba.it/media/400_8bb59cd018666782945342d0c4cc818b5b52f4fa.pdf/o/codice%20etico%20e%20di%20condotta_pgs.pdf)). Spain's LOPIVI and Poland's "Kamilek law" impose similar statutory protection duties on sports entities ([gov.pl](https://www.gov.pl/web/sprawiedliwosc/ustawa-kamilka--standardy-ochrony-maloletnich); [Educo](https://admin.educo.org/getmedia/d0c60eb1-d9f7-4e7e-92c8-f2f4de58f241/Figura-de-Delegado-o-Delegada-de-Proteccion-en-entidades-deportivas.pdf)).

The consent record should be per player and hold:

- the scope (internal use, publication on club channels);
- who consented and whether both parents did;
- the date;
- a withdrawal date, if any.

The photo step is disabled unless consent covers publication. A jersey-number or avatar fallback serves players without consent. Full names are not placed next to the image by default, and the share screen warns that the story contains minors' images. Italy's digital age of consent of **14** (art. 2-quinquies Codice privacy) governs a minor consenting to an online service, not image publication by a club **[Unverified for the text]**. Do not use it as the image-consent threshold.

Staff criminal-record certificates required by Spanish and German protection regimes are criminal-offence data under Art. 10 GDPR. Store at most a "verified on date X by Y" flag, never the certificate **[Inference]** ([Sportjugend Hessen](https://sportjugend-hessen.de/fileadmin/media/gesellschaft/kindeswohl/Kindeswohl-Merkblatt_erw._Fuehrungszeugnis.pdf)).

### A .dvw import brings other clubs' minors into the database

A .dvw file carries opponents' names and jersey numbers, often of minors. Importing it makes the importing club a controller of strangers' data, on a legitimate-interest basis that weighs children more heavily (Recital 38) **[Law/Inference]**. Store opponents as **jersey numbers only**, discarding names on import. That matches the text-scouting minimisation.

The parser itself stands on firm ground. ***SAS Institute v WPL* (C-406/10, 2 May 2012)** holds that a program's functionality and **data file formats** are not protected as expression of a computer program, provided no expressive elements such as manuals are copied **[Law, via Commentary; the holding on file formats is Unverified]** ([Fieldfisher](https://www.fieldfisher.com/en/insights/sas-institute-inc-v-world-programming-limited); [SCL](https://www.scl.org/2303-sas-v-wpl-a-note-of-caution-for-software-developers/)). Open-source tools already read .dvw files ([openvolley/datavolley](https://github.com/raymondben/datavolley)). Three rules for building the importer:

- Write it from sample files.
- Do not decompile DataVolley or copy Data Project manuals.
- Do not copy openvolley code, which is likely GPL-licensed **[Unverified]**; learning the format from it is fine.

The **DataVolley EULA could not be found**, and it is the single largest open item for this feature. A clause stopping licensees from feeding outputs into other tools would bind the club, not the operator, and its enforceability is uncertain.

Raw match facts are not copyright works (*Football Dataco v Yahoo*, C-604/10). A club that scouts its own matches creates its own dataset **[Law, via Commentary]** ([SCL](https://scl.org/?p=1955)). The Lega Volley–Genius Sports exclusivity covers **official live data and streams for betting** in Serie A2/A3, not coaching data a club scouts itself ([Lega Volley](https://www.legavolley.it/2021/exclusive-partnership-between-lega-volley-and-genius-sports-group/?lang=en)). Genius has owned Data Project since 2017 ([Data Project](https://www.dataproject.com/en/GeniusSportsAcquiresDataProject.html)).

Product rules for the feature:

- No public live-score feeds, public APIs or resale of match data.
- An import warranty: "I have the right to import this file".
- Plain-text naming only, such as "Import DataVolley (.dvw) files", with no logos or "official" claims.
- A non-affiliation disclaimer, which fits the referential-use rule in EUTMR art. 14 **[Unverified]**.

### AI features owe AI Act transparency from day one

The Digital Omnibus on AI was published as **Regulation (EU) 2026/1744** and entered into force on 27 July 2026. It moved high-risk obligations to **2 December 2027** and **2 August 2028**. Art. 50 transparency kept its **2 August 2026** start. The only relief is a grace period to **2 December 2026** for machine-readable marking (Art. 50(2)) of systems already placed on the market before 2 August 2026. A system launched now must comply at launch **[Commentary]** ([Orrick](https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes); [Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html)). The Art. 4 AI-literacy duty was softened to "take measures" ([Ainora](https://ainora.lt/blog/eu-ai-act-article-4-ai-literacy)). Both need confirming against the Official Journal text.

The operator is plausibly the **provider** of an AI system built on third-party models. Exercise drafting and text scouting are not Annex III high-risk uses **[Inference]**. The product should:

- store `generatedBy: 'ai'` on drafted content;
- show a visible "AI draft" label until a human edits or approves it;
- add a short "using AI responsibly" note;
- in the Terms, **prohibit using AI to rate, select or profile minors**, because AI-generated player evaluations would sit close to the Annex III education and training categories.

Check the final Commission Art. 50 guidelines (draft consulted May–June 2026) on whether text scouting qualifies for the "assistive editing" exemption.

### Smaller duties that still shape screens

Under the DSA, the app is a hosting service but not an online platform, because club content is not disseminated to the public. That still means:

- a single point of contact (Arts. 11–12);
- content-restriction rules in the Terms (Art. 14);
- a "report illegal content" route (Art. 16);
- a statement of reasons on any removal or suspension (Art. 17).

Commentary disagrees on whether B2B SaaS is in scope at all **[Commentary]** ([sota.io](https://sota.io/blog/eu-digital-services-act-saas-developer-compliance-guide-2026); [YPOG](https://www.ypog.law/hubfs/YPOG%20Briefing%20The%20Digital%20Services%20Act.pdf)). Strictly necessary local storage (auth session, settings, the offline Firestore cache, the AI key) needs only a privacy-notice description, not a cookie banner, under both Garante (2021) and CNPD (2021) guidelines. Adding analytics would trigger consent **[Guidance]** ([Legiscope](https://www.legiscope.com/blog/cookie-linee-guida-garante.html); [Linklaters](https://www.linklaters.com/knowledge/publications/alerts-newsletters-and-guides/2021/november/11/cnpd-publishes-new-guidelines-on-cookies)). NIS2 and the Cyber Resilience Act are unlikely to apply to a micro web-only SaaS **[Commentary/Unverified thresholds]** ([Presencis](https://presencis.com/regulations/cra/exemptions/saas)).

The promise that the platform admin can "never see club data" should be **technically true in Firestore rules** and covered by rules tests: the admin may read only the tenant-registry fields. Rules tests are the natural evidence of Art. 32's "regular testing" **[Law/Inference]** ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). The future support-access mechanism should be a time-boxed grant that the club admin approves per ticket, scoped and logged, and described in the DPA as access on the controller's instruction.

## 2. What the DPA and Terms must say, and how far operator-friendly terms can go

The DPA must contain the full Art. 28(3) list **[Law]** ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)):

- subject matter, duration, nature and purpose;
- data types and categories of data subjects;
- the controller's rights.

It must also bind the processor to:

- (a) process only on documented instructions, including on transfers;
- (b) bind its staff to confidentiality;
- (c) take Art. 32 security measures;
- (d) follow the sub-processor conditions;
- (e) help answer data-subject requests;
- (f) help with security, breach notification and DPIA duties;
- (g) delete or return data at the end of the service;
- (h) provide compliance information and allow audits.

The processor must also say immediately if an instruction is unlawful. The Commission's controller–processor SCCs (Decision 2021/915) are a regulator-recognised template. They are rigid, however: the parties can adjust only annexes and options, and commercial terms must sit in a separate agreement that does not contradict them **[Law; clause detail Unverified]** ([EUR-Lex 2021/915](https://eur-lex.europa.eu/eli/dec_impl/2021/915/oj)). EDPB Guidelines 07/2020 accept a processor drafting the contract for a standard service, as long as the controller can accept it knowingly and keeps the "essential means" **[Guidance]** ([EDPB](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en)). A short bespoke DPA that follows Art. 28(3) point by point, with the favourable options chosen, is lawful and more practical. The SCCs serve as a benchmark.

The annexes should hold four documents. The first is a description of processing (the club's teams, players and guardians; skill and physical-test data; match events; the stated "no special categories"). The second is the technical and organisational measures (tenant isolation through rules, encryption, MFA on admin accounts, backups and restore tests, the breach runbook, CSP, the AI minimisation). The third is the sub-processor list. The fourth is the retention and deletion schedule.

Ship a **DPIA support pack** alongside: a data map, data flows, sub-processors, the TOMs, an AI risk note and retention defaults. The Garante's mandatory DPIA list includes "non-occasional processing of data on vulnerable people, such as minors" and processing with AI systems, so Italian clubs need a DPIA **[Guidance, binding as Art. 35(4) list]** ([Filodiritto](https://www.filodiritto.com/valutazione-dimpatto-garante-la-protezione-dei-dati-personali-gli-specifici-casi-cui-e-obbligatorio-il-dpia)). Luxembourg's CNPD list has no minors item, but its EDPB-derived two-criteria rule likely catches clubs anyway ([CNPD Deliberation 34/2019](https://cnpd.public.lu/dam-assets/fr/actualites/national/2019/Delib-34-2019-du-6-mars-2019.pdf)). The pack discharges Art. 28(3)(f) and also works as a sales asset.

The table sets each favourable position against the legal limit that bounds it:

| Term | Operator-favourable position | Hard limit | Basis |
|---|---|---|---|
| Liability cap | Cap at fees paid in the last 12 months or the current season; exclude indirect loss, lost profits, and data loss beyond restoring from backups | Binds only operator and club. It cannot limit a data subject's Art. 82 claim (each party responsible can be liable for the **entire damage**, Art. 82(4)) or regulators' fines. It is void for wilful misconduct or gross negligence in Italy (art. 1229 c.c.). In Italy it needs OTP-approved specific approval. The Data Act Art. 13 blacklist bars excluding liability for intent or gross negligence in data-related terms | [Law] [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj); [Law] [art. 1341](https://www.brocardi.it/codice-civile/libro-quarto/titolo-ii/capo-ii/sezione-i/art1341.html); art. 1229 and Data Act Art. 13 detail [Unverified] |
| Fault exposure | Rely on Art. 82(2): a processor is liable only for breaching processor-specific duties or instructions | Fault is presumed; escape requires proving the operator is "in no way responsible" (C-667/21). Damage, causation and infringement must all be shown (C-300/21) | [Law] [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2024/04/data-breaches-not-excused-by-employee-error) |
| Sub-processors | General authorisation; public list; 14–30 day objection window; objections only on reasonable data-protection grounds; sole remedy is termination with a pro-rata refund | Prior information is required; the controller keeps the "ultimate decision"; keep emergency swaps narrow | [Law] Art. 28(2); [Guidance] [Opinion 22/2024](https://www.hunton.com/privacy-and-cybersecurity-law-blog/edpb-adopts-opinion-on-processors-and-guidelines-on-legitimate-interests) |
| Audits | Documentation first (TOMs, questionnaire, Google's ISO 27001/SOC 2 reports); on-site or remote audits only if those are insufficient or a regulator asks; at most yearly; at the club's cost | A clause excluding audits breaches Art. 28(3)(h) | [Law] Art. 28(3)(h); [Inference] |
| Breach notice | "Without undue delay and in any event within ~48 hours", with information delivered in phases | Art. 33(2) "without undue delay". A 72h processor window leaves the club no time for its own 72h filing. The Omnibus proposal to move filings to 96h is **not law** | [Law] Art. 33; [Commentary] [Bright Defense](https://www.brightdefense.com/news/eu-digital-omnibus-seeks-96-hour-gdpr-breach-deadline/) |
| Assistance costs | Self-service tools (export, edit, delete) free; bespoke assistance chargeable at reasonable rates | The operator's own compliance costs cannot be charged; Data Act switching must be free from 12 Jan 2027 | [Law] Art. 28(3)(e)-(f); [Commentary] [Maples](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview) |
| Post-termination | 30-day export window after the transition, then deletion; backups expire on rotation | Data Act retrieval of **≥30 days after** the transition; GDPR return at the controller's choice | [Commentary] Data Act; [Law] Art. 28(3)(g) |
| Law and forum | Luxembourg law and courts while based there; Italian law and courts after the move | Cannot oust data subjects' right to sue at home (Art. 79(2)) or regulators' jurisdiction; a domestic Italian contract cannot escape art. 1341 by choosing foreign law; the forum clause needs OTP approval in Italy | [Law] Art. 79; [Commentary] [Diritto al Digitale](https://dirittoaldigitale.com/2026/06/30/clausole-vessatorie-contratti-online/) |
| Notice to leave | Fixed per-season term | Notice to start switching **≤2 months**; an early-termination fee is lawful only if proportionate (expressly so only if the Omnibus passes) | [Commentary] [Maples](https://maples.com/knowledge/the-eu-data-acts-switching-framework-a-practical-overview); [GT](https://www.gtlaw.com/en/insights/2026/7/eu-digital-omnibus-package-proposes-amendments-to-data-act) |
| Late payment | Contractual interest rate, OTP-approved | Italian statutory rate is **10.40% for H2 2026** but applies only between businesses; an amateur ASD may not count as one, so write the rate into the contract | [Law via Commentary] [Edotto](https://edotto.com/articolo/ritardi-nei-pagamenti-commerciali-interessi-di-mora-dal-1-luglio-2026) |
| Warranties | Service "as is" and "as available"; no uptime SLA; AI outputs are drafts with no accuracy warranty; beta features flagged; cloud and LLM outages as force majeure | Cannot cover gross negligence (Italy); the Terms still must describe the service honestly | [Unverified] art. 1229; [Inference] |

Beyond the DPA, the Terms must carry the Data Act Art. 25 switching clauses (notice, transition, retrieval, erasure, exportable-data list), a link to the published data-format register and infrastructure jurisdiction, the DSA content and contact sections, the AI-use rules, and the acceptable-use policy. The acceptable-use policy should bar health data in free text, AI rating of minors, live or betting distribution of match data, and imports the user has no right to make.

Gather every art. 1341(2) clause in one numbered section so the OTP screen can cite it: liability limits, suspension, operator termination, unilateral changes, forfeitures and time bars, any renewal clause, and law and forum. Draft each one so the business still works if a court strikes it. Suspension for non-payment, for example, is independently justified by the art. 1460 c.c. defence of non-performance **[Inference/Unverified for art. 1460]**.

The simplest commercial model is a **prepaid per-season licence with no auto-renewal**, with activation on payment. It removes the tacit-renewal and late-payment fights altogether **[Inference]** ([Brocardi, art. 1341](https://www.brocardi.it/codice-civile/libro-quarto/titolo-ii/capo-ii/sezione-i/art1341.html)).

One unverified point needs a lawyer. Data Act Chapter IV (Art. 13) makes unfair those *data-related* terms that one enterprise unilaterally imposes on another. It blacklists exclusions of liability for intentional acts or gross negligence and greylists, among others, unreasonably short termination notice **[Unverified]**. If it applies, it scrutinises the data-use, data-access and termination clauses of a standard SaaS contract. Whether a purely amateur ASD counts as an "enterprise" is open.

## 3. Operator rights worth reserving, and the line each one stops at

**Intellectual property.** The operator keeps everything in the software: code, design system, court-diagram engine and award templates. Clubs receive a non-exclusive, non-transferable, season-limited access licence. Software copyright arises without registration **[Unverified for statute citations]**. Clubs own their content and data. The operator's licence to that content is limited to hosting, operating, backing up and supporting the service. Anything wider is barred, because a processor acting beyond instructions is fined (Dedalus) or becomes a controller (Art. 28(10)) **[Law]** ([Cooley](https://cdp.cooley.com/breach-of-patients-data-leads-to-heavy-sanctions-in-france/)).

**Anonymised statistics.** Reserve this as a **documented controller instruction** inside the DPA rather than as an operator purpose. Producing anonymised statistics is itself processing of personal data. Limit the output to truly anonymised aggregates with minimum-group thresholds, and use service metadata (feature usage) as the operator's own controller data under legitimate interest. Avoid cross-club benchmarks shown to other clubs, because small youth squads make re-identification by age group, position and club easy **[Law/Inference]** ([GDPR Recital 26 and Art. 28(10)](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). Do not reuse one club's exercises for others without an explicit opt-in licence.

**Smaller reserved rights:**

- a perpetual, royalty-free feedback licence;
- the right to name the club as a customer and show its logo, **with opt-out**;
- an absolute bar on using players' images or names in operator marketing, a promise US colleges will also expect;
- the right to refuse or delay activation, since B2B freedom of contract supports manual activation;
- the right to suspend for non-payment, security threats, illegal content or acceptable-use breaches, with notice except in emergencies, a DSA statement of reasons, and an export-only window;
- termination for material breach, again with the export window;
- feature changes without removing core functionality mid-season;
- price and term changes **for the next season only**, with 30–60 days' notice and a right to leave.

These rest on **[Inference from Law/Commentary]** ([Brocardi, art. 1341](https://www.brocardi.it/codice-civile/libro-quarto/titolo-ii/capo-ii/sezione-i/art1341.html)).

**Assignment.** The most important right for this founder is the right to **assign or novate the contract and DPA to a successor entity**, with notice. It is what lets a Luxembourg sole trader hand clubs to an Italian ditta or SRL, or to a buyer, without new signatures from every club. Italian counsel should say whether that clause itself needs 1341 approval, since it restricts the club's position. Put it on the OTP list to be safe.

**Trade mark.** Protect the brand with an EU trade mark: **€850 for one class or €900 for two (classes 9 + 42) filed online**, after a TMview clearance search **[Guidance/official fees via Commentary]** ([Austrian Patent Office](https://www.patentamt.at/en/trademarks/apply-for-trademarks/international-trademark/eu-trademark)).

## 4. Business form decides who signs, who pays VAT and who carries the risk

The operator must register where the founder actually lives and works. A Luxembourg sole trader or SARL-S needs an *autorisation d'établissement*, which requires a **real physical establishment with day-to-day management in Luxembourg** ("a letterbox is not accepted"). A Luxembourg court treated self-employment without a permit as an offence even when carried on as a side activity **[Law/Commentary]** ([Frontaliers Grand Est](https://frontaliers-grandest.eu/accueil/employeurs/entreprendre/luxembourg/); [Cour supérieure de justice](https://download.data.public.lu/resources/cour-superieure-de-justice-chambre-10-correctionnelle/20240827-221941/20150204-ca10-43a-accessible.pdf)). After the move to Italy, a Luxembourg company managed from Italy risks being treated as Italian-resident under the place-of-effective-management rule (art. 73 TUIR, *esterovestizione*) while also failing its own permit condition **[Unverified]**. The research supports a clear sequence. Either run a Luxembourg sole trader only while resident there, or wait. Then open the Italian business on arrival, close the Luxembourg one, and get advice on the overlap year.

| | Luxembourg sole trader | Luxembourg SARL-S / SARL | Italy ditta individuale (forfettario) | Italy SRL / SRLS |
|---|---|---|---|---|
| Contracting party | Founder personally | The company | Founder personally | The company |
| Liability | Unlimited | Limited; but one source says SARL-S shareholders are **jointly and severally liable until conversion**, so verify ([LexGO](https://www.lexgo.lu/en/news-and-articles/3782-simplified-s-a-r-l)) | Unlimited | Limited, but "not absolute": director liability and personal guarantees pierce it ([fiscoinvestimenti](https://fiscoinvestimenti.it/?p=127)) |
| Set-up | Permit (€50 fee, decision within 3 months), CCSS registration within 8 days | SARL-S: €1–12,000 capital, no notary, natural persons only; SARL: €12,000 capital plus notary ([LexGO](https://www.lexgo.lu/en/news-and-articles/3782-simplified-s-a-r-l)) | Partita IVA; INPS | €1,500–4,000 including notary ([partitaiva.it](https://www.partitaiva.it/costi-srl-costituzione-gestione-imposte-commercialista)) |
| Income tax | Progressive personal tax **[Unverified: top rate ~45.8%]** | CIT 14% (<€175k) / 16% + 7% surcharge + municipal tax ≈ **23.87%** combined in Luxembourg City; minimum net wealth tax from €535 ([PwC](https://taxsummaries.pwc.com/Luxembourg/Corporate/Taxes-on-corporate-income); [Norton Rose](https://www.nortonrosefulbright.com/en-au/knowledge/publications/659b290b/2025-luxembourg-tax-landscape-key-updates-you-need-to-know)) | **5%** substitute tax for 5 years if start-up conditions are met, then 15%, on a flat ~67% profit coefficient (programmers; the exact SaaS ATECO code must be confirmed); revenue cap **€85,000**; unavailable if 2025 employment income exceeded **€35,000** (2026 only, possibly €30k from 2027) ([money.it](https://www.money.it/legge-di-bilancio-2026-le-novita-per-il-regime-forfettario); [informazionefiscale](https://www.informazionefiscale.it/forfettario-limite-reddito-lavoro-dipendente-pensione-35000-euro)) | IRES 24% + IRAP 3.9%, then 26% on dividends ([partitaiva.it](https://www.partitaiva.it/costi-srl-costituzione-gestione-imposte-commercialista)) |
| Social security | Exempt if earned income ≤ **1/3 of the social minimum wage** ([guichet.lu](https://guichet.public.lu/en/entreprises/creation-developpement/obligations-fiscales-sociales/securite-sociale/affiliation-independant.html)) | Depends on the manager's status | INPS commercianti **24.48%**, fixed minimum **€4,611.64** (2026), 35% reduction for forfettari on request ([informazionefiscale](https://www.informazionefiscale.it/contributi-inps-artigiani-commercianti-importi-aliquote-2026)); whether *gestione separata* applies instead is a commercialista call | Director/shareholder rules |
| VAT | Franchise up to **€50,000** (from 2025) ([Arendt](https://www.arendt.com/news-insights/news/vat-law-changes-on-1-january-2025/)) | Normal VAT | Charges no VAT; e-invoicing through SdI **[Unverified]** | 22% |
| Lead GDPR regulator | CNPD | CNPD (if really managed there) | Garante | Garante |

Business form changes the legal picture in three ways. First, the **contracting party and DPA processor is the founder in person** under either sole-trader form. GDPR damages claims from minors' guardians, and contract claims from clubs, therefore reach personal assets, held back only by the contractual cap (which binds clubs, not data subjects), insurance, and, later, a company. A 2019 Italian broker scheme quoted cyber cover **from €58 a year for €250k** for small firms, which is clearly a floor ([CNPI/Marsh](https://cnpi.eu/wp-content/uploads/2019/02/CYBER-RISK-INFORMATIVA-E-TARIFFA-2019.pdf)). Real 2026 quotes for a SaaS holding minors' data are needed from brokers. Second, the **lead supervisory authority** follows the main establishment, meaning the place of central administration (Arts. 4(16)(b), 56). It is the CNPD now and the Garante after the move. An Art. 27 representative is unnecessary while the operator is EU-established **[Law]** ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)). Third, a **merchant of record such as Paddle** becomes the legal seller and VAT handler for the revenue it processes ([Paddle](https://www.paddle.com/help/start/intro-to-paddle/how-paddle-is-able-to-take-on-your-vat-and-tax-responsibilities)). The club's *sales* contract is then with Paddle, but the software terms and the **Art. 28 DPA must still name the founder's business**, because that business processes the data **[Inference]**.

VAT on sales to Italian clubs depends on what kind of club it is. Art. 7-ter DPR 633/72 treats associations as taxable customers **even when acting outside commercial activity**, if they hold VAT status. That makes an SSD, or an ASD with a partita IVA, a B2B customer: a foreign seller invoices under reverse charge, and an Italian seller charges 22%, or nothing under forfettario **[Law via Commentary]** ([ecnews](https://www.ecnews.it/fiscale/fisco-e-patrimonio/iva/status-soggetto-passivo-del-committente-nei-servizi-lestero/)). An ASD with only a *codice fiscale* is a B2C customer for electronic services, taxed where the customer is (art. 7-octies) ([fiscoetasse](https://www.fiscoetasse.com/approfondimenti/15134-territorialita-iva-di-servizi-complessi-resi-in-parte-per-via-elettronica-dallestero.html)). Above an EU-wide **€10,000** of cross-border B2C electronic services, a Luxembourg seller would owe Italian 22% through the OSS **[Unverified]**. Checkout should therefore ask every club for its partita IVA and check it on VIES.

A forfettario Italian seller charges no VAT. That is a real price advantage with ASDs that cannot recover VAT **[Inference]**. A club's VAT status is separate from its consumer-law status: an ASD can be a non-taxable customer for VAT and still not be a "consumer".

## 5. US colleges: the gate is procurement, with FERPA underneath

FERPA binds the school, not the vendor. A vendor may receive athlete data as a "school official" only if it performs an outsourced institutional function, sits under the school's **direct control**, and accepts the §99.33 limits on use and re-disclosure **[Law]** ([34 CFR 99.31](https://www.law.cornell.edu/cfr/text/34/99.31); [34 CFR 99.33](https://www.law.cornell.edu/cfr/text/34/99.33)). "Direct control" is achieved in practice by contract ([Covington](https://www.insideprivacy.com/childrens-privacy/student-privacy-and-the-cloud-five-principles-for-schools/)). Skill ratings, development plans, physical tests and match statistics kept for an athletics department fit the definition of "education records": "directly related to a student" and maintained "by a party acting for" the institution **[Law]** ([34 CFR 99.3](https://www.law.cornell.edu/cfr/text/34/99.3)).

FERPA's notion of personal information includes data "linkable" by "a reasonable person in the school community". **Jersey numbers on a public roster do not de-identify**, so the AI provider must carry the same pass-through limits, or AI must be off until the institution opts in **[Inference from Law]**. Some freshmen are 17, but COPPA covers only children under 13 and is irrelevant for colleges. It would matter only for a US youth-club expansion ([Davis Polk](https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect)). State student-privacy statutes such as SOPIPA target K-12 schools ([FPF](https://fpf.org/blog/fpf-guide-student-data-protections-sopipa-k-12-school-administrators-ed-tech-vendors/)). A small vendor sits far below the CCPA's thresholds (about **$26.6M** of revenue or **100,000** consumers) ([Feroot](https://www.feroot.com/blog/ccpa-applicability-website-california-law/)), although private colleges in some states may still demand state-law processor terms ([AACRAO](https://www.aacrao.org/news-advocacy/advocacy/advocacy-issues/state-issues-privacy-legislation/)).

Procurement is the real gate. Expect these demands:

- **HECVAT 4** (currently v4.1.6, with privacy and AI sections) ([EDUCAUSE](https://www.educause.edu/hecvat)).
- A **VPAT/ACR against WCAG 2.1 AA**. The ADA Title II web rule now applies to large public entities from **26 April 2027** and to smaller ones from **26 April 2028** **[Law]** ([Federal Register 2026-07663](https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web)).
- Cyber and technology E&O insurance of **$1M–$2M** at community colleges ([Cuesta](https://www.cuesta.edu/about/vpas/insurance-contract-requirements.html)), rising to **$3M–$5M**, and **$5M cyber where FERPA or health data is involved**, at universities ([Villanova](https://www.villanova.edu/university/financial-affairs/vendors/access-to-data.html); [UNR](https://www.unr.edu/bcn-nshe/risk/contracts/technology-contracts)).
- **TX-RAMP certification** before selling to any Texas public university; student records likely need Level 2 **[Law]** ([Texas DIR](https://dir.texas.gov/information-security/tx-ramp-eligibility-and-requirements)).
- A sworn foreign-country-of-concern affidavit for Florida public entities, which an EU vendor can sign ([Fla. Stat. 287.138](https://florida.public.law/statutes/fla._stat._287.138)).
- Confirmation that no sub-processor or staff sit in a DOJ Part 202 country of concern; a China-based LLM API would fail ([Pearl Cohen](https://www.pearlcohen.com/dojs-new-data-security-program-explained/)).
- A W-8BEN-E (or W-8BEN for an individual) with the treaty claim completed, to avoid default **30%** withholding ([FAU](https://www.fau.edu/controllers-office/tax-services/payment-to-foreign-supplier-document)).

Public universities refuse to indemnify vendors and void click-through terms that conflict with state law (Ohio). They treat out-of-state law or forum clauses as void (North Carolina) and cannot accept arbitration (Alabama) **[Law/Policy]** ([BGSU Policy 3341-6-55](https://www.bgsu.edu/policies/finance-administration/3341-6-55); [UNC Charlotte](https://legal.charlotte.edu/sites/default/files/media/3A%20Contracting%20Process%20Presentation.pdf); [Auburn](https://ba.auburn.edu/wp-content/uploads/2023/12/Memorandum-on-Governing-Law-Jurisdiciton-and-Venue.pdf)). The EU-optimised click-through, with its Luxembourg or Italian law, liability cap and OTP approval, therefore cannot be the only contract path. Plan a **US rider** that overrides it and a willingness to sign the university's own terms.

Several build implications follow:

- a US Firebase region for US tenants (no statute requires it, but it removes procurement friction);
- per-tenant data residency;
- the same export and certified-deletion flow;
- breach notice in contract terms of 24–72 hours;
- an express "no model training, no sale, no advertising" commitment;
- an NCAA-aware note that bench device and live-stats rules vary by division ([NAIA/NCAA rules changes](https://www.naia.org/wp-content/uploads/2026/07/W-Volleyball_2026-2027_RulesChanges_D2D3.pdf)).

An EU processor serving US controllers remains under GDPR for its own processing. How returning data to a US controller is classified (SCC Module 4 or otherwise) was not researched and needs EU counsel.

## 6. Prioritised checklist

**Before the first paying club** (still in Luxembourg):

| # | Item | Type | Who |
|---|---|---|---|
| 1 | Decide whether to trade from Luxembourg at all: permit with physical establishment, employer's contract on side activity, CCSS 1/3-minimum-wage exemption, VAT franchise and OSS route; or wait for Italy | Business | **Fiduciaire** |
| 2 | DPA (Art. 28(3) point by point, with annexes: processing description, TOMs, sub-processors, retention) and Terms (Data Act Art. 25 clauses, DSA, AI and acceptable use, numbered 1341 section, assignment clause) | Contract | **Lawyer** (Italian contract and data protection counsel to review the 1341 list and the art. 1229 caps; check Data Act Art. 13) |
| 3 | Sign-up gate: organisation-only declaration, authority confirmation, checkbox, then OTP-approved 1341 screen, then emailed PDF; immutable acceptance log (version hash, club, email, timestamp, IP, text shown); no activation or data entry without it | Build | Founder |
| 4 | Tenant lifecycle (pending, trial, active, suspended export-only, terminating, deleted), free self-service JSON/CSV export, hard-delete job, documented backup rotation | Build | Founder |
| 5 | Firestore rules: platform admin reads only registry fields, with rules tests; design support access as an approved, logged, time-boxed grant | Build | Founder |
| 6 | Public sub-processor page plus change notices; BYOK statement in the AI settings and DPA; prefer an OpenAI EU-residency project if the operator supplies a key; verify DPF status and Firebase Auth data location | Build + verify | Founder |
| 7 | Health guardrails: no free-text notes on tests, "unavailable" status, warnings on development plans, "no special categories" in the DPA | Build | Founder |
| 8 | Per-player image consent record gating award photos; no-photo fallback; share warning | Build | Founder |
| 9 | AI: "AI draft" label plus `generatedBy` metadata; AI-literacy note; Terms ban on AI rating of minors; check final Art. 50 guidelines | Build | Founder |
| 10 | Privacy notice for the operator's own data (accounts, billing, logs) and storage section (no cookie banner while analytics stay off); controller and processor records of processing; DPIA support pack and template club notices | Documents | Founder, lawyer review |
| 11 | Breach runbook with ~48h notice to clubs; MFA on admin accounts | Process | Founder |
| 12 | Payment model: prepaid season, no auto-renewal; Paddle as merchant of record or Stripe; collect partita IVA and VIES at checkout | Business | Fiduciaire / commercialista |
| 13 | Cyber and professional indemnity insurance quotes | Risk | **Broker** |
| 14 | EU trade mark clearance and filing (classes 9 + 42, €900) | IP | Founder (attorney optional) |

**Before the move to Italy:**

| # | Item | Who |
|---|---|---|
| 1 | Choose forfettario ditta or SRL: ATECO code and coefficient, 5% start-up conditions, €35k/€30k employment-income test, INPS commercianti vs gestione separata, e-invoicing via SdI, VIES | **Commercialista** |
| 2 | Overlap year: residence test and AIRE deregistration, Luxembourg–Italy treaty tie-breaker, closing the Luxembourg business, no Luxembourg company managed from Italy | **Commercialista + fiduciaire** |
| 3 | Novate or assign contracts and DPA to the Italian entity under the assignment clause; notify clubs; update the DPA's processor identity and lead regulator (Garante) | **Lawyer** |
| 4 | Switch governing law and forum to Italy for new contracts; re-check that the OTP flow meets Cass. 20945/2026 and any later case law | Lawyer |
| 5 | Re-check Digital Omnibus status (Data Act and GDPR), the DPF appeal and the Art. 50 guidelines | Founder |
| 6 | Obtain and review the DataVolley licence before shipping .dvw import; confirm the openvolley licence; check DATAVOLLEY trade-mark status | Lawyer / founder |
| 7 | Reassess company form once revenue nears €85k or liability exposure grows (multi-club minors' data) | Commercialista |
| 8 | Reassess whether a DPO is needed as club count grows (large-scale Art. 9 data only) | Lawyer |

**Before the first US college:**

| # | Item | Who |
|---|---|---|
| 1 | US rider and FERPA/state-law DPA template (school official, no re-disclosure, no training, sale or ads, deletion certificate, breach notice); willingness to sign university paper | **US counsel** |
| 2 | HECVAT 4.1.6 completed once; security and privacy whitepaper; decide on SOC 2 | Founder |
| 3 | WCAG 2.1 AA audit and remediation; VPAT/ACR | Founder / auditor |
| 4 | Cyber and tech E&O of $1M–$5M with US jurisdiction | Broker |
| 5 | US Firebase region per tenant; AI off by default for US tenants or covered by pass-through terms | Build |
| 6 | W-8BEN-E with treaty claim; sales-tax nexus check; Texas TX-RAMP and Florida affidavit only if targeting those states | **US tax adviser** |
| 7 | GDPR treatment of an EU processor returning data to US controllers | EU counsel |

## Conclusion

The research turns several of the original product instincts into their legally safer variants without giving up much. "Deactivation means losing access completely" becomes "losing the app, keeping a route to the data". The export screen that once looked like a courtesy is now an obligation that also serves FERPA and GDPR requests. "Accept the DPA at sign-up" survives, but as a logged gate with an OTP-signed second step. That step costs a few hours to build now, and leaving it out would mean re-papering every Italian club after the move. "The operator never sees club data" is worth more as a rules-tested technical fact than as a contract promise. It also lowers the operator's risk under nearly every regime examined. The operator-favourable terms are largely available, but they protect the operator against clubs only. Against guardians and regulators, the real protection is minimisation in the product, insurance, and in time a company.

The less obvious finding is that the founder's move is itself a legal event for the product. The contracting party, the lead regulator, the governing law and the enforceability of the onerous clauses all change at once. An assignment clause, a design that is valid under Italian rules from the first day, and a deliberate overlap year turn that event into paperwork rather than a renegotiation. The open questions that could still change the design are few and specific: the DataVolley EULA, the Data Act Art. 13 reach to amateur ASDs, the final Art. 50 guidance, the DPF appeal, and the Luxembourg permit and side-activity position. Each should be closed with the named professional before money changes hands.

*This report synthesises research notes and is not legal, tax or accounting advice. Statements tagged [Unverified] are background knowledge that was not confirmed in this research. Confirm every contract clause, tax figure and registration step with a qualified Luxembourg fiduciaire, an Italian commercialista, Italian contract and data-protection counsel, and, before US sales, US counsel and a US tax adviser.*
