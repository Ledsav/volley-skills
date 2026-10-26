import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildClubExportFiles,
  clubExportFileName,
  playersCsv,
  zipClubExport,
  type ClubExportData,
} from './clubExport';

const ts = { toDate: () => new Date('2026-01-02T03:04:05Z') };

function fixture(): ClubExportData {
  return {
    club: { id: 'c1', name: 'VC Test', createdAt: ts },
    members: [{ id: 'a@x.com', email: 'a@x.com', role: 'admin' }],
    acceptances: [],
    statusLog: [],
    teams: [
      {
        data: {
          team: { id: 't1', name: 'U17' },
          players: [
            {
              player: {
                id: 'p1',
                number: 7,
                fullName: 'Ana Lima',
                guardians: [{ relation: 'mother', name: 'Ana', phone: '600', email: 'ana@x.com' }],
                viewerEmails: ['ana@x.com'],
              },
              physicalTests: [{ id: 'pt1', testType: 'sprint' }],
            },
          ],
          testingSessions: [{ session: { id: 's1' }, entries: [{ id: 'e1' }] }],
          matches: [{ match: { id: 'm1' }, events: [{ id: 'ev2', order: 2 }, { id: 'ev1', order: 1 }] }],
          calendar: [],
          scoutProfile: [],
        },
        awards: [{ id: 'season' }],
      },
    ],
    exercises: [{ exercise: { id: 'x1', name: 'Pepper' }, diagrams: [{ id: 'd1', order: 0 }] }],
    trainings: [],
    counters: [],
    skillGuide: { id: 'skillGuide', skills: [] },
    physicalTestGuide: { id: 'physicalTestGuide', tests: [] },
    sectionAccess: [],
  };
}

function empty(): ClubExportData {
  return { ...fixture(), teams: [], exercises: [], skillGuide: null, physicalTestGuide: null };
}

const HEADER =
  'Number,Name,Date of birth,Nationality,Licence,Position,Shirt size,Starting,Player phone,Guardians,' +
  'Viewer emails,Average,Level,Serve,Attack,Block,Set,Defence,Reception,Jump,Speed,IQ,Consent given,Consent date,Left club';

/** players.csv starts with a BOM (for Excel); assert it, then drop it. */
function withoutBom(csv: string): string {
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  return csv.slice(1);
}

describe('buildClubExportFiles', () => {
  it('builds exactly the spec file set', () => {
    expect(Object.keys(buildClubExportFiles(fixture())).sort()).toEqual(
      [
        'README.txt',
        'club.json',
        'members.json',
        'acceptances.json',
        'statusLog.json',
        'teams/t1/team.json',
        'teams/t1/players.json',
        'teams/t1/players.csv',
        'teams/t1/calendar.json',
        'teams/t1/testingSessions.json',
        'teams/t1/awards.json',
        'teams/t1/scoutProfile.json',
        'teams/t1/matches/m1.json',
        'library/exercises.json',
        'library/trainings.json',
        'library/counters.json',
        'config/skillGuide.json',
        'config/physicalTestGuide.json',
        'sectionAccess.json',
      ].sort(),
    );
  });

  it('writes timestamps as ISO strings', () => {
    const club = JSON.parse(buildClubExportFiles(fixture())['club.json']);
    expect(club.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });

  it('sorts match events by order', () => {
    const match = JSON.parse(buildClubExportFiles(fixture())['teams/t1/matches/m1.json']);
    expect(match.events.map((e: { order: number }) => e.order)).toEqual([1, 2]);
    expect(match.match.id).toBe('m1');
  });

  it('an empty club still builds', () => {
    const files = buildClubExportFiles(empty());
    expect(Object.keys(files).sort()).toEqual(
      [
        'README.txt',
        'club.json',
        'members.json',
        'acceptances.json',
        'statusLog.json',
        'library/exercises.json',
        'library/trainings.json',
        'library/counters.json',
        'config/skillGuide.json',
        'config/physicalTestGuide.json',
        'sectionAccess.json',
      ].sort(),
    );
    expect(files['config/skillGuide.json']).toBe('null');
  });

  it('README names every file', () => {
    const files = buildClubExportFiles(fixture());
    const readme = files['README.txt'];
    for (const path of Object.keys(files)) {
      const pattern = path.replace(/^teams\/t1\//, 'teams/<teamId>/').replace('matches/m1.json', 'matches/<matchId>.json');
      expect(readme).toContain(pattern);
    }
    for (const field of ['avgScore', 'viewerEmails', 'consent']) expect(readme).toContain(field);
    expect(readme.startsWith('Club data export\nClub: VC Test (c1)\nExported: ')).toBe(true);
  });
});

describe('playersCsv', () => {
  it('players.csv has the fixed header and guards formulas', () => {
    const csv = playersCsv([
      {
        player: {
          id: 'p1',
          number: 3,
          fullName: '=HYPERLINK("x")',
          guardians: [{ relation: 'mother', name: 'Ana', phone: '600', email: 'ana@x.com' }],
        },
        physicalTests: [],
      },
    ]);
    const [header, row] = withoutBom(csv).split('\r\n');
    expect(header).toBe(HEADER);
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain('"mother: Ana, 600, ana@x.com"');
  });

  it('sorts rows by number and fills skills and flags', () => {
    const skill = (score: number | null) => ({ score, notes: '', priority: false });
    const skills = {
      serve: skill(5), attack: skill(6), block: skill(null), set: skill(4), defence: skill(5),
      reception: skill(5), jump: skill(5), speed: skill(5), iq: skill(5),
    };
    const csv = playersCsv([
      { player: { id: 'b', number: 9, fullName: 'B', skills, starting: true, positionCategory: 'OH', consent: { given: true, date: '2026-09-01', confirmedBy: 'x' } }, physicalTests: [] },
      { player: { id: 'a', number: 2, fullName: 'A' }, physicalTests: [] },
    ]);
    const rows = withoutBom(csv).trimEnd().split('\r\n');
    expect(rows[1].startsWith('2,A,')).toBe(true);
    expect(rows[2]).toContain(',Outside,');
    expect(rows[2]).toContain(',yes,');
    expect(rows[2]).toContain(',5,6,,4,5,5,5,5,5,yes,2026-09-01,');
  });
});

describe('zip and file name', () => {
  it('zips and unzips to the same files', () => {
    const files = buildClubExportFiles(fixture());
    const unzipped = unzipSync(zipClubExport(files));
    // ignoreBOM keeps players.csv's BOM (Excel needs it) instead of eating it on decode.
    const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
    const decoded = Object.fromEntries(Object.entries(unzipped).map(([k, v]) => [k, decoder.decode(v)]));
    expect(decoded).toEqual(files);
    expect(strFromU8(unzipped['club.json'])).toBe(files['club.json']);
  });

  it('names the file after the club and date', () => {
    expect(clubExportFileName({ id: 'c1', name: 'VC Bàrça / A' }, new Date('2026-10-22T10:00:00Z'))).toBe(
      'club-VC-Bàrça-A-export-2026-10-22.zip',
    );
  });
});
