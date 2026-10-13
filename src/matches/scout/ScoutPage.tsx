import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Tab } from '../../components/Tab';
import { useMediaQuery } from '../../components/useMediaQuery';
import type { ActionEvent, EventSource, Match, MatchEventPayload, UsageProfile } from '../../types/match';
import { getDeviceId, isLockedByOther } from '../deviceLock';
import { appendOrder, orderAfter } from '../eventOrder';
import { buildFinishPayload } from '../finish';
import { rosterMap } from '../format';
import { addEvent, claimDevice, deleteEvents, finishMatch, getMatch, getUsageProfile, updateEvent, updateMatchResult } from '../matchesApi';
import { defaultLineup } from '../matchSetup';
import { countsForPlayer, expectedSkill, orderSkills } from '../nextActions';
import { nextRotation, prevRotation, replay, resultFromState, sortEvents } from '../scoutEngine';
import { playerForm } from '../scoutStats';
import { rallyOutcome } from '../skillGrades';
import { useMatchEvents } from '../useMatchEvents';
import { ActionSheet } from './ActionSheet';
import { BenchStrip } from './BenchStrip';
import { CorrectionDialog } from './CorrectionDialog';
import { CourtGrid } from './CourtGrid';
import { EditEventDialog } from './EditEventDialog';
import { RallyBar } from './RallyBar';
import { ScoutHeader } from './ScoutHeader';
import { LiveStatsPanel } from './LiveStatsPanel';
import { SetStartDialog } from './SetStartDialog';
import { SubDialog } from './SubDialog';
import { TimelineDrawer } from './TimelineDrawer';

const HEARTBEAT_MS = 60_000;

export function ScoutPage() {
  const { teamId = '', matchId = '' } = useParams<{ teamId: string; matchId: string }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const deviceId = useMemo(() => getDeviceId(), []);

  const [match, setMatch] = useState<Match | null>(null);
  const [usage, setUsage] = useState<UsageProfile>({ players: {} });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<string[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; kind: 'setStart' | 'setEnd' } | null>(null);
  const [subOutId, setSubOutId] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [phoneTab, setPhoneTab] = useState<'court' | 'live' | 'timeline'>('court');
  const [editing, setEditing] = useState<ActionEvent | null>(null);
  const [dismissedSetPoint, setDismissedSetPoint] = useState<string | null>(null);
  const { events, pending, error: eventsError } = useMatchEvents(teamId, matchId);

  useEffect(() => {
    getMatch(teamId, matchId)
      .then((m) => {
        if (!m) {
          setLoadError('Match not found.');
          return;
        }
        setMatch(m);
        if (isLockedByOther(m.activeDevice, deviceId, Date.now())) setLocked(true);
        else void claimDevice(teamId, matchId, deviceId).catch(() => undefined);
      })
      .catch(() => setLoadError("You don't have access to this match."));
    getUsageProfile(teamId).then(setUsage).catch(() => undefined);
  }, [teamId, matchId, deviceId]);

  const matchLoaded = match !== null;
  useEffect(() => {
    if (!matchLoaded || locked) return;
    const t = window.setInterval(() => void claimDevice(teamId, matchId, deviceId).catch(() => undefined), HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, [matchLoaded, locked, teamId, matchId, deviceId]);

  const state = useMemo(() => (match && events ? replay(match, events) : null), [match, events]);
  const roster = useMemo(() => rosterMap(match?.roster ?? []), [match]);

  // Keep the list/calendar result current without replaying there.
  useEffect(() => {
    if (!match || !state || locked) return;
    const result = resultFromState(state);
    if (JSON.stringify(result) === JSON.stringify(match.result)) return;
    setMatch({ ...match, result });
    updateMatchResult(teamId, matchId, result).catch(() => undefined);
  }, [state, match, locked, teamId, matchId]);

  // Double-tap guards: one setEnd per set, one finish per click-through.
  const endedSetRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const setPointReached = state?.setPointReached ?? false;
  useEffect(() => {
    if (!setPointReached) endedSetRef.current = null;
  }, [setPointReached]);

  const record = useCallback(
    (payload: MatchEventPayload, source: EventSource = 'tap') => {
      if (!events || !firebaseUser) return;
      const order = anchorId ? orderAfter(events, anchorId) : appendOrder(events);
      const { id, written } = addEvent(teamId, matchId, { ...payload, order, source, chunkId: null }, firebaseUser.uid);
      written.catch(() => setWriteError('An action could not be saved. Check your connection and the timeline.'));
      if (anchorId) {
        const endsRally =
          payload.type === 'point' || (payload.type === 'action' && rallyOutcome(payload.skill, payload.grade) !== null);
        setAnchorId(endsRally ? null : id);
      }
    },
    [events, firebaseUser, anchorId, teamId, matchId],
  );

  function undo() {
    if (!events || events.length === 0) return;
    const sorted = sortEvents(events);
    const last = sorted[sorted.length - 1];
    const ids = last.chunkId ? events.filter((e) => e.chunkId === last.chunkId).map((e) => e.id) : [last.id];
    if (ids.length > 1) setPendingUndo(ids);
    else if (anchorId && ids.includes(anchorId)) setAnchorId(null);
    if (ids.length === 1) void deleteEvents(teamId, matchId, ids).catch(() => setWriteError('Could not undo. Try again.'));
  }

  function deleteFromTimeline(ids: string[]) {
    if (anchorId && ids.includes(anchorId)) setAnchorId(null);
    void deleteEvents(teamId, matchId, ids).catch(() => setWriteError('Could not delete. Try again.'));
  }

  async function finish() {
    if (!match || !state || finishingRef.current) return;
    finishingRef.current = true;
    let fresh: UsageProfile;
    try {
      fresh = await getUsageProfile(teamId);
    } catch {
      finishingRef.current = false;
      setWriteError('Could not load usage history — try finishing again.');
      return;
    }
    finishMatch(teamId, matchId, buildFinishPayload(match, state, fresh)).catch(() => undefined);
    navigate(`/teams/${teamId}/matches/${matchId}`);
  }

  function confirmSet() {
    if (!state || endedSetRef.current === state.set) return;
    endedSetRef.current = state.set;
    record({ type: 'setEnd', set: state.set });
  }

  if (loadError || eventsError) return <p role="alert" className="p-6 text-red">{loadError ?? eventsError}</p>;
  if (!match || !state) return <p className="p-6 text-slate">Loading match…</p>;

  if (locked) {
    return (
      <ConfirmDialog
        title="Being scouted on another device"
        message="Another device scouted this match in the last two minutes. Take over here? Only one device should scout at a time."
        confirmLabel="Take over"
        onCancel={() => navigate(`/teams/${teamId}/matches/${matchId}`)}
        onConfirm={() => {
          setLocked(false);
          void claimDevice(teamId, matchId, deviceId).catch(() => undefined);
        }}
      />
    );
  }

  const liberoIds = new Set(match.liberos.map((l) => l.playerId));
  const selected = selectedId ? roster.get(selectedId) : undefined;
  const bench = match.roster.filter((r) => !state.court.includes(r.playerId));
  const skillsFor = (playerId: string) => {
    const entry = roster.get(playerId);
    return orderSkills({
      position: entry?.positionCategory ?? 'TBD',
      isLibero: liberoIds.has(playerId),
      expected: expectedSkill(state),
      matchCounts: countsForPlayer(state, playerId),
      history: usage.players[playerId] ?? null,
    });
  };

  const courtColumn = (
    <div className="flex flex-col gap-3">
      <CourtGrid
        court={state.court}
        roster={roster}
        activeLiberoId={state.activeLiberoId}
        selectedId={selectedId}
        form={(id) => playerForm(state, id)}
        onSelect={setSelectedId}
        onLongPress={(id) => {
          if (!liberoIds.has(id)) setSubOutId(id);
        }}
      />
      <BenchStrip players={bench} onSelect={setSelectedId} />
      <RallyBar
        format={match.format}
        timeoutsUsed={state.timeoutsUsed}
        onPoint={(winner, reason) => record({ type: 'point', winner, reason })}
        onTimeout={(team) => record({ type: 'timeout', team })}
      />
      {selected && (
        <ActionSheet
          key={selected.playerId}
          player={selected}
          isLibero={liberoIds.has(selected.playerId)}
          skills={skillsFor(selected.playerId)}
          floating={!isDesktop}
          onClose={() => setSelectedId(null)}
          onSub={() => {
            setSubOutId(selected.playerId);
            setSelectedId(null);
          }}
          onGrade={(skill, grade) => {
            record({ type: 'action', playerId: selected.playerId, skill, grade });
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );

  const timeline = (
    <TimelineDrawer
      events={events ?? []}
      state={state}
      roster={roster}
      onDelete={(ids) => {
        const structural = (events ?? []).find((e) => ids.includes(e.id) && (e.type === 'setStart' || e.type === 'setEnd'));
        if (structural && (structural.type === 'setStart' || structural.type === 'setEnd')) {
          setPendingDelete({ ids, kind: structural.type });
          return;
        }
        deleteFromTimeline(ids);
      }}
      onEdit={setEditing}
      onInsertAfter={(id) => {
        setAnchorId(id);
        setPhoneTab('court');
      }}
    />
  );
  const live = <LiveStatsPanel state={state} roster={roster} />;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <ScoutHeader
        state={state}
        format={match.format}
        opponent={match.opponent}
        pending={pending}
        onEditScore={() => setShowCorrection(true)}
        onRotate={(delta) =>
          record(
            { type: 'correction', score: null, serving: null, rotation: delta === 1 ? nextRotation(state.rotation) : prevRotation(state.rotation) },
            'correction',
          )
        }
      />
      {writeError && <p role="alert" className="bg-red/10 px-4 py-2 text-sm text-red-strong">{writeError}</p>}
      {anchorId && (
        <div className="flex items-center justify-between bg-blue/10 px-4 py-2 text-sm text-ink">
          <span>Inserting into the timeline</span>
          <button type="button" onClick={() => setAnchorId(null)} className="font-medium text-blue">Back to live</button>
        </div>
      )}
      {state.matchOver && (
        <div className="flex items-center justify-between gap-3 bg-green/15 px-4 py-3">
          <span className="font-semibold text-ink">
            Match over · {state.setsWon.us}–{state.setsWon.them}
          </span>
          <Button variant="primary" size="sm" onClick={() => void finish()}>Finish match</Button>
        </div>
      )}
      {isDesktop ? (
        <main className="grid flex-1 grid-cols-[minmax(320px,440px)_1fr] gap-4 p-4">
          {courtColumn}
          <div className="flex min-w-0 flex-col gap-4">
            {live}
            <div className="max-h-[50vh] overflow-y-auto">{timeline}</div>
          </div>
        </main>
      ) : (
        <>
          <nav className="flex gap-4 border-b border-border bg-surface px-4">
            <Tab active={phoneTab === 'court'} onClick={() => setPhoneTab('court')}>Court</Tab>
            <Tab active={phoneTab === 'live'} onClick={() => setPhoneTab('live')}>Live</Tab>
            <Tab active={phoneTab === 'timeline'} onClick={() => setPhoneTab('timeline')}>Timeline</Tab>
          </nav>
          <main className={`flex-1 p-3 ${phoneTab === 'court' && selected ? 'pb-80' : ''}`}>
            {phoneTab === 'court' && courtColumn}
            {phoneTab === 'live' && live}
            {phoneTab === 'timeline' && timeline}
          </main>
        </>
      )}
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-border bg-surface px-3 py-2">
        <button type="button" onClick={undo} className="flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-ink hover:bg-bg">
          <Undo2 size={16} aria-hidden="true" /> Undo
        </button>
        <button
          type="button"
          onClick={() => navigate(`/teams/${teamId}/matches/${matchId}`)}
          className="min-h-11 rounded-md px-3 text-sm text-blue hover:bg-blue/10"
        >
          Exit
        </button>
      </footer>

      {!state.inSet && !state.matchOver && (
        <SetStartDialog
          setNumber={state.set + 1}
          roster={match.roster}
          liberos={match.liberos}
          initialLineup={state.setStartLineup.length === 6 ? state.setStartLineup : defaultLineup(match.roster, match.liberos)}
          initialServing={state.serving === 'us' ? 'them' : 'us'}
          onCancel={() => navigate(`/teams/${teamId}/matches/${matchId}`)}
          onStart={(lineup, serving) => record({ type: 'setStart', set: state.set + 1, lineup, serving })}
        />
      )}

      {subOutId && roster.get(subOutId) && (
        <SubDialog
          outPlayer={roster.get(subOutId)!}
          candidates={match.roster.filter((r) => !state.lineup.includes(r.playerId) && !liberoIds.has(r.playerId))}
          onCancel={() => setSubOutId(null)}
          onSub={(inPlayerId) => {
            record({ type: 'sub', outPlayerId: subOutId, inPlayerId });
            setSubOutId(null);
          }}
        />
      )}

      {showCorrection && (
        <CorrectionDialog
          score={state.score}
          serving={state.serving}
          rotation={state.rotation}
          onCancel={() => setShowCorrection(false)}
          onSave={(c) => {
            if (c.score || c.serving || c.rotation !== null) record({ type: 'correction', ...c }, 'correction');
            setShowCorrection(false);
          }}
        />
      )}

      {state.setPointReached && dismissedSetPoint !== `${state.set}-${state.score.us}-${state.score.them}` && (
        <div role="dialog" aria-label="Set point" className="fixed inset-x-3 top-24 z-40 rounded-lg border border-border bg-surface p-4 shadow-pop">
          <p className="mb-3 font-semibold text-ink">
            {state.score.us > state.score.them ? 'Set won' : 'Set lost'} {state.score.us}–{state.score.them}?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDismissedSetPoint(`${state.set}-${state.score.us}-${state.score.them}`)}>
              Not yet
            </Button>
            <Button variant="primary" aria-label="Confirm set" onClick={confirmSet}>
              Confirm set
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <EditEventDialog
          event={editing}
          roster={match.roster}
          onCancel={() => setEditing(null)}
          onSave={(patch) => {
            void updateEvent(teamId, matchId, editing.id, patch).catch(() => setWriteError('Could not save the edit.'));
            setEditing(null);
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.kind === 'setStart' ? 'Delete set start?' : 'Delete set end?'}
          message="This changes the score and lineup for the rest of the set."
          confirmLabel="Yes, delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteFromTimeline(pendingDelete.ids);
            setPendingDelete(null);
          }}
        />
      )}

      {pendingUndo && (
        <ConfirmDialog
          title={`Undo whole text batch (${pendingUndo.length} events)?`}
          message={`This removes ${pendingUndo.length} events that were added together.`}
          confirmLabel="Undo batch"
          onCancel={() => setPendingUndo(null)}
          onConfirm={() => {
            if (anchorId && pendingUndo.includes(anchorId)) setAnchorId(null);
            void deleteEvents(teamId, matchId, pendingUndo).catch(() => setWriteError('Could not undo. Try again.'));
            setPendingUndo(null);
          }}
        />
      )}
    </div>
  );
}
