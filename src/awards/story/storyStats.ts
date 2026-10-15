// src/awards/story/storyStats.ts
import { WEAK_RECEPTION_POS } from '../../matches/statFlags';
import type { Person } from '../../teams/stats/rosterIndex';
import { teamSeason, type TeamSeason } from '../../teams/stats/teamSeason';
import type { AwardScope } from '../../types/awards';
import type { Match } from '../../types/match';

/** One big-number story slide. `big` counts up; `bigSuffix` is appended ("%", "–1"). */
export interface StoryStat {
  id: 'record' | 'strength' | 'rotation';
  kicker: string;
  big: number;
  bigSuffix: string;
  caption: string;
  detail: string | null;
}

export const MIN_ROTATION_RALLIES = 20;

const pct = (x: number) => Math.round(x * 100);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function recordStat(scope: AwardScope, matches: Match[], s: TeamSeason): StoryStat | null {
  if (scope === 'match') {
    const m = matches[0];
    return {
      id: 'record', kicker: 'Final score', big: m.result.setsUs, bigSuffix: `–${m.result.setsThem}`,
      caption: `vs ${m.opponent}`,
      detail: m.result.sets.length ? m.result.sets.map((x) => `${x.us}–${x.them}`).join(' · ') : null,
    };
  }
  if (s.record.won === 0) return null; // story slides stay positive
  return {
    id: 'record', kicker: 'This season', big: s.record.won, bigSuffix: '',
    caption: `${plural(s.record.won, 'win', 'wins')} out of ${matches.length} ${plural(matches.length, 'match', 'matches')}`,
    detail: `Sets ${s.record.setsWon}–${s.record.setsLost}`,
  };
}

function strengthStat(s: TeamSeason): StoryStat | null {
  const candidates: { score: number; stat: StoryStat }[] = [];
  if (s.sideOut !== null && s.sideOut - 0.5 > 0) {
    candidates.push({ score: s.sideOut - 0.5, stat: { id: 'strength', kicker: 'Side-out', big: pct(s.sideOut), bigSuffix: '%', caption: 'of rallies won on the opponent’s serve', detail: null } });
  }
  if (s.receptionPos !== null && s.receptionPos - WEAK_RECEPTION_POS > 0) {
    candidates.push({ score: s.receptionPos - WEAK_RECEPTION_POS, stat: { id: 'strength', kicker: 'Reception', big: pct(s.receptionPos), bigSuffix: '%', caption: 'of serves received on target', detail: null } });
  }
  if (candidates.length) return candidates.reduce((a, b) => (b.score > a.score ? b : a)).stat;
  if (s.aces > 0) return { id: 'strength', kicker: 'From the service line', big: s.aces, bigSuffix: '', caption: plural(s.aces, 'ace', 'aces'), detail: null };
  return null;
}

function rotationStat(s: TeamSeason): StoryStat | null {
  if (s.bestRotation === null) return null;
  const v = s.rotations[s.bestRotation];
  const rallies = v.won + v.lost;
  if (rallies < MIN_ROTATION_RALLIES) return null;
  return {
    id: 'rotation', kicker: `Rotation ${s.bestRotation}`, big: pct(v.won / rallies), bigSuffix: '%',
    caption: 'of its rallies won — the strongest rotation', detail: `${v.won} of ${rallies} rallies`,
  };
}

/** The story slides' numbers, in order; any slide without enough data is left out. */
export function storyStats(scope: AwardScope, matches: Match[], people: Map<string, Person>): StoryStat[] {
  if (matches.length === 0) return [];
  const s = teamSeason(matches, people);
  const out = [recordStat(scope, matches, s), strengthStat(s), scope === 'season' ? rotationStat(s) : null];
  return out.filter((x): x is StoryStat => x !== null);
}
