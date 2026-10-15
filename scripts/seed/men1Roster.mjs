// The "Men 1" demo squad: 14 adult players (fictional names) for the emulator.
// Adults give photo consent themselves, so consent is recorded as given and there
// are no guardians. Pure data builder — seedMen1.mjs writes it.

import { SKILL_KEYS } from './parseWorkbook.mjs';

export const MEN1_TEAM = {
  name: 'Men 1',
  ageGroup: 'Senior',
  description: 'Senior men — first team',
  notes: '',
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
};

// number, name, birth date, position, starter, nationality,
// skill scores in SKILL_KEYS order: serve attack block set defence reception jump speed iq
const SQUAD = [
  [1, 'Lucas Weber', '1997-03-14', 'S', true, 'LU', [7, 5, 6, 9, 7, 6, 7, 7, 9]],
  [12, 'Tom Schmit', '2003-08-02', 'S', false, 'LU', [6, 4, 5, 7, 6, 5, 6, 6, 7]],
  [4, 'Noah Kieffer', '1999-11-21', 'OH', true, 'LU', [8, 8, 6, 5, 7, 8, 8, 7, 7]],
  [7, 'Ben Muller', '2001-05-09', 'OH', true, 'DE', [7, 8, 7, 5, 6, 7, 8, 8, 6]],
  [9, 'Rui Ferreira', '1995-01-30', 'OH', false, 'PT', [6, 7, 6, 5, 7, 7, 6, 6, 8]],
  [15, 'Max Hoffmann', '2004-09-17', 'OH', false, 'LU', [5, 6, 5, 4, 6, 6, 7, 7, 5]],
  [3, 'Paul Lambert', '1998-06-25', 'O', true, 'BE', [7, 9, 7, 4, 5, 4, 9, 7, 7]],
  [14, 'Leo Martin', '2002-12-04', 'O', false, 'FR', [6, 7, 6, 4, 5, 4, 7, 6, 6]],
  [5, 'Jonas Becker', '1996-04-11', 'MB', true, 'LU', [6, 7, 9, 4, 4, 3, 8, 6, 7]],
  [10, 'Marc Reuter', '2000-02-28', 'MB', true, 'LU', [5, 7, 8, 4, 4, 3, 8, 7, 6]],
  [11, 'Yann Thill', '2003-07-19', 'MB', false, 'LU', [5, 6, 7, 3, 4, 3, 7, 6, 5]],
  [16, 'Eric Wagner', '1994-10-08', 'MB', false, 'LU', [6, 6, 7, 4, 5, 3, 6, 5, 8]],
  [2, 'Hugo Klein', '1999-03-03', 'L', true, 'LU', [5, 2, 1, 6, 9, 9, 5, 8, 8]],
  [8, 'Sam Faber', '2005-01-12', 'L', false, 'LU', [5, 2, 1, 5, 7, 7, 5, 7, 6]],
];

function level(avg) {
  if (avg === null) return null;
  if (avg < 4) return 'Beginner';
  if (avg < 6) return 'Developing';
  if (avg < 8) return 'Advanced';
  return 'Elite';
}

/** Player docs (without id / timestamps) for the Men 1 team. */
export function men1Players({ team, admin, today }) {
  return SQUAD.map(([number, fullName, dob, positionCategory, starting, nationality, scores]) => {
    const skills = Object.fromEntries(SKILL_KEYS.map((k, i) => [k, { score: scores[i], notes: '', priority: false }]));
    const avgScore = scores.reduce((t, s) => t + s, 0) / scores.length;
    return {
      number, fullName, dob, nationality, licenseNumber: '', positionCategory, shirtSize: '', starting,
      playerPhone: '', guardians: [], viewerEmails: [],
      teamName: team.name, ageGroup: team.ageGroup, season: team.season,
      skills, avgScore, level: level(avgScore),
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
      consent: { given: true, date: today, confirmedBy: admin },
      createdBy: 'seed-script-men1',
    };
  });
}
