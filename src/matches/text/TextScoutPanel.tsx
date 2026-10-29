import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input, Textarea } from '../../components/Input';
import type { Match, MatchEvent, MatchEventPayload } from '../../types/match';
import { batchOrders } from '../eventOrder';
import { replay, sortEvents } from '../scoutEngine';
import { AI_MAX_TOKENS, AiError, chatJson, type ChatMessage } from '../../ai/aiClient';
import { useT } from '../../i18n/I18nProvider';
import { isAiConfigured, providerName, readAiSettings, readDraft, writeDraft } from '../../ai/aiSettings';
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

export function TextScoutPanel({ match, events, anchorId, maxWritten, online, onMerge, onClose, lastWrite, ask }: TextScoutPanelProps) {
  const t = useT();
  const tx = t.textScout.panel;
  const [text, setText] = useState(() => readDraft(match.id));
  const [batch, setBatch] = useState<ParsedBatch | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState<{ us: string; them: string }>({ us: '', them: '' });
  const [processedText, setProcessedText] = useState<string | null>(null);
  const [settings] = useState(readAiSettings);
  const configured = !!ask || isAiConfigured(settings);
  const askModel = ask ?? ((messages: ChatMessage[], signal: AbortSignal) => chatJson(settings, messages, { signal, maxTokens: AI_MAX_TOKENS.scout }));
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
      const name = providerName(settings.provider);
      return e.retryAfterSec ? tx.retryIn(name, e.retryAfterSec) : tx.tryAgainSoon(name);
    }
    if (e.kind === 'unreachable' && settings.provider === 'local') return `${tx.errors.unreachable} ${t.ai.localHint}`;
    return tx.errors[e.kind];
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
        setBusy(tx.processing(i + 1, chunks.length));
        results.push(await askParsed(buildMessages(chunks[i], players, anchor), true));
      }
      setBatch(mergeBatches(results));
      setProcessedText(source);
    } catch (e) {
      if (run.reason === 'unmount') return;
      if (run.reason === 'cancel') setError(tx.cancelled);
      else if (run.reason === 'timeout') setError(tx.timedOut);
      else if (e instanceof AiError) setError(errorText(e));
      else setError(tx.wentWrong);
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
    <section aria-label={tx.ariaLabel} className="flex flex-col gap-3 rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-headline text-ink">{tx.title}</h2>
        <button type="button" onClick={onClose} className="min-h-11 rounded-md px-3 text-callout font-semibold text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">{tx.close}</button>
      </div>
      <p className="text-footnote tabular-nums text-ink-2">
        {tx.inserting(!!anchorId, anchorState.score.us, anchorState.score.them, anchorState.set || '–', anchorState.rotation, anchorState.serving === 'us')}
      </p>
      {!anchorState.inSet && <p className="text-callout text-orange-strong">{tx.startSetFirst}</p>}
      {!configured && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-callout text-ink-2">{tx.noProvider}</p>
          <Link
            to="/settings"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-surface-2 px-3 py-1.5 text-callout font-semibold tracking-[-0.01em] text-ink hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {tx.openSettings}
          </Link>
        </div>
      )}
      {!online && <p className="text-callout text-ink-2">{tx.offline}</p>}
      <label className="flex flex-col gap-1 text-callout font-semibold text-ink">
        {tx.matchNotes}
        <Textarea
          aria-label={tx.matchNotes}
          rows={5}
          value={text}
          onChange={(e) => editText(e.target.value)}
          placeholder={tx.placeholder}
        />
        <span className="mt-1 flex flex-col gap-0.5 text-footnote font-normal text-ink-2">
          <span>{tx.tipResult}</span>
          <span>{tx.tipDictate}</span>
          <span>{tx.privacy}</span>
        </span>
      </label>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => void process()} disabled={!canProcess}>{tx.process}</Button>
        {busy && (
          <>
            <span className="text-callout text-ink-2">{busy}</span>
            <Button variant="ghost" size="sm" onClick={cancel}>{tx.cancel}</Button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-callout text-red-strong">{error}</p>}

      {batch && (
        <div className="flex flex-col gap-2">
          <p className="text-callout font-semibold tabular-nums text-ink">
            {tx.scoreChange(anchorState.score.us, anchorState.score.them, afterState.score.us, afterState.score.them, afterState.rotation, afterState.serving === 'us')}
          </p>
          {laterConflicts > 0 && (
            <p className="text-footnote text-orange-strong">{tx.laterWarnings(laterConflicts)}</p>
          )}
          {batch.unparsed.length > 0 && (
            <div className="rounded-lg bg-orange-tint p-3 text-footnote text-ink">
              <p className="font-medium">{tx.notUnderstood}</p>
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
            <label className="flex flex-col gap-1 text-footnote text-ink-2">
              {tx.actualUs}
              <Input aria-label={tx.actualUsAria} type="number" min={0} className="w-20 tabular-nums" value={actual.us} onChange={(e) => setActual({ ...actual, us: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-footnote text-ink-2">
              {tx.actualThem}
              <Input aria-label={tx.actualThemAria} type="number" min={0} className="w-20 tabular-nums" value={actual.them} onChange={(e) => setActual({ ...actual, them: e.target.value })} />
            </label>
          </div>
          {mismatch && (
            <p role="alert" className="text-callout text-red-strong">
              {tx.mismatch(afterState.score.us, afterState.score.them, actual.us, actual.them)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setBatch(null); setProcessedText(null); setActual({ us: '', them: '' }); setError(null); }}>{tx.discard}</Button>
            <Button variant="primary" size="sm" onClick={merge} disabled={!!busy || blocking || payloads.length === 0}>{tx.merge}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
