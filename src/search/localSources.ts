import { Plus, UserPlus } from 'lucide-react';
import type { Access } from '../auth/access';
import { getT } from '../i18n/I18nProvider';
import { goToDestinations } from '../layout/navModel';
import type { PendingActionId, SearchItem } from './types';

/** "Go to": every page the person can reach, from the one list the sidebar also renders. */
export function goToItems(access: Access | null, isPlatformAdmin: boolean): SearchItem[] {
  return goToDestinations(access, isPlatformAdmin).map((d) => ({
    id: d.to,
    group: 'goto',
    label: d.label,
    to: d.to,
    icon: d.Icon,
  }));
}

/** Where a team-scoped action lands once a team is chosen. */
export function teamActionPath(action: PendingActionId, teamId: string): string {
  return `/teams/${teamId}?tab=${action === 'add-player' ? 'roster' : 'matches'}`;
}

/**
 * Create actions the person may perform. `adminsATeam` says there is at least one team they can act on
 * (or the club does), which is what "New match" and "Add player" need; the team picker then
 * only offers teams they can act on (club admin: all; otherwise `listMyTeams`, i.e. isTeamAdmin).
 * `aiEnabled` is accepted for the AI actions Plan 3 adds.
 */
export function actionItems(access: Access | null, _aiEnabled: boolean, adminsATeam = false): SearchItem[] {
  const t = getT().search.actions;
  const items: SearchItem[] = [];
  if (access?.isClubAdmin) items.push({ id: 'new-team', group: 'actions', label: t.newTeam, to: '/teams', icon: Plus, action: 'new-team' });
  if (access?.sections.trainings) items.push({ id: 'new-training', group: 'actions', label: t.newTraining, to: '/trainings', icon: Plus, action: 'new-training' });
  if (access?.sections.exercises) items.push({ id: 'new-exercise', group: 'actions', label: t.newExercise, to: '/exercises', icon: Plus, action: 'new-exercise' });
  if (adminsATeam) {
    items.push({ id: 'new-match', group: 'actions', label: t.newMatch, icon: Plus, pick: 'team', action: 'new-match' });
    items.push({ id: 'add-player', group: 'actions', label: t.addPlayer, icon: UserPlus, pick: 'team', action: 'add-player' });
  }
  return items;
}
