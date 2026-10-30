import type { Access } from '../auth/access';

export type StepId = 'team' | 'players' | 'coach' | 'session' | 'match';
export type WelcomeRowId = 'teams' | 'coaches' | 'sessions' | 'scouting' | 'library' | 'view';

/** `adminsAnyTeam` is true for a club admin or anyone whose Today team list is not empty. */
export interface Who {
  access: Access;
  adminsAnyTeam: boolean;
}

export interface StepFacts {
  teams: number;
  anyPlayers: boolean;
  members: number;
  anySession: boolean;
  anyMatch: boolean;
}

/** The first rows that apply to the person, up to four. */
export function welcomeRows({ access, adminsAnyTeam }: Who): WelcomeRowId[] {
  const rows: WelcomeRowId[] = [];
  if (access.isClubAdmin) rows.push('teams', 'coaches');
  if (access.isClubAdmin || adminsAnyTeam) rows.push('sessions', 'scouting');
  if (access.isClubAdmin || access.sections.exercises || access.sections.trainings) rows.push('library');
  const picked = rows.slice(0, 4);
  return picked.length > 0 ? picked : ['view'];
}

/** Steps in fixed order. A coach sees `players` only while no loaded team has players (unknown counts as none). */
export function checklistSteps({ access, adminsAnyTeam }: Who, facts: Pick<StepFacts, 'anyPlayers'> | null): StepId[] {
  if (access.isClubAdmin) return ['team', 'players', 'coach', 'session', 'match'];
  if (!adminsAnyTeam) return [];
  return facts?.anyPlayers ? ['session', 'match'] : ['players', 'session', 'match'];
}

export function stepDone(id: StepId, facts: StepFacts): boolean {
  switch (id) {
    case 'team': return facts.teams > 0;
    case 'players': return facts.anyPlayers;
    case 'coach': return facts.members >= 2;
    case 'session': return facts.anySession;
    case 'match': return facts.anyMatch;
  }
}
