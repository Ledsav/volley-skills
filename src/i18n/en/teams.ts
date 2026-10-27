export const teams = {
  gender: {
    label: 'Team type',
    choose: 'Choose…',
    women: 'Women',
    men: 'Men',
    mixed: 'Mixed',
    prompt: "Is this a women's, men's or mixed team?",
    promptHint: 'Used for wording in Italian. You can change it later in Settings.',
    saveError: 'Could not save the team type. Please try again.',
    importRequired: (n: number) => `row ${n}: "gender" is required (women, men or mixed)`,
    importInvalid: (n: number) => `row ${n}: "gender" must be women, men or mixed`,
  },
};
