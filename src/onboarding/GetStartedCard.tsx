import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ListRow } from '../components/GroupedList';
import { Menu } from '../components/Menu';
import { useUndoable } from '../components/Notice';
import { useTeamAction } from '../home/Shortcuts';
import { useT } from '../i18n/I18nProvider';
import { withPendingAction } from '../search/pendingAction';
import type { Team } from '../types/team';
import { checklistSteps, stepDone, type StepId } from './steps';
import { useStepFacts } from './useStepFacts';

function Dot({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${done ? 'bg-ink text-on-ink' : 'border-2 border-ink-3'}`}
    >
      {done && <Check size={12} strokeWidth={3} />}
    </span>
  );
}

/**
 * The Get started checklist on Today. Steps tick themselves off from real data and keep their order.
 * When the facts first come back all done, the card shows its completion line this once and hides itself.
 */
export function GetStartedCard({ teams, adminsAnyTeam }: { teams: Team[]; adminsAnyTeam: boolean }) {
  const { onboarding, updateOnboarding, access, activeClubId } = useAuth();
  const t = useT().onboarding.checklist;
  const navigate = useNavigate();
  const undoable = useUndoable();
  const players = useTeamAction(teams, 'add-player');
  const session = useTeamAction(teams, 'new-session');
  const match = useTeamAction(teams, 'new-match');
  // Local state changes at once, so a pending or rejected write never brings the card back.
  const [hiddenLocal, setHiddenLocal] = useState(false);
  const [ready, setReady] = useState(false);
  const written = useRef(false);

  const who = access ? { access, adminsAnyTeam } : null;
  const hiddenInState = !!activeClubId && !!onboarding?.hiddenChecklists.includes(activeClubId);
  // The first pass decides which facts to read; the second, with the facts, may drop the players step.
  const wanted = who ? checklistSteps(who, null) : [];
  const enabled = !!onboarding && !!activeClubId && !hiddenInState && !hiddenLocal && wanted.length > 0;
  const facts = useStepFacts(teams, wanted, enabled);
  const steps = who && facts ? checklistSteps(who, facts) : [];
  const allDone = !!facts && steps.length > 0 && steps.every((id) => stepDone(id, facts));

  useEffect(() => {
    if (!allDone || !enabled || !activeClubId || written.current) return;
    written.current = true;
    setReady(true);
    void Promise.resolve(updateOnboarding({ kind: 'hideChecklist', clubId: activeClubId })).catch(() => {});
  }, [allDone, enabled, activeClubId, updateOnboarding]);

  if (ready) {
    return (
      <section role="status" className="mb-6 flex items-center gap-3 rounded-lg bg-surface p-4 shadow-card">
        <Dot done />
        <p className="text-headline text-ink">{access?.isClubAdmin ? t.readyClub : t.readyYou}</p>
      </section>
    );
  }
  if (!enabled || !facts || steps.length === 0) return null;

  const done = steps.filter((id) => stepDone(id, facts)).length;
  const start: Record<StepId, () => void> = {
    team: () => navigate('/teams', withPendingAction('new-team')),
    players: players.start,
    coach: () => navigate('/club?tab=people'),
    session: session.start,
    match: match.start,
  };
  const hide = () => {
    if (!activeClubId) return;
    setHiddenLocal(true);
    undoable({
      message: t.hidden,
      commit: () => updateOnboarding({ kind: 'hideChecklist', clubId: activeClubId }),
      onUndo: () => setHiddenLocal(false),
    });
  };

  return (
    <section aria-labelledby="get-started" className="mb-6 overflow-hidden rounded-lg bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 pt-3">
        <h2 id="get-started" className="text-headline text-ink">{t.title}</h2>
        <span className="text-footnote tabular-nums text-ink-2">{t.progress(done, steps.length)}</span>
        <Menu
          label={t.more}
          trigger={<MoreHorizontal size={18} aria-hidden="true" />}
          triggerClassName="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-surface-3"
          items={[{ kind: 'action', label: t.hide, onSelect: hide }]}
        />
      </div>
      <div className="mx-4 mb-2 h-1 overflow-hidden rounded-[2px] bg-surface-3" aria-hidden="true">
        <div className="h-full rounded-[2px] bg-ink" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul>
        {steps.map((id) => {
          const isDone = stepDone(id, facts);
          return (
            <ListRow
              key={id}
              leading={<Dot done={isDone} />}
              title={<span className={isDone ? 'text-ink-2' : undefined}>{t[id].title}</span>}
              subtitle={isDone ? undefined : t[id].help}
              trailing={<ChevronRight size={18} aria-hidden="true" className="text-ink-3" />}
              onClick={start[id]}
              rowProps={isDone ? { 'aria-label': t.stepDone(t[id].title) } : undefined}
            />
          );
        })}
      </ul>
      {players.picker}
      {session.picker}
      {match.picker}
    </section>
  );
}
