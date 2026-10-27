import { GRADES, SKILLS, type Grade, type MatchEventPayload, type PointReason, type RosterEntry, type Side, type Skill } from '../../types/match';
import { labels as enLabels } from '../../i18n/en/labels';
import { POINT_REASONS, rallyOutcome, validGrades } from '../skillGrades';
import type { ChatMessage } from '../../ai/aiClient';

// The prompt and its validator messages are a protocol: always the English labels, never the active locale.
const SKILL_LABELS = enLabels.skill;
const GRADE_LABELS = enLabels.grade;

export interface ParsedAction {
  number: number;
  skill: Skill;
  /** null when the notes name the action but not its result; the coach picks it in the preview. */
  grade: Grade | null;
}

export interface ParsedRally {
  actions: ParsedAction[];
  point: { winner: Side; reason: PointReason | null } | null;
  subs: { outNumber: number; inNumber: number }[];
  timeouts: { team: Side }[];
}

export interface ParsedBatch {
  rallies: ParsedRally[];
  unparsed: string[];
}

interface AnchorInfo {
  set: number;
  score: { us: number; them: number };
  serving: Side;
  rotation: number;
  onCourt: number[];
}

interface PromptPlayer {
  number: number;
  role: string;
  isLibero: boolean;
}

/** A coach-facing problem found while turning a batch into events; the UI words it from the textScout catalog. */
export type BatchIssue = { rally: number; blocking: boolean } & (
  | { kind: 'unknownNumber'; number: number }
  | { kind: 'missingGrade'; number: number; skill: Skill }
  | { kind: 'invalidGrade'; skill: Skill; grade: Grade }
  | { kind: 'conflictingWinner'; actions: Side; notes: Side }
  | { kind: 'noWinner' }
);

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const STOPWORDS = new Set(
  [
    // name particles
    'de', 'la', 'las', 'los', 'le', 'y', 'e', 'da', 'do', 'dos', 'das', 'di', 'van', 'von', 'der', 'du', 'des',
    // note and protocol tokens
    'to', 'us', 'them', 'ace', 'kill', 'set', 'opp', 'error', 'block', 'dig', 'serve', 'rec', 'point', 'pt',
  ].map(normalize),
);

const letterRuns = (s: string): string[] => s.match(/[\p{L}\p{M}]+/gu) ?? [];

/**
 * Replaces roster name parts (accent/case-insensitive, letter-only pieces, so
 * "Ana's" or "Ana-María" are covered) with `#number`; ambiguous parts become `#?`.
 */
export function anonymizeNames(text: string, roster: RosterEntry[]): string {
  const byPart = new Map<string, number | null>();
  for (const r of roster) {
    // The first part is the given name: always mapped, even if it is a stoplisted word.
    letterRuns(r.name.normalize('NFC')).forEach((piece, idx) => {
      const key = normalize(piece);
      if (key.length < 2 || (idx > 0 && STOPWORDS.has(key))) return;
      const existing = byPart.get(key);
      byPart.set(key, existing === undefined || existing === r.number ? r.number : null);
    });
  }
  const replaced = text.normalize('NFC').replace(/[\p{L}\p{M}]+/gu, (word) => {
    const n = byPart.get(normalize(word));
    if (n === undefined) return word;
    return n === null ? '#?' : `#${n}`;
  });
  return replaced.replace(/(#\d+)(?:[\s-]+\1)+\b/g, '$1');
}

/** Built from the app's own buttons so the prompt can never drift from them. */
const GRADE_TABLE = SKILLS.map(
  (s) => `${s} (${SKILL_LABELS[s]}): ${validGrades(s).map((g) => `"${g}" ${GRADE_LABELS[s][g]}`).join(', ')}`,
).join('\n');

export const SYSTEM_PROMPT = `You convert a volleyball coach's match notes about THEIR OWN team into JSON.
Players are identified only by jersey number ("#7" or "7"). "#?" means an unknown player: put that line in "unparsed".
Fundamentals (skill): S serve, R reception, A attack, B block, D dig, E set, F free ball.
Grades (DataVolley): "#" perfect/point (ace, kill, stuff block, perfect pass), "+" good, "!" ok, "-" poor, "/" overpass/blocked/free ball back, "=" error.
Everyday words for each fundamental (English, Spanish, French):
- A attack: smash, spike, hit, attack, remate, rematar, ataque, attaque, frappe
- S serve: serve, saque, sacar, service, servir
- R reception: pass, reception, receive, recepción, recibir, réception
- E set: set, setting, colocación, colocar, passe
- B block: block, bloqueo, bloquear, contre
- D dig: dig, defense, defensa, défense, save
- F free ball: free ball, freeball, bola fácil, balle facile
Result words -> grade:
- kill, point, punto, point gagnant, winner -> "#" (S# ace, A# kill, B# stuff block); ace -> S "#"
- out, fuera, dehors, long, wide, net, red, filet, error, fallo, faute -> "="
- blocked, bloqueado, contré (our attack) -> A "/"
- good, bien, bon -> "+"; bad, poor, mal, mauvais -> "-"
- overpass, over -> "/" for R, D or F
- easy, too easy, fácil, facile -> "-" (for S, R, D, F, E it means poor/easy)
- tough, hard, strong, difícil, difficile, pressure, presión -> "+" for S
- covered, cubierto, couvert -> A "!"
- tooled, tocada, block-out -> B "/" (from our block); touch, toque, touche -> B "+" (ours) unless the notes say theirs
- perfect, perfecto, parfait -> "#" for R, D, E, F
- ok, regular, moyen -> "!"
The app's own grade labels per fundamental (grade symbol, label):
${GRADE_TABLE}
When the notes use one of these labels or an obvious synonym, use that grade.
If the notes name the action but not its result, still output the action with "grade": null. Never put a line in unparsed just because the result is missing.
A rally ends with a point. Add "point" only when the notes say who won it and no action already decides it (S#, A#, B# win; any "=", A/ or B/ lose).
Point reasons (only for points not decided by our action): "oppError", "oppKill", "oppAce", "oppBlock", "unknown".
Substitutions like "8 in for 9" -> subs [{"outNumber":9,"inNumber":8}]. Timeouts "TO us"/"TO them" -> timeouts [{"team":"us"}].
Substitutions and timeouts that happen between rallies belong to the NEXT rally's entry (or an entry with no actions if none follows).
Never invent players or actions. Anything you cannot map goes verbatim into "unparsed".
Reply ONLY with JSON of this shape:
{"rallies":[{"actions":[{"number":7,"skill":"S","grade":"#"}],"point":{"winner":"us","reason":"oppError"},"subs":[],"timeouts":[]}],"unparsed":[]}`;

export function buildMessages(text: string, players: PromptPlayer[], anchor: AnchorInfo): ChatMessage[] {
  const context = {
    players,
    situation: {
      set: anchor.set,
      score: `${anchor.score.us}-${anchor.score.them}`,
      serving: anchor.serving,
      rotation: anchor.rotation,
      onCourt: anchor.onCourt,
    },
  };
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Context: ${JSON.stringify(context)}\nNotes:\n${text}` },
  ];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSide = (v: unknown): v is Side => v === 'us' || v === 'them';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
/** Models sometimes quote numbers ("7"); accept plain digit strings. */
const toNum = (v: unknown): unknown => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v);
const toSkill = (v: unknown): unknown => (typeof v === 'string' ? v.trim().toUpperCase() : v);

const MAX_RALLIES = 200;
const MAX_ACTIONS_PER_RALLY = 30;
const TOO_LARGE = 'Reply too large.';

export function parseBatch(raw: unknown): { ok: true; batch: ParsedBatch } | { ok: false; error: string } {
  if (!isObj(raw) || !Array.isArray(raw.rallies)) return { ok: false, error: 'Missing "rallies".' };
  if (raw.rallies.length > MAX_RALLIES) return { ok: false, error: TOO_LARGE };
  const rallies: ParsedRally[] = [];
  for (const r of raw.rallies) {
    if (!isObj(r)) return { ok: false, error: 'A rally is not an object.' };
    for (const key of ['actions', 'subs', 'timeouts'] as const) {
      if (r[key] !== undefined && r[key] !== null && !Array.isArray(r[key])) return { ok: false, error: `"${key}" must be an array.` };
    }
    if (r.point !== undefined && r.point !== null && !isObj(r.point)) return { ok: false, error: '"point" must be an object or null.' };
    const rawActions = Array.isArray(r.actions) ? r.actions : [];
    if (rawActions.length > MAX_ACTIONS_PER_RALLY) return { ok: false, error: TOO_LARGE };
    const actions: ParsedAction[] = [];
    for (const a of rawActions) {
      if (!isObj(a)) return { ok: false, error: `Invalid action ${JSON.stringify(a)}.` };
      const number = toNum(a.number);
      const skill = toSkill(a.skill);
      const grade = a.grade === undefined || a.grade === null ? null : a.grade;
      if (!isNum(number) || !SKILLS.includes(skill as Skill) || (grade !== null && !GRADES.includes(grade as Grade))) {
        return { ok: false, error: `Invalid action ${JSON.stringify(a)}.` };
      }
      actions.push({ number, skill: skill as Skill, grade: grade as Grade | null });
    }
    let point: ParsedRally['point'] = null;
    if (isObj(r.point)) {
      if (!isSide(r.point.winner)) return { ok: false, error: 'Invalid point winner.' };
      const rawReason = r.point.reason;
      const reason = POINT_REASONS[r.point.winner].find((x) => x === rawReason) ?? null;
      point = { winner: r.point.winner, reason };
    }
    const subs: ParsedRally['subs'] = [];
    for (const s of Array.isArray(r.subs) ? r.subs : []) {
      const outNumber = isObj(s) ? toNum(s.outNumber) : undefined;
      const inNumber = isObj(s) ? toNum(s.inNumber) : undefined;
      if (!isNum(outNumber) || !isNum(inNumber)) return { ok: false, error: 'Invalid substitution.' };
      subs.push({ outNumber, inNumber });
    }
    const timeouts: ParsedRally['timeouts'] = [];
    for (const t of Array.isArray(r.timeouts) ? r.timeouts : []) {
      if (!isObj(t) || !isSide(t.team)) return { ok: false, error: 'Invalid timeout.' };
      timeouts.push({ team: t.team });
    }
    rallies.push({ actions, point, subs, timeouts });
  }
  const unparsed = Array.isArray(raw.unparsed) ? raw.unparsed.filter((u): u is string => typeof u === 'string') : [];
  return { ok: true, batch: { rallies, unparsed } };
}

export function batchToPayloads(batch: ParsedBatch, roster: RosterEntry[]): { payloads: MatchEventPayload[]; issues: BatchIssue[] } {
  const byNumber = new Map(roster.map((r) => [r.number, r.playerId]));
  const payloads: MatchEventPayload[] = [];
  const issues: BatchIssue[] = [];
  const unknown = (rally: number, n: number) =>
    issues.push({ rally, kind: 'unknownNumber', blocking: true, number: n });

  batch.rallies.forEach((r, i) => {
    for (const s of r.subs) {
      const out = byNumber.get(s.outNumber);
      const inn = byNumber.get(s.inNumber);
      if (!out) unknown(i, s.outNumber);
      if (!inn) unknown(i, s.inNumber);
      if (out && inn) payloads.push({ type: 'sub', outPlayerId: out, inPlayerId: inn });
    }
    for (const t of r.timeouts) payloads.push({ type: 'timeout', team: t.team });
    let decided: Side | null = null;
    for (const a of r.actions) {
      const playerId = byNumber.get(a.number);
      if (a.grade === null) {
        issues.push({ rally: i, kind: 'missingGrade', blocking: true, number: a.number, skill: a.skill });
        if (!playerId) unknown(i, a.number);
        continue;
      }
      const gradeOk = validGrades(a.skill).includes(a.grade);
      if (!gradeOk) {
        issues.push({ rally: i, kind: 'invalidGrade', blocking: true, skill: a.skill, grade: a.grade });
      }
      if (!playerId) {
        unknown(i, a.number);
        continue;
      }
      if (!gradeOk) continue;
      payloads.push({ type: 'action', playerId, skill: a.skill, grade: a.grade });
      decided = rallyOutcome(a.skill, a.grade) ?? decided;
    }
    if (r.point) {
      if (decided && decided !== r.point.winner) {
        issues.push({ rally: i, kind: 'conflictingWinner', blocking: false, actions: decided, notes: r.point.winner });
      } else if (!decided) {
        payloads.push({ type: 'point', winner: r.point.winner, reason: r.point.reason });
      }
    } else if (r.actions.length > 0 && (!decided || r.actions[r.actions.length - 1].grade === null)) {
      // An ungraded last action may still decide the rally, so an earlier decision is not trusted.
      issues.push({ rally: i, kind: 'noWinner', blocking: false });
    }
  });
  return { payloads, issues };
}

/** Splits text by lines into chunks of at most `maxChars` (a single longer line stays whole). */
export function chunkText(text: string, maxChars = 1500): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

export function mergeBatches(batches: ParsedBatch[]): ParsedBatch {
  return { rallies: batches.flatMap((b) => b.rallies), unparsed: batches.flatMap((b) => b.unparsed) };
}
