import type { Match, MatchResult, MatchSummary, UsageContribution, UsageProfile } from '../types/match';
import { resultFromState, type MatchState } from './scoutEngine';
import { computeStats } from './scoutStats';
import { applyUsage, computeUsageContribution } from './usage';

export interface FinishPayload {
  summary: MatchSummary;
  usageContribution: UsageContribution;
  result: MatchResult;
  usageProfile: UsageProfile;
}

export function buildFinishPayload(match: Match, state: MatchState, profile: UsageProfile): FinishPayload {
  const usageContribution = computeUsageContribution(state);
  return {
    summary: computeStats(state, {}),
    usageContribution,
    result: resultFromState(state),
    usageProfile: applyUsage(profile, match.usageContribution, usageContribution),
  };
}
