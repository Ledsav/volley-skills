# US legal and contracting requirements for an EU-based SaaS vendor selling volleyball team software to US colleges (NCAA/NAIA/NJCAA) and pro teams (as of Oct 2026)

Scope note: "Binding law" = statute/regulation that applies to the school or vendor. "Procurement practice" = what universities typically demand in contracts/questionnaires (not law, but a de facto gate to closing a sale). Research was web-based (eCFR text via Cornell LII, Federal Register, EDUCAUSE, Texas DIR, Florida statutes, university procurement pages, law-firm briefings). Nothing here is legal advice.

## Q1. FERPA: vendor as "school official", are athletics records education records, contract terms, re-disclosure, deletion

### Takeaway
FERPA binds the institution, not the vendor directly; a vendor receives student-athlete data under the "school official" exception only if it does an outsourced institutional function, sits under the school's "direct control" (in practice, via contract), and accepts the 99.33 re-disclosure/use limits. Skill ratings, development plans, physical-test results and match stats kept by (or for) an athletics department are very likely "education records" because the definition covers any record "directly related to a student" maintained by the institution "or by a party acting for" it. The vendor must therefore build to, and sign, a FERPA-style data protection addendum (DPA).

### Cited Findings
- 34 CFR 99.3 defines "education records" as records "(1) Directly related to a student; and (2) Maintained by an educational agency or institution or by a party acting for the agency or institution." Exclusions are narrow: sole-possession memory aids, law-enforcement unit records, employee records, treatment records by physicians/psychologists for students 18+ "made, maintained, or used only in connection with treatment", post-attendance records, and ungraded peer papers. — [34 CFR 99.3 (Cornell LII)](https://www.law.cornell.edu/cfr/text/34/99.3)
- PII under FERPA includes the student's name, personal identifiers, indirect identifiers, and "Other information that, alone or in combination, is linked or linkable to a specific student that would allow a reasonable person in the school community ... to identify the student with reasonable certainty." — [34 CFR 99.3 (Cornell LII)](https://www.law.cornell.edu/cfr/text/34/99.3)
- School-official exception for outside parties, 99.31(a)(1)(i)(B): "A contractor, consultant, volunteer, or other party to whom an agency or institution has outsourced institutional services or functions may be considered a school official ... provided that the outside party— (1) Performs an institutional service or function for which the agency or institution would otherwise use employees; (2) Is under the direct control of the agency or institution with respect to the use and maintenance of education records; and (3) Is subject to the requirements of § 99.33(a) governing the use and redisclosure of personally identifiable information from education records." — [34 CFR 99.31 (Cornell LII)](https://www.law.cornell.edu/cfr/text/34/99.31)
- 99.31(a)(1)(ii): the institution "must use reasonable methods to ensure that school officials obtain access to only those education records in which they have legitimate educational interests" (physical/technological access controls, or effective administrative policy). — [34 CFR 99.31 (Cornell LII)](https://www.law.cornell.edu/cfr/text/34/99.31)
- Re-disclosure, 99.33(a)(1): PII may be disclosed "only on the condition that the party to whom the information is disclosed will not disclose the information to any other party without the prior consent of the parent or eligible student." 99.33(a)(2): the recipient's officers, employees and agents "may use the information, but only for the purposes for which the disclosure was made." 99.33(b)(1) allows further disclosures "on behalf of" the institution under conditions. — [34 CFR 99.33 (Cornell LII)](https://www.law.cornell.edu/cfr/text/34/99.33)
- "Direct control" is not defined in FERPA but "is interpreted to encompass imposing restrictions via contract on the service provider's conduct." — [Covington, Inside Privacy](https://www.insideprivacy.com/childrens-privacy/student-privacy-and-the-cloud-five-principles-for-schools/)
- PTAC-related material: "FERPA does not require an educational agency or institution to enter into an agreement under the school official exception, although it is a best practice" to clarify direct control and legitimate educational interest. — [Wisconsin DPI, Vetting Ed Tech slides](https://dpi.wi.gov/sites/default/files/imce/wisedata/pdf/2023Conference/Vetting_Ed_Tech_-_WISEDATA_-_Clean.pdf)
- US ED/PTAC guidance "Protecting Student Privacy While Using Online Educational Services: Requirements and Best Practices" (Feb 2014) recommends written contracts covering security, data collection, data use and retention, access, termination, and indemnification; explicit scope of collection; data minimization; and access by students/parents/educators. — [studentprivacy.ed.gov](https://studentprivacy.ed.gov/resources/protecting-student-privacy-while-using-online-educational-services-requirements-and-best); [SETDA summary](https://www.setda.org/?p=4229); [CDT summary](https://cdt.org/blog/department-of-education-encourages-schools-to-take-affirmative-steps-to-protect-data/)
- Athletics data: Duke analysis says heart-rate data gathered through a university-issued device and kept in an athletic department dashboard may become part of a FERPA-protected education record, while data in a personal wearable account falls instead under the company's privacy policy, FTC Act s.5 and state law. — [Duke Deep Tech blog](https://deeptech.duke.edu/blog-post/no-pain-no-privacy-athletic-wearables-and-limits-consent/)
- Commentators note that schools "may be obligated to perform due diligence and contractually obligate vendors" to safeguard student-athlete performance data; and that student-athletes often sign FERPA consent/release forms allowing institutions to share information. — [Duke Deep Tech blog](https://deeptech.duke.edu/blog-post/no-pain-no-privacy-athletic-wearables-and-limits-consent/); [HonorDRM policy brief](https://www.honordrm.com/post/policy-brief-considerations-when-ferpa-athlete-data-institutional-compliance-intersect)
- A 1998 US ED letter addresses FERPA and NCAA disclosures (athletics records handled under FERPA). — [studentprivacy.ed.gov, NCAA 1998 letter](https://studentprivacy.ed.gov/sites/default/files/resource_document/file/ncaa98.pdf)

### Inferences
- Under the 99.3 definition, the app's player profiles (skills, development plans, physical tests, match stats) maintained by a college athletics department, and held by the vendor "acting for" the school, should be treated as education records. "Directory information" (name, position, jersey number, height/weight of athletes is often listed in schools' directory-information policies) may be disclosable without consent, but skill ratings/development plans/physical tests are not directory information. Assume full FERPA treatment.
- Stripping names to jersey numbers before AI calls does not by itself de-identify data under FERPA's "linkable ... reasonable person in the school community" test (a jersey number on a public roster identifies the player). The LLM provider would be a sub-processor and must be covered by the same 99.33 use/re-disclosure limits (pass-through contract terms) or the feature must be off by default/opt-in by the institution.
- What the vendor must build/sign (FERPA-derived, priority order):
  1. A FERPA addendum / DPA stating the vendor is a "school official" with legitimate educational interest; the institution owns and controls the data; use only to provide the service; no re-disclosure except to listed sub-processors bound by equal terms (Google Firebase, the LLM provider); no sale, no advertising, no secondary use or AI model training.
  2. Data return/export and deletion on termination (and on request), with certification of deletion and a defined window; this matches PTAC's "termination" and "retention" contract topics.
  3. Role-based access controls proving "reasonable methods" (the app's per-team/per-section email-keyed access in Firestore rules supports this).
  4. Breach notification commitment (FERPA has no fixed deadline; state breach laws and contracts set it, often 24-72h in contracts).
  5. Support for the institution's FERPA rights requests (student inspection/amendment) via export/edit tools.
  6. The operator's stated "no access to customer data" posture helps, but support/debug access by the operator must still be contractually limited.
- Click-through signup does not satisfy most universities: the institution itself needs to establish "direct control", usually by signing its own DPA (see Q4 on click-through terms).

### Gaps
- Could not retrieve the full PTAC "Online Educational Services" PDF or PTAC's cloud FAQ text directly; contract-term list comes from secondary summaries of it.
- No authoritative US ED/SPPO guidance found specifically classifying athletic performance/analytics records as education records post-2020; the conclusion relies on the regulatory definition plus commentary.
- FERPA does not prescribe a deletion timeline; I found no regulatory text requiring deletion on termination (it is a contract/best-practice term).

## Q2. State student-privacy laws for higher ed; state comprehensive privacy laws (CCPA/CPRA and others)

### Takeaway
State student-privacy statutes (SOPIPA and its clones such as Illinois SOPPA) target K-12 operators; no enacted higher-ed equivalent was confirmed (California AB 1159 proposed one). State comprehensive privacy laws largely exempt FERPA-regulated data and/or higher-ed institutions, and a small vendor is unlikely to meet CCPA thresholds; but private colleges and pro teams may be covered entities in some states, so a processor DPA is still expected.

### Cited Findings
- SOPIPA applies to operators of services "designed and marketed for K-12 school purposes" and not to general-audience products. — [FPF Guide to SOPIPA](https://fpf.org/blog/fpf-guide-student-data-protections-sopipa-k-12-school-administrators-ed-tech-vendors/); [FPF SOPIPA presentation](https://fpf.org/wp-content/uploads/2016/03/FPF-Boot-Camp-SOPIPA-Presentation.pdf)
- Illinois SOPPA likewise covers operators whose services are designed, marketed and primarily used for K-12 school purposes. — [Cooley, Student Data Privacy: The States Are in the Lead](https://www.cooley.com/news/insight/2015/student-data-privacy-the-states-are-in-the-lead)
- Commentary on California AB 1159: higher-education students "remain largely outside any comparable state-level statutory regime governing the conduct of educational technology vendors"; AB 1159 would enact a "Higher Education Student Information Protection Act" banning sale, targeted ads, profiling and AI training on student data (with an educational-purpose exception) and adding a limited private right of action with notice-and-cure. At time of the article it was heading to Assembly Appropriations, not enacted. — [Captain Compliance on AB 1159](https://captaincompliance.com/education/california-ab-1159-a-landmark-student-privacy-bill-that-fixes-the-past-while-struggling-to-catch-the-present/)
- CCPA "business" thresholds (any one): annual gross revenue over $26,625,000 (inflation-adjusted figure reported for 2025/2026; global revenue, preceding calendar year); buying/selling/sharing PI of 100,000+ California consumers/households; or 50%+ of revenue from selling/sharing PI. — [Feroot](https://www.feroot.com/blog/ccpa-applicability-website-california-law/); [Clym](https://www.clym.io/blog/ccpa-applicability-guide); note internal inconsistency in [Captain Compliance](https://captaincompliance.com/ccpa-fines-overview) ($25.625M vs $26.625M)
- Colorado Privacy Act excludes data regulated by FERPA and has no general nonprofit exemption, so some private/for-profit higher-ed institutions may be subject to it while public institutions are not. — [EdTech Magazine (2021)](https://www.edtechmagazine.com/higher/article/2021/09/should-higher-ed-be-worried-about-colorado-privacy-act)
- Connecticut uses status-based exemptions for institutions of higher education plus data-based exemptions for FERPA data; Delaware exempts FERPA data; Iowa and Kentucky exempt higher education institutions and nonprofits. — [AACRAO state privacy legislation tracker](https://www.aacrao.org/news-advocacy/advocacy/advocacy-issues/state-issues-privacy-legislation/)

### Inferences
- An early-stage EU vendor with modest revenue and far fewer than 100,000 Californians' data does not meet CCPA "business" thresholds; it would at most be a "service provider/processor" to covered customers. (Pro teams are typically below the 100k-consumer threshold too, but large franchises may meet the revenue test, making them CCPA businesses that demand a service-provider contract.)
- Where a customer is a covered controller (e.g., a private college in Colorado, Oregon or other states without nonprofit/FERPA carve-outs, or a pro team meeting thresholds), the vendor will be asked to sign a processor DPA with the standard state-law processor terms (confidentiality, instructions-only processing, sub-processor flow-down, deletion/return, assistance, audit). A single US DPA template covering FERPA + state processor terms is the efficient build.
- State data-breach notification laws (all 50 states) apply to entities holding residents' personal information; for name + jersey + skill data, most state breach statutes are triggered only by specific data elements (SSN, account numbers, etc.), but contracts will impose notice regardless.
- AB 1159-style "no AI training" bans are already standard contract asks; the vendor should commit to no model training regardless of enactment.

### Gaps
- Final status of California AB 1159 (2025-26 session) not confirmed; no enacted higher-ed vendor statute found in any state.
- Did not verify current Oregon/Minnesota/Maryland nonprofit and higher-ed treatment, nor the CPPA's official 2025-2026 adjusted threshold publication.
- Did not research state laws on athletes' biometric/health data (e.g., Illinois BIPA, Washington My Health My Data) — physical test results are probably not "biometric" but could be argued "consumer health data" in Washington; needs follow-up.

## Q3. COPPA (amended rule) relevance

### Takeaway
COPPA protects children under 13 and applies to operators of child-directed services or with actual knowledge of under-13 users; college and pro rosters are out of scope. The amended rule's full compliance date was 22 April 2026.

### Cited Findings
- Amended COPPA Rule published in the Federal Register 22 April 2025, effective 23 June 2025; most operators had until 22 April 2026 for full compliance. New obligation includes written data retention policies referencing a time period. — [Davis Polk](https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect); [Toy Association](https://toyassociation.org/PressRoom2/News/2026-News/updated-coppa-rule-requirements-take-effect-april-22.aspx)
- 25 Feb 2026 FTC policy statement limits enforcement for data collected solely for age verification without prior parental consent, only if the company is compliant "in every other respect"; further age-verification rulemaking signaled. — [Davis Polk](https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect); [Mondaq](https://webiis10.mondaq.com/unitedstates/privacy-protection/1790866/coppas-amended-rule-is-now-in-full-effect-what-operators-need-to-know)

### Inferences
- College student-athletes and pro players are 17+ (virtually all 18+), so COPPA is irrelevant for the US college/pro market. It would only matter if the product were sold to US youth clubs with under-13 players (the app's European origin is U17 club teams; a US youth-club expansion would trigger COPPA and K-12-style state laws if sold to schools).
- Note: some college freshmen are 17, so FERPA still applies (rights belong to the student once attending postsecondary, per 99.3 "eligible student" concept), but not COPPA.

### Gaps
- Did not fetch the FTC's own rule text/FAQ; relied on law-firm and trade association summaries.

## Q4. University procurement: HECVAT, SOC 2, accessibility, insurance, data residency, TX-RAMP/Florida/foreign-vendor rules, contract clauses public universities cannot accept

### Takeaway
The practical gate is procurement, not statute: expect a HECVAT 4 questionnaire, a VPAT/ACR showing WCAG 2.1 AA, cyber + tech E&O insurance (commonly $1M-$5M), a university-paper DPA, and refusal of indemnity/foreign governing law/arbitration in click-through terms at public institutions. Texas public universities legally require TX-RAMP certification for cloud services; Florida requires a sworn foreign-country-of-concern affidavit (EU vendors can sign it). ADA Title II's web rule (WCAG 2.1 AA) now hits large public entities on 26 April 2027.

### Cited Findings
HECVAT
- Current HECVAT version is 4.1.6; HECVAT 4 (announced Feb 2025) merged the former Full, Lite and On-Premise versions into one file; providers answer applicable questions, institutions can do a "lite-style" review via asterisked questions. HECVAT 4 adds privacy questions, a privacy-analyst tab, and AI-specific questions. Free to institutions. — [EDUCAUSE HECVAT](https://www.educause.edu/hecvat); [EDUCAUSE HECVAT FAQs for Corporations](https://www.educause.edu/higher-education-community-vendor-assessment-toolkit/hecvat-faqs-for-corporations); [Campus Technology, Feb 2025](https://campustechnology.com/Articles/2025/02/11/Educause-HECVAT-Vendor-Assessment-Tool-Gets-an-Upgrade.aspx?p=1)

Accessibility (binding for public universities)
- DOJ interim final rule (Federal Register, 20 April 2026, effective immediately) extended ADA Title II web/mobile compliance dates by one year: public entities with total population 50,000+ move from 24 April 2026 to 26 April 2027; entities under 50,000 and special district governments to 26 April 2028. Technical standard unchanged: WCAG 2.1 Level AA. Comments were due 22 June 2026. — [Federal Register 2026-07663](https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web); [Reed Smith](https://www.reedsmith.com/articles/doj-extends-digital-accessibility-compliance-dates-under-title-ii-of-the-ada/); [University of Arizona](https://accessibility.arizona.edu/news/doj-issues-interim-final-rule-title-ii-digital-accessibility-compliance-dates)
- Original 2024 rule fact sheet (scope incl. content and apps that public entities provide through contractual, licensing or other arrangements). — [ADA.gov fact sheet](https://www.ada.gov/resources/2024-03-08-web-rule/)
- HHS Section 504 rule (relevant to recipients of HHS funds) reportedly had May 2026/May 2027 dates; one later source says HHS issued its own interim final rule on 11 May 2026 moving the date to 11 May 2027 — not verified in the Federal Register. — [ADA Title III blog (Seyfarth)](https://www.adatitleiii.com/2026/04/doj-extends-ada-title-ii-website-accessibility-deadlines-for-governmental-entities-but-litigation-and-compliance-risks-remain/); [iAccess Digital](https://www.iaccessdigital.com/doj-delays-ada-title-ii-web-rule-to-2027-what-changed-and-what-didnt.html)
- HECVAT has accessibility questions used in accessible procurement (VPAT/ACR, WCAG conformance). — [Accessing Higher Ground handout](https://accessinghigherground.org/wp/wp-content/uploads/2022/04/QuestionsforAccessibleProcurement-HECVAT-AHG-22-Handout-KyleShachmut.pdf)

TX-RAMP (binding for Texas state agencies and public universities/community colleges)
- Texas Gov't Code 2054.0593 / 1 TAC 202.5: cloud services procured by state agencies, universities and community colleges must be TX-RAMP certified; primes and resellers must show certification for covered cloud services including those via subcontractors. Level 1 = low-impact, non-confidential; Level 2 = confidential/regulated data (moderate/high impact). FedRAMP Moderate or StateRAMP Cat 2 gives automatic Level 2; Level 1 via assessment or StateRAMP Cat 1/FedRAMP Low. — [Texas DIR TX-RAMP eligibility](https://dir.texas.gov/information-security/tx-ramp-eligibility-and-requirements); [1 TAC 202.5 (Cornell LII)](https://www.law.cornell.edu/regulations/texas/1-Tex-Admin-Code-SS-202-5); [UT Southwestern TX-RAMP](https://www.utsouthwestern.edu/employees/information-security/tx-ramp)
- Secondary sources: Level 1 ~117 controls, Level 2 ~223 controls; certifications valid 3 years; a one-time 18-month provisional certification exists; Program Manual 4.0 effective 12 Feb 2026 (not verified against DIR). — [SaltyCloud guide](https://www.saltycloud.com/blog/everything-about-tx-ramp-complete-guide); [SecurityWall 2026 guide](https://securitywall.co/blog/tx-ramp-certification-guide-2026)

Florida foreign-vendor rule (binding for Florida governmental entities, incl. public universities)
- Fla. Stat. 287.138: a governmental entity may not contract with an entity that would access personal identifying information if it is owned/controlled by, or organized/headquartered in, a "foreign country of concern" (China, Russia, Iran, North Korea, Cuba, Maduro regime of Venezuela, Syria). Since 1 Jan 2024 a bid/contract giving access to PII requires an officer-signed affidavit under penalty of perjury attesting none of those criteria apply; since 1 July 2025 the affidavit is required on extensions/renewals and such contracts cannot be renewed. 25% voting/profit interest presumed controlling. — [Fla. Stat. 287.138 (public.law)](https://florida.public.law/statutes/fla._stat._287.138); [Florida Senate statute page](https://www.flsenate.gov/Laws/statutes/2025/287.138)
- 2026 bills (HB 905, SB 482 amendment) would expand this (e.g., IT-contract affidavits, "foreign sources of concern"); enactment not confirmed. — [CS/HB 905 text](https://www.flsenate.gov/Session/Bill/2026/905/BillText/e1/PDF); [SB 482 amendment](https://www.flsenate.gov/Session/Bill/2026/482/Amendment/119286/PDF)

Federal "foreign" data rule
- DOJ Data Security Program, 28 CFR Part 202 (implementing EO 14117, effective 8 April 2025) restricts data brokerage, vendor, employment and investment transactions giving countries of concern (China incl. HK/Macau, Cuba, Iran, North Korea, Russia, Venezuela) or covered persons access to bulk US sensitive personal data (incl. biometric, health, precise geolocation). — [University of Illinois compliance page](https://www.ethics.uillinois.edu/compliance/d_o_j_data_security_program_compliance); [Pearl Cohen](https://www.pearlcohen.com/dojs-new-data-security-program-explained/); [DOJ fact sheet](https://www.justice.gov/opa/media/1382526/dl)

Contract clauses public universities refuse
- Ohio state-university policy on click-through software contracts: no state university may agree to indemnify a vendor, hold a vendor harmless, or pay litigation costs or other contingent liability; contracts governed by Ohio law; the university will not be bound by any click-through term conflicting with the policy or Ohio law. — [BGSU Policy 3341-6-55](https://www.bgsu.edu/policies/finance-administration/3341-6-55)
- North Carolina: out-of-state governing-law or forum clauses implicate state sovereign immunity and the AG's authority, are against public policy and "void and unenforceable". — [UNC Charlotte Legal, contracting presentation](https://legal.charlotte.edu/sites/default/files/media/3A%20Contracting%20Process%20Presentation.pdf)
- Alabama (Auburn): arbitration clauses unenforceable against state entities; Auburn cannot accept arbitration in any agreement. — [Auburn memo on governing law/jurisdiction/venue](https://ba.auburn.edu/wp-content/uploads/2023/12/Memorandum-on-Governing-Law-Jurisdiciton-and-Venue.pdf)
- South Carolina AG opinion (Jan 2025): state cannot agree to indemnify/hold harmless; statute makes such terms void ab initio unless authorized (third-party summary). — [ezel.ai summary of SC AG opinion](https://ezel.ai/ag-opinions/sc/opinion-regarding-the-legality-of-the-state-or-its-subdivisions-entering-into-so-called-indemnification-agreements-whereby-the-state-agrees-to-hold-harmless-another-entity)
- Pennsylvania (IUP): standard click-through agreements commonly contain terms not allowed by state law. — [IUP policy](https://www.iup.edu/ITSupportCenter/about/policies/_files/82913.pdf)

Insurance (procurement practice)
- Cuesta College: Cyber Liability $1M per occurrence / $2M aggregate and Technology E&O $2M/$2M for vendors providing cloud hosting/software that store data. — [Cuesta College insurance requirements](https://www.cuesta.edu/about/vpas/insurance-contract-requirements.html)
- Villanova: Tech E&O $3M per claim and Cyber $3M per claim, rising to $5M cyber for vendors with access to health or FERPA records. — [Villanova vendor data access](https://www.villanova.edu/university/financial-affairs/vendors/access-to-data.html)
- University of Nevada, Reno: cyber and tech E&O minimum $5M per occurrence even for contracts under $1M. Cornell: not less than $5M per wrongful act. USF: $5M per occurrence. — [UNR technology contracts](https://www.unr.edu/bcn-nshe/risk/contracts/technology-contracts); [Cornell Risk](https://www.risk.cornell.edu/?p=2897); [USF vendor notice](https://myusf.usfca.edu/sites/default/files/contractor_vendor_notice.pdf)

### Inferences
- Priority build/sign list (procurement-driven):
  1. Completed HECVAT 4 (answer the full v4.1.6 file once; reuse) + a short security/privacy whitepaper. AI section matters because of the LLM feature.
  2. VPAT/ACR against WCAG 2.1 AA (Section 508 edition). Public universities need this for the ADA Title II deadline (26 April 2027 for large entities) and many will put WCAG 2.1 AA warranties and remediation timelines in contracts. Private colleges are not under the Title II rule but commonly ask for the same.
  3. US DPA/FERPA addendum + willingness to sign the university's own terms or a standard rider overriding the click-through ToS (no indemnity by the university, governing law = the customer's state or silence, no arbitration, no auto-renewal, liability caps acceptable to the state). The self-service click-through cannot be the only contract path for public institutions.
  4. Cyber + tech E&O insurance: $1M-$2M meets the low end (community colleges); $3M-$5M is common at universities, often higher where FERPA data is involved. An EU policy must name US jurisdiction/coverage.
  5. SOC 2: no source found making it legally mandatory; it is a frequent HECVAT/security-review ask. A small vendor can usually substitute HECVAT + Google Cloud's SOC 2/ISO 27001 reports for the infrastructure layer + its own policies, at the cost of slower reviews and lost deals at stricter schools.
  6. Texas: TX-RAMP certification needed before selling to any Texas public university/community college (Level 1 may suffice only if data is non-confidential; student records suggest Level 2). Firebase/Google Cloud's own certifications do not certify the vendor's SaaS.
  7. Florida public universities: sign the 287.138 affidavit (an EU-headquartered company with no ownership from listed countries qualifies).
- The DOJ bulk data rule and Florida/Texas foreign-adversary rules target named "countries of concern"; EU member states are not on any list, so an EU vendor is not barred. Watch for sub-processors or staff in listed countries (e.g., a China-based LLM API would be a problem under both the DOJ rule's vendor-agreement category and Florida's affidavit).
- Data residency: no source found indicating a US statute requiring US hosting of college student data (FERPA has no localization rule). US hosting is a frequent contract/procurement preference, and choosing a US Firebase region for US customers removes friction.

### Gaps
- No primary source for SOC 2 being required by specific universities; no statistics on how often SOC 2 Type II is mandatory vs. HECVAT-only.
- Did not verify whether TX-RAMP itself requires US data residency or applies to SaaS bought with athletics/foundation funds or via P-card/click-through.
- Did not research other state cloud programs (StateRAMP/GovRAMP states such as Arizona, etc.) or state accessibility procurement laws (e.g., California Gov. Code 11135, Texas 1 TAC 206/213).
- Did not verify HHS Section 504 interim rule date (11 May 2027) in the Federal Register.
- Did not confirm 2026 Florida bill outcomes (HB 905 / SB 482).

## Q5. NCAA rules relevant to software; NIL implications of award stories with athlete photos

### Takeaway
No NCAA rule found restricting analytics/scouting software vendors generally; the relevant rules are playing rules on electronic devices at the bench during matches (a 2026 experimental proposal would allow live stats/video to the bench for D2/D3 conferences). Post-House NIL law matters mainly if athlete images are used commercially; award-story photos are consent-gated and memory-only in the app, which limits exposure.

### Cited Findings
- 2026-27 women's volleyball rules-change document (hosted by NAIA, marked not yet applicable to NAIA until official) proposes letting conferences experiment in 2026 with electronic transmission of live statistical data and/or live video to the bench; video cannot be used to challenge calls; electronic communication to/from the bench stays banned, laptops/tablets may be used on the bench when not used for communication; using a device to communicate draws a red card for the head coach. — [NAIA/NCAA W Volleyball 2026-27 Rules Changes D2/D3](https://www.naia.org/wp-content/uploads/2026/07/W-Volleyball_2026-2027_RulesChanges_D2D3.pdf)
- NCAA basketball precedent (2019-20): laptops/tablets permitted on bench for live data with all other apps and communication deactivated. — [NCAA.org news, Nov 2019](https://www.ncaa.org/news/2019/11/25/ten-basketball-conferences-allowed-to-experiment-with-electronic-devices-during-league-games.aspx)
- House v. NCAA settlement final approval 6 June 2025; D-I institutions may share revenue directly with athletes (cap ~US$20.5M per institution initially); College Sports Commission (CSC) oversees NIL compliance via "NIL Go" where athletes disclose third-party deals; NCAA/conferences may enforce standards on third-party deals. — [Butler Snow, NIL after House (2026)](https://www.butlersnow.com/news-and-events/nil-after-house-what-name-image-and-likeness-means-for-colleges-and-higher-education-institutions-in-2026); [Manatt](https://www.manatt.com/ncaa-settlement-kicks-off-new-era-for-student-athlete-nil)

### Inferences
- The scouting UI is used during live matches; colleges will need to check their division's playing-rules status (D1 rules on bench devices and live stats not confirmed). This is a product/marketing constraint, not a vendor legal obligation.
- Award stories using athlete photos: if generated and shared by the coach/school for internal or team purposes, it is the school's use of a student's likeness (FERPA directory-info / media release policies and state right-of-publicity laws). If the vendor ever used athlete images in its own marketing, it would need athlete consent and could intersect NIL rules (a commercial use of NIL). The app's current design (photos never stored, consent-gated) is defensible; add a contract/ToS term that the vendor never uses athlete images or names for its own promotion.

### Gaps
- Did not find the NCAA D1 women's volleyball 2025-26/2026-27 rule text on bench electronic devices, nor NJCAA/NAIA confirmed rules.
- No source found on NCAA bylaws restricting technology/analytics vendors or on recruiting-related software restrictions (e.g., scouting services rules apply to recruiting services, not team analytics — unverified).
- No source found on university media-release practices for athlete photos post-House.

## Q6. Data transfers: US restrictions on storing student data in the EU; EU-to-US considerations

### Takeaway
No US law found that prohibits a US college from having student data stored in the EU; FERPA has no localization requirement and the US foreign-data restrictions target only named countries of concern. The binding constraints run the other way: the EU vendor is itself subject to GDPR for its processing, and US customers' contracts may impose US-hosting preferences.

### Cited Findings
- FERPA's outside-party conditions are functional (institutional function, direct control, 99.33 limits) with no location requirement. — [34 CFR 99.31 (Cornell LII)](https://www.law.cornell.edu/cfr/text/34/99.31)
- DOJ Part 202 restricts access by six countries of concern; EU states are not listed. — [Pearl Cohen](https://www.pearlcohen.com/dojs-new-data-security-program-explained/); [University of Montana](https://www.umt.edu/research-compliance-tech-transfer/research-security/department-of-justice-bulk-sensitive-data-program)
- Florida 287.138's list of foreign countries of concern contains no EU state. — [Fla. Stat. 287.138](https://florida.public.law/statutes/fla._stat._287.138)

### Inferences
- With Firebase region selectable, offer a US region (e.g., us-central/nam5) for US customers. That removes residency objections in HECVAT/procurement, aligns with TX-RAMP/state expectations, and keeps US customer data out of EU-only storage.
- GDPR angle (not researched here): an EU-established processor is subject to GDPR obligations for its processing even of non-EU data subjects; returning data to a US controller may be treated as a transfer (typically handled with SCC Module 4 processor-to-controller or reliance on the EU-US Data Privacy Framework if the customer is certified, which universities rarely are). This needs confirmation from the EU-side research.
- A US university might perceive an EU vendor as exposing data to EU authorities' access; the reverse of the usual concern. Not found as a common procurement objection.

### Gaps
- No source searched for GDPR Art. 3(1)/Chapter V treatment of an EU processor serving US controllers (out of scope for US research; flag for EU research stream).
- No source found on universities' contractual "US-only data" clauses frequency.

## Q7. Tax/paperwork basics: W-8BEN-E, purchase orders, sales tax

### Takeaway
US universities will require a Form W-8BEN-E (not a W-9) at supplier onboarding; with a completed form, SaaS delivered from abroad is typically treated as non-US-source / non-service income with no withholding, but incomplete forms trigger 30% default withholding. Purchases go via supplier registration + PO (or P-card for small amounts). Sales tax: public and many private universities are exempt purchasers and provide exemption certificates; a foreign remote seller's US sales-tax nexus for SaaS was not researched in depth.

### Cited Findings
- University tax offices: W-8 instructions relate to services, not goods; where vendor and work are abroad, income is non-taxable foreign-source income with no university withholding (UC Davis); W-8BEN-E must be completed in full to avoid mandatory 30% withholding and treaty claims are recommended to avoid payment delays (FAU); goods/software purchased from foreign vendors are listed as not taxable/reportable (Indiana University); risk that reclassification as services makes the whole amount taxable (FAU). — [UC Davis Tax Information Foreign Vendors](https://accountability.ucdavis.edu/sites/g/files/dgvnsk4871/files/inline-files/Tax_Information_Foreign_Vendors.pdf); [FAU payments to foreign suppliers](https://www.fau.edu/controllers-office/tax-services/payment-to-foreign-supplier-document); [Indiana University foreign vendor tax](https://procurement.iu.edu/purchasing/resources/preliminary/preliminary-tax.html)
- Overview of selling to US customers from an EU (Estonian) company: W-8BEN-E and sales tax in 2026. — [Enty blog](https://enty.io/blog/selling-to-us-customers-estonian-ou-w8bene-sales-tax-2026)

### Inferences
- Paperwork kit: W-8BEN-E (claim treaty benefits, Part III, using the vendor's home-country tax ID; a US ITIN/EIN may be requested by some schools to claim treaty benefits), bank details for international wire or a US payment rail, supplier registration forms, invoice compatible with PO numbers, quote/order form, and the HECVAT/insurance certificates.
- Keep any onboarding/training work performed in the US separate from the subscription to avoid service-income reclassification and withholding.
- Many university purchases under a few thousand dollars are made by P-card, which often still requires vendor acceptance of university terms (the click-through ToS issue in Q4 still applies).
- Sales tax: states with economic-nexus rules (post-Wayfair) can reach remote sellers, and SaaS taxability varies by state; exempt university purchasers will provide certificates. Needs confirmation by a US tax adviser once US revenue grows.

### Gaps
- No primary source found on state sales-tax treatment of SaaS sold by foreign remote sellers to exempt universities, or on economic-nexus thresholds by state.
- Did not verify the US-Spain (or other EU state) treaty article applicable to SaaS income.
- Pro-team customers: did not research pro sports specifics (players' unions/CBAs on player data, CCPA applicability to US pro volleyball leagues such as LOVB, MLV/Athletes Unlimited). FERPA does not apply to pro teams; state privacy laws and contract terms would govern.
