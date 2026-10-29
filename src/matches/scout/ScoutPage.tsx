import { NotFoundState, isNotFoundError } from '../../components/NotFoundState';
import { usePageMeta } from '../../layout/usePageMeta';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useClubFeatures } from '../../clubs/useClubFeatures';
import { getT, useT } from '../../i18n/I18nProvider';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Tab } from '../../components/Tab';
import { useMediaQuery } from '../../components/useMediaQuery';
import type { ActionEvent, EventSource, Grade, Match, MatchEvent, MatchEventPayload, PointReason, RoleMap, Side, Skill, UsageProfile } from '../../types/match';
import { getDeviceId, isLockedByOther } from '../deviceLock';
import { nextOrder } from '../eventOrder';
import { buildFinishPayload } from '../finish';
import { rosterMap, shortNames } from '../format';
import { addEvent, claimDevice, deleteEvents, finishMatch, getMatch, getUsageProfile, updateEvent, updateMatchResult, updateMatchRoster } from '../matchesApi';
import { defaultLineup } from '../matchSetup';
import { countsForPlayer, expectedSkill, orderSkills, predictPlayer } from '../nextActions';
import { nextRotation, prevRotation, replay, resultFromState, rosterRoles, sameResult, sortEvents } from '../scoutEngine';
import { playerForm } from '../scoutStats';
import { POINT_REASONS, rallyOutcome } from '../skillGrades';
import { useMatchEvents } from '../useMatchEvents';
import { ActionSheet } from './ActionSheet';
import { BenchStrip } from './BenchStrip';
import { CorrectionDialog } from './CorrectionDialog';
import { CourtGrid } from './CourtGrid';
import { EditEventDialog } from './EditEventDialog';
import { HotkeyCheatSheet } from './HotkeyCheatSheet';
import { keyLabel } from './hotkeys';
import { Kbd } from './Kbd';
import { RallyBar, type ReasonPrompt } from './RallyBar';
import { onlyImports, undoTarget } from './undoTarget';
import { ScoutHeader } from './ScoutHeader';
import type { MenuItem } from '../../components/Menu';
import { LiveStatsPanel } from './LiveStatsPanel';
import { SetStartDialog } from './SetStartDialog';
import { TextScoutPanel } from '../text/TextScoutPanel';
import { SubDialog } from './SubDialog';
import { TimelineDrawer } from './TimelineDrawer';
import { readQuickScore, writeQuickScore } from './quickScore';
import { useScoutHotkeys, type ScoutHotkeysOptions } from './useScoutHotkeys';

const HEARTBEAT_MS = 60_000;
const REASON_PROMPT_MS = 5_000;
const AUTO_SELECT_KEY = 'vcb.scoutAutoSelect';

/** Per-device preference, default on. Storage can throw (private mode, blocked site data). */
function readAutoSelect(): boolean {
  try {
    return window.localStorage.getItem(AUTO_SELECT_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeAutoSelect(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_SELECT_KEY, on ? 'on' : 'off');
  } catch {
    // Not persisted; the toggle still applies for this visit.
  }
}

/** `seq` re-keys the action sheet so each selection starts on its first chip. */
interface Selection {
  id: string;
  auto: boolean;
  seq: number;
}

/**
 * Roles the next set's dialog starts from: the roster roles with the previous
 * set's chosen roles on top (covers a roster write that never landed). Subs'
 * inherited roles are not carried over.
 */
function nextSetRoles(match: Match, events: MatchEvent[]): RoleMap {
  const prevStart = sortEvents(events).filter((e) => e.type === 'setStart').pop();
  const prevRoles = prevStart && prevStart.type === 'setStart' ? prevStart.roles ?? {} : {};
  const known = new Set(match.roster.map((r) => r.playerId));
  return { ...rosterRoles(match), ...Object.fromEntries(Object.entries(prevRoles).filter(([id]) => known.has(id))) };
}

/** First serve alternates set to set: the other side of the previous set's first server. */
function nextSetServing(events: MatchEvent[], fallbackServing: Side): Side {
  const prevStart = sortEvents(events).filter((e) => e.type === 'setStart').pop();
  const prev = prevStart && prevStart.type === 'setStart' ? prevStart.serving : fallbackServing;
  return prev === 'us' ? 'them' : 'us';
}

/** Mounts the keyboard listener once the page is live and shows its jersey hint. */
function ScoutHotkeys(props: ScoutHotkeysOptions): ReactNode {
  const { hint } = useScoutHotkeys(props);
  if (!hint) return null;
  return (
    <p
      role="status"
      className="pointer-events-none fixed bottom-16 left-1/2 z-40 -translate-x-1/2 rounded-md bg-ink px-3 py-1.5 text-sm font-medium tabular-nums text-white shadow-pop"
    >
      {hint}
    </p>
  );
}

export function ScoutPage() {
  const tr = useT();
  const sp = tr.scout.page;
  usePageMeta({ title: sp.title });
  const { teamId = '', matchId = '' } = useParams<{ teamId: string; matchId: string }>();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { aiEnabled } = useClubFeatures();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const deviceId = useMemo(() => getDeviceId(), []);

  const [match, setMatch] = useState<Match | null>(null);
  const [usage, setUsage] = useState<UsageProfile>({ players: {} });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [autoSelect, setAutoSelect] = useState(readAutoSelect);
  const [quickScore, setQuickScore] = useState(readQuickScore);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<string[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; kind: 'setStart' | 'setEnd' } | null>(null);
  const [subOutId, setSubOutId] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [phoneTab, setPhoneTab] = useState<'court' | 'live' | 'timeline' | 'text'>('court');
  const [textOpen, setTextOpen] = useState(false);
  const textVisible = aiEnabled && (isDesktop ? textOpen : phoneTab === 'text');
  // Once opened, the text panel stays mounted (hidden when not shown) so a
  // preview or an in-flight Process survives tab switches and closing.
  const [textMounted, setTextMounted] = useState(false);
  useEffect(() => {
    if (textVisible) setTextMounted(true);
  }, [textVisible]);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  const [editing, setEditing] = useState<ActionEvent | null>(null);
  const [dismissedSetPoint, setDismissedSetPoint] = useState<string | null>(null);
  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [reasonPrompt, setReasonPrompt] = useState<ReasonPrompt | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // The action panel's active fundamental, tied to the selection it was picked for.
  const [sheetSkill, setSheetSkill] = useState<{ seq: number; skill: Skill } | null>(null);
  const { events, pending, error: eventsError } = useMatchEvents(teamId, matchId);
  const selectedId = selection?.id ?? null;
  const selectionSeqRef = useRef(0);
  // The event whose arrival in the snapshot triggers the next auto-select.
  // Cleared by a manual tile tap or closing the sheet (suppresses until the next write).
  const autoAfterRef = useRef<string | null>(null);
  const select = useCallback((id: string | null, auto = false) => {
    if (!auto) autoAfterRef.current = null;
    setSelection(id ? { id, auto, seq: ++selectionSeqRef.current } : null);
  }, []);

  useEffect(() => {
    setNotFound(false);
    setLoadError(null);
    getMatch(teamId, matchId)
      .then((m) => {
        if (!m) {
          setNotFound(true);
          return;
        }
        // Only a live match takes events: a stale tab must not write into a
        // match that is back in setup or already finished.
        if (m.status !== 'live') {
          navigate(`/teams/${teamId}/matches/${matchId}`, { replace: true });
          return;
        }
        setMatch(m);
        if (isLockedByOther(m.activeDevice, deviceId, Date.now())) setLocked(true);
        else void claimDevice(teamId, matchId, deviceId).catch(() => undefined);
      })
      .catch((e) => (isNotFoundError(e) ? setNotFound(true) : setLoadError(getT().matches.page.loadError)));
    getUsageProfile(teamId).then(setUsage).catch(() => undefined);
  }, [teamId, matchId, deviceId, navigate]);

  const matchLoaded = match !== null;
  useEffect(() => {
    if (!matchLoaded || locked) return;
    const t = window.setInterval(() => void claimDevice(teamId, matchId, deviceId).catch(() => undefined), HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, [matchLoaded, locked, teamId, matchId, deviceId]);

  const state = useMemo(() => (match && events ? replay(match, events) : null), [match, events]);
  const roster = useMemo(() => rosterMap(match?.roster ?? []), [match]);
  const names = useMemo(() => shortNames(match?.roster ?? []), [match]);

  // Before the very first set, open the lineup dialog once; later sets start
  // from the banner so an accidental "Confirm set" can still be undone.
  const autoOpenedRef = useRef(false);
  const awaitingFirstSet = !!state && state.set === 0 && !state.inSet && !state.matchOver;
  useEffect(() => {
    if (!awaitingFirstSet || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    setSetDialogOpen(true);
  }, [awaitingFirstSet]);

  // A set ending (or not yet started) closes anything that would record into it.
  const inSet = state?.inSet ?? false;
  useEffect(() => {
    if (inSet) return;
    setSelection(null);
    setSubOutId(null);
    setReasonPrompt(null);
    setShowCorrection(false);
  }, [inSet]);

  // Keep the list/calendar result current without replaying there.
  useEffect(() => {
    if (!match || !state || locked) return;
    const result = resultFromState(state);
    if (sameResult(result, match.result)) return;
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

  // Writes from this page, newest last: Undo removes what this device just did
  // (even an insert mid-timeline), and rapid taps never reuse an order before
  // the snapshot catches up.
  const writtenRef = useRef<string[]>([]);
  const lastWriteRef = useRef<{ id: string; order: number } | null>(null);
  const maxOrderRef = useRef(0);

  const record = useCallback(
    (payload: MatchEventPayload, source: EventSource = 'tap'): string | null => {
      if (!events || !firebaseUser) return null;
      setReasonPrompt(null);
      const order = nextOrder(events, anchorId, lastWriteRef.current, maxOrderRef.current);
      const { id, written } = addEvent(teamId, matchId, { ...payload, order, source, chunkId: null }, firebaseUser.uid);
      written.catch(() => setWriteError(getT().scout.page.writeAction));
      writtenRef.current.push(id);
      lastWriteRef.current = { id, order };
      maxOrderRef.current = Math.max(maxOrderRef.current, order);
      // While inserting mid-timeline the replayed state is the timeline's end, not the
      // insert point, so a prediction would be wrong: skip auto-select there.
      autoAfterRef.current = anchorId ? null : id;
      if (anchorId) {
        const endsRally =
          payload.type === 'point' || (payload.type === 'action' && rallyOutcome(payload.skill, payload.grade) !== null);
        setAnchorId(endsRally ? null : id);
      }
      return id;
    },
    [events, firebaseUser, anchorId, teamId, matchId],
  );

  function mergeText(payloads: MatchEventPayload[], orders: number[]): boolean {
    if (!firebaseUser || payloads.length === 0) return false;
    const chunkId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `chunk-${Date.now()}`;
    payloads.forEach((payload, i) => {
      const { id, written } = addEvent(teamId, matchId, { ...payload, order: orders[i], source: 'text', chunkId }, firebaseUser.uid);
      written.catch(() => setWriteError(getT().scout.page.writeText));
      writtenRef.current.push(id);
      lastWriteRef.current = { id, order: orders[i] };
      maxOrderRef.current = Math.max(maxOrderRef.current, orders[i]);
    });
    setAnchorId(null);
    return true;
  }

  // Once this device's last write shows up in the snapshot, pre-select the most
  // likely player for the next expected skill (one tap: grade).
  useEffect(() => {
    const awaited = autoAfterRef.current;
    if (!awaited || !events || !state || !match) return;
    if (!events.some((e) => e.id === awaited)) return;
    autoAfterRef.current = null;
    if (!autoSelect || quickScore || !state.inSet || textVisible) return;
    const id = predictPlayer({ state, skill: expectedSkill(state), roster, liberos: match.liberos, usage });
    if (id) select(id, true);
  }, [events, state, match, roster, usage, autoSelect, quickScore, select, textVisible]);

  useEffect(() => {
    if (textVisible) setSelection(null);
  }, [textVisible]);

  useEffect(() => {
    if (!reasonPrompt) return;
    const t = window.setTimeout(() => setReasonPrompt(null), REASON_PROMPT_MS);
    return () => window.clearTimeout(t);
  }, [reasonPrompt]);

  function undo() {
    if (!events || events.length === 0) return;
    setReasonPrompt(null);
    const target = undoTarget(events, writtenRef.current);
    writtenRef.current = target.stack;
    if (target.kind === 'none' || target.kind === 'importOnly') return;
    const ids = target.ids;
    if (target.kind === 'batch') setPendingUndo(ids);
    else if (anchorId && ids.includes(anchorId)) setAnchorId(null);
    if (ids.length === 1) void deleteEvents(teamId, matchId, ids).catch(() => setWriteError(getT().scout.page.undoError));
  }

  function recordPoint(winner: Side) {
    const id = record({ type: 'point', winner, reason: null });
    if (id) setReasonPrompt({ eventId: id, winner });
  }

  function amendReason(eventId: string, reason: PointReason) {
    void updateEvent(teamId, matchId, eventId, { reason }).catch(() => setWriteError(getT().scout.page.pointReasonError));
    setReasonPrompt(null);
  }

  function recordTimeout(team: Side) {
    record({ type: 'timeout', team });
  }

  function toggleAutoSelect() {
    const next = !autoSelect;
    setAutoSelect(next);
    writeAutoSelect(next);
  }

  function toggleQuickScore() {
    const next = !quickScore;
    setQuickScore(next);
    writeQuickScore(next);
    if (next) select(null);
  }

  function gradeAction(playerId: string, skill: Skill, grade: Grade) {
    setSelection(null);
    record({ type: 'action', playerId, skill, grade });
  }

  function openSub(playerId: string) {
    setSubOutId(playerId);
    select(null);
  }

  function undoSetEnd() {
    const lastEnd = sortEvents(events ?? []).filter((e) => e.type === 'setEnd').pop();
    if (!lastEnd) return;
    endedSetRef.current = null;
    deleteFromTimeline([lastEnd.id]);
  }

  function deleteFromTimeline(ids: string[]) {
    if (reasonPrompt && ids.includes(reasonPrompt.eventId)) setReasonPrompt(null);
    if (anchorId && ids.includes(anchorId)) setAnchorId(null);
    void deleteEvents(teamId, matchId, ids).catch(() => setWriteError(getT().scout.page.deleteError));
  }

  async function finish() {
    if (!match || !state || finishingRef.current) return;
    finishingRef.current = true;
    let fresh: UsageProfile;
    try {
      fresh = await getUsageProfile(teamId);
    } catch {
      finishingRef.current = false;
      setWriteError(getT().matches.page.usageError);
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

  if (notFound) {
    return <NotFoundState title={tr.matches.page.notFoundTitle} message={tr.matches.page.notFoundMessage} backTo={`/teams/${teamId}`} backLabel={tr.matches.page.backToTeam} />;
  }
  if (loadError || eventsError) return <p role="alert" className="p-6 text-red-strong">{loadError ?? eventsError}</p>;
  if (!match || !state) return <p className="p-6 text-slate">{tr.matches.page.loading}</p>;

  if (locked) {
    return (
      <ConfirmDialog
        title={sp.lockedTitle}
        message={sp.lockedMessage}
        confirmLabel={sp.lockedConfirm}
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
      position: state.roles[playerId] ?? entry?.positionCategory ?? 'TBD',
      isLibero: liberoIds.has(playerId),
      expected: expectedSkill(state),
      matchCounts: countsForPlayer(state, playerId),
      history: usage.players[playerId] ?? null,
    });
  };
  const panelPlayer = state.inSet && selection && !quickScore ? selected : undefined;
  const panelSkills = panelPlayer ? skillsFor(panelPlayer.playerId) : [];
  const panelSkill = panelPlayer && selection ? (sheetSkill?.seq === selection.seq ? sheetSkill.skill : panelSkills[0]) : null;
  const canSub = !!panelPlayer && !liberoIds.has(panelPlayer.playerId);
  const chooseSkill = (skill: Skill) => {
    if (selection) setSheetSkill({ seq: selection.seq, skill });
  };

  // Keyboard commands call the same handlers as the buttons.
  const onHotkey: ScoutHotkeysOptions['onCommand'] = (command) => {
    switch (command.type) {
      case 'grade':
        if (panelPlayer && panelSkill) gradeAction(panelPlayer.playerId, panelSkill, command.grade);
        return;
      case 'skill':
        chooseSkill(command.skill);
        return;
      case 'point':
        if (state.inSet) recordPoint(command.winner);
        return;
      case 'reason': {
        const reason = reasonPrompt ? POINT_REASONS[reasonPrompt.winner][command.index] : undefined;
        if (reasonPrompt && reason) amendReason(reasonPrompt.eventId, reason);
        return;
      }
      case 'timeout':
        if (state.inSet) recordTimeout(command.team);
        return;
      case 'undo':
        undo();
        return;
      case 'close':
        if (selection) select(null);
        return;
      case 'sub':
        if (panelPlayer && canSub) openSub(panelPlayer.playerId);
        return;
      case 'toggleAuto':
        if (!quickScore) toggleAutoSelect();
        return;
      case 'toggleHelp':
        setHelpOpen((open) => !open);
        return;
      case 'closeHelp':
        setHelpOpen(false);
        return;
      default:
        return;
    }
  };

  // App tools — not match events (dock) and not corrections (header).
  const tools: MenuItem[] = [
    { kind: 'check', label: sp.quickScore, checked: quickScore, onSelect: toggleQuickScore },
    ...(quickScore
      ? []
      : [{ kind: 'check' as const, label: sp.autoSelect, checked: autoSelect, onSelect: toggleAutoSelect, hint: <Kbd>{keyLabel('auto')}</Kbd> }]),
    ...(isDesktop
      ? [
          ...(aiEnabled
            ? [{ kind: 'check' as const, label: sp.textPanel, checked: textOpen, onSelect: () => setTextOpen((v) => !v) }]
            : []),
          { kind: 'action' as const, label: sp.shortcuts, onSelect: () => setHelpOpen(true), hint: <Kbd>{keyLabel('help')}</Kbd> },
        ]
      : []),
    { kind: 'divider' },
    { kind: 'action', label: sp.exit, onSelect: () => navigate(`/teams/${teamId}/matches/${matchId}`) },
  ];

  const courtColumn = (
    <div className="flex flex-col gap-3">
      {!quickScore && (
        <>
          <CourtGrid
            court={state.court}
            roster={roster}
            roles={state.roles}
            liberos={match.liberos}
            activeLiberoId={state.activeLiberoId}
            selectedId={selectedId}
            autoSelected={selection?.auto ?? false}
            form={(id) => playerForm(state, id)}
            disabled={!state.inSet}
            servingUs={state.serving === 'us'}
            onSelect={(id) => select(id)}
            onLongPress={(id) => {
              if (!liberoIds.has(id)) setSubOutId(id);
            }}
          />
          {/* While a player's actions are open, grading gets the room. */}
          {!panelPlayer && <BenchStrip players={bench} names={names} onSelect={(id) => select(id)} disabled={!state.inSet} />}
        </>
      )}
      {panelPlayer && panelSkill && selection && (
        <ActionSheet
          key={`${panelPlayer.playerId}-${selection.seq}`}
          player={panelPlayer}
          isLibero={liberoIds.has(panelPlayer.playerId)}
          skills={panelSkills}
          skill={panelSkill}
          onSkillChange={chooseSkill}
          onClose={() => select(null)}
          onSub={() => openSub(panelPlayer.playerId)}
          onGrade={(skill, grade) => gradeAction(panelPlayer.playerId, skill, grade)}
        />
      )}
      {!state.inSet && <p className="py-2 text-center text-sm text-slate">{sp.startToRecord}</p>}
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
  const textPanel = aiEnabled && (textMounted || textVisible) && (
    <div hidden={!textVisible}>
      <TextScoutPanel
        match={match}
        events={events ?? []}
        anchorId={anchorId}
        maxWritten={maxOrderRef.current}
        lastWrite={lastWriteRef.current}
        online={online}
        onMerge={mergeText}
        onClose={() => (isDesktop ? setTextOpen(false) : setPhoneTab('court'))}
      />
    </div>
  );

  return (
    // A fixed full-height frame: header and events dock never scroll away; only the middle does.
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg">
      <ScoutHeader
        state={state}
        format={match.format}
        opponent={match.opponent}
        pending={pending}
        disabled={!state.inSet}
        onUndo={undo}
        undoHint={onlyImports(events ?? []) ? sp.undoImportHint : null}
        tools={tools}
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
          <span>{sp.inserting}</span>
          <button type="button" onClick={() => setAnchorId(null)} className="font-medium text-blue-strong">{sp.backToLive}</button>
        </div>
      )}
      {!state.inSet && !state.matchOver && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-orange/10 px-4 py-2">
          <span className="font-semibold text-ink">
            {state.set === 0
              ? sp.setLineup
              : sp.setOver(state.set, state.setScores[state.set - 1]?.us ?? 0, state.setScores[state.set - 1]?.them ?? 0)}
          </span>
          <div className="flex gap-2">
            {state.set > 0 && (
              <Button variant="ghost" size="sm" onClick={undoSetEnd}>{sp.undoSetEnd}</Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setSetDialogOpen(true)}>{sp.startSet(state.set + 1)}</Button>
          </div>
        </div>
      )}
      {state.matchOver && (
        <div className="flex items-center justify-between gap-3 bg-green/15 px-4 py-3">
          <span className="font-semibold text-ink">
            {sp.matchOver(state.setsWon.us, state.setsWon.them)}
          </span>
          <Button variant="primary" size="sm" onClick={() => void finish()}>{tr.matches.page.finish}</Button>
        </div>
      )}
      {isDesktop ? (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(320px,440px)_1fr] gap-4 overflow-y-auto p-4">
          {courtColumn}
          <div className="flex min-w-0 flex-col gap-4">
            {textPanel}
            {!textVisible && live}
            <div className="max-h-[50vh] overflow-y-auto">{timeline}</div>
          </div>
        </main>
      ) : (
        <>
          <div role="tablist" aria-label={sp.views} className="flex gap-4 border-b border-border bg-surface px-4">
            <Tab active={phoneTab === 'court'} onClick={() => setPhoneTab('court')}>{sp.tabCourt}</Tab>
            <Tab active={phoneTab === 'live'} onClick={() => setPhoneTab('live')}>{sp.tabLive}</Tab>
            <Tab active={phoneTab === 'timeline'} onClick={() => setPhoneTab('timeline')}>{sp.tabTimeline}</Tab>
            {aiEnabled && <Tab active={phoneTab === 'text'} onClick={() => setPhoneTab('text')}>{sp.tabText}</Tab>}
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto p-3">
            {phoneTab === 'court' && courtColumn}
            {phoneTab === 'live' && live}
            {phoneTab === 'timeline' && timeline}
            {textPanel}
          </main>
        </>
      )}
      {state.inSet && (
        <section
          aria-label={sp.events}
          className="shrink-0 border-t border-border bg-surface px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-pop"
        >
          <div className="mx-auto w-full max-w-3xl">
            <RallyBar
              size={quickScore ? 'large' : 'normal'}
              format={match.format}
              timeoutsUsed={state.timeoutsUsed}
              reasonPrompt={reasonPrompt}
              onPoint={recordPoint}
              onReason={amendReason}
              onTimeout={recordTimeout}
            />
          </div>
        </section>
      )}

      {setDialogOpen && !state.inSet && !state.matchOver && (
        <SetStartDialog
          setNumber={state.set + 1}
          roster={match.roster}
          liberos={match.liberos}
          roles={nextSetRoles(match, events ?? [])}
          initialLineup={state.setStartLineup.length === 6 ? state.setStartLineup : defaultLineup(match.roster, match.liberos)}
          initialServing={nextSetServing(events ?? [], state.serving)}
          onCancel={() => setSetDialogOpen(false)}
          onStart={(lineup, serving, roles) => {
            record({ type: 'setStart', set: state.set + 1, lineup, serving, roles });
            setSetDialogOpen(false);
            // Later sets default to these roles: keep them in the match roster snapshot.
            if (match.roster.some((r) => roles[r.playerId] && roles[r.playerId] !== r.positionCategory)) {
              const nextRoster = match.roster.map((r) => ({ ...r, positionCategory: roles[r.playerId] ?? r.positionCategory }));
              setMatch({ ...match, roster: nextRoster });
              updateMatchRoster(teamId, matchId, nextRoster).catch(() =>
                setWriteError(sp.rosterError),
              );
            }
          }}
        />
      )}

      {state.inSet && subOutId && roster.get(subOutId) && (
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

      {state.inSet && showCorrection && (
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
        <div role="dialog" aria-label={sp.setPoint} className="fixed inset-x-3 top-24 z-40 rounded-lg border border-border bg-surface p-4 shadow-pop">
          <p className="mb-3 font-semibold text-ink">
            {sp.setResult(state.score.us > state.score.them, state.score.us, state.score.them)}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDismissedSetPoint(`${state.set}-${state.score.us}-${state.score.them}`)}>
              {sp.notYet}
            </Button>
            <Button variant="primary" aria-label={sp.confirmSet} onClick={confirmSet}>
              {sp.confirmSet}
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
            void updateEvent(teamId, matchId, editing.id, patch).catch(() => setWriteError(getT().scout.page.editError));
            setEditing(null);
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.kind === 'setStart' ? sp.deleteSetStartTitle : sp.deleteSetEndTitle}
          message={sp.deleteStructuralMessage}
          confirmLabel={tr.matches.page.deleteConfirm}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteFromTimeline(pendingDelete.ids);
            setPendingDelete(null);
          }}
        />
      )}

      <ScoutHotkeys
        context={{
          inSet: state.inSet,
          helpOpen,
          panelSkill,
          panelSkills,
          canSub,
          reasonCount: state.inSet && reasonPrompt ? POINT_REASONS[reasonPrompt.winner].length : 0,
        }}
        jerseyNumbers={match.roster.map((r) => r.number)}
        onCommand={onHotkey}
        onJersey={(number) => {
          const entry = match.roster.find((r) => r.number === number);
          if (entry && state.inSet && !quickScore) select(entry.playerId);
        }}
      />
      {helpOpen && <HotkeyCheatSheet onClose={() => setHelpOpen(false)} />}

      {pendingUndo && (
        <ConfirmDialog
          title={sp.undoBatchTitle(pendingUndo.length)}
          message={sp.undoBatchMessage(pendingUndo.length)}
          confirmLabel={sp.undoBatchConfirm}
          onCancel={() => setPendingUndo(null)}
          onConfirm={() => {
            if (anchorId && pendingUndo.includes(anchorId)) setAnchorId(null);
            void deleteEvents(teamId, matchId, pendingUndo).catch(() => setWriteError(sp.undoError));
            setPendingUndo(null);
          }}
        />
      )}
    </div>
  );
}
