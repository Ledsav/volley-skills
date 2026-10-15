import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input, Textarea } from '../../components/Input';
import type { Match, MatchEvent, MatchEventPayload } from '../../types/match';
import { batchOrders } from '../eventOrder';
import { replay, sortEvents } from '../scoutEngine';
import { AiError, chatJson, type ChatMessage } from '../../ai/aiClient';
import { LOCAL_UNREACHABLE_HINT, isAiConfigured, providerName, readAiSettings, readDraft, writeDraft } from '../../ai/aiSettings';
import { PreviewRallyCard } from './PreviewRallyCard';
import {
  anonymizeNames,
  batchToPayloads,
  buildMessages,
  chunkText,
  mergeBatches,
  parseBatch,
  type ParsedBatch,
} from './textScout';

interface TextScoutPanelProps {
  match: Match;
  events: MatchEvent[];
  anchorId: string | null;
  maxWritten: number;
  online: boolean;
  /** Writes the batch; returns false when nothing was written (the preview and notes are then kept). */
  onMerge: (payloads: MatchEventPayload[], orders: number[]) => boolean;
  onClose: () => void;
  lastWrite?: { id: string; order: number } | null;
  ask?: (messages: ChatMessage[], signal: AbortSignal) => Promise<unknown>;
}

/** A Process run is aborted after this long. */
export const PROCESS_TIMEOUT_MS = 90_000;

type AbortReason = 'cancel' | 'timeout' | 'unmount';

/** Rejects as soon as `signal` aborts, even if `promise` ignores the signal. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new AiError('unreachable', 'Aborted.'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new AiError('unreachable', 'Aborted.'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

const ERROR_TEXT: Record<AiError['kind'], string> = {
  notConfigured: 'Set up an AI provider in Settings first.',
  unauthorized: 'Key rejected — check it in Settings.',
  rateLimited: 'Rate limit reached.',
  unreachable: 'Could not reach the AI provider. Your notes are kept.',
  badResponse: "Couldn't parse — edit the notes or enter by taps.",
  privacyBlocked: 'No provider for this model keeps your notes private (zero data retention). Pick another model in Settings.',
  http: 'The AI provider returned an error. Your notes are kept.',
};

export function TextScoutPanel({ match, events, anchorId, maxWritten, online, onMerge, onClose, lastWrite, ask }: TextScoutPanelProps) {
  const [text, setText] = useState(() => readDraft(match.id));
  const [batch, setBatch] = useState<ParsedBatch | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState<{ us: string; them: string }>({ us: '', them: '' });
  const [processedText, setProcessedText] = useState<string | null>(null);
  const [settings] = useState(readAiSettings);
  const configured = !!ask || isAiConfigured(settings);
  const askModel = ask ?? ((messages: ChatMessage[], signal: AbortSignal) => chatJson(settings, messages, { signal }));
  const runRef = useRef<{ controller: AbortController; reason: AbortReason | null } | null>(null);

  useEffect(
    () => () => {
      const run = runRef.current;
      if (run) {
        run.reason = 'unmount';
        run.controller.abort();
      }
    },
    [],
  );

  const sorted = useMemo(() => sortEvents(events), [events]);
  const anchorOrder = anchorId ? sorted.find((e) => e.id === anchorId)?.order ?? (lastWrite && lastWrite.id === anchorId ? lastWrite.order : Infinity) : Infinity;
  const before = useMemo(() => sorted.filter((e) => e.order <= anchorOrder), [sorted, anchorOrder]);
  const anchorState = useMemo(() => replay(match, before), [match, before]);

  const { payloads, issues } = useMemo(
    () => (batch ? batchToPayloads(batch, match.roster) : { payloads: [], issues: [] }),
    [batch, match.roster],
  );
  const orders = useMemo(() => batchOrders(events, anchorId, payloads.length, maxWritten, lastWrite ?? null), [events, anchorId, payloads.length, maxWritten, lastWrite]);
  const drafts = useMemo<MatchEvent[]>(
    () => payloads.map((p, i) => ({ ...p, id: `draft-${i}`, order: orders[i], source: 'text', chunkId: 'draft' }) as MatchEvent),
    [payloads, orders],
  );
  const afterState = useMemo(() => replay(match, [...before, ...drafts]), [match, before, drafts]);
  const laterIds = useMemo(() => new Set(sorted.filter((e) => e.order > anchorOrder).map((e) => e.id)), [sorted, anchorOrder]);
  const laterConflicts = useMemo(() => {
    if (laterIds.size === 0 || drafts.length === 0) return 0;
    const keys = (ws: { eventId: string; code: string }[]) =>
      new Set(ws.filter((w) => laterIds.has(w.eventId)).map((w) => `${w.eventId}:${w.code}`));
    const existing = keys(replay(match, events).warnings);
    const after = keys(replay(match, [...events, ...drafts]).warnings);
    return [...after].filter((k) => !existing.has(k)).length;
  }, [match, events, drafts, laterIds]);

  const blocking = issues.some((x) => x.blocking);
  const actualUs = actual.us === '' ? null : Number(actual.us);
  const actualThem = actual.them === '' ? null : Number(actual.them);
  const mismatch =
    batch && actualUs !== null && actualThem !== null && (actualUs !== afterState.score.us || actualThem !== afterState.score.them);

  function editText(next: string) {
    setText(next);
    writeDraft(match.id, next);
  }

  function errorText(e: AiError): string {
    if (e.kind === 'rateLimited') {
      const base = `${providerName(settings.provider)} rate limit reached`;
      return e.retryAfterSec ? `${base} — retry in ${e.retryAfterSec} s.` : `${base} — try again in a moment.`;
    }
    if (e.kind === 'unreachable' && settings.provider === 'local') return `${ERROR_TEXT.unreachable} ${LOCAL_UNREACHABLE_HINT}`;
    return ERROR_TEXT[e.kind];
  }

  function cancel() {
    const run = runRef.current;
    if (!run) return;
    run.reason = 'cancel';
    run.controller.abort();
  }

  async function process() {
    setError(null);
    const source = text;
    const chunks = chunkText(anonymizeNames(source, match.roster));
    if (chunks.length === 0) return;
    const liberoIds = new Set(match.liberos.map((l) => l.playerId));
    const players = match.roster.map((r) => ({
      number: r.number,
      role: anchorState.roles[r.playerId] ?? r.positionCategory,
      isLibero: liberoIds.has(r.playerId),
    }));
    const numberOf = new Map(match.roster.map((r) => [r.playerId, r.number]));
    const anchor = {
      set: anchorState.set,
      score: anchorState.score,
      serving: anchorState.serving,
      rotation: anchorState.rotation,
      onCourt: anchorState.court.map((id) => numberOf.get(id)).filter((n): n is number => n !== undefined),
    };
    const run = { controller: new AbortController(), reason: null as AbortReason | null };
    runRef.current = run;
    const { signal } = run.controller;
    const timer = window.setTimeout(() => {
      run.reason = 'timeout';
      run.controller.abort();
    }, PROCESS_TIMEOUT_MS);
    // One retry when the reply is not JSON or does not validate.
    const askParsed = async (messages: ChatMessage[], retry: boolean): Promise<ParsedBatch> => {
      let parsed: ReturnType<typeof parseBatch>;
      try {
        parsed = parseBatch(await untilAborted(askModel(messages, signal), signal));
      } catch (e) {
        if (retry && !signal.aborted && e instanceof AiError && e.kind === 'badResponse') return askParsed(messages, false);
        throw e;
      }
      if (parsed.ok) return parsed.batch;
      if (retry) return askParsed(messages, false);
      throw new AiError('badResponse', parsed.error);
    };
    const results: ParsedBatch[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        setBusy(chunks.length > 1 ? `Processing ${i + 1}/${chunks.length}…` : 'Processing…');
        results.push(await askParsed(buildMessages(chunks[i], players, anchor), true));
      }
      setBatch(mergeBatches(results));
      setProcessedText(source);
    } catch (e) {
      if (run.reason === 'unmount') return;
      if (run.reason === 'cancel') setError('Cancelled.');
      else if (run.reason === 'timeout') setError('Timed out — your notes are kept.');
      else if (e instanceof AiError) setError(errorText(e));
      else setError('Something went wrong. Your notes are kept.');
    } finally {
      window.clearTimeout(timer);
      if (runRef.current === run) runRef.current = null;
      if (run.reason !== 'unmount') setBusy(null);
    }
  }

  function merge() {
    if (!onMerge(payloads, orders)) return;
    // Keep anything typed after Process; drop only the text that was merged.
    const rest =
      processedText !== null && text.startsWith(processedText) ? text.slice(processedText.length).replace(/^[\r\n]+/, '') : text;
    setError(null);
    setBatch(null);
    setProcessedText(null);
    editText(rest);
    setActual({ us: '', them: '' });
  }

  const canProcess = anchorState.inSet && configured && online && !busy && text.trim().length > 0;

  return (
    <section aria-label="Text scouting" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Text</h2>
        <button type="button" onClick={onClose} className="min-h-11 rounded-md px-3 text-sm text-blue hover:bg-blue/10">Close</button>
      </div>
      <p className="text-xs tabular-nums text-slate">
        Inserting {anchorId ? 'after' : 'at'} {anchorState.score.us}–{anchorState.score.them} · Set {anchorState.set || '–'} · Rot {anchorState.rotation} ·{' '}
        {anchorState.serving === 'us' ? 'we serve' : 'they serve'}
      </p>
      {!anchorState.inSet && <p className="text-sm text-orange-strong">Start the set first.</p>}
      {!configured && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate">No AI provider set up.</p>
          <Link
            to="/settings"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-blue bg-surface px-3 py-1.5 text-sm font-medium text-blue hover:bg-blue/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            Open Settings
          </Link>
        </div>
      )}
      {!online && <p className="text-sm text-slate">Offline — your notes are saved; process them when you're back online.</p>}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Match notes
        <Textarea
          aria-label="Match notes"
          rows={5}
          value={text}
          onChange={(e) => editText(e.target.value)}
          placeholder={'7 ace\n12 bad reception, 2 set, 9 kill\nopp error · TO them · 8 in for 9'}
        />
        <span className="text-xs font-normal text-slate">Tip: add the result — kill, out, blocked, good…</span>
        <span className="text-xs font-normal text-slate">
          Tip: tap your keyboard&apos;s microphone to dictate — e.g. &quot;good serve from 7, then a kill by 12&quot;.
        </span>
        <span className="text-xs font-normal text-slate">
          Notes are sent to your AI provider: use jersey numbers only, no names (including opponents&apos;) and no
          injury or health details.
        </span>
      </label>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => void process()} disabled={!canProcess}>Process</Button>
        {busy && (
          <>
            <span className="text-sm text-slate">{busy}</span>
            <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red">{error}</p>}

      {batch && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tabular-nums text-ink">
            {anchorState.score.us}–{anchorState.score.them} → {afterState.score.us}–{afterState.score.them} · Rot {afterState.rotation} ·{' '}
            {afterState.serving === 'us' ? 'we serve' : 'they serve'}
          </p>
          {laterConflicts > 0 && (
            <p className="text-xs text-orange-strong">{laterConflicts} later event(s) get warnings after this insert — check the timeline.</p>
          )}
          {batch.unparsed.length > 0 && (
            <div className="rounded-md bg-orange/10 p-2 text-xs text-ink">
              <p className="font-medium">Not understood:</p>
              <ul className="list-inside list-disc">
                {batch.unparsed.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {batch.rallies.map((r, i) => (
              <PreviewRallyCard
                key={i}
                index={i}
                rally={r}
                roster={match.roster}
                issues={issues.filter((x) => x.rally === i)}
                onChange={(next) => setBatch({ ...batch, rallies: batch.rallies.map((x, j) => (j === i ? next : x)) })}
                onDelete={() => setBatch({ ...batch, rallies: batch.rallies.filter((_, j) => j !== i) })}
              />
            ))}
          </ul>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate">
              Actual score — us
              <Input aria-label="Actual score us" type="number" min={0} className="w-20 tabular-nums" value={actual.us} onChange={(e) => setActual({ ...actual, us: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate">
              them
              <Input aria-label="Actual score them" type="number" min={0} className="w-20 tabular-nums" value={actual.them} onChange={(e) => setActual({ ...actual, them: e.target.value })} />
            </label>
          </div>
          {mismatch && (
            <p role="alert" className="text-sm text-red">
              Replay gives {afterState.score.us}–{afterState.score.them}, actual is {actual.us}–{actual.them}. Check rallies with no winner.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setBatch(null); setProcessedText(null); setActual({ us: '', them: '' }); setError(null); }}>Discard</Button>
            <Button variant="primary" size="sm" onClick={merge} disabled={!!busy || blocking || payloads.length === 0}>Merge</Button>
          </div>
        </div>
      )}
    </section>
  );
}
