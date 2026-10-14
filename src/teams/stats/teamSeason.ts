import { mvpAverage, scoutedMatches } from '../../awards/awardRules';
import { FINISHED_MATCHES_CAP } from '../../matches/matchesApi';
import { attackEff, mergeLines, ratio } from '../../matches/scoutStats';
import { matchRatings, seasonStats, type MatchRatings } from '../../players/matchRating';
import type { Competition, HomeAway, Match, PlayerStats } from '../../types/match';
import { UNKNOWN_PERSON, type Person } from './rosterIndex';

export type StatsRange = { kind: 'season' } | { kind: 'last'; count: 5 | 10 } | { kind: 'dates'; from: string; to: string };
export interface StatsFilter { competition: Competition | 'all'; range: StatsRange; homeAway: HomeAway | 'all' }
export const DEFAULT_FILTER: StatsFilter = { competition: 'all', range: { kind: 'season' }, homeAway: 'all' };

export interface Coverage { scouted: number; scoreOnly: number; skipped: number; capped: boolean }

const hasActions = (p: PlayerStats) => Object.values(p.skills).some((l) => !!l && l.attempts > 0);

export function seasonCoverage(all: Match[]): Coverage {
  let scouted = 0, scoreOnly = 0, skipped = 0;
  for (const m of all) {
    if (!m.summary) skipped += 1;
    else if (Object.values(m.summary.players).some(hasActions)) scouted += 1;
    else scoreOnly += 1;
  }
  return { scouted, scoreOnly, skipped, capped: all.length >= FINISHED_MATCHES_CAP };
}

export function filterMatches(matches: Match[], f: StatsFilter): Match[] {
  let out = [...matches]
    .filter((m) => f.competition === 'all' || m.competition === f.competition)
    .filter((m) => f.homeAway === 'all' || m.homeAway === f.homeAway)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (f.range.kind === 'dates') {
    const { from, to } = f.range;
    out = out.filter((m) => m.date >= from && m.date <= to);
  }
  if (f.range.kind === 'last') {
    const count = f.range.count;
    const scouted = new Set(scoutedMatches(out).map((m) => m.id));
    out = out.filter((m) => scouted.has(m.id)).slice(-count).reverse();
  }
  return out;
}

export interface TeamPlayerRow {
  playerId: string; number: number | null; name: string; current: boolean;
  matchesPlayed: number; points: number; errors: number; mvpAvg: number | null;
  attackEff: number | null; serveEff: number | null; receptionPos: number | null; ratings: MatchRatings;
}
export interface TrendPoint { matchId: string; date: string; opponent: string; won: boolean; sideOut: number | null; attackEff: number | null; receptionPos: number | null }
export interface TeamSeason {
  record: { won: number; lost: number; setsWon: number; setsLost: number };
  sideOut: number | null; breakPoint: number | null; attackEff: number | null; receptionPos: number | null;
  aces: number; serveErrors: number; oppErrorPoints: number;
  rotations: Record<number, { won: number; lost: number }>;
  bestRotation: number | null; weakestRotation: number | null;
  trend: TrendPoint[]; players: TeamPlayerRow[];
}

export function teamSeason(matches: Match[], people: Map<string, Person>): TeamSeason {
  const record = { won: 0, lost: 0, setsWon: 0, setsLost: 0 };
  for (const m of matches) {
    record.setsWon += m.result.setsUs;
    record.setsLost += m.result.setsThem;
    if (m.result.setsUs > m.result.setsThem) record.won += 1;
    else if (m.result.setsThem > m.result.setsUs) record.lost += 1;
  }
  const withSummary = matches.filter((m) => m.summary).sort((a, b) => a.date.localeCompare(b.date));
  const so = { won: 0, total: 0 }, bp = { won: 0, total: 0 };
  let aces = 0, serveErrors = 0, oppErrorPoints = 0;
  const rotations: Record<number, { won: number; lost: number }> = {};
  for (let r = 1; r <= 6; r++) rotations[r] = { won: 0, lost: 0 };
  for (const m of withSummary) {
    const t = m.summary!.team;
    so.won += t.sideOut.won; so.total += t.sideOut.total;
    bp.won += t.breakPoint.won; bp.total += t.breakPoint.total;
    aces += t.aces; serveErrors += t.serveErrors; oppErrorPoints += t.oppErrorPoints;
    for (const [r, v] of Object.entries(t.rotations)) {
      rotations[Number(r)].won += v.won;
      rotations[Number(r)].lost += v.lost;
    }
  }
  const allPlayers = withSummary.flatMap((m) => Object.values(m.summary!.players));
  const attack = mergeLines(allPlayers.map((p) => p.skills.A));
  const reception = mergeLines(allPlayers.map((p) => p.skills.R));

  const rates = Object.entries(rotations)
    .filter(([, v]) => v.won + v.lost > 0)
    .map(([r, v]) => ({ r: Number(r), rate: v.won / (v.won + v.lost) }));
  const best = rates.length ? rates.reduce((a, b) => (b.rate > a.rate ? b : a)).r : null;
  const weakest = rates.length ? rates.reduce((a, b) => (b.rate < a.rate ? b : a)).r : null;

  const ids = new Set(allPlayers.filter(hasActions).map((p) => p.playerId));
  const players: TeamPlayerRow[] = [...ids].map((playerId) => {
    const s = seasonStats(withSummary, playerId);
    const person = people.get(playerId) ?? UNKNOWN_PERSON(playerId);
    return {
      playerId, number: person.number, name: person.name, current: person.current,
      matchesPlayed: s.matchesPlayed, points: s.points, errors: s.errors, mvpAvg: mvpAverage(withSummary, playerId),
      attackEff: s.attackEff, serveEff: s.serveEff, receptionPos: s.receptionPos, ratings: matchRatings(s),
    };
  }).sort((a, b) => (a.number ?? 999) - (b.number ?? 999));

  return {
    record,
    sideOut: ratio(so.won, so.total), breakPoint: ratio(bp.won, bp.total),
    attackEff: attackEff(attack),
    receptionPos: reception ? ratio(reception.grades['#'] + reception.grades['+'], reception.attempts) : null,
    aces, serveErrors, oppErrorPoints, rotations, bestRotation: best, weakestRotation: weakest,
    trend: withSummary.map((m) => ({
      matchId: m.id, date: m.date, opponent: m.opponent, won: m.result.setsUs > m.result.setsThem,
      sideOut: ratio(m.summary!.team.sideOut.won, m.summary!.team.sideOut.total),
      attackEff: m.summary!.team.attackEff, receptionPos: m.summary!.team.receptionPos,
    })),
    players,
  };
}
