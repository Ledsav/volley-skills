import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Input, Textarea } from '../../components/Input';
import type { Match, MatchEvent, MatchEventPayload } from '../../types/match';
import { batchOrders } from '../eventOrder';
import { replay, sortEvents } from '../scoutEngine';
import { AiError, chatJson, type ChatMessage } from './aiClient';
import { isAiConfigured, readAiSettings, readDraft, writeDraft } from './aiSettings';
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
  onMerge: (payloads: MatchEventPayload[], orders: number[]) => void;
  onClose: () => void;
  lastWrite?: { id: string; order: number } | null;
  ask?: (messages: ChatMessage[]) => Promise<unknown>;
}

const ERROR_TEXT: Record<AiError['kind'], string> = {
  notConfigured: 'Set up an AI provider in Settings first.',
  unauthorized: 'Key rejected — check it in Settings.',
  rateLimited: 'Rate limit reached',
  unreachable: 'Could not reach the AI provider. Your notes are kept.',
  badResponse: "Couldn't parse — edit the notes or enter by taps.",
  http: 'The AI provider returned an error. Your notes are kept.',
};

export function TextScoutPanel({ match, events, anchorId, maxWritten, online, onMerge, onClose, lastWrite, ask }: TextScoutPanelProps) {
  const [text, setText] = useState(() => readDraft(match.id));
  const [batch, setBatch] = useState<ParsedBatch | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState<{ us: string; them: string }>({ us: '', them: '' });
  const settings = readAiSettings();
  const configured = !!ask || isAiConfigured(settings);
  const askModel = ask ?? ((messages: ChatMessage[]) => chatJson(settings, messages));

  const sorted = useMemo(() => sortEvents(events), [events]);
  const anchorOrder = anchorId ? sorted.find((e) => e.id === anchorId)?.order ?? Infinity : Infinity;
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
  const laterConflicts = useMemo(
    () => (laterIds.size === 0 ? 0 : replay(match, [...events, ...drafts]).warnings.filter((w) => laterIds.has(w.eventId)).length),
    [match, events, drafts, laterIds],
  );

  const blocking = issues.some((x) => x.blocking);
  const actualUs = actual.us === '' ? null : Number(actual.us);
  const actualThem = actual.them === '' ? null : Number(actual.them);
  const mismatch =
    batch && actualUs !== null && actualThem !== null && (actualUs !== afterState.score.us || actualThem !== afterState.score.them);

  function editText(next: string) {
    setText(next);
    writeDraft(match.id, next);
  }

  async function process() {
    setError(null);
    const chunks = chunkText(anonymizeNames(text, match.roster));
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
    const results: ParsedBatch[] = [];
    try {
      for (let i = 0; i < chunks.length; i++) {
        setBusy(chunks.length > 1 ? `Processing ${i + 1}/${chunks.length}…` : 'Processing…');
        const messages = buildMessages(chunks[i], players, anchor);
        let parsed = parseBatch(await askModel(messages));
        if (!parsed.ok) parsed = parseBatch(await askModel(messages));
        if (!parsed.ok) throw new AiError('badResponse', parsed.error);
        results.push(parsed.batch);
      }
      setBatch(mergeBatches(results));
    } catch (e) {
      if (e instanceof AiError) {
        setError(e.kind === 'rateLimited' && e.retryAfterSec ? `${ERROR_TEXT.rateLimited} — retry in ${e.retryAfterSec} s.` : ERROR_TEXT[e.kind]);
      } else {
        setError('Something went wrong. Your notes are kept.');
      }
    } finally {
      setBusy(null);
    }
  }

  function merge() {
    onMerge(payloads, orders);
    setBatch(null);
    editText('');
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
        <p className="text-sm text-slate">
          No AI provider set up. <Link to="/settings" className="text-blue hover:underline">Open Settings</Link>
        </p>
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
      </label>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => void process()} disabled={!canProcess}>Process</Button>
        {busy && <span className="text-sm text-slate">{busy}</span>}
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
            <Button variant="ghost" size="sm" onClick={() => setBatch(null)}>Discard</Button>
            <Button variant="primary" size="sm" onClick={merge} disabled={blocking || payloads.length === 0}>Merge</Button>
          </div>
        </div>
      )}
    </section>
  );
}
