// Parses `reference/VCB_U17_PlayerCards_2026-27.xlsx` (see app design spec §9)
// into plain objects shaped to the Firestore data model (spec §5).
//
// Pure module — no Firebase, no network. `seed.mjs` is the writer.
//
// The workbook holds ONE team's roster: a "Skills Guide" sheet, an "Overview"
// sheet (ignored — fully derived), and one sheet per player named `#<n> <name>`.
// Contact + guardian fields are populated; skill scores / notes / priorities and
// all development-plan fields are typically blank on import (the coach fills them
// in the app afterwards). This parser reads them anyway so a later, fuller
// workbook still imports cleanly.

import ExcelJS from 'exceljs';

const SKILL_ROW_LABELS = {
  SERVE: 'serve',
  ATTACK: 'attack',
  SET: 'set',
  DEFENCE: 'defence',
  RECEPTION: 'reception',
  JUMP: 'jump',
  SPEED: 'speed',
  IQ: 'iq',
};

const SKILL_GUIDE_LABELS = {
  Serve: 'serve',
  Attack: 'attack',
  Set: 'set',
  Defence: 'defence',
  Reception: 'reception',
  Jump: 'jump',
  Speed: 'speed',
  IQ: 'iq',
};

export const SKILL_KEYS = ['serve', 'attack', 'set', 'defence', 'reception', 'jump', 'speed', 'iq'];

const EMPTY_SKILL = () => ({ score: null, notes: '', priority: false });

/** Flatten an ExcelJS cell value (string | number | Date | richText | formula) to a trimmed string. */
export function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (value.result != null) return cellText(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('').trim();
    if (typeof value.text === 'string') return value.text.trim();
    return '';
  }
  return String(value).trim();
}

/** A cell that should be a 1-10 score. Returns a number in [1,10] or null. */
export function cellScore(value) {
  const t = cellText(value);
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

/**
 * "14.12.12" (D.M.YY) / "14.12.2012" / "2012-12-14" / a Date -> "YYYY-MM-DD".
 * Two-digit years map to 20YY (players are 13-15 in 2026). Returns '' if unparseable.
 */
export function parseDob(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const t = cellText(value).trim();
  if (t === '') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/);
  if (!m) return '';
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${month}-${day}`;
}

/**
 * "1-3: foo. 4-6: bar. 7-8: baz. 9-10: qux." -> the 4 ranges the data model expects.
 * Falls back to a single 1-10 range holding the whole string if the markers are absent.
 */
export function splitCriteria(text) {
  const s = cellText(text).trim();
  if (s === '') return [];
  const re = /(\d+)\s*-\s*(\d+)\s*:\s*/g;
  const marks = [];
  let mm;
  while ((mm = re.exec(s)) !== null) {
    marks.push({ min: Number(mm[1]), max: Number(mm[2]), start: mm.index, textStart: re.lastIndex });
  }
  if (marks.length === 0) return [{ min: 1, max: 10, description: s }];
  return marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : s.length;
    return {
      min: mark.min,
      max: mark.max,
      description: s.slice(mark.textStart, end).trim().replace(/\s+/g, ' '),
    };
  });
}

function labelRowIndex(sheet, label) {
  for (let r = 1; r <= sheet.rowCount; r++) {
    if (cellText(sheet.getRow(r).getCell(1).value).toLowerCase() === label.toLowerCase()) return r;
  }
  return -1;
}

function valueForLabel(sheet, label) {
  const r = labelRowIndex(sheet, label);
  return r === -1 ? '' : cellText(sheet.getRow(r).getCell(2).value);
}

function parsePlayerSheet(sheet) {
  const title = cellText(sheet.getRow(2).getCell(1).value);
  const numMatch = title.match(/#\s*(\d+)/) || sheet.name.match(/#\s*(\d+)/);
  const number = numMatch ? Number(numMatch[1]) : 0;

  const guardians = [];
  for (const [labelPrefix, relation] of [
    ['Mother', 'mother'],
    ['Father', 'father'],
  ]) {
    const name = valueForLabel(sheet, `${labelPrefix} / Guardian`);
    const phone = valueForLabel(sheet, `${labelPrefix} Phone`);
    const email = valueForLabel(sheet, `${labelPrefix} Email`);
    if (name || phone || email) guardians.push({ relation, name, phone, email });
  }

  const skills = Object.fromEntries(SKILL_KEYS.map((k) => [k, EMPTY_SKILL()]));
  const skillHeaderRow = (() => {
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      if (
        cellText(row.getCell(1).value).toUpperCase() === 'SKILL' &&
        cellText(row.getCell(3).value).toUpperCase() === 'SCORE'
      ) {
        return r;
      }
    }
    return -1;
  })();
  if (skillHeaderRow !== -1) {
    for (let r = skillHeaderRow + 1; r <= skillHeaderRow + 12 && r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const key = SKILL_ROW_LABELS[cellText(row.getCell(1).value).toUpperCase()];
      if (!key) continue;
      skills[key] = {
        score: cellScore(row.getCell(3).value),
        notes: cellText(row.getCell(4).value),
        priority: /^(y|yes|true|1|★|⭐|priority)$/i.test(cellText(row.getCell(5).value)),
      };
    }
  }

  const objectivesUnder = (headerNeedle, dateKey) => {
    const headerRow = (() => {
      for (let r = 1; r <= sheet.rowCount; r++) {
        if (cellText(sheet.getRow(r).getCell(1).value).toUpperCase().includes(headerNeedle)) return r;
      }
      return -1;
    })();
    if (headerRow === -1) return [];
    const out = [];
    // rows after the header: a "#" column-header row, then numbered objective rows
    for (let r = headerRow + 1; r <= headerRow + 8 && r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const first = cellText(row.getCell(1).value);
      if (first.toUpperCase() === 'OBJECTIVE' || first === '#' || first === '') continue;
      if (!/^\d+$/.test(first)) break;
      const objective = cellText(row.getCell(2).value);
      const dateOrTarget = cellText(row.getCell(3).value);
      const status = cellText(row.getCell(4).value);
      const coachComment = cellText(row.getCell(5).value);
      if (!objective && !dateOrTarget && !status && !coachComment) continue;
      out.push({ objective, [dateKey]: dateOrTarget, status, coachComment });
    }
    return out;
  };

  return {
    number,
    fullName: valueForLabel(sheet, 'Full Name'),
    dob: parseDob(sheet.getRow(labelRowIndex(sheet, 'Date of Birth')).getCell(2).value),
    nationality: valueForLabel(sheet, 'Nationality'),
    licenseNumber: valueForLabel(sheet, 'License #'),
    position: valueForLabel(sheet, 'Position'),
    playerPhone: valueForLabel(sheet, 'Player Phone'),
    guardians,
    skills,
    developmentPlan: {
      shortTermObjectives: objectivesUnder('SHORT-TERM OBJECTIVES', 'targetDate'),
      seasonObjectives: objectivesUnder('SEASON-LONG OBJECTIVES', 'target'),
      generalNotes: (() => {
        const r = labelRowIndex(sheet, 'COACH GENERAL NOTES & OBSERVATIONS');
        if (r === -1) return '';
        const lines = [];
        for (let i = r + 1; i <= sheet.rowCount; i++) {
          const v = cellText(sheet.getRow(i).getCell(2).value) || cellText(sheet.getRow(i).getCell(1).value);
          if (v) lines.push(v);
        }
        return lines.join('\n');
      })(),
    },
  };
}

function parseSkillGuide(sheet) {
  const skills = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const label = cellText(row.getCell(1).value);
    const key = SKILL_GUIDE_LABELS[label];
    if (!key) continue;
    skills.push({
      key,
      label,
      ranges: splitCriteria(row.getCell(2).value),
      howToEvaluate: cellText(row.getCell(3).value),
    });
  }
  return skills;
}

/**
 * @param {string} filePath path to the .xlsx
 * @returns {Promise<{team: object, skillGuide: object[], players: object[]}>}
 */
export async function parseWorkbook(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const guideSheet = wb.worksheets.find((s) => /skills guide/i.test(s.name));
  const playerSheets = wb.worksheets.filter((s) => /^#\s*\d+/.test(s.name.trim()));

  // Team identity: read the club/age/season banner off the first player sheet.
  const banner = playerSheets.length ? cellText(playerSheets[0].getRow(1).getCell(1).value) : '';
  const ageGroup = (banner.match(/\bU\d{1,2}\b/) || ['U17'])[0];
  const season = (banner.match(/\b(\d{4})\s*[-–]\s*(\d{2,4})\b/) || [undefined, '2026', '2027']).slice(1).join('-');

  const team = {
    name: ageGroup,
    club: 'Volley Club Belair (VCB)',
    ageGroup,
    season,
    description: '',
    notes: '',
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  };

  const players = playerSheets
    .map(parsePlayerSheet)
    .filter((p) => p.fullName)
    .sort((a, b) => a.number - b.number);

  return { team, skillGuide: guideSheet ? parseSkillGuide(guideSheet) : [], players };
}
