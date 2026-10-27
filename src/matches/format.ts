import type { MatchEvent, RosterEntry } from '../types/match';
import { getT } from '../i18n/I18nProvider';
import { labelGrade, labelSkill } from './skillGrades';
import { formatPercent } from '../i18n/format';

export function fmtPct(x: number | null): string {
  return formatPercent(x);
}

export function fmtEff(x: number | null): string {
  if (x === null) return '—';
  const pct = Math.round(x * 100);
  return `${pct > 0 ? '+' : ''}${formatPercent(x)}`;
}

export function rosterMap(roster: RosterEntry[]): Map<string, RosterEntry> {
  return new Map(roster.map((r) => [r.playerId, r]));
}

export function playerLabel(entry: RosterEntry | undefined): string {
  return entry ? `#${entry.number}` : '#?';
}

/**
 * Names that fit a court tile: the first name, plus the surname initial when two
 * players share a first name, and the full name if that still clashes.
 */
export function shortNames(roster: RosterEntry[]): Map<string, string> {
  const words = (name: string) => name.trim().split(/\s+/).filter(Boolean);
  const first = (r: RosterEntry) => words(r.name)[0] ?? '';
  const initial = (r: RosterEntry) => {
    const w = words(r.name);
    return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0] ?? '';
  };
  const count = (key: (r: RosterEntry) => string, value: string) => roster.filter((r) => key(r) === value).length;
  return new Map(
    roster.map((r) => {
      if (count(first, first(r)) === 1) return [r.playerId, first(r)];
      if (count(initial, initial(r)) === 1) return [r.playerId, initial(r)];
      return [r.playerId, r.name.trim()];
    }),
  );
}

export function describeEvent(ev: MatchEvent, roster: Map<string, RosterEntry>): string {
  const t = getT();
  switch (ev.type) {
    case 'action':
      return `${playerLabel(roster.get(ev.playerId))} ${labelSkill(ev.skill)} ${ev.grade} ${labelGrade(ev.skill, ev.grade)}`.trim();
    case 'point':
      return t.matches.event.point(ev.winner, ev.reason ? t.labels.pointReason[ev.reason] : null);
    case 'sub':
      return t.matches.event.sub(playerLabel(roster.get(ev.inPlayerId)), playerLabel(roster.get(ev.outPlayerId)));
    case 'timeout':
      return t.matches.event.timeout(ev.team);
    case 'setStart':
      return t.matches.event.setStart(ev.set, ev.serving);
    case 'setEnd':
      return t.matches.event.setEnd(ev.set);
    case 'correction': {
      const parts: string[] = [];
      if (ev.score) parts.push(t.matches.event.correctionScore(ev.score.us, ev.score.them));
      if (ev.rotation !== null) parts.push(t.matches.event.correctionRotation(ev.rotation));
      if (ev.serving) parts.push(t.matches.event.correctionServing(ev.serving));
      return t.matches.event.correction(parts);
    }
  }
}
