export const legal = {
  docTitles: {
    terms: 'Terms of Service',
    dpa: 'Data Processing Agreement',
    subprocessors: 'Sub-processors',
    privacy: 'Privacy',
    dpiaPack: 'DPIA pack',
  },
  page: {
    description: (title: string) => `${title} of Volley Skills.`,
    backToApp: 'Back to the app',
    versionInForce: (version: string, since: string) => `Version ${version}, in force since ${since}`,
    version: (version: string) => `Version ${version}`,
    notFound: 'We could not find that legal text.',
  },
  langSwitcher: 'Language of the legal text',
  links: {
    label: 'Legal',
    terms: 'Terms',
    dpa: 'DPA',
    reportContent: 'Report content',
  },
  banner: {
    termsUpdated: (date: string) => `Updated Terms of Service take effect on ${date} — `,
    dpaUpdated: (date: string) => `Updated Data Processing Agreement takes effect on ${date} — `,
    review: 'review',
    reviewTerms: ' the Terms of Service',
    reviewDpa: ' the Data Processing Agreement',
    subprocessorsChange: (date: string) =>
      `The sub-processor list changes on ${date}. You can object within 15 days of this notice.`,
    seeList: 'See the list',
    contactOperator: 'Contact the operator',
  },
  review: {
    titleUpdated: 'Review the updated Terms and DPA',
    titleFirst: 'Accept the Terms and DPA',
    dontAgree: "Don't agree?",
  },
};
