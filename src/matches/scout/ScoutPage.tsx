import { NotFoundState, isNotFoundError } from '../../components/NotFoundState';
import { usePageMeta } from '../../layout/usePageMeta';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useClubFeatures } from '../../clubs/useClubFeatures';
import { getT, useT } from '../../i18n/I18nProvider';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SegmentedControl } from '../../components/SegmentedControl';
import { tapFlash } from '../../motion/tapFlash';
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
import { ScoutStartTip } from '../../onboarding/ScoutStartTip';
import { ScoutRoot } from './ScoutRoot';
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
import { TakeoverSheet } from './TakeoverSheet';
import { useDeviceTakeover } from './useDeviceTakeover';
import { StatusStrip, type StatusStripProps } from './StatusStrip';
import { pickStrip } from './pickStrip';
import { useWriteError } from './useWriteError';
import { ScoutHeader } from './ScoutHeader';
import type { MenuItem } from '../../components/Menu';
import { LiveStatsPanel } from './LiveStatsPanel';
import { SetStartDialog } from './SetStartDialog';
import { TextScoutPanel } from '../text/TextScoutPanel';
import { SubDialog } from './SubDialog';
import { TimelineDrawer } from './TimelineDrawer';
import { readQuickScore, writeQuickScore } from './quickScore';
import { useScoutHotkeys, type ScoutHotkeysOptions } from './useScoutHotkeys';

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
function nextSetServing(events: MatchEvent[]): Side | null {
  const prevStart = sortEvents(events).filter((e) => e.type === 'setStart').pop();
  if (!prevStart || prevStart.type !== 'setStart') return null;
  return prevStart.serving === 'us' ? 'them' : 'us';
}

/** Mounts the keyboard listener once the page is live and shows its jersey hint. */
function ScoutHotkeys(props: ScoutHotkeysOptions): ReactNode {
  const { hint } = useScoutHotkeys(props);
  if (!hint) return null;
  return (
    <p
      role="status"
      className="pointer-events-none fixed bottom-40 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-callout font-medium tabular-nums text-on-ink shadow-pop"
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
  // Landscape phones: too short for a stacked panel, so the panel sits beside the court and the dock is one row.
  const isShort = useMediaQuery('(max-height: 560px) and (orientation: landscape)', false) && !isDesktop;
  const deviceId = useMemo(() => getDeviceId(), []);

  const [match, setMatch] = useState<Match | null>(null);
  const [usage, setUsage] = useState<UsageProfile>({ players: {} });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const writeError = useWriteError();
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
  const { takenOver, takeBack } = useDeviceTakeover({ teamId, matchId, deviceId, active: matchLoaded && !locked });

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
    if (!match || !state || locked || takenOver) return;
    const result = resultFromState(state);
    if (sameResult(result, match.result)) return;
    setMatch({ ...match, result });
    updateMatchResult(teamId, matchId, result).catch(() => undefined);
  }, [state, match, locked, takenOver, teamId, matchId]);

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
      if (!events || !firebaseUser || takenOver) return null;
      setReasonPrompt(null);
      const order = nextOrder(events, anchorId, lastWriteRef.current, maxOrderRef.current);
      const { id, written } = addEvent(teamId, matchId, { ...payload, order, source, chunkId: null }, firebaseUser.uid);
      writeError.track(written, getT().scout.page.writeAction);
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
    [events, firebaseUser, takenOver, anchorId, teamId, matchId, writeError],
  );

  function mergeText(payloads: MatchEventPayload[], orders: number[]): boolean {
    if (!firebaseUser || takenOver || payloads.length === 0) return false;
    const chunkId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `chunk-${Date.now()}`;
    payloads.forEach((payload, i) => {
      const { id, written } = addEvent(teamId, matchId, { ...payload, order: orders[i], source: 'text', chunkId }, firebaseUser.uid);
      writeError.track(written, getT().scout.page.writeText);
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
    if (!events || events.length === 0 || takenOver) return;
    const target = undoTarget(events, writtenRef.current);
    writtenRef.current = target.stack;
    if (target.kind === 'none' || target.kind === 'importOnly') return;
    setReasonPrompt(null);
    const ids = target.ids;
    if (target.kind === 'batch') setPendingUndo(ids);
    else if (anchorId && ids.includes(anchorId)) setAnchorId(null);
    if (ids.length === 1) void deleteEvents(teamId, matchId, ids).catch(() => writeError.show(getT().scout.page.undoError));
  }

  function recordPoint(winner: Side) {
    const id = record({ type: 'point', winner, reason: null });
    if (id) setReasonPrompt({ eventId: id, winner });
  }

  function amendReason(eventId: string, reason: PointReason) {
    void updateEvent(teamId, matchId, eventId, { reason }).catch(() => writeError.show(getT().scout.page.pointReasonError));
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
    if (takenOver) return;
    if (reasonPrompt && ids.includes(reasonPrompt.eventId)) setReasonPrompt(null);
    if (anchorId && ids.includes(anchorId)) setAnchorId(null);
    void deleteEvents(teamId, matchId, ids).catch(() => writeError.show(getT().scout.page.deleteError));
  }

  async function finish() {
    if (!match || !state || finishingRef.current) return;
    finishingRef.current = true;
    let fresh: UsageProfile;
    try {
      fresh = await getUsageProfile(teamId);
    } catch {
      finishingRef.current = false;
      writeError.show(getT().matches.page.usageError);
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
    return (
      <ScoutRoot>
        <NotFoundState title={tr.matches.page.notFoundTitle} message={tr.matches.page.notFoundMessage} backTo={`/teams/${teamId}`} backLabel={tr.matches.page.backToTeam} />
      </ScoutRoot>
    );
  }
  if (loadError || eventsError) {
    return (
      <ScoutRoot>
        <p role="alert" className="p-6 text-red-strong">{loadError ?? eventsError}</p>
      </ScoutRoot>
    );
  }
  if (!match || !state) {
    return (
      <ScoutRoot>
        <p className="p-6 text-ink-2">{tr.matches.page.loading}</p>
      </ScoutRoot>
    );
  }

  if (locked) {
    return (
      <ScoutRoot>
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
      </ScoutRoot>
    );
  }

  const liberoIds = new Set(match.liberos.map((l) => l.playerId));
  // Setup events do not count: the tip is about the first tap on a player or a point.
  const hasTapped = (events ?? []).some((e) => e.type === 'action' || e.type === 'point');
  const selected = selectedId ? roster.get(selectedId) : undefined;
  const stripKind = pickStrip({
    error: writeError.error !== null,
    matchOver: state.matchOver,
    betweenSets: !state.inSet && !state.matchOver,
    inserting: anchorId !== null,
  });
  let stripProps: StatusStripProps | null = null;
  if (stripKind === 'error') {
    stripProps = { kind: 'error', message: writeError.error ?? '', dismissLabel: sp.dismiss, onDismiss: writeError.dismiss };
  } else if (stripKind === 'matchOver') {
    stripProps = {
      kind: 'matchOver',
      label: sp.matchOver(state.setsWon.us, state.setsWon.them),
      finishLabel: tr.matches.page.finish,
      onFinish: () => void finish(),
    };
  } else if (stripKind === 'betweenSets') {
    stripProps = {
      kind: 'betweenSets',
      label:
        state.set === 0
          ? sp.setLineup
          : sp.setOver(state.set, state.setScores[state.set - 1]?.us ?? 0, state.setScores[state.set - 1]?.them ?? 0),
      undoLabel: state.set > 0 ? sp.undoSetEnd : null,
      onUndo: undoSetEnd,
      startLabel: sp.startSet(state.set + 1),
      onStart: () => setSetDialogOpen(true),
    };
  } else if (stripKind === 'inserting') {
    stripProps = { kind: 'inserting', label: sp.inserting, backLabel: sp.backToLive, onBack: () => setAnchorId(null) };
  }

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

  // Desktop: inline under the court. Phones: pinned above the dock, outside the scrolling main, so the
  // grades never need a scroll while the court shrinks.
  const actionPanel =
    panelPlayer && panelSkill && selection ? (
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
    ) : null;

  // Desktop: the column is exactly the height between header and dock, so the court never needs a page
  // scroll. Phones keep their scrolling main.
  const courtColumn = (
    <div className={`flex flex-col gap-3 ${isDesktop ? 'h-full min-h-0' : 'min-h-full'}`}>
      <ScoutStartTip tapped={hasTapped} hidden={quickScore || isShort || !state.inSet} />
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
            // Stays compact while auto-select will reopen the panel, so the court does not jump after every grade.
            compact={!isDesktop && (isShort || actionPanel !== null || (autoSelect && !quickScore && state.inSet))}
            onSelect={(id) => select(id)}
            onLongPress={(id) => {
              if (!liberoIds.has(id)) setSubOutId(id);
            }}
          />
          {/* While a player's actions are open, grading gets the room. */}
          {!panelPlayer && <BenchStrip players={bench} names={names} onSelect={(id) => select(id)} disabled={!state.inSet} />}
        </>
      )}
      {isDesktop && actionPanel}
      {!state.inSet && <p className="py-2 text-center text-callout text-ink-2">{sp.startToRecord}</p>}
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
    <ScoutRoot>
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
      {stripProps && <StatusStrip {...stripProps} />}
      {/* The content region: the set-point prompt floats at its top, below the header and any status strip. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {isDesktop ? (
          // One row exactly as tall as the space between header and dock: the court fits, and the right
          // column's panels scroll inside themselves instead of pushing the page.
          <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.4fr)_360px] grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.4fr)_400px]">
            {courtColumn}
            <div className="flex min-h-0 min-w-0 flex-col gap-4">
              {textPanel && <div className={textVisible ? 'scroll-quiet min-h-0 shrink overflow-y-auto rounded-lg' : undefined}>{textPanel}</div>}
              {!textVisible && <div className="scroll-quiet min-h-0 shrink overflow-y-auto rounded-lg">{live}</div>}
              <div className="scroll-quiet max-h-[40%] min-h-0 shrink-0 overflow-y-auto rounded-lg">{timeline}</div>
            </div>
          </main>
        ) : (
          <>
            <SegmentedControl
              semantics="tabs"
              label={sp.views}
              options={[
                { id: 'court', label: sp.tabCourt },
                { id: 'live', label: sp.tabLive },
                { id: 'timeline', label: sp.tabTimeline },
                ...(aiEnabled ? [{ id: 'text' as const, label: sp.tabText }] : []),
              ]}
              value={phoneTab}
              onChange={setPhoneTab}
              className="mx-3 mt-2 shrink-0"
            />
            <main
              className={`min-h-0 flex-1 overflow-y-auto ${actionPanel && !isShort ? 'p-2' : 'p-3'} ${
                isShort && phoneTab === 'court' ? 'grid grid-cols-2 gap-3' : 'flex flex-col'
              }`}
            >
              {phoneTab === 'court' && courtColumn}
              {isShort && phoneTab === 'court' && <div className="min-w-0">{actionPanel}</div>}
              {phoneTab === 'live' && live}
              {phoneTab === 'timeline' && timeline}
              {textPanel}
            </main>
            {/* Portrait phones: pinned above the dock but allowed to shrink and scroll, so the dock is never clipped. */}
            {!isShort && phoneTab === 'court' && actionPanel && (
              <div data-testid="pinned-panel" className="min-h-0 shrink overflow-y-auto px-2 pb-2">
                {actionPanel}
              </div>
            )}
          </>
        )}
        {state.setPointReached && dismissedSetPoint !== `${state.set}-${state.score.us}-${state.score.them}` && (
          <div
            role="dialog"
            aria-label={sp.setPoint}
            className="absolute inset-x-3 top-2 z-40 rounded-xl bg-surface p-4 shadow-pop md:inset-x-auto md:left-1/2 md:w-[420px] md:-translate-x-1/2"
          >
            <p className="mb-3 text-headline text-ink">
              {sp.setResult(state.score.us > state.score.them, state.score.us, state.score.them)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onPointerDown={(e) => tapFlash(e.currentTarget)}
                onClick={() => setDismissedSetPoint(`${state.set}-${state.score.us}-${state.score.them}`)}
                className="min-h-14 rounded-md bg-surface-2 px-4 text-headline text-ink"
              >
                {sp.notYet}
              </button>
              <button
                type="button"
                aria-label={sp.confirmSet}
                onPointerDown={(e) => tapFlash(e.currentTarget)}
                onClick={confirmSet}
                className="min-h-14 rounded-md bg-ink px-4 text-headline text-on-ink"
              >
                {sp.confirmSet}
              </button>
            </div>
          </div>
        )}
      </div>
      {state.inSet && (
        <section
          aria-label={sp.events}
          className="shrink-0 border-t border-separator bg-bg px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
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
              oneRow={isShort}
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
          initialServing={nextSetServing(events ?? [])}
          onCancel={() => setSetDialogOpen(false)}
          onStart={(lineup, serving, roles) => {
            record({ type: 'setStart', set: state.set + 1, lineup, serving, roles });
            setSetDialogOpen(false);
            // Later sets default to these roles: keep them in the match roster snapshot.
            if (match.roster.some((r) => roles[r.playerId] && roles[r.playerId] !== r.positionCategory)) {
              const nextRoster = match.roster.map((r) => ({ ...r, positionCategory: roles[r.playerId] ?? r.positionCategory }));
              setMatch({ ...match, roster: nextRoster });
              updateMatchRoster(teamId, matchId, nextRoster).catch(() =>
                writeError.show(sp.rosterError),
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

      {editing && (
        <EditEventDialog
          event={editing}
          roster={match.roster}
          onCancel={() => setEditing(null)}
          onSave={(patch) => {
            void updateEvent(teamId, matchId, editing.id, patch).catch(() => writeError.show(getT().scout.page.editError));
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
            if (takenOver) {
              setPendingUndo(null);
              return;
            }
            if (anchorId && pendingUndo.includes(anchorId)) setAnchorId(null);
            void deleteEvents(teamId, matchId, pendingUndo).catch(() => writeError.show(sp.undoError));
            setPendingUndo(null);
          }}
        />
      )}
      {/* Last, so it stacks above any confirm that was already open. */}
      {takenOver && (
        <TakeoverSheet onTakeBack={takeBack} onLeave={() => navigate(`/teams/${teamId}/matches/${matchId}`)} />
      )}
    </ScoutRoot>
  );
}
