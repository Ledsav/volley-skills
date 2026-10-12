import type { Skill, SkillCounts, UsageContribution, UsageProfile } from '../types/match';
import type { MatchState } from './scoutEngine';

export function computeUsageContribution(state: Pick<MatchState, 'actions'>): UsageContribution {
  const out: UsageContribution = {};
  for (const a of state.actions) {
    const counts = (out[a.playerId] ??= {});
    counts[a.skill] = (counts[a.skill] ?? 0) + 1;
  }
  return out;
}

function addCounts(totals: SkillCounts, delta: SkillCounts, sign: 1 | -1): SkillCounts {
  const next: SkillCounts = { ...totals };
  for (const [skill, value] of Object.entries(delta) as [Skill, number][]) {
    const v = (next[skill] ?? 0) + sign * value;
    if (v > 0) next[skill] = v;
    else delete next[skill];
  }
  return next;
}

/** Removes `previous` (if this match was finished before) and adds `next`. */
export function applyUsage(
  profile: UsageProfile,
  previous: UsageContribution | null,
  next: UsageContribution,
): UsageProfile {
  const players: UsageProfile['players'] = {};
  for (const [id, entry] of Object.entries(profile.players)) players[id] = { matches: entry.matches, totals: { ...entry.totals } };

  for (const [id, counts] of Object.entries(previous ?? {})) {
    const entry = players[id];
    if (!entry) continue;
    entry.matches = Math.max(0, entry.matches - 1);
    entry.totals = addCounts(entry.totals, counts, -1);
    if (entry.matches === 0) delete players[id];
  }
  for (const [id, counts] of Object.entries(next)) {
    const entry = (players[id] ??= { matches: 0, totals: {} });
    entry.matches += 1;
    entry.totals = addCounts(entry.totals, counts, 1);
  }
  return { players };
}
