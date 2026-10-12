import { rallyOutcome } from './skillGrades';
import type { GradeCounts, MatchStats, PlayerStats, SkillLine, TeamStats } from '../types/match';
import type { MatchState } from './scoutEngine';

const emptyGrades = (): GradeCounts => ({ '#': 0, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0 });

function ratio(numerator: number, attempts: number): number | null {
  return attempts === 0 ? null : numerator / attempts;
}

function attackEff(line: SkillLine | undefined): number | null {
  if (!line) return null;
  return ratio(line.grades['#'] - line.grades['='] - line.grades['/'], line.attempts);
}

function serveEff(line: SkillLine | undefined): number | null {
  if (!line) return null;
  return ratio(line.grades['#'] - line.grades['='], line.attempts);
}

function mergeLines(lines: (SkillLine | undefined)[]): SkillLine | undefined {
  const present = lines.filter((l): l is SkillLine => !!l);
  if (present.length === 0) return undefined;
  const grades = emptyGrades();
  let attempts = 0;
  for (const l of present) {
    attempts += l.attempts;
    for (const g of Object.keys(grades) as (keyof GradeCounts)[]) grades[g] += l.grades[g];
  }
  return { attempts, grades };
}

export function computeStats(
  state: Pick<MatchState, 'actions' | 'rallies' | 'timeouts'>,
  scope: { set?: number },
): MatchStats {
  const inScope = <T extends { set: number }>(x: T) => scope.set === undefined || x.set === scope.set;
  const players: Record<string, PlayerStats> = {};
  const sourceCounts = { tap: 0, text: 0 };

  for (const a of state.actions.filter(inScope)) {
    const p = (players[a.playerId] ??= {
      playerId: a.playerId,
      skills: {},
      points: 0,
      errors: 0,
      attackEff: null,
      serveEff: null,
      receptionPos: null,
      receptionPerfect: null,
    });
    const line = (p.skills[a.skill] ??= { attempts: 0, grades: emptyGrades() });
    line.attempts += 1;
    line.grades[a.grade] += 1;
    const outcome = rallyOutcome(a.skill, a.grade);
    if (outcome === 'us') p.points += 1;
    if (outcome === 'them') p.errors += 1;
    sourceCounts[a.source === 'text' ? 'text' : 'tap'] += 1;
  }

  for (const p of Object.values(players)) {
    p.attackEff = attackEff(p.skills.A);
    p.serveEff = serveEff(p.skills.S);
    const r = p.skills.R;
    p.receptionPos = r ? ratio(r.grades['#'] + r.grades['+'], r.attempts) : null;
    p.receptionPerfect = r ? ratio(r.grades['#'], r.attempts) : null;
  }

  const team: TeamStats = {
    sideOut: { won: 0, total: 0 },
    breakPoint: { won: 0, total: 0 },
    oppErrorPoints: 0,
    rotations: {},
    weakestRotation: null,
    receptionPos: null,
    attackEff: null,
    aces: 0,
    serveErrors: 0,
  };

  const rallies = state.rallies.filter(inScope);
  for (const r of rallies) {
    const bucket = r.serving === 'them' ? team.sideOut : team.breakPoint;
    bucket.total += 1;
    if (r.winner === 'us') bucket.won += 1;
    const rot = (team.rotations[r.rotation] ??= { won: 0, lost: 0 });
    if (r.winner === 'us') rot.won += 1;
    else rot.lost += 1;
    if (r.reason === 'oppError') team.oppErrorPoints += 1;
  }

  let weakest: { rotation: number; diff: number } | null = null;
  for (const [rotation, { won, lost }] of Object.entries(team.rotations)) {
    const diff = won - lost;
    if (!weakest || diff < weakest.diff) weakest = { rotation: Number(rotation), diff };
  }
  team.weakestRotation = weakest ? weakest.rotation : null;

  const all = Object.values(players);
  const reception = mergeLines(all.map((p) => p.skills.R));
  team.receptionPos = reception ? ratio(reception.grades['#'] + reception.grades['+'], reception.attempts) : null;
  team.attackEff = attackEff(mergeLines(all.map((p) => p.skills.A)));
  const serve = mergeLines(all.map((p) => p.skills.S));
  team.aces = serve?.grades['#'] ?? 0;
  team.serveErrors = serve?.grades['='] ?? 0;

  const timeoutEffects = state.timeouts.filter(inScope).map((t) => {
    const next = state.rallies.filter((r) => r.set === t.set && r.index >= t.ralliesBefore).slice(0, 5);
    return {
      set: t.set,
      team: t.team,
      score: t.score,
      won: next.filter((r) => r.winner === 'us').length,
      lost: next.filter((r) => r.winner === 'them').length,
    };
  });

  return { players, team, timeoutEffects, sourceCounts };
}

export type LiveAlert =
  | { kind: 'playerErrors'; playerId: string; errors: number }
  | { kind: 'oppRun'; run: number };

const ERROR_ALERT = 3;
const RUN_ALERT = 3;

function setTally(state: Pick<MatchState, 'actions' | 'set'>) {
  const tally: Record<string, { points: number; errors: number }> = {};
  for (const a of state.actions) {
    if (a.set !== state.set) continue;
    const t = (tally[a.playerId] ??= { points: 0, errors: 0 });
    const outcome = rallyOutcome(a.skill, a.grade);
    if (outcome === 'us') t.points += 1;
    if (outcome === 'them') t.errors += 1;
  }
  return tally;
}

export function liveAlerts(state: Pick<MatchState, 'actions' | 'rallies' | 'set'>): LiveAlert[] {
  const alerts: LiveAlert[] = [];
  for (const [playerId, t] of Object.entries(setTally(state))) {
    if (t.errors >= ERROR_ALERT) alerts.push({ kind: 'playerErrors', playerId, errors: t.errors });
  }
  const setRallies = state.rallies.filter((r) => r.set === state.set);
  let run = 0;
  for (let i = setRallies.length - 1; i >= 0 && setRallies[i].winner === 'them'; i--) run += 1;
  if (run >= RUN_ALERT) alerts.push({ kind: 'oppRun', run });
  return alerts;
}

export function playerForm(state: Pick<MatchState, 'actions' | 'set'>, playerId: string): 'good' | 'bad' | null {
  const t = setTally(state)[playerId];
  if (!t) return null;
  if (t.errors >= ERROR_ALERT) return 'bad';
  if (t.points - t.errors >= 3) return 'good';
  return null;
}
