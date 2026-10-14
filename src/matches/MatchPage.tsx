import { usePageMeta } from '../layout/usePageMeta';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Download, FileSpreadsheet, Printer, Trophy } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageSkeleton } from '../components/Skeleton';
import { NotFoundState, isNotFoundError } from '../components/NotFoundState';
import { Menu } from '../components/Menu';
import { downloadText } from '../export/exportJson';
import type { Match } from '../types/match';
import { buildFinishPayload } from './finish';
import { deleteMatch, finishMatch, getMatch, getUsageProfile, setMatchStatus, updateMatchSetup } from './matchesApi';
import { MatchSetupForm } from './MatchSetupForm';
import { MatchReport } from './report/MatchReport';
import { reportCsv, reportCsvFileName, type CsvFormat } from './report/reportCsv';
import { buildReportData } from './report/reportData';
import { replay } from './scoutEngine';
import { useMatchEvents } from './useMatchEvents';

export function MatchPage() {
  const { teamId = '', matchId = '' } = useParams<{ teamId: string; matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  usePageMeta({ title: match ? `vs ${match.opponent}` : 'Match' });
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reportSet, setReportSet] = useState<number | 'all'>('all');

  useEffect(() => {
    setNotFound(false);
    setError(null);
    getMatch(teamId, matchId)
      .then((m) => (m ? setMatch(m) : setNotFound(true)))
      .catch((e) => (isNotFoundError(e) ? setNotFound(true) : setError('Could not load this match.')));
  }, [teamId, matchId]);

  // A finished match carries its report, so it never reads the event log; only
  // live matches (and ones finished before the report was stored) need events.
  const needsEvents = match?.status === 'live' || (match?.status === 'finished' && !match.report);
  const { events } = useMatchEvents(teamId, matchId, needsEvents);
  const state = useMemo(() => (match && events ? replay(match, events) : null), [match, events]);
  const report = useMemo(
    () => (match?.status === 'finished' && match.report ? match.report : state ? buildReportData(state) : null),
    [match, state],
  );
  const finishingRef = useRef(false);

  if (notFound) {
    return <NotFoundState title="Match not found" message="It may have been deleted, or you don't have access." backTo={`/teams/${teamId}`} backLabel="Back to team" />;
  }
  if (error) return <p role="alert" className="p-6 text-red">{error}</p>;
  if (!match) return <PageSkeleton layout="match" label="Loading match…" />;

  // Setup-phase writes are fire-and-forget like scouting events: offline, a
  // Firestore write only resolves once the server acks, so awaiting would hang.
  function startScouting() {
    setActionError(null);
    setMatchStatus(teamId, matchId, 'live').catch(() => setActionError('Could not start scouting. Please try again.'));
    navigate(`/teams/${teamId}/matches/${matchId}/scout`);
  }

  async function finish() {
    if (!match || !state || finishingRef.current) return;
    finishingRef.current = true;
    setActionError(null);
    let profile;
    try {
      profile = await getUsageProfile(teamId);
    } catch {
      finishingRef.current = false;
      setActionError('Could not load usage history — try finishing again.');
      return;
    }
    const payload = buildFinishPayload(match, state, profile);
    finishMatch(teamId, matchId, payload).catch(() => undefined);
    finishingRef.current = false;
    setMatch({ ...match, status: 'finished', summary: payload.summary, report: payload.report, usageContribution: payload.usageContribution, result: payload.result });
  }

  function reopen() {
    if (!match) return;
    setActionError(null);
    setMatch({ ...match, status: 'live' });
    setMatchStatus(teamId, matchId, 'live').catch(() => {
      setMatch((cur) => (cur ? { ...cur, status: 'finished' } : cur));
      setActionError('Could not reopen the match. Please try again.');
    });
  }

  function exportCsv(csvFormat: CsvFormat) {
    if (!match || !report) return;
    const stats = (reportSet === 'all' ? report.all : report.bySet[reportSet]) ?? report.all;
    downloadText(reportCsvFileName(match, reportSet), reportCsv(match, stats, csvFormat), 'text/csv;charset=utf-8');
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <Link to={`/teams/${teamId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-blue hover:underline print:hidden">
        <ChevronLeft size={16} aria-hidden="true" /> Back to team
      </Link>
      <div className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6 print:border-0 print:p-0 print:shadow-none">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm tabular-nums text-slate">{match.date} · {match.homeAway === 'home' ? 'Home' : 'Away'} · <span className="capitalize">{match.competition}</span></p>
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">vs {match.opponent}</h1>
          </div>
          <Button variant="dangerGhost" size="sm" className="print:hidden" onClick={() => setConfirmDelete(true)}>Delete match</Button>
        </div>

        {match.status === 'setup' && (
          <>
            <div className="mb-6 flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                {dirty && <span className="text-xs text-slate">Save the setup first.</span>}
                <Button variant="primary" disabled={dirty} onClick={startScouting}>Start scouting</Button>
              </div>
              {actionError && <p role="alert" className="text-sm text-red">{actionError}</p>}
            </div>
            <MatchSetupForm
              teamId={teamId}
              initial={match}
              submitLabel="Save setup"
              onCancel={() => navigate(`/teams/${teamId}`)}
              onDirtyChange={setDirty}
              onSubmit={(input) => {
                setMatch({ ...match, ...input });
                return updateMatchSetup(teamId, matchId, input);
              }}
            />
          </>
        )}

        {match.status === 'live' && (
          <div className="mb-6 rounded-md bg-orange/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-ink">Scouting in progress</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={!state} onClick={() => void finish()}>Finish match</Button>
                <Link to={`/teams/${teamId}/matches/${matchId}/scout`} className="inline-flex min-h-11 items-center rounded-md bg-navy px-3 text-sm font-medium text-white">
                  Resume scouting
                </Link>
              </div>
            </div>
            {actionError && <p role="alert" className="mt-2 text-sm text-red">{actionError}</p>}
          </div>
        )}
        {match.status === 'finished' && (
          <div className="mb-6 flex flex-col items-end gap-1 print:hidden">
            <div className="flex flex-wrap justify-end gap-2">
              <Menu
                label="Export"
                triggerClassName="inline-flex min-h-11 items-center gap-2 rounded-md border border-blue bg-surface px-3 text-sm font-medium text-blue hover:bg-blue/10 disabled:opacity-50"
                trigger={
                  <>
                    <Download size={16} aria-hidden="true" /> Export <ChevronDown size={16} aria-hidden="true" />
                  </>
                }
                items={[
                  { kind: 'action', label: 'Print / PDF', icon: <Printer size={16} />, onSelect: () => window.print() },
                  { kind: 'divider' },
                  { kind: 'action', label: 'CSV · Excel (Belgium/EU)', icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('eu') },
                  { kind: 'action', label: 'CSV · Excel (English) / Sheets', icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('en') },
                ]}
              />
              <Link to={`/teams/${teamId}/matches/${matchId}/awards`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-orange px-4 font-medium text-white hover:bg-orange-strong">
                <Trophy size={16} aria-hidden="true" /> Match awards
              </Link>
              <Button variant="secondary" size="sm" onClick={reopen}>Reopen for editing</Button>
            </div>
            {actionError && <p role="alert" className="text-sm text-red">{actionError}</p>}
          </div>
        )}
        {match.status !== 'setup' && report && <MatchReport match={match} report={report} set={reportSet} onSetChange={setReportSet} />}
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
