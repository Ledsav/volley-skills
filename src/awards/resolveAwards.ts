import { UNKNOWN_PERSON, type Person } from '../teams/stats/rosterIndex';
import type { AwardId, AwardScope, AwardsInput, CustomAward } from '../types/awards';
import type { Match } from '../types/match';
import { AWARDS_FOR, rankAward, type Ranked } from './awardRules';
import { getT } from '../i18n/I18nProvider';

export interface ResolvedAward {
  key: string; title: string; kind: 'stats' | 'custom';
  winner: Person | null; statLine: string | null;
  suggested: Ranked | null; runnersUp: Ranked[];
  overridden: boolean; hidden: boolean; note: string;
}

export function defaultOrder(scope: AwardScope, custom: CustomAward[]): string[] {
  const stats = AWARDS_FOR[scope].filter((id) => id !== 'mvp');
  return [...stats, ...custom.map((c) => c.id), 'mvp'];
}

const statLine = (r: Ranked) => `${r.display}${r.attempts !== null ? ` · ${r.attempts} att.` : ''}`;

export function resolveAwards(scope: AwardScope, matches: Match[], config: AwardsInput | null, people: Map<string, Person>): ResolvedAward[] {
  const cfg = config ?? { picks: {}, custom: [], order: [] };
  const person = (id: string) => people.get(id) ?? UNKNOWN_PERSON(id);
  const byKey = new Map<string, ResolvedAward>();

  for (const id of AWARDS_FOR[scope]) {
    const ranking = rankAward(id, scope, matches);
    const suggested = ranking.ranked[0] ?? null;
    const pick = cfg.picks[id as AwardId];
    const chosenId = pick?.playerId ?? suggested?.playerId ?? null;
    const overridden = !!pick?.playerId && pick.playerId !== suggested?.playerId;
    byKey.set(id, {
      // TODO(i18n T8): teamGender(team)
      key: id, title: getT().labels.awardTitle[id]('mixed'), kind: 'stats',
      winner: chosenId ? person(chosenId) : null,
      statLine: !overridden && suggested ? statLine(suggested) : null,
      suggested, runnersUp: ranking.ranked.slice(1, 3),
      overridden, hidden: !!pick?.hidden, note: '',
    });
  }
  for (const c of cfg.custom) {
    byKey.set(c.id, {
      key: c.id, title: c.title, kind: 'custom', winner: person(c.playerId), statLine: null,
      suggested: null, runnersUp: [], overridden: false, hidden: false, note: c.note,
    });
  }

  const saved = cfg.order.filter((k) => byKey.has(k));
  const order = [...saved, ...defaultOrder(scope, cfg.custom).filter((k) => !saved.includes(k))];
  return order.map((k) => byKey.get(k)!);
}

export function revealable(awards: ResolvedAward[]): ResolvedAward[] {
  return awards.filter((a) => !a.hidden && a.winner !== null);
}
