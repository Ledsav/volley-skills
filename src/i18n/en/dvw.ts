import { plural } from '../plural';

/** "line 3" or "lines 1, 2, 3, 4, 5, …": at most the first five line numbers. */
const lineList = (lines: number[]) =>
  `${plural('en', lines.length, { one: 'line', other: 'lines' })} ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? ', …' : ''}`;
const actions = (n: number) => `${n} ${plural('en', n, { one: 'action', other: 'actions' })}`;
const FIX = 'mark your middle blockers as MB in the team roster, then import again.';

export const dvw = {
  lineList,
  messages: {
    notDvw: 'This does not look like a DataVolley file.',
    unsupportedRegulation: 'Unsupported regulation: only indoor rally-point matches can be imported.',
    noRallies: 'This file has no scouted rallies.',
    playerNoJersey: (line: string) => `Skipped a player line without a jersey number: "${line}"`,
    setNumberMismatch: (set: number, lines: number[]) =>
      `Set ${set}: ${lines.length} scout ${plural('en', lines.length, { one: 'line has', other: 'lines have' })} a missing or different set number (${lineList(lines)}); the set markers were used.`,
    sameAppPlayer: (first: number, second: number) => `Two file players are mapped to the same app player (#${first} and #${second}).`,
    tooManyLiberos: 'The app takes at most two liberos: skip the others or map them to other players.',
    liberoReplaces: (jerseys: number[]) =>
      `Read from the file: the libero replaces ${jerseys.map((j) => `#${j}`).join(', ')} in the back row. If that is wrong, ${FIX}`,
    liberoNeverOnCourt: `The libero never comes on court: ${FIX}`,
    startersUnmapped: (set: number) => `Map or keep every starter: the app needs six players on court in set ${set}.`,
    tooLong: 'This match is too long to import (more than 1,900 events).',
    unlistedJersey: (jersey: number, line: number) => `#${jersey} is not in the file's player list (first seen on line ${line}).`,
    droppedGrade: (skill: string, grade: string, lines: number[]) =>
      `${lines.length} ${skill} "${grade}" ${plural('en', lines.length, { one: 'action', other: 'actions' })} dropped: the app has no such grade (${lineList(lines)}).`,
    droppedUnknownPlayer: (lines: number[]) => `${actions(lines.length)} by an unknown player ($$) dropped (${lineList(lines)}).`,
    droppedForJersey: (reason: 'unmapped' | 'decided', jersey: number, lines: number[]) =>
      `${actions(lines.length)} of #${jersey} dropped: ${reason === 'unmapped' ? 'not mapped to a player' : 'the rally was already decided'} (${lineList(lines)}).`,
    subUnmapped: (line: number, out: number, inn: number) => `Line ${line}: substitution #${out} → #${inn} has an unmapped player — skipped.`,
    endedOtherWay: (line: number, pointLine: number, winner: 'us' | 'them') =>
      `Line ${line}: this action ended the rally the other way; line ${pointLine} gives the point to ${winner === 'us' ? 'us' : 'the opponent'} — action dropped.`,
    scoreDiffers: "The replayed score differs from the file's set scores.",
  },
  review: {
    alreadyImported: (date: string, opponent: string) => `This file was already imported on ${date} against ${opponent}.`,
    openExisting: 'Open the existing match',
    date: 'Date',
    opponent: 'Opponent',
    competition: 'Competition',
    league: 'League',
    cup: 'Cup',
    friendly: 'Friendly',
    tournament: 'Tournament',
    format: 'Format',
    bestOf3: 'Best of 3',
    bestOf5: 'Best of 5',
    whichTeam: 'Which team is us',
    home: 'home',
    visiting: 'visiting',
    roster: 'Roster',
    notInList: 'Not in the player list',
    unknownRole: 'Unknown',
    mapAria: (jersey: number, name: string) => `Map #${jersey} ${name}`,
    skip: 'Skip',
    checks: 'Checks',
    set: 'Set',
    file: 'File',
    pointLines: 'Point lines',
    replayed: 'Replayed',
    setN: (n: number) => `Set ${n}`,
    corrections: (n: number) => `${n} score corrections`,
    correctionLines: (lines: number[]) => `(lines ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? ', …' : ''})`,
    events: 'Events:',
    eventTypes: { setStart: 'setStart', action: 'action', point: 'point', sub: 'sub', timeout: 'timeout', correction: 'correction', setEnd: 'setEnd' },
    none: 'none',
    ignored: (n: number) => `${n} lines ignored`,
    scoresDiffer: "The replayed set scores differ from the file's set scores.",
    checkedScores: 'I checked the scores',
    cancel: 'Cancel',
    import: 'Import',
  },
  dialog: {
    title: 'Import from DataVolley (.dvw)',
    tooLarge: 'This file is larger than 2 MB.',
    readError: 'Could not read this file. Check your connection and try again.',
    imported: 'Match imported.',
    discardError: 'Could not discard the partial import. Check your connection and try again.',
    importing: (done: number, total: number) => `Importing… ${done}/${total}`,
    notFinished: 'The import did not finish. Retry, or discard what was written.',
    discard: 'Discard',
    retry: 'Retry',
    fileLabel: 'DVW file',
    help: 'Pick a DataVolley scout file (up to 2 MB). It is read on this device; the player names in it are only shown while you review. Also works with Click&Scout and VolleyStation .dvw exports.',
    reading: 'Reading the file…',
    disclaimer: 'Not affiliated with Data Project or Genius Sports. DataVolley is a trademark of its owner.',
  },
};
