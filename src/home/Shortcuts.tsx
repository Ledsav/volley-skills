import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Plus, Trophy, type LucideIcon } from 'lucide-react';
import type { Access } from '../auth/access';
import { useT } from '../i18n/I18nProvider';
import { withPendingAction } from '../search/pendingAction';
import { teamActionPath } from '../search/localSources';
import type { Team } from '../types/team';
import { TeamPickerSheet } from './TeamPickerSheet';

/**
 * Starts a team-scoped create action from Today: one team goes straight there,
 * several ask which team first (the picker is returned as `picker`; render it once).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTeamAction(teams: Team[], action: 'new-match' | 'new-session'): { start: () => void; picker: ReactNode } {
  const navigate = useNavigate();
  const t = useT().home;
  const [picking, setPicking] = useState(false);

  const go = (team: Team) => navigate(teamActionPath(action, team.id), withPendingAction(action));

  return {
    start: () => {
      if (teams.length === 1) go(teams[0]);
      else if (teams.length > 1) setPicking(true);
    },
    picker: picking ? (
      <TeamPickerSheet
        title={t.pickTeam}
        teams={teams}
        onClose={() => setPicking(false)}
        onPick={(team) => {
          setPicking(false);
          go(team);
        }}
      />
    ) : null,
  };
}

function Tile({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[88px] flex-col items-start justify-between rounded-lg bg-surface p-4 text-left shadow-card pressable cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-3 text-ink-2">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="text-callout font-semibold text-ink">{label}</span>
    </button>
  );
}

/** The create shortcuts on Today. Each tile shows only when the person can use it; no tiles, no section. */
export function Shortcuts({ teams, access }: { teams: Team[]; access: Access | null }) {
  const t = useT().home.shortcuts;
  const navigate = useNavigate();
  const match = useTeamAction(teams, 'new-match');
  const canTrain = !!access?.sections.trainings;
  const canExercise = !!access?.sections.exercises;
  if (teams.length === 0 && !canTrain && !canExercise) return null;

  return (
    <section aria-labelledby="shortcuts" className="mb-6">
      <h2 id="shortcuts" className="mb-2 text-title-3 text-ink">{t.title}</h2>
      <div className="grid grid-cols-3 gap-3">
        {teams.length > 0 && <Tile icon={Trophy} label={t.newMatch} onClick={match.start} />}
        {canTrain && <Tile icon={Dumbbell} label={t.newTraining} onClick={() => navigate('/trainings', withPendingAction('new-training'))} />}
        {canExercise && <Tile icon={Plus} label={t.newExercise} onClick={() => navigate('/exercises', withPendingAction('new-exercise'))} />}
      </div>
      {match.picker}
    </section>
  );
}
