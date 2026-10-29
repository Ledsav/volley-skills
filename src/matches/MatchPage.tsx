import { usePageMeta } from '../layout/usePageMeta';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, FileSpreadsheet, Play, Printer, RotateCcw, Trash2, Trophy } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageSkeleton } from '../components/Skeleton';
import { NotFoundState, isNotFoundError } from '../components/NotFoundState';
import type { MenuItem } from '../components/Menu';
import { PageHeader } from '../layout/PageHeader';
import { usePublishPageChrome } from '../layout/PageChrome';
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
import { formatDate } from '../i18n/format';
import { getT, useT } from '../i18n/I18nProvider';

export function MatchPage() {
  const t = useT();
  const p = t.matches.page;
  const { teamId = '', matchId = '' } = useParams<{ teamId: string; matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  usePageMeta({ title: match ? p.title(match.opponent) : p.titleFallback });
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [reportSet, setReportSet] = useState<number | 'all'>('all');

  useEffect(() => {
    setNotFound(false);
    setError(null);
    getMatch(teamId, matchId)
      .then((m) => (m ? setMatch(m) : setNotFound(true)))
      .catch((e) => (isNotFoundError(e) ? setNotFound(true) : setError(getT().matches.page.loadError)));
  }, [teamId, matchId, attempt]);

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
  const deletingRef = useRef(false);
  // While the match loads, the toolbar shows a loading title instead of nothing.
  usePublishPageChrome({ title: p.loading }, !match && !error && !notFound);

  if (notFound) {
    return <NotFoundState title={p.notFoundTitle} message={p.notFoundMessage} backTo={`/teams/${teamId}`} backLabel={p.backToTeam} />;
  }
  if (error) {
    return (
      <div className="p-6">
        <p role="alert" className="text-callout text-red-strong">{error}</p>
        <Button variant="secondary" className="mt-3" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>{t.common.retry}</Button>
      </div>
    );
  }
  if (!match) return <PageSkeleton layout="match" label={p.loading} />;

  // Setup-phase writes are fire-and-forget like scouting events: offline, a
  // Firestore write only resolves once the server acks, so awaiting would hang.
  function startScouting() {
    setActionError(null);
    setMatchStatus(teamId, matchId, 'live').catch(() => setActionError(p.startError));
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
      setActionError(p.usageError);
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
      setActionError(p.reopenError);
    });
  }

  function exportCsv(csvFormat: CsvFormat) {
    if (!match || !report) return;
    const stats = (reportSet === 'all' ? report.all : report.bySet[reportSet]) ?? report.all;
    downloadText(reportCsvFileName(match, reportSet), reportCsv(match, stats, csvFormat), 'text/csv;charset=utf-8');
  }

  const deleteItem: MenuItem = {
    kind: 'action',
    label: p.deleteMenu,
    icon: <Trash2 size={16} />,
    danger: true,
    onSelect: () => setConfirmDelete(true),
  };
  const more: MenuItem[] =
    match.status === 'finished'
      ? [
          { kind: 'action', label: p.print, icon: <Printer size={16} />, onSelect: () => window.print() },
          { kind: 'action', label: p.csvEu, icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('eu') },
          { kind: 'action', label: p.csvEn, icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('en') },
          { kind: 'divider' },
          { kind: 'action', label: p.reopen, icon: <RotateCcw size={16} />, onSelect: reopen },
          { kind: 'divider' },
          deleteItem,
        ]
      : [deleteItem];
  const mainAction =
    match.status === 'setup'
      ? { label: p.startScouting, icon: Play, disabled: dirty, onSelect: startScouting }
      : match.status === 'finished'
        ? { label: p.awards, icon: Trophy, onSelect: () => navigate(`/teams/${teamId}/matches/${matchId}/awards`) }
        : undefined;

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <Link to={`/teams/${teamId}`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-callout text-ink-2 hover:text-ink print:hidden">
        <ChevronLeft size={16} aria-hidden="true" /> {p.backToTeam}
      </Link>
      <PageHeader
        title={p.title(match.opponent)}
        eyebrow={
          <span className="tabular-nums">
            {formatDate(match.date, 'short')} · {match.homeAway === 'home' ? t.matches.shared.home : t.matches.shared.away} · <span>{t.labels.competition[match.competition]}</span>
          </span>
        }
        mainAction={mainAction}
        more={more}
        className="mb-4"
      />

      {match.status === 'setup' && (
        <>
          {(dirty || actionError) && (
            <div className="mb-3 flex flex-col gap-1">
              {dirty && <span className="text-footnote text-ink-2">{p.saveFirst}</span>}
              {actionError && <p role="alert" className="text-callout text-red-strong">{actionError}</p>}
            </div>
          )}
          <MatchSetupForm
            teamId={teamId}
            initial={match}
            submitLabel={p.saveSetup}
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
        <div className="mb-4 rounded-lg bg-green-tint p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-headline text-ink">{p.inProgress}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={!state} onClick={() => void finish()}>{p.finish}</Button>
              <Link
                to={`/teams/${teamId}/matches/${matchId}/scout`}
                className="inline-flex min-h-11 items-center rounded-md bg-ink px-3 text-sm font-semibold tracking-[-0.01em] text-on-ink hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {p.resumeScouting}
              </Link>
            </div>
          </div>
          {actionError && <p role="alert" className="mt-2 text-callout text-red-strong">{actionError}</p>}
        </div>
      )}
      {match.status === 'finished' && actionError && <p role="alert" className="mb-3 text-callout text-red-strong print:hidden">{actionError}</p>}
      {match.status !== 'setup' && report && <MatchReport match={match} report={report} set={reportSet} onSetChange={setReportSet} />}

      {confirmDelete && (
        <ConfirmDialog
          title={p.deleteTitle}
          message={p.deleteMessage}
          confirmLabel={p.deleteConfirm}
          error={deleteError}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
          onConfirm={() => {
            if (deletingRef.current) return;
            deletingRef.current = true;
            setDeleteError(null);
            deleteMatch(teamId, matchId)
              .then(() => navigate(`/teams/${teamId}`))
              .catch(() => setDeleteError(p.deleteError))
              .finally(() => {
                deletingRef.current = false;
              });
          }}
        />
      )}
    </div>
  );
}
