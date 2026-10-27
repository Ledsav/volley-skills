import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FIELD_CLASS, Input } from '../../components/Input';
import type { Competition, MatchSetupInput, SetScore } from '../../types/match';
import type { Player } from '../../types/player';
import { setupProblemMessage, validateSetup } from '../matchSetup';
import { autoMapPlayers, mapDvw, ourFilePlayers, type DvwPlan, type PlayerMapping } from './mapDvw';
import { pickOurSide } from './pickSide';
import type { DvwFile, DvwPlayer, DvwSide } from './types';

const ROLE_LABEL: Record<DvwPlayer['roleCode'], string> = {
  1: 'Libero', 2: 'Outside', 3: 'Opposite', 4: 'Middle', 5: 'Setter', 6: 'Unknown',
};
const roleLabel = (p: DvwPlayer) => (p.specialRole === 'L' ? 'Libero' : ROLE_LABEL[p.roleCode]);

const scoreText = (s: SetScore | undefined) => (s ? `${s.us}–${s.them}` : '–');
const sameSets = (a: SetScore[], b: SetScore[]) =>
  a.length === b.length && a.every((s, i) => s.us === b[i].us && s.them === b[i].them);

interface DvwReviewProps {
  teamId: string;
  file: DvwFile;
  fileName: string;
  players: Player[];
  appNames: string[];
  duplicate: { id: string; date: string; opponent: string } | null;
  onCancel: () => void;
  /** Called with the plan whose setup already carries the edited match fields. */
  onImport: (plan: DvwPlan) => void;
}

type Edits = Partial<Pick<MatchSetupInput, 'date' | 'opponent' | 'competition'>> & { bestOf?: 3 | 5 };

export function DvwReview({ teamId, file, fileName, players, appNames, duplicate, onCancel, onImport }: DvwReviewProps) {
  const [side, setSide] = useState<DvwSide>(() => pickOurSide(file.teams, appNames));
  const [mapping, setMapping] = useState<PlayerMapping>(() => autoMapPlayers(file, side, players));
  const [edits, setEdits] = useState<Edits>({});
  const [confirmed, setConfirmed] = useState(false);
  const [importId] = useState(() => crypto.randomUUID());

  const base = useMemo(() => mapDvw(file, { us: side, mapping, players, importId }), [file, side, mapping, players, importId]);
  const setup: MatchSetupInput = {
    ...base.setup,
    date: edits.date ?? base.setup.date,
    opponent: edits.opponent ?? base.setup.opponent,
    competition: edits.competition ?? base.setup.competition,
    format: { ...base.setup.format, bestOf: edits.bestOf ?? base.setup.format.bestOf },
  };
  const plan: DvwPlan = { ...base, setup };
  const setupProblem = validateSetup(setup);
  const blocking = [
    ...base.issues.filter((i) => i.kind === 'blocking').map((i) => i.message),
    ...(setupProblem ? [setupProblemMessage(setupProblem)] : []),
  ];
  // Parse warnings first, then the mapping's; every message names its lines.
  const warnings = [...file.warnings, ...base.issues.filter((i) => i.kind === 'warning').map((i) => i.message)];
  const { checks } = base;
  const scoresDiffer = !sameSets(checks.replaySets, checks.fileSets);

  useEffect(() => {
    if (!scoresDiffer) setConfirmed(false);
  }, [scoresDiffer]);

  function flip(next: DvwSide) {
    setSide(next);
    setMapping(autoMapPlayers(file, next, players));
    setEdits((c) => ({ ...c, opponent: undefined }));
    setConfirmed(false);
  }

  const canImport = blocking.length === 0 && (!scoresDiffer || confirmed);
  const sets = Math.max(checks.fileSets.length, checks.pointLineSets.length, checks.replaySets.length);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate">{fileName}</p>

      {duplicate && (
        <p className="rounded-md border border-orange bg-orange/10 px-3 py-2 text-sm text-ink">
          This file was already imported on {duplicate.date} against {duplicate.opponent}.{' '}
          <Link to={`/teams/${teamId}/matches/${duplicate.id}`} className="font-medium text-blue hover:underline">
            Open the existing match
          </Link>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Date
          <Input type="date" value={setup.date} onChange={(e) => setEdits((c) => ({ ...c, date: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Opponent
          <Input value={setup.opponent} onChange={(e) => setEdits((c) => ({ ...c, opponent: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Competition
          <select
            className={FIELD_CLASS}
            value={setup.competition}
            onChange={(e) => setEdits((c) => ({ ...c, competition: e.target.value as Competition }))}>
            <option value="league">League</option>
            <option value="cup">Cup</option>
            <option value="friendly">Friendly</option>
            <option value="tournament">Tournament</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Format
          <select
            className={FIELD_CLASS}
            value={setup.format.bestOf}
            onChange={(e) => setEdits((c) => ({ ...c, bestOf: Number(e.target.value) as 3 | 5 }))}>
            <option value={3}>Best of 3</option>
            <option value={5}>Best of 5</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Which team is us</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
          {(['*', 'a'] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="dvw-side" checked={side === s} onChange={() => flip(s)} />
              {file.teams[s].name}
              <span className="text-slate">({s === '*' ? 'home' : 'visiting'})</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Roster</legend>
        <ul className="flex flex-col gap-2">
          {ourFilePlayers(file, side).map((p) => {
            const key = `${side}${p.jersey}`;
            const name = `${p.firstName} ${p.lastName}`.trim() || 'Not in the player list';
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-ink">#{p.jersey}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{name}</span>
                <span className="hidden w-20 shrink-0 text-xs text-slate sm:block">{roleLabel(p)}</span>
                <select
                  aria-label={`Map #${p.jersey} ${name}`}
                  className={`${FIELD_CLASS} w-40 shrink-0`}
                  value={mapping[key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || null }))}>
                  <option value="">Skip</option>
                  {players.map((a) => (
                    <option key={a.id} value={a.id}>
                      #{a.number} {a.fullName}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <section data-testid="checks" aria-label="Checks" className="rounded-md border border-border bg-surface p-3 text-sm">
        <h3 className="mb-2 font-semibold text-ink">Checks</h3>
        <table className="mb-3 w-full tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate">
              <th scope="col" className="font-medium">Set</th>
              <th scope="col" className="font-medium">File</th>
              <th scope="col" className="font-medium">Point lines</th>
              <th scope="col" className="font-medium">Replayed</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sets }, (_, i) => (
              <tr key={i} className="text-ink">
                <td>Set {i + 1}</td>
                <td>{scoreText(checks.fileSets[i])}</td>
                <td>{scoreText(checks.pointLineSets[i])}</td>
                <td>{scoreText(checks.replaySets[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-ink">
          {checks.corrections.length} score corrections
          {checks.corrections.length > 0 && <> (lines {checks.corrections.slice(0, 5).join(', ')}{checks.corrections.length > 5 ? ', …' : ''})</>}
        </p>
        <p className="text-slate">
          Events:{' '}
          {Object.entries(checks.eventCounts)
            .filter(([, n]) => n > 0)
            .map(([type, n]) => `${type} ${n}`)
            .join(', ') || 'none'}
        </p>
        <p className="text-slate">{checks.ignoredLines} lines ignored</p>
        {warnings.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-ink">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </section>

      {scoresDiffer && (
        <div className="rounded-md border border-orange bg-orange/10 px-3 py-2 text-sm text-ink">
          <p className="mb-2 font-medium">The replayed set scores differ from the file&apos;s set scores.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I checked the scores
          </label>
        </div>
      )}

      {blocking.length > 0 && (
        <ul data-testid="blocking-issues" className="flex flex-col gap-1 text-sm text-red">
          {blocking.map((m, i) => (
            <li key={i} role="alert">{m}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!canImport} onClick={() => onImport(plan)}>Import</Button>
      </div>
    </div>
  );
}
