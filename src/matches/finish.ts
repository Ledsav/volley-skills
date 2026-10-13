import type { Match, MatchReportData, MatchResult, MatchSummary, UsageContribution, UsageProfile } from '../types/match';
import { buildReportData } from './report/reportData';
import { resultFromState, type MatchState } from './scoutEngine';
import { applyUsage, computeUsageContribution } from './usage';

export interface FinishPayload {
  summary: MatchSummary;
  report: MatchReportData;
  usageContribution: UsageContribution;
  result: MatchResult;
  usageProfile: UsageProfile;
}

export function buildFinishPayload(match: Match, state: MatchState, profile: UsageProfile): FinishPayload {
  const usageContribution = computeUsageContribution(state);
  const report = buildReportData(state);
  return {
    summary: report.all,
    report,
    usageContribution,
    result: resultFromState(state),
    usageProfile: applyUsage(profile, match.usageContribution, usageContribution),
  };
}
