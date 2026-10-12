import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Match } from '../types/match';
import { deleteMatch, getMatch, setMatchStatus, updateMatchSetup } from './matchesApi';
import { MatchSetupForm } from './MatchSetupForm';

export function MatchPage() {
  const { teamId = '', matchId = '' } = useParams<{ teamId: string; matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    getMatch(teamId, matchId)
      .then((m) => (m ? setMatch(m) : setError('Match not found.')))
      .catch(() => setError("You don't have access to this match."));
  }, [teamId, matchId]);

  if (error) return <p role="alert" className="p-6 text-red">{error}</p>;
  if (!match) return <p className="p-6 text-slate">Loading match…</p>;

  async function startScouting() {
    setActionError(null);
    try {
      await setMatchStatus(teamId, matchId, 'live');
      navigate(`/teams/${teamId}/matches/${matchId}/scout`);
    } catch {
      setActionError('Could not start scouting. Please try again.');
    }
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <Link to={`/teams/${teamId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-blue hover:underline">
        <ChevronLeft size={16} aria-hidden="true" /> Back to team
      </Link>
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm tabular-nums text-slate">{match.date} · {match.homeAway === 'home' ? 'Home' : 'Away'}</p>
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">vs {match.opponent}</h1>
          </div>
          <Button variant="dangerGhost" size="sm" onClick={() => setConfirmDelete(true)}>Delete match</Button>
        </div>

        {match.status === 'setup' && (
          <>
            <div className="mb-6 flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                {dirty && <span className="text-xs text-slate">Save the setup first.</span>}
                <Button variant="primary" disabled={dirty} onClick={() => void startScouting()}>Start scouting</Button>
              </div>
              {actionError && <p role="alert" className="text-sm text-red">{actionError}</p>}
            </div>
            <MatchSetupForm
              teamId={teamId}
              initial={match}
              submitLabel="Save setup"
              onCancel={() => navigate(`/teams/${teamId}`)}
              onDirtyChange={setDirty}
              onSubmit={async (input) => {
                await updateMatchSetup(teamId, matchId, input);
                setMatch({ ...match, ...input });
              }}
            />
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this match?"
          message="All scouted actions for this match are deleted. This cannot be undone."
          confirmLabel="Yes, delete"
          error={deleteError}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
          onConfirm={() => {
            setDeleteError(null);
            deleteMatch(teamId, matchId)
              .then(() => navigate(`/teams/${teamId}`))
              .catch(() => setDeleteError('Could not delete the match. Please try again.'));
          }}
        />
      )}
    </div>
  );
}
