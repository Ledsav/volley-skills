import { latestRosterIndex, UNKNOWN_PERSON } from '../teams/stats/rosterIndex';
import type { Match } from '../types/match';
import { rankAward } from './awardRules';
import { styleName } from './nameStyle';

export function matchMvpLabel(match: Match): string | null {
  const pick = match.awards?.picks.mvp;
  if (pick?.hidden) return null;
  const id = pick?.playerId ?? rankAward('mvp', 'match', [match]).ranked[0]?.playerId ?? null;
  if (!id) return null;
  const p = latestRosterIndex([match]).get(id) ?? UNKNOWN_PERSON(id);
  return `${p.number !== null ? `#${p.number} ` : ''}${styleName(p, 'firstInitial')}`;
}
