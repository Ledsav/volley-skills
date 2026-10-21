# GDPR obligations and contracting room for a small SaaS processor (volleyball clubs as controllers), as of October 2026

Scope note for the report writer: "Binding law" = GDPR text / CJEU judgments / Commission implementing decisions. "Guidance" = EDPB/national SA documents (persuasive, followed by SAs, not binding on courts). "Opinion" = law-firm/academic/vendor commentary. Where a point below is drawn from my knowledge of a primary text that I did not re-fetch in this session, it is flagged "[text not re-fetched]" so it can be verified. Tool budget limited the number of primary documents fetched; see Gaps in each section.

## 1. Art. 28(3) mandatory DPA contents, the Commission SCCs (Decision 2021/915), EDPB Guidelines 07/2020 and Opinion 22/2024

### Takeaway
The DPA must contain a fixed list of Art. 28(3) items (subject-matter/duration/nature/purpose/data types/data-subject categories + controller rights, and the eight processor duties (a)–(h)); the processor has its own, independent duty to have this contract and can be fined alone for missing it (CNIL Dedalus, 2022). The Commission's controller-processor SCCs (2021/915) are a safe, regulator-recognised template but are rigid and less operator-favourable; a bespoke DPA that tracks Art. 28(3) verbatim is lawful and lets the operator choose the favourable options (general authorisation, audit by report, cost allocation).

### Cited Findings
- **Binding law – Art. 28(3) GDPR** requires the contract to set out: subject-matter and duration, nature and purpose, type of personal data, categories of data subjects, and the controller's obligations and rights; and to stipulate that the processor: (a) processes only on documented instructions, including on third-country transfers, unless required by EU/Member State law (then informs the controller unless legally prohibited); (b) ensures persons authorised to process are bound by confidentiality; (c) takes all Art. 32 security measures; (d) respects Art. 28(2) and (4) conditions for engaging sub-processors; (e) assists the controller by appropriate technical and organisational measures, insofar as possible, to respond to data-subject rights requests; (f) assists with Arts. 32–36 (security, breach notification, DPIA, prior consultation) "taking into account the nature of processing and the information available to the processor"; (g) at the controller's choice deletes or returns all personal data after the end of services and deletes existing copies unless EU/Member State law requires storage; (h) makes available all information necessary to demonstrate compliance and allows for and contributes to audits, including inspections, by the controller or a mandated auditor; plus the processor must immediately inform the controller if an instruction infringes the GDPR — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Binding law – Art. 28(2)**: no sub-processor without prior specific or general written authorisation; with general authorisation the processor must inform the controller of intended additions/replacements, giving the controller the opportunity to object. **Art. 28(4)**: same data-protection obligations must flow down to sub-processors; initial processor remains fully liable to the controller for the sub-processor's performance — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Binding law – Art. 28(7)/(8)**: the Commission (and SAs) may lay down standard contractual clauses for Art. 28(3)/(4); **Commission Implementing Decision (EU) 2021/915** of 4 June 2021 adopted such controller-processor SCCs (distinct from the transfer SCCs in Decision 2021/914) — [Decision 2021/915, EUR-Lex](https://eur-lex.europa.eu/eli/dec_impl/2021/915/oj) [text not re-fetched]. Recognised features of the 2021/915 clauses: modular annexes (description of processing, TOMs, list of sub-processors), Option 1 (specific prior authorisation) vs Option 2 (general authorisation with a notice period the parties fill in), a docking clause, and a statement that the clauses do not prevent parties adding other clauses provided they do not contradict the SCCs or reduce protection [text not re-fetched; verify clause numbers before quoting].
- **Binding law – CNIL Dedalus Biologie (April 2022, €1.5M)**: a software vendor acting as processor for laboratories was fined because its standard contract lacked the Art. 28(3) terms; the CNIL rejected the argument that this duty sits with the controller, holding the processor's obligation is "separate, independent" and that the processor "alone" was responsible for that failure. Also breached Art. 29 (extracted more data than instructed during a migration) and Art. 32 (no migration procedure, unencrypted server) — [Goodwin](https://www.goodwinlaw.com/en/insights/blogs/2022/06/french-data-protection-authority-fined-medical-software-provider-for-gdpr-violations); [Cooley](https://cdp.cooley.com/breach-of-patients-data-leads-to-heavy-sanctions-in-france/)
- **Guidance – EDPB Opinion 22/2024 (Art. 64(2), adopted 7 Oct 2024, at the Danish SA's request)**: controllers should have the identity (name, address, contact person) of **all** processors and sub-processors (whole chain) "readily available at all times", regardless of risk; processors should proactively provide and keep this updated; the initial processor should propose sub-processors offering sufficient guarantees but the controller keeps "the ultimate decision on whether to engage a specific sub-processor" and the verification responsibility (scrutiny scaled to risk); where sub-processors transfer data outside the EEA the controller remains subject to Art. 28(1) — [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/edpb-adopts-opinion-on-processors-and-guidelines-on-legitimate-interests); [BDK Advokati](https://bdkadvokati.com/edpb-opinion-22-2024-key-insights-on-using-processors-and-sub-processors-under-gdpr); [EDPB page](https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-222024-certain-obligations-following_en)
- **Guidance – EDPB Guidelines 07/2020 on controller/processor (v2.0, July 2021)**: [EDPB](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en). Key positions relevant here [text not re-fetched]: the DPA should not merely restate Art. 28 but specify how obligations are met; a processor offering a standard service may draft the contract, but the controller must still be able to accept it knowingly and remain in control of essential means; with general authorisation the controller must be given a meaningful objection period and the processor should keep the sub-processor list up to date; costs of assistance may be allocated contractually; "essential means" (what data, how long, who has access) stay with the controller while "non-essential means" (hardware, software choice, security detail) can be left to the processor.

### Inferences
- Using the 2021/915 SCCs as the DPA: **pros** — regulator-recognised, no SA can say terms are insufficient, minimal legal cost, familiar to clubs/federations; **cons** — rigid text (e.g., audit/inspection clause, sub-processor notice structure, deletion mechanics) that cannot be weakened; only annexes and the option choices are adjustable; and commercial terms (liability cap, fees for assistance, law/forum) must be added in a separate main agreement that must not contradict the SCCs. For a solo founder, a short bespoke DPA tracking Art. 28(3) item-by-item with operator-favourable options is lawful and likely more practical; the SCCs remain a fallback/benchmark.
- Because of Dedalus, the operator must make DPA acceptance a hard gate at club signup (no activation without it) and keep evidence (version, timestamp, accepting user, club).
- Opinion 22/2024 means the DPA must ship with a maintained, public **sub-processor list** (Google/Firebase, OpenAI, Groq, any email provider, payment provider if it touches club personal data) with entity names and addresses, and a notification mechanism.

### Gaps
- I could not fetch the full text of Opinion 22/2024 (PDF URL 404'd) — its exact treatment of the Art. 28(3)(a) "unless required by Union or Member State law" wording (my recollection: EDPB said the wording "unless required by EU or Member State law" is highly recommended but not strictly mandatory to reproduce, and third-country legal requirements cannot be followed unless compatible) is unverified.
- Exact clause numbers/wording of Decision 2021/915 not re-fetched.

## 2. Is click-through / electronic acceptance a valid "contract in writing, including in electronic form" (Art. 28(9))?

### Takeaway
Yes in substance: Art. 28(9) expressly allows electronic form, and no source found requires a handwritten or qualified e-signature; the practical issue is evidence and the controller's genuine ability to review the terms.

### Cited Findings
- **Binding law – Art. 28(9)**: the contract or other legal act "shall be in writing, including in electronic form" — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Binding law / enforcement** – the processor bears an independent duty to have the contract (CNIL Dedalus) — [Goodwin](https://www.goodwinlaw.com/en/insights/blogs/2022/06/french-data-protection-authority-fined-medical-software-provider-for-gdpr-violations)

### Inferences
- A click-wrap with an affirmative checkbox, the DPA text viewable/downloadable before acceptance, and a logged record (DPA version hash, club ID, accepting admin email, timestamp, IP) is the standard SaaS practice and should satisfy Art. 28(9). Under the eIDAS Regulation a simple electronic signature cannot be denied legal effect solely because it is electronic (general eIDAS principle) [not fetched this session].
- The accepting person must have authority to bind the club (an association); the signup flow should have them confirm they are authorised to act for the club.

### Gaps
- No Luxembourg- or Italy-specific SA guidance on click-through DPAs found. Italian civil law (Art. 1341–1342 Codice civile) requires specific written approval of "vexatious" clauses (e.g., liability limitations, forum, tacit renewal) in standard-form contracts — if Italian law governs, liability caps and forum clauses may need a separate specific acceptance (double click). Not researched in this session; flag for the Italy-law researcher [from general knowledge, unverified].

## 3. Operator-favourable but lawful terms

### Takeaway
The operator can lawfully choose: general sub-processor authorisation with notice + objection (objection remedy = terminate), audits primarily via documentation/questionnaire/third-party reports with on-site audits limited and at controller's cost, a defined breach-notice window, charging for extraordinary assistance, a short post-termination deletion window, and EU-member-state law/forum. What it cannot do is remove any Art. 28(3) duty, make audits impossible, or limit liability toward data subjects or SAs.

### Cited Findings
- **Liability, binding law – Art. 82(2)**: a processor is liable for damage only where it has not complied with obligations specifically directed to processors or acted outside/contrary to lawful controller instructions; **Art. 82(3)** exemption if it proves it is "not in any way responsible"; **Art. 82(4)** where controller and processor are involved in the same processing and responsible for damage, each is liable for the entire damage to ensure effective compensation; **Art. 82(5)** recourse claim between them for their share — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Binding law – CJEU on Art. 82**: compensation requires infringement + damage + causal link (C-300/21, C-340/21, C-456/22); mere infringement is not itself damage (C-741/21 juris); fault is presumed — the controller escapes only by proving it is in no way responsible (C-667/21 Krankenversicherung Nordrhein, 21 Dec 2023); Art. 83 fine criteria cannot be used to quantify Art. 82 damages (C-741/21) — [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2024/04/data-breaches-not-excused-by-employee-error); [LexisNexis](https://www.lexisnexis.com/en-gb/legal/news/clarity-on-processing-sensitive-data-right-to-compensation-under-eu-gdpr-krankenversicherung); [Conflict of Laws](https://conflictoflaws.net/2024/one-two-three-fault-cjeu-rules-on-civil-liability-requirements-under-the-gdpr/?print=pdf)
- **Opinion (academic)**: the CJEU liability line is criticised as inconsistent (three-element test vs fault-based exoneration), likely to cause difficulty in cross-border cases — [Santos Morón, UC3M](https://e-revistas.uc3m.es/index.php/CDT/article/view/8983); [Conflict of Laws](https://conflictoflaws.net/2024/one-two-three-fault-cjeu-rules-on-civil-liability-requirements-under-the-gdpr/?print=pdf)
- **Sub-processors – guidance**: general authorisation is permitted, but the controller keeps the "ultimate decision" and must have identity info for the whole chain (Opinion 22/2024) — [Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/edpb-adopts-opinion-on-processors-and-guidelines-on-legitimate-interests)
- **Breach notice – binding law Art. 33(2)**: processor must notify the controller "without undue delay after becoming aware" of a breach (no fixed hours for processors); controller then has 72h to the SA (Art. 33(1)) — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Pending reform (not law)**: the Digital Omnibus proposal (procedure 2025/0360(COD)) would raise the SA-notification threshold to "high risk" and extend 72h to 96h; EDPB-EDPS Joint Opinion 2/2026 (10 Feb 2026) supported this; as of an Aug 2026 briefing it was still at committee stage in Parliament — [Bright Defense](https://www.brightdefense.com/news/eu-digital-omnibus-seeks-96-hour-gdpr-breach-deadline/); [Innovires on Joint Opinion 2/2026](https://www.innovires.com/en/blog/digital-omnibus-gdpr-edpb-edps-stanovishche-2-2026.html); [Kennedys](https://www.kennedyslaw.com/en/thought-leadership/article/2026/the-2025-european-commission-eu-digital-omnibus-package-the-gdpr-regulation-eu-2016679/); [iubenda](https://www.iubenda.com/en/blog/eu-digital-omnibus-gdpr-changes-proposed-amendments-explained/). Processor-to-controller "without undue delay" is not reported as changing.

### Inferences
- **Liability cap**: a cap (e.g., fees paid in the last 12 months, or a fixed floor amount) is valid only inter partes (operator vs club). It cannot limit (i) a data subject's direct Art. 82 claim — the operator can be sued for the full damage under Art. 82(4) if responsible — or (ii) SA fines under Art. 83 (fines on the processor are its own). Carve-outs typical in market practice (breach of confidentiality/data protection uncapped or super-capped) are a commercial choice, not a legal requirement. A cap that would leave the club with no recourse for the operator's own GDPR breaches may be unenforceable under national rules on exclusion of liability for gross negligence/wilful misconduct (Italy Art. 1229 c.c.; Luxembourg civil code equivalent) [general knowledge, not fetched].
- **Sub-processors**: favourable but lawful — general written authorisation, notice by email/in-app + public list, ~14–30 day objection window, objection must be on reasonable data-protection grounds, sole remedy = termination with pro-rata refund. Emergency replacement with after-the-fact notice is market practice but tension with "prior" authorisation — keep it narrow.
- **Audits**: lawful to satisfy Art. 28(3)(h) first by documentation (security whitepaper, TOMs annex, answers to a questionnaire, Google Cloud's ISO 27001/SOC 2 reports for the infrastructure layer), with on-site/remote audits only if documentation is insufficient or an SA requests, max once per year, reasonable notice, confidentiality, controller's cost. A clause excluding audits entirely would breach Art. 28(3)(h).
- **Breach notice timing**: "without undue delay and in any event within X hours of becoming aware" — market range 24–72h; picking 48–72h is defensible, but because the controller needs to file within 72h, a 72h processor window leaves the club no time; ~48h with a commitment to provide information in phases is a balanced operator-favourable choice.
- **Cost of assistance**: Art. 28(3)(e)/(f) assistance is mandatory, but the contract may provide that self-service tooling (export, delete, edit inside the app) is the primary means at no extra cost and that bespoke assistance is chargeable at reasonable rates. The processor's own compliance costs (security, breach notification to the controller) cannot be charged.
- **Choice of law/forum**: free choice between parties (Rome I / Brussels I bis), but it cannot oust data subjects' Art. 79(2) right to sue in their habitual-residence Member State, nor SA competence. Choosing the operator's establishment state (Luxembourg now; Italy if relocating) is lawful.

### Gaps
- No source fetched on market-standard cap levels or on Luxembourg/Italian case law on GDPR-related liability caps.

## 4. End of contract: Art. 28(3)(g), retention after deactivation, backups

### Takeaway
At end of services the processor must delete or return all personal data at the controller's choice and delete copies unless EU/Member State law requires storage; a short, documented export window (e.g., 30 days) followed by deletion, with backups expiring on their normal rotation (e.g., ≤35–90 days) and kept inaccessible meanwhile, is defensible. "Club loses access completely" on deactivation must be reconciled with the controller's right to get its data back.

### Cited Findings
- **Binding law – Art. 28(3)(g)**: "at the choice of the controller, deletes or returns all the personal data … after the end of the provision of services relating to processing, and deletes existing copies unless Union or Member State law requires storage" — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Binding law – Art. 5(1)(e)** storage limitation and Art. 32 availability/restore duties apply concurrently — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- **Binding law – Art. 28(10)**: a processor that determines purposes/means is a controller for that processing — keeping club data after termination for the operator's own reasons would make the operator a controller needing its own legal basis — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

### Inferences
- Design: separate **deactivation** (e.g., non-payment/suspension — data retained, access blocked, reversible) from **termination** (contract ends → export window → deletion). Immediate total loss of access with no return path conflicts with the controller's Art. 28(3)(g) choice to have data returned; offer an export (JSON/CSV) on request or during a grace period, then hard-delete Firestore data and Auth accounts.
- Firestore deletes are not instant across backups/PITR; the DPA should state backup retention and that backup copies are overwritten on schedule and not restored except for DR. This is accepted market practice; no SA source fetched.
- Keep only a minimal termination record (club ID, dates, DPA acceptance log, invoices) as the operator's own controller data (accounting/legal-claims basis).

### Gaps
- No SA guidance found specifying an acceptable post-termination retention window; the 30-day / backup-rotation figures are market practice, not law.

## 5. The operator's own controller role (accounts, billing, logs): privacy notice, Art. 30, DPO, DPIA

### Takeaway
The operator is controller for club-admin/coach account data, signup/activation, billing, platform-admin and security logs, and must give an Art. 13 notice, keep its own records (as controller and as processor under Art. 30(2)); the SME Art. 30(5) exemption likely does not apply because processing is not occasional. A DPO is probably not mandatory. A DPIA is the **clubs'** (controllers') duty; in Italy minors' data processed non-occasionally is on the Garante's mandatory-DPIA list, in Luxembourg it is not listed, but EDPB criteria (vulnerable data subjects + innovative tech/AI + evaluation/scoring) may still trigger it. The processor must assist (Art. 28(3)(f)) — best done by publishing a DPIA support pack.

### Cited Findings
- **Binding law – Art. 30(1)/(2)**: controllers and processors must keep records; **Art. 30(5)** exemption for <250 employees does not apply if the processing is likely to result in a risk, is not occasional, or includes Art. 9/10 data — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Pending reform (not law)**: Digital Omnibus reportedly proposes a "simplified ROPA"; details not verified — [Acompli](https://acompli.ie/news/digital-omnibus-gdpr-changes-2026/)
- **Binding law – Art. 37(1)**: DPO mandatory (for controller or processor) only for public authorities, core activities of large-scale regular and systematic monitoring, or large-scale processing of Art. 9/10 data — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Binding law – Art. 35(1)/(4)**: DPIA is a **controller** duty for likely high-risk processing; SAs publish mandatory lists — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- **Luxembourg CNPD list (Deliberation 34/2019, 6 March 2019; binding as Art. 35(4) list, non-exhaustive)**: 8 items — genetic data + 1 EDPB criterion; biometric identification + 1 criterion; combining data from different purposes with legal/similarly significant effects; regular systematic employee monitoring; files covering the whole national population; research/statistics under Arts. 63–65 of the 2018 law; systematic location tracking; indirect collection + 1 criterion where information cannot be provided. **No item on minors/vulnerable persons or health data**; the deliberation states a DPIA is still required whenever high risk is likely and the list complements the EDPB criteria — [CNPD Deliberation 34/2019 (PDF)](https://cnpd.public.lu/dam-assets/fr/actualites/national/2019/Delib-34-2019-du-6-mars-2019.pdf); [EDPB Opinion 26/2018 on LU list](https://edpb.europa.eu/sites/default/files/files/file1/2018-12-04-opinion_2018-26_art._64_lu_sas_dpia_list_fr.pdf)
- **Italy Garante list (provv. n. 467, 11 Oct 2018, GU 19 Nov 2018; non-exhaustive)**: 12 items including (6) "non-occasional processing of data on vulnerable people, such as minors, persons with disabilities, elderly people, patients, asylum seekers"; (7) processing using innovative technologies such as IoT, **AI systems**, voice assistants; (1) large-scale evaluation/scoring; (3) systematic monitoring/profiling incl. via apps; (10) Art. 9/10 data interconnected with data collected for other purposes. The Garante adds a DPIA is also required when 2+ WP248 criteria are met — [Filodiritto](https://www.filodiritto.com/valutazione-dimpatto-garante-la-protezione-dei-dati-personali-gli-specifici-casi-cui-e-obbligatorio-il-dpia); [dirittobancario](https://www.dirittobancario.it/art/provvedimento-del-garante-privacy-sui-trattamenti-soggetti-ad-una-valutazione-di-impatto/)
- **Guidance – WP248 rev.01 (endorsed by EDPB)**: nine criteria incl. evaluation/scoring, sensitive or highly personal data, data concerning vulnerable data subjects (children), innovative technological solutions; meeting two generally triggers a DPIA — referenced in [Garante list commentary](https://www.filodiritto.com/valutazione-dimpatto-garante-la-protezione-dei-dati-personali-gli-specifici-casi-cui-e-obbligatorio-il-dpia) and [CNPD deliberation](https://cnpd.public.lu/dam-assets/fr/actualites/national/2019/Delib-34-2019-du-6-mars-2019.pdf)

### Inferences
- Clubs here process minors' data (vulnerable subjects) + skill ratings 1–10 and development plans (evaluation/scoring) + optional AI features (innovative tech) → two or more WP248 criteria are plausibly met for many clubs; Italian clubs fall squarely within Garante item 6 (non-occasional minors' data). Whether a single club's processing is "large scale" is doubtful, but large scale is not required for item 6 or for the 2-criteria rule. Conclusion: assume clubs need a DPIA; the operator should provide a **DPIA template/support pack** (data map, data flows, sub-processors, TOMs, AI-feature risk analysis, retention defaults) — this both satisfies Art. 28(3)(f) and is a sales asset.
- The operator should also do an internal (voluntary) DPIA-style risk assessment of the platform as a whole — not legally required of the processor, but supports Art. 32 "appropriate" measures and the assistance duty.
- DPO: core activity is hosting a SaaS, not monitoring; whether a multi-tenant platform aggregating many clubs' minors' data reaches "large-scale" Art. 9 processing depends on whether performance data is health data (section 6) and on volume. Likely not mandatory at launch; reassess as the club count grows. Voluntary appointment triggers full Art. 38–39 obligations.
- Privacy notice: an Art. 13 notice for club admins/coaches (account, auth, billing, logs, support), separate from the clubs' own notices to players/guardians (which clubs must give; the operator can supply a template).
- Records: maintain both a controller ROPA (own activities) and a processor ROPA (Art. 30(2): categories of processing per client, sub-processors, transfers, TOMs).

### Gaps
- Whether Italy or Luxembourg add national DPO triggers beyond Art. 37 — not researched (to my knowledge neither does, unlike Germany).
- Digital Omnibus ROPA changes unverified.

## 6. Minors and sensitive data: Art. 8, lawful bases, is performance data "health data"?

### Takeaway
Art. 8 governs consent-based offers of information society services **directly to a child**; it is not triggered when the service is sold to clubs and used by adult coaches, unless children themselves get accounts. Clubs typically rely on contract/membership (Art. 6(1)(b)), legitimate interests (6(1)(f), with heightened weight for children), legal obligation for federation registration, and consent for photos. Physical-test data (jump height, sprint) is not per se health data, but the CJEU reads "data concerning health" broadly (inference test), so any injury/medical notes, fitness-limitation notes, or data that reveals a health condition should be treated as Art. 9 data.

### Cited Findings
- **Binding law – Art. 8(1)**: where Art. 6(1)(a) consent applies "in relation to the offer of information society services directly to a child", processing is lawful if the child is at least 16 (Member States may lower to 13); otherwise parental consent — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]. National ages (general knowledge, not fetched): Italy 14 (Codice privacy art. 2-quinquies, D.lgs. 101/2018); Luxembourg did not derogate → 16.
- **Binding law – Recital 38 / Art. 6(1)(f)**: children merit specific protection; legitimate-interest balancing weighs more heavily where the data subject is a child — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Binding law – CJEU C-21/23 Lindenapotheke (4 Oct 2024)**: "data concerning health" must be interpreted broadly; data are health data when they make it possible, "by mental association or inference", to establish a link to a person's state of health — even pharmacy-only non-prescription medicine orders; builds on C-184/20 OT (indirect revelation suffices) — [Bird & Bird](https://cm.twobirds.com/en/insights/2024/global/feeling-unwell-after-the-cjeus-lindenapotheke-decision); [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2024/10/ecj-lindenapotheke); [datenschutz-notizen](https://www.datenschutz-notizen.de/cjeu-broadens-definition-of-health-data-in-pivotal-gdpr-ruling-4650395/)
- **Binding law – Art. 4(15) / Recital 35**: health data = data related to physical or mental health which reveal information about health status — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

### Inferences
- Pure athletic performance metrics (jump height, sprint time, skill ratings) are not health data on their face, but under the Lindenapotheke inference test, free-text fields ("development plan: returning from knee injury", "asthma — limit sprints"), injury absences, or test results annotated as medically limited would be Art. 9 data. Design implication: either (a) prohibit health information in free-text fields via UI guidance and DPA (controller's instruction), or (b) treat the dataset as potentially Art. 9 and apply Art. 9-level security; the DPA should state data categories expressly (and "no special categories intended"), which shifts responsibility to clubs that enter them.
- Clubs' Art. 9 basis would usually be explicit consent of guardian (9(2)(a)); this is the club's problem, but the operator's template notice/consent texts help.
- Photos: on-device processing without storage minimises the operator's role; if the operator never receives the image, it is not processing it as processor (only the client-side code runs on the club's device). Clubs still need consent for photo use/publication.
- Art. 8 only becomes relevant if the operator later offers player/guardian logins where minors themselves consent to something.

### Gaps
- No EDPB or SA guidance specific to sports performance testing data found in this session; sports-specific case law not found.

## 7. International transfers: Google Cloud/Firebase (EU region), OpenAI, Groq; DPF status 2026

### Takeaway
The EU-US Data Privacy Framework adequacy decision (July 2023) remains in force: the General Court dismissed Latombe (T-553/23) on 3 Sept 2025; the appeal (C-703/25 P) is pending at the CJEU with no hearing date reported as of mid-2026 (Microsoft admitted as intervener June 2026). Transfers to DPF-certified US recipients need no SCCs/TIA, but because of litigation risk, a fallback (SCCs 2021/914 Module 3 for processor→sub-processor) and EU-residency options are prudent. Groq's DPA incorporates 2021/914 SCCs; OpenAI offers EU data residency for API projects (eu.api.openai.com) since Feb 2025.

### Cited Findings
- **Binding law / litigation**: General Court dismissed Latombe's annulment action on 3 Sept 2025 (T-553/23); appeal lodged 31 Oct 2025 (C-703/25 P, four grounds incl. the President's power over bulk-collection objectives); CJEU President admitted Microsoft as intervener in support of the Commission on 4 June 2026; no hearing date reported as of July/Aug 2026 — [DataGuidance](https://www.dataguidance.com/news/eu-cjeu-admits-microsoft-intervener-appeal-concerning); [EDPL](https://edpl.lexxion.eu/article/EDPL/2026/1/15); [Legal500](https://www.legal500.com/intelligence/france/privacy/appeal-seeking-annulment-of-the-data-privacy-framework-dismissed); [Berkeley Tech LJ](https://btlj.org/2026/02/third-times-the-charm-the-fate-of-the-eu-u-s-data-privacy-framework/). Secondary sources only; CJEU register not checked. A separate noyb challenge (FTC independence) is reported as expected but distinct — [secureprivacy (vendor blog, lower reliability)](https://secureprivacy.ai/blog/is-the-eu-us-data-privacy-framework-at-risk-the-ftc-ruling-explained-2026)
- **Groq**: GroqCloud Customer DPA dated 15 Oct 2025 incorporates EU SCCs under Decision 2021/914 (Section 8, International Data Transfers); third-party review says data of non-US users is transferred to/stored in the US and that EU residency should be confirmed directly with Groq — [Groq DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum); [ConductAtlas (third-party analysis)](https://conductatlas.com/platform/groq/groq-privacy-policy/international-data-transfers/)
- **OpenAI**: European data residency for API launched 5 Feb 2025 — per new Project, Europe region selectable, eligible endpoints processed in-region with zero data retention; existing projects cannot be switched; separate EU endpoint/keys reported (eu.api.openai.com, secondary source) — [OpenAI](https://openai.com/index/introducing-data-residency-in-europe/); [TechCrunch](https://techcrunch.com/2025/02/06/openai-launches-data-residency-in-europe); [Maginative](https://www.maginative.com/article/openai-introduces-european-data-residency-for-enterprises-and-developers/)
- **Binding law – Ch. V GDPR (Arts. 44–46)**: transfers need adequacy (Art. 45) or appropriate safeguards (Art. 46, e.g. SCCs) — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

### Inferences
- **Google/Firebase**: Firestore can be placed in an EU multi-region/region, but Firebase Authentication and some Firebase services process data in the US/globally; Google relies on DPF certification + its Cloud Data Processing Addendum with SCCs. Treat Google as a sub-processor with US transfer potential (support access, Auth) and disclose it. [Firebase location specifics not fetched this session.]
- **AI features**: Because player names are stripped to jersey numbers, transmitted text is still pseudonymous personal data (club holds the key; text may contain contextual info) — not anonymous. If the AI provider is configured by the **club itself** (the app is "bring-your-own-key" to any OpenAI-compatible endpoint, per CLAUDE.md), the club, not the operator, chooses the recipient: that recipient is then the club's own processor, not the operator's sub-processor — a key design/DPA point to state explicitly. If the operator supplies a default AI key/provider, the provider becomes the operator's sub-processor and must be listed with transfer mechanism (prefer OpenAI EU residency + ZDR; Groq = US + SCCs).
- **TIA**: required only for Art. 46 transfers (SCCs), not DPF-based ones; keep a short TIA for Groq/any non-DPF recipient. If Latombe appeal succeeds, all DPF-based transfers would need SCCs+TIA immediately — DPA should allow switching transfer mechanism without re-consent.

### Gaps
- DPF certification status of OpenAI, Groq and Google not verified on the DPF participant list in this session.
- Firebase Auth data location not verified.

## 8. Anonymised/aggregated data for product improvement or benchmarks — when does the processor become a controller (Art. 28(10))?

### Takeaway
Producing anonymised/aggregated statistics from club data is itself processing of personal data; doing it for the operator's own purposes (product improvement, cross-club benchmarks) without being instructed makes the operator a controller for that processing (Art. 28(10)) needing its own legal basis and compatibility under Art. 6(4). The safest route is for the DPA to include it as a documented controller instruction/authorisation, limited to truly anonymised output.

### Cited Findings
- **Binding law – Art. 28(10)**: "if a processor infringes this Regulation by determining the purposes and means of processing, the processor shall be considered to be a controller in respect of that processing" (without prejudice to Arts. 82–84) — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- **Binding law – Art. 29 / Art. 28(3)(a)**: processing only on documented instructions — the Dedalus case shows SAs sanction a processor that processes beyond instructions — [Cooley](https://cdp.cooley.com/breach-of-patients-data-leads-to-heavy-sanctions-in-france/)
- **Binding law – Recital 26**: truly anonymous data falls outside GDPR — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

### Inferences
- DPA clause: club authorises the operator to create anonymised, aggregated statistics (k-anonymity thresholds, no single-club or single-player outputs) for service improvement, and to use service metadata (usage logs) as controller under legitimate interest. EDPB Guidelines 07/2020 accept that a processor can use limited data for its own purposes only if it becomes controller with its own basis; making it an instruction keeps it within the processor role. Cross-club "benchmarks" shown to other clubs risk re-identification with small youth squads (age group + position + club) — treat as high risk.
- The CJEU's EDPS v SRB judgment (C-413/23 P, 4 Sept 2025), to my knowledge, adopted a relative approach: pseudonymised data may be non-personal for a recipient who cannot re-identify — relevant to aggregated benchmarks but not verified this session.

### Gaps
- EDPB anonymisation/pseudonymisation guidance (Guidelines 01/2025 on pseudonymisation) and SRB judgment not fetched.

## 9. Lead supervisory authority / one-stop-shop (Luxembourg vs Italy); Art. 27

### Takeaway
The operator's lead SA is the authority of its **main establishment** — for a solo founder, the Member State of its central administration (where decisions are taken). Luxembourg CNPD now; the Italian Garante after moving the business to Italy. Art. 27 representative is not needed because the operator is EU-established.

### Cited Findings
- **Binding law – Art. 4(16)(b)**: for a processor, main establishment = place of central administration in the Union (or, if none, where main processing activities take place); **Art. 56(1)**: the SA of the main establishment is lead SA for cross-border processing; **Art. 3(1)/Art. 27**: representative only required for non-EU-established controllers/processors under Art. 3(2) — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]
- Luxembourg's competent SA is the CNPD (law of 1 August 2018) — [CNPD Deliberation 34/2019](https://cnpd.public.lu/dam-assets/fr/actualites/national/2019/Delib-34-2019-du-6-mars-2019.pdf)

### Inferences
- One-stop-shop only applies to cross-border processing; clubs in other Member States still deal with their own SA as controllers, and any SA can act on local complaints in certain cases (Art. 56(2)). Note that the GDPR Procedural Regulation (cross-border enforcement) was adopted in 2025 [not verified this session].
- The legal entity choice matters: a sole trader resident in Italy with central administration there → Garante; a Luxembourg company with decisions taken in Italy could be contested. Align company seat with where the founder actually decides.

### Gaps
- Procedural Regulation status/application date not verified.

## 10. Security (Art. 32) and breach notification duties

### Takeaway
Art. 32 requires risk-appropriate measures (pseudonymisation/encryption, confidentiality-integrity-availability-resilience, restore capability, regular testing); for a multi-tenant SaaS holding minors' data, regulators expect strong tenant isolation, access control, encryption in transit/at rest, logging, backup/restore, and documented procedures. The Dedalus fine shows SAs also penalise missing procedures (migration) and missing encryption.

### Cited Findings
- **Binding law – Art. 32(1)**: measures including (a) pseudonymisation and encryption; (b) ongoing confidentiality, integrity, availability and resilience; (c) timely restore after incident; (d) regular testing/evaluation; applies to controller **and** processor — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]; commentary — [Secrails](https://secrails.com/blog/gdpr-compliance-checklist-complete-guide)
- **Enforcement** – CNIL Dedalus: lack of specific migration procedure and lack of encryption on the affected server were Art. 32 breaches by the processor — [Cooley](https://cdp.cooley.com/breach-of-patients-data-leads-to-heavy-sanctions-in-france/)
- **Binding law – Art. 33(2)**: processor → controller "without undue delay"; Art. 33(5) controller documents all breaches — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

### Inferences
- For this app: Firestore Security Rules are the tenant-isolation boundary (no Cloud Functions) → rules tests are the key evidence of "regular testing"; MFA for operator/admin accounts; operator super-admin must not have data read access (supports "operator cannot access club data" claim — make it technically true in rules, and log any break-glass access); documented breach-response runbook with the DPA's notice window; backups/PITR with restore test; minimise AI-payload; CSP; dependency updates. Describe all of this in the DPA's TOMs annex.
- NIS2 is unlikely to apply to a micro SaaS (size-cap rule) — not researched.

### Gaps
- No SA guidance specific to sports-club SaaS security found.

## 11. Fines/enforcement against small SaaS processors

### Takeaway
Few published fines target small SaaS processors; the best-known processor case is CNIL v Dedalus Biologie (€1.5M, 2022): no Art. 28 contract, processing beyond instructions, weak security. Processors face fines up to €10M/2% (Arts. 28, 32, 33) or €20M/4% (Arts. 29, 44 transfers).

### Cited Findings
- CNIL v Dedalus Biologie, April 2022, €1.5M — highest CNIL sanction against a processor at the time — [Goodwin](https://www.goodwinlaw.com/en/insights/blogs/2022/06/french-data-protection-authority-fined-medical-software-provider-for-gdpr-violations); [Heimdal](https://heimdalsecurity.com/blog/medical-software-company-fined-e1-5m-for-exposing-490k-patients-data/)
- BfDI fined Vodafone GmbH €45M (June 2025), €15M of it under Art. 28(1) for failing to monitor partner agencies — controller-side Art. 28 enforcement — [HSF Kramer](https://www.hsfkramer.com/ru/notes/data/2025-posts/may-data-wrap-a-snapshot-of-key-regulatory-developments)
- **Binding law – Art. 83(4)/(5)** fine tiers — [GDPR, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) [text not re-fetched]

### Inferences
- Realistic risk for a solo operator is less a headline fine and more: an SA complaint after a breach (minors' data increases severity), a club's damages/recourse claim, and loss of club trust. Art. 83(2) proportionality factors (size, cooperation, measures taken) favour a well-documented small operator.

### Gaps
- No Italian Garante or Luxembourg CNPD fines against small SaaS processors found in this session (search returned none); recommend checking the CNPD decisions page, the Garante's newsletter, and the CMS GDPR Enforcement Tracker filtered by "processor".
