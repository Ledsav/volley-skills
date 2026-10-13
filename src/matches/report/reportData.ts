import type { MatchReportData, MatchStats } from '../../types/match';
import type { MatchState } from '../scoutEngine';
import { computeStats } from '../scoutStats';

export function buildReportData(state: MatchState): MatchReportData {
  const sets = Array.from(new Set(state.rallies.map((r) => r.set).concat(state.actions.map((a) => a.set)))).sort(
    (a, b) => a - b,
  );
  const bySet: Record<number, MatchStats> = {};
  for (const set of sets) bySet[set] = computeStats(state, { set });
  return {
    setsWon: state.setsWon,
    setScores: state.setScores,
    sets,
    all: computeStats(state, {}),
    bySet,
  };
}
