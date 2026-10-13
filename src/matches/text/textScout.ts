import { GRADES, SKILLS, type Grade, type MatchEventPayload, type PointReason, type RosterEntry, type Side, type Skill } from '../../types/match';
import { POINT_REASONS, rallyOutcome } from '../skillGrades';
import type { ChatMessage } from './aiClient';

export interface ParsedAction {
  number: number;
  skill: Skill;
  grade: Grade;
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

export interface AnchorInfo {
  set: number;
  score: { us: number; them: number };
  serving: Side;
  rotation: number;
  onCourt: number[];
}

export interface PromptPlayer {
  number: number;
  role: string;
  isLibero: boolean;
}

export interface BatchIssue {
  rally: number;
  kind: 'unknownNumber' | 'noWinner' | 'conflictingWinner';
  blocking: boolean;
  message: string;
}

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
    for (const piece of letterRuns(r.name.normalize('NFC'))) {
      const key = normalize(piece);
      if (key.length < 2 || STOPWORDS.has(key)) continue;
      const existing = byPart.get(key);
      byPart.set(key, existing === undefined || existing === r.number ? r.number : null);
    }
  }
  const replaced = text.normalize('NFC').replace(/[\p{L}\p{M}]+/gu, (word) => {
    const n = byPart.get(normalize(word));
    if (n === undefined) return word;
    return n === null ? '#?' : `#${n}`;
  });
  return replaced.replace(/(#\d+)(?:[\s-]+\1)+\b/g, '$1');
}

export const SYSTEM_PROMPT = `You convert a volleyball coach's match notes about THEIR OWN team into JSON.
Players are identified only by jersey number ("#7" or "7"). "#?" means an unknown player: put that line in "unparsed".
Fundamentals (skill): S serve, R reception, A attack, B block, D dig, E set, F free ball.
Grades (DataVolley): "#" perfect/point (ace, kill, stuff block, perfect pass), "+" good, "!" ok, "-" poor, "/" overpass/blocked/free ball back, "=" error.
A rally ends with a point. Add "point" only when the notes say who won it and no action already decides it (S#, A#, B# win; any "=", A/ or B/ lose).
Point reasons (only for points not decided by our action): "oppError", "oppKill", "oppAce", "oppBlock", "unknown".
Substitutions like "8 in for 9" -> subs [{"outNumber":9,"inNumber":8}]. Timeouts "TO us"/"TO them" -> timeouts [{"team":"us"}].
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

export function parseBatch(raw: unknown): { ok: true; batch: ParsedBatch } | { ok: false; error: string } {
  if (!isObj(raw) || !Array.isArray(raw.rallies)) return { ok: false, error: 'Missing "rallies".' };
  const rallies: ParsedRally[] = [];
  for (const r of raw.rallies) {
    if (!isObj(r)) return { ok: false, error: 'A rally is not an object.' };
    for (const key of ['actions', 'subs', 'timeouts'] as const) {
      if (r[key] !== undefined && !Array.isArray(r[key])) return { ok: false, error: `"${key}" must be an array.` };
    }
    if (r.point !== undefined && r.point !== null && !isObj(r.point)) return { ok: false, error: '"point" must be an object or null.' };
    const actions: ParsedAction[] = [];
    for (const a of Array.isArray(r.actions) ? r.actions : []) {
      if (!isObj(a) || !isNum(a.number) || !SKILLS.includes(a.skill as Skill) || !GRADES.includes(a.grade as Grade)) {
        return { ok: false, error: `Invalid action ${JSON.stringify(a)}.` };
      }
      actions.push({ number: a.number, skill: a.skill as Skill, grade: a.grade as Grade });
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
      if (!isObj(s) || !isNum(s.outNumber) || !isNum(s.inNumber)) return { ok: false, error: 'Invalid substitution.' };
      subs.push({ outNumber: s.outNumber, inNumber: s.inNumber });
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
    issues.push({ rally, kind: 'unknownNumber', blocking: true, message: `#${n} is not in this match's roster.` });

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
      if (!playerId) {
        unknown(i, a.number);
        continue;
      }
      payloads.push({ type: 'action', playerId, skill: a.skill, grade: a.grade });
      decided = rallyOutcome(a.skill, a.grade) ?? decided;
    }
    if (r.point) {
      if (decided && decided !== r.point.winner) {
        issues.push({ rally: i, kind: 'conflictingWinner', blocking: false, message: `The actions give the point to ${decided}, the notes to ${r.point.winner}.` });
      } else if (!decided) {
        payloads.push({ type: 'point', winner: r.point.winner, reason: r.point.reason });
      }
    } else if (!decided && r.actions.length > 0) {
      issues.push({ rally: i, kind: 'noWinner', blocking: false, message: 'No winner for this rally.' });
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
