// src/awards/story/storyStats.ts
import { WEAK_RECEPTION_POS } from '../../matches/statFlags';
import type { Person } from '../../teams/stats/rosterIndex';
import { teamSeason, type TeamSeason } from '../../teams/stats/teamSeason';
import type { AwardScope } from '../../types/awards';
import type { Match } from '../../types/match';
import { getT } from '../../i18n/I18nProvider';

/** One big-number story slide. `big` counts up; `bigSuffix` is appended ("%", "–1"). */
export interface StoryStat {
  id: 'record' | 'strength' | 'rotation';
  kicker: string;
  big: number;
  bigSuffix: string;
  caption: string;
  detail: string | null;
}

const MIN_ROTATION_RALLIES = 20;

const pct = (x: number) => Math.round(x * 100);
const story = () => getT().awards.story;

function recordStat(scope: AwardScope, matches: Match[], s: TeamSeason): StoryStat | null {
  if (scope === 'match') {
    const m = matches[0];
    return {
      id: 'record', kicker: story().finalScore, big: m.result.setsUs, bigSuffix: `–${m.result.setsThem}`,
      caption: story().vsOpponent(m.opponent),
      detail: m.result.sets.length ? m.result.sets.map((x) => `${x.us}–${x.them}`).join(' · ') : null,
    };
  }
  if (s.record.won === 0) return null; // story slides stay positive
  return {
    id: 'record', kicker: story().thisSeason, big: s.record.won, bigSuffix: '',
    caption: story().wins(s.record.won, matches.length),
    detail: story().sets(s.record.setsWon, s.record.setsLost),
  };
}

function strengthStat(s: TeamSeason): StoryStat | null {
  const candidates: { score: number; stat: StoryStat }[] = [];
  if (s.sideOut !== null && s.sideOut - 0.5 > 0) {
    candidates.push({ score: s.sideOut - 0.5, stat: { id: 'strength', kicker: story().sideOut, big: pct(s.sideOut), bigSuffix: '%', caption: story().sideOutCaption, detail: null } });
  }
  if (s.receptionPos !== null && s.receptionPos - WEAK_RECEPTION_POS > 0) {
    candidates.push({ score: s.receptionPos - WEAK_RECEPTION_POS, stat: { id: 'strength', kicker: story().reception, big: pct(s.receptionPos), bigSuffix: '%', caption: story().receptionCaption, detail: null } });
  }
  if (candidates.length) return candidates.reduce((a, b) => (b.score > a.score ? b : a)).stat;
  if (s.aces > 0) return { id: 'strength', kicker: story().fromServiceLine, big: s.aces, bigSuffix: '', caption: story().aces(s.aces), detail: null };
  return null;
}

function rotationStat(s: TeamSeason): StoryStat | null {
  if (s.bestRotation === null) return null;
  const v = s.rotations[s.bestRotation];
  const rallies = v.won + v.lost;
  if (rallies < MIN_ROTATION_RALLIES) return null;
  return {
    id: 'rotation', kicker: story().rotation(s.bestRotation), big: pct(v.won / rallies), bigSuffix: '%',
    caption: story().rotationCaption, detail: story().rotationDetail(v.won, rallies),
  };
}

/** The story slides' numbers, in order; any slide without enough data is left out. */
export function storyStats(scope: AwardScope, matches: Match[], people: Map<string, Person>): StoryStat[] {
  if (matches.length === 0) return [];
  const s = teamSeason(matches, people);
  const out = [recordStat(scope, matches, s), strengthStat(s), scope === 'season' ? rotationStat(s) : null];
  return out.filter((x): x is StoryStat => x !== null);
}
