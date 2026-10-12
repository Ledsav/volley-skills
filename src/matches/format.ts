import { POINT_REASON_LABELS, type MatchEvent, type RosterEntry } from '../types/match';
import { GRADE_LABELS, SKILL_LABELS } from './skillGrades';

export function fmtPct(x: number | null): string {
  return x === null ? '—' : `${Math.round(x * 100)}%`;
}

export function fmtEff(x: number | null): string {
  if (x === null) return '—';
  const pct = Math.round(x * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

export function rosterMap(roster: RosterEntry[]): Map<string, RosterEntry> {
  return new Map(roster.map((r) => [r.playerId, r]));
}

export function playerLabel(entry: RosterEntry | undefined): string {
  return entry ? `#${entry.number}` : '#?';
}

export function describeEvent(ev: MatchEvent, roster: Map<string, RosterEntry>): string {
  switch (ev.type) {
    case 'action':
      return `${playerLabel(roster.get(ev.playerId))} ${SKILL_LABELS[ev.skill]} ${ev.grade} ${GRADE_LABELS[ev.skill][ev.grade] ?? ''}`.trim();
    case 'point':
      return `Point ${ev.winner}${ev.reason ? ` · ${POINT_REASON_LABELS[ev.reason]}` : ''}`;
    case 'sub':
      return `Sub ${playerLabel(roster.get(ev.inPlayerId))} in for ${playerLabel(roster.get(ev.outPlayerId))}`;
    case 'timeout':
      return `Timeout ${ev.team}`;
    case 'setStart':
      return `Set ${ev.set} · ${ev.serving === 'us' ? 'we serve' : 'they serve'}`;
    case 'setEnd':
      return `Set ${ev.set} end`;
    case 'correction': {
      const parts: string[] = [];
      if (ev.score) parts.push(`score ${ev.score.us}–${ev.score.them}`);
      if (ev.rotation !== null) parts.push(`rotation ${ev.rotation}`);
      if (ev.serving) parts.push(ev.serving === 'us' ? 'we serve' : 'they serve');
      return `Correction · ${parts.join(', ')}`;
    }
  }
}
