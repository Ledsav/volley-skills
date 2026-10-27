import { fmtEff, fmtPct } from '../matches/format';
import { attackEff, mergeLines, ratio, serveEff } from '../matches/scoutStats';
import { GRADE_WEIGHTS } from '../players/matchRating';
import type { AwardId, AwardScope } from '../types/awards';
import { GRADES, type Match, type PlayerStats, type Skill, type SkillLine } from '../types/match';
import { formatNumber } from '../i18n/format';

const MVP_QUALITY_WEIGHT = 0.5;

const BOTH: AwardId[] = ['topScorer', 'attacker', 'server', 'receiver', 'blocker', 'defender', 'setter'];
export const AWARDS_FOR: Record<AwardScope, AwardId[]> = {
  match: [...BOTH, 'mvp'],
  season: [...BOTH, 'mostImproved', 'everPresent', 'mvp'],
};

const MIN_ATTEMPTS_FOR: Partial<Record<AwardId, { match: number; season: number }>> = {
  attacker: { match: 8, season: 30 },
  server: { match: 8, season: 30 },
  receiver: { match: 8, season: 30 },
  defender: { match: 6, season: 25 },
  setter: { match: 10, season: 40 },
};

export interface Ranked { playerId: string; value: number; display: string; attempts: number | null; rank: number }
export interface AwardRanking { id: AwardId; ranked: Ranked[]; notEnoughData: string[] }

export function quality(l: SkillLine | undefined): number | null {
  if (!l || l.attempts === 0) return null;
  return GRADES.reduce((sum, g) => sum + l.grades[g] * GRADE_WEIGHTS[g], 0) / l.attempts;
}

const actionCount = (p: PlayerStats) => Object.values(p.skills).reduce((n, l) => n + (l?.attempts ?? 0), 0);
export const hasActions = (p: PlayerStats) => actionCount(p) > 0;

export function mvpScore(p: PlayerStats): number {
  let bonus = 0;
  for (const l of Object.values(p.skills)) {
    const q = quality(l);
    if (l && q !== null) bonus += l.attempts * (q - 0.5);
  }
  return p.points - p.errors + MVP_QUALITY_WEIGHT * bonus;
}

export function scoutedMatches(matches: Match[]): Match[] {
  return matches.filter((m) => m.summary && Object.values(m.summary.players).some(hasActions));
}

/** Per player: their PlayerStats in each scouted match they played, oldest first. */
function appearances(matches: Match[]): Map<string, PlayerStats[]> {
  const out = new Map<string, PlayerStats[]>();
  const sorted = [...scoutedMatches(matches)].sort((a, b) => a.date.localeCompare(b.date));
  for (const m of sorted) {
    for (const p of Object.values(m.summary!.players)) {
      if (actionCount(p) === 0) continue;
      out.set(p.playerId, [...(out.get(p.playerId) ?? []), p]);
    }
  }
  return out;
}

const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

export function mvpAverage(matches: Match[], playerId: string): number | null {
  return mean((appearances(matches).get(playerId) ?? []).map(mvpScore));
}

interface Candidate { playerId: string; value: number; tie: number; attempts: number | null; display: string }

const merged = (games: PlayerStats[], skills: Skill[]) => mergeLines(games.flatMap((g) => skills.map((s) => g.skills[s])));
const sum = (games: PlayerStats[], f: (p: PlayerStats) => number) => games.reduce((n, g) => n + f(g), 0);
const rating = (q: number) => `rating ${formatNumber(1 + 9 * q, 1)}`;

/** Ranks every player for one award; ties on value and tie-break share a rank. */
export function rankAward(id: AwardId, scope: AwardScope, matches: Match[]): AwardRanking {
  if (scope === 'match' && (id === 'mostImproved' || id === 'everPresent')) return { id, ranked: [], notEnoughData: [] };
  const apps = appearances(matches);
  const scoutedCount = scoutedMatches(matches).length;
  const min = MIN_ATTEMPTS_FOR[id]?.[scope] ?? 0;
  const candidates: Candidate[] = [];
  const notEnoughData: string[] = [];

  const byAttempts = (playerId: string, l: SkillLine | undefined, value: (l: SkillLine) => number | null, tie: number, display: (v: number) => string) => {
    if (!l || l.attempts === 0) return;
    if (l.attempts < min) {
      notEnoughData.push(playerId);
      return;
    }
    const v = value(l);
    if (v !== null) candidates.push({ playerId, value: v, tie, attempts: l.attempts, display: display(v) });
  };

  for (const [playerId, games] of apps) {
    const points = sum(games, (g) => g.points);
    const errors = sum(games, (g) => g.errors);
    switch (id) {
      case 'mvp': {
        if (scope === 'season' && games.length < Math.ceil(scoutedCount / 2)) {
          notEnoughData.push(playerId);
          break;
        }
        const v = mean(games.map(mvpScore))!;
        // tie-break: fewer errors, then more points → encode as -errors * 1000 + points
        candidates.push({ playerId, value: v, tie: -errors * 1000 + points, attempts: null, display: `${formatNumber(v, 1)} MVP pts${scope === 'season' ? '/match' : ''}` });
        break;
      }
      case 'topScorer':
        if (points > 0) candidates.push({ playerId, value: points, tie: -errors, attempts: null, display: `${points} pts` });
        break;
      case 'attacker': {
        const l = merged(games, ['A']);
        byAttempts(playerId, l, (x) => attackEff(x), l?.grades['#'] ?? 0, (v) => `${fmtEff(v)} att. eff.`);
        break;
      }
      case 'server': {
        const l = merged(games, ['S']);
        byAttempts(playerId, l, (x) => serveEff(x), l?.grades['#'] ?? 0, (v) => `${fmtEff(v)} serve eff.`);
        break;
      }
      case 'receiver': {
        const l = merged(games, ['R']);
        byAttempts(playerId, l, (x) => ratio(x.grades['#'] + x.grades['+'], x.attempts), l?.grades['#'] ?? 0, (v) => `${fmtPct(v)} rec. +`);
        break;
      }
      case 'blocker': {
        const l = merged(games, ['B']);
        const kills = l?.grades['#'] ?? 0;
        if (kills >= 1) candidates.push({ playerId, value: kills, tie: -((l?.grades['='] ?? 0) + (l?.grades['/'] ?? 0)), attempts: l!.attempts, display: `${kills} block${kills === 1 ? '' : 's'}` });
        break;
      }
      case 'defender': {
        const l = merged(games, ['D', 'F']);
        byAttempts(playerId, l, quality, l?.attempts ?? 0, rating);
        break;
      }
      case 'setter': {
        const l = merged(games, ['E']);
        byAttempts(playerId, l, quality, l?.attempts ?? 0, rating);
        break;
      }
      case 'mostImproved': {
        if (games.length < 6) break;
        const third = Math.floor(games.length / 3);
        const first = mean(games.slice(0, third).map(mvpScore))!;
        const last = mean(games.slice(-third).map(mvpScore))!;
        const delta = last - first;
        if (delta > 0) candidates.push({ playerId, value: delta, tie: last, attempts: null, display: `+${formatNumber(delta, 1)} MVP pts/match` });
        break;
      }
      case 'everPresent':
        candidates.push({ playerId, value: games.length, tie: sum(games, actionCount), attempts: null, display: `${games.length} match${games.length === 1 ? '' : 'es'}` });
        break;
    }
  }

  candidates.sort((a, b) => b.value - a.value || b.tie - a.tie);
  const ranked: Ranked[] = [];
  candidates.forEach((c, i) => {
    const prev = candidates[i - 1];
    const rank = prev && prev.value === c.value && prev.tie === c.tie ? ranked[i - 1].rank : i + 1;
    ranked.push({ playerId: c.playerId, value: c.value, display: c.display, attempts: c.attempts, rank });
  });
  return { id, ranked, notEnoughData };
}
