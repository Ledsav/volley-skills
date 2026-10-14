import { DEFAULT_FORMAT, GRADES, type Grade, type Match, type PlayerStats, type Skill, type SkillLine } from '../types/match';
import { attackEff, serveEff, ratio } from '../matches/scoutStats';
import { rallyOutcome } from '../matches/skillGrades';

/** Builds a SkillLine from a grade string like "##+=": one char per action. */
export function line(grades: string): SkillLine {
  const counts = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  for (const g of grades) counts[g as Grade] += 1;
  return { attempts: grades.length, grades: counts };
}

/** PlayerStats from per-skill grade strings, points/errors derived like computeStats. */
export function player(playerId: string, skills: Partial<Record<Skill, string>>): PlayerStats {
  const lines: Partial<Record<Skill, SkillLine>> = {};
  let points = 0;
  let errors = 0;
  for (const [s, gs] of Object.entries(skills) as [Skill, string][]) {
    lines[s] = line(gs);
    for (const g of gs) {
      const o = rallyOutcome(s, g as Grade);
      if (o === 'us') points += 1;
      if (o === 'them') errors += 1;
    }
  }
  const r = lines.R;
  return {
    playerId, skills: lines, points, errors,
    attackEff: attackEff(lines.A), serveEff: serveEff(lines.S),
    receptionPos: r ? ratio(r.grades['#'] + r.grades['+'], r.attempts) : null,
    receptionPerfect: r ? ratio(r.grades['#'], r.attempts) : null,
  };
}

export function finished(id: string, date: string, players: PlayerStats[] | null, opts: Partial<Match> = {}): Match {
  return {
    id, date, opponent: `Opp ${id}`, competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT,
    roster: (players ?? []).map((p, i) => ({ playerId: p.playerId, number: i + 1, name: `Player ${p.playerId}`, positionCategory: 'OH' })),
    liberos: [], status: 'finished', result: { setsUs: 3, setsThem: 1, sets: [] },
    summary: players === null ? null : {
      players: Object.fromEntries(players.map((p) => [p.playerId, p])),
      team: {
        sideOut: { won: 10, total: 20 }, breakPoint: { won: 5, total: 20 }, oppErrorPoints: 4,
        rotations: { 1: { won: 4, lost: 2 }, 2: { won: 2, lost: 4 }, 3: { won: 3, lost: 3 }, 4: { won: 5, lost: 1 }, 5: { won: 1, lost: 5 }, 6: { won: 3, lost: 3 } },
        weakestRotation: 5, receptionPos: 0.5, attackEff: 0.2, aces: 3, serveErrors: 2,
      },
      timeoutEffects: [], sourceCounts: { tap: 0, text: 0 },
    },
    usageContribution: null, activeDevice: null, createdBy: '', createdAt: null, updatedAt: null,
    ...opts,
  };
}
