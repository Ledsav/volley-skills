import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FIELD_CLASS, Input } from '../../components/Input';
import { useT } from '../../i18n/I18nProvider';
import type { Gender } from '../../i18n/catalog';
import type { Competition, MatchSetupInput, SetScore } from '../../types/match';
import type { Player } from '../../types/player';
import { setupProblemMessage, validateSetup } from '../matchSetup';
import { autoMapPlayers, mapDvw, ourFilePlayers, type DvwPlan, type PlayerMapping } from './mapDvw';
import { dvwMessageText } from './dvwMessage';
import { pickOurSide } from './pickSide';
import type { DvwFile, DvwPlayer, DvwSide } from './types';

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
  /** For gendered role labels; the import dialog gets it from the team page. */
  gender?: Gender;
  onCancel: () => void;
  /** Called with the plan whose setup already carries the edited match fields. */
  onImport: (plan: DvwPlan) => void;
}

type Edits = Partial<Pick<MatchSetupInput, 'date' | 'opponent' | 'competition'>> & { bestOf?: 3 | 5 };

const GROUP = 'rounded-lg bg-surface p-4';
const HEADER = 'mb-2 text-footnote text-ink-2';

export function DvwReview({ teamId, file, fileName, players, appNames, duplicate, gender = 'mixed', onCancel, onImport }: DvwReviewProps) {
  const t = useT();
  const d = t.dvw.review;
  const roleLabel = (p: DvwPlayer) =>
    p.specialRole === 'L' || p.roleCode === 1
      ? t.labels.position.L(gender)
      : p.roleCode === 2 ? t.labels.position.OH(gender)
      : p.roleCode === 3 ? t.labels.position.O(gender)
      : p.roleCode === 4 ? t.labels.position.MB(gender)
      : p.roleCode === 5 ? t.labels.position.S(gender)
      : d.unknownRole;
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
    ...base.issues.filter((i) => i.kind === 'blocking').map((i) => dvwMessageText(i.message, t)),
    ...(setupProblem ? [setupProblemMessage(setupProblem)] : []),
  ];
  // Parse warnings first, then the mapping's; every message names its lines.
  const warnings = [...file.warnings, ...base.issues.filter((i) => i.kind === 'warning').map((i) => i.message)].map((m) => dvwMessageText(m, t));
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
    <div className="flex flex-col gap-4">
      {duplicate && (
        <p className="rounded-lg bg-orange-tint px-3 py-2 text-callout text-ink">
          {d.alreadyImported(duplicate.date, duplicate.opponent)}{' '}
          <Link to={`/teams/${teamId}/matches/${duplicate.id}`} className="font-semibold text-ink underline">
            {d.openExisting}
          </Link>
        </p>
      )}

      <section className={GROUP}>
        <h3 className={HEADER}>{d.file}</h3>
        <p className="truncate text-callout text-ink">{fileName}</p>
      </section>

      <section className={GROUP}>
        <h3 className={HEADER}>{d.matchGroup}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-callout font-semibold text-ink">
            {d.date}
            <Input type="date" value={setup.date} onChange={(e) => setEdits((c) => ({ ...c, date: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-callout font-semibold text-ink">
            {d.opponent}
            <Input value={setup.opponent} onChange={(e) => setEdits((c) => ({ ...c, opponent: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-callout font-semibold text-ink">
            {d.competition}
            <select
              className={FIELD_CLASS}
              value={setup.competition}
              onChange={(e) => setEdits((c) => ({ ...c, competition: e.target.value as Competition }))}>
              <option value="league">{d.league}</option>
              <option value="cup">{d.cup}</option>
              <option value="friendly">{d.friendly}</option>
              <option value="tournament">{d.tournament}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-callout font-semibold text-ink">
            {d.format}
            <select
              className={FIELD_CLASS}
              value={setup.format.bestOf}
              onChange={(e) => setEdits((c) => ({ ...c, bestOf: Number(e.target.value) as 3 | 5 }))}>
              <option value={3}>{d.bestOf3}</option>
              <option value={5}>{d.bestOf5}</option>
            </select>
          </label>
        </div>
      </section>

      <fieldset className={GROUP}>
        <legend className={`${HEADER} float-left w-full`}>{d.whichTeam}</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
          {(['*', 'a'] as const).map((s) => (
            <label key={s} className="flex min-h-11 items-center gap-2 text-callout text-ink">
              <input type="radio" name="dvw-side" checked={side === s} onChange={() => flip(s)} />
              {file.teams[s].name}
              <span className="text-ink-2">({s === '*' ? d.home : d.visiting})</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={GROUP}>
        <legend className={`${HEADER} float-left w-full`}>{d.roster}</legend>
        <ul className="flex flex-col gap-2">
          {ourFilePlayers(file, side).map((p) => {
            const key = `${side}${p.jersey}`;
            const name = `${p.firstName} ${p.lastName}`.trim() || d.notInList;
            return (
              <li key={key} className="flex items-center gap-2 text-callout">
                <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-ink">#{p.jersey}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{name}</span>
                <span className="hidden w-20 shrink-0 text-footnote text-ink-2 sm:block">{roleLabel(p)}</span>
                <select
                  aria-label={d.mapAria(p.jersey, name)}
                  className={`${FIELD_CLASS} w-40 shrink-0`}
                  value={mapping[key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || null }))}>
                  <option value="">{d.skip}</option>
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

      <section data-testid="checks" aria-label={d.checks} className={`${GROUP} text-callout`}>
        <h3 className={HEADER}>{d.checks}</h3>
        <table className="mb-3 w-full tabular-nums">
          <thead>
            <tr className="text-left text-footnote text-ink-2">
              <th scope="col" className="font-medium">{d.set}</th>
              <th scope="col" className="font-medium">{d.file}</th>
              <th scope="col" className="font-medium">{d.pointLines}</th>
              <th scope="col" className="font-medium">{d.replayed}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sets }, (_, i) => (
              <tr key={i} className="text-ink">
                <td>{d.setN(i + 1)}</td>
                <td>{scoreText(checks.fileSets[i])}</td>
                <td>{scoreText(checks.pointLineSets[i])}</td>
                <td>{scoreText(checks.replaySets[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-ink">
          {d.corrections(checks.corrections.length)}
          {checks.corrections.length > 0 && <> {d.correctionLines(checks.corrections)}</>}
        </p>
        <p className="text-ink-2">
          {d.events}{' '}
          {Object.entries(checks.eventCounts)
            .filter(([, n]) => n > 0)
            .map(([type, n]) => `${d.eventTypes[type as keyof typeof d.eventTypes]} ${n}`)
            .join(', ') || d.none}
        </p>
        <p className="text-ink-2">{d.ignored(checks.ignoredLines)}</p>
        {warnings.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-ink">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </section>

      {scoresDiffer && (
        <div className="rounded-lg bg-orange-tint px-3 py-2 text-callout text-ink">
          <p className="mb-2 font-semibold">{d.scoresDiffer}</p>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            {d.checkedScores}
          </label>
        </div>
      )}

      {blocking.length > 0 && (
        <ul data-testid="blocking-issues" className="flex flex-col gap-1 text-callout text-red-strong">
          {blocking.map((m, i) => (
            <li key={i} role="alert">{m}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>{d.cancel}</Button>
        <Button variant="primary" disabled={!canImport} onClick={() => onImport(plan)}>{d.import}</Button>
      </div>
    </div>
  );
}
