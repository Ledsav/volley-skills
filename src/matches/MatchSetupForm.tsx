import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Field, FIELD_LABEL_CLASS, Input } from '../components/Input';
import { Select } from '../components/Select';
import {
  DEFAULT_FORMAT,
  type Competition,
  type HomeAway,
  type LiberoMode,
  type MatchFormat,
  type MatchSetupInput,
} from '../types/match';
import { POSITION_CATEGORIES, type Player, type PositionCategory } from '../types/player';
import { todayIso } from '../calendar/monthGrid';
import { loadTeamRoster } from './matchesApi';
import { getT, useT } from '../i18n/I18nProvider';
import { MAX_ROSTER, buildRoster, defaultRosterIds, validateSetup, setupProblemMessage } from './matchSetup';

interface MatchSetupFormProps {
  teamId: string;
  initial?: MatchSetupInput;
  defaultDate?: string;
  submitLabel: string;
  /** May return the pending write; the form never waits for it (offline), only surfaces a rejection. */
  onSubmit: (input: MatchSetupInput) => Promise<void> | void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** In a sheet: one roster column, so names keep room beside the role and number fields. */
  narrow?: boolean;
}

// The fieldset itself stays unstyled: a background or border on it would draw the legend in the card's top edge
// (the classic notch). The legend sits above the card as a section header, inset to the card's text.
const FIELDSET = 'min-w-0';
const LEGEND = 'mb-2 px-4 text-footnote font-medium text-ink-2';
const GROUP = 'rounded-lg bg-surface p-4';

/** `role` = this match's role for the player (snapshot only; the profile is untouched). */
type Picks = Record<string, { checked: boolean; number: number; role: PositionCategory }>;
interface LiberoPick { playerId: string; mode: LiberoMode }

export function MatchSetupForm({ teamId, initial, defaultDate, submitLabel, onSubmit, onCancel, onDirtyChange, narrow = false }: MatchSetupFormProps) {
  const t = useT();
  const m = t.matches.setup;
  const LIBERO_MODES: { value: LiberoMode; label: string }[] = [
    { value: 'always', label: m.modeAlways },
    { value: 'receiving', label: m.modeReceiving },
    { value: 'serving', label: m.modeServing },
  ];
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayIso());
  const [opponent, setOpponent] = useState(initial?.opponent ?? '');
  const [competition, setCompetition] = useState<Competition>(initial?.competition ?? 'league');
  const [homeAway, setHomeAway] = useState<HomeAway>(initial?.homeAway ?? 'home');
  const [format, setFormat] = useState<MatchFormat>(initial?.format ?? DEFAULT_FORMAT);
  const [picks, setPicks] = useState<Picks>({});
  const [liberoPicks, setLiberoPicks] = useState<LiberoPick[]>(() => {
    const fromInitial = initial?.liberos.map((l) => ({ playerId: l.playerId, mode: l.mode })) ?? [];
    const defaults: LiberoPick[] = [
      { playerId: '', mode: 'always' },
      { playerId: '', mode: 'receiving' },
    ];
    return [0, 1].map((i) => fromInitial[i] ?? defaults[i]);
  });
  const [replaces, setReplaces] = useState<string[] | null>(initial?.liberos[0]?.replaces ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadTeamRoster(teamId)
      .then((loaded) => {
        setPlayers(loaded);
        const inRoster = new Map(initial?.roster.map((r) => [r.playerId, r]));
        const defaults = new Set(defaultRosterIds(loaded));
        const roleOf = (p: Player) => inRoster.get(p.id)?.positionCategory ?? p.positionCategory;
        setPicks(
          Object.fromEntries(
            loaded.map((p) => [
              p.id,
              {
                checked: initial ? inRoster.has(p.id) : defaults.has(p.id),
                number: inRoster.get(p.id)?.number ?? p.number,
                role: roleOf(p),
              },
            ]),
          ),
        );
        if (!initial) {
          const ls = loaded.filter((p) => defaults.has(p.id) && roleOf(p) === 'L').sort((a, b) => a.number - b.number);
          if (ls.length) {
            setLiberoPicks((cur) =>
              cur.some((l) => l.playerId)
                ? cur
                : [
                    { playerId: ls[0].id, mode: ls.length > 1 ? 'receiving' : 'always' },
                    { playerId: ls[1]?.id ?? '', mode: 'serving' },
                  ],
            );
          }
        }
        setReplaces((prev) => prev ?? loaded.filter((p) => roleOf(p) === 'MB').map((p) => p.id));
      })
      .catch(() => setError(getT().matches.setup.loadRosterError));
  }, [teamId, initial]);

  function setNum<K extends keyof MatchFormat>(key: K, value: number) {
    setFormat((f) => ({ ...f, [key]: value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!players) return;
    const roster = buildRoster(players, picks);
    const liberos = liberoPicks
      .filter((l) => l.playerId)
      .map((l) => ({ playerId: l.playerId, mode: l.mode, replaces: (replaces ?? []).filter((id) => id !== l.playerId) }));
    const input: MatchSetupInput = { date, opponent: opponent.trim(), competition, homeAway, format, roster, liberos };
    const problem = validateSetup(input);
    if (problem) {
      setError(setupProblemMessage(problem));
      return;
    }
    const failed = () => {
      setSaved(false);
      setError(m.saveError);
      onDirtyChange?.(true);
    };
    setError(null);
    try {
      const written = onSubmit(input);
      setSaved(true);
      onDirtyChange?.(false);
      written?.catch(failed);
    } catch {
      failed();
    }
  }

  if (!players) return <p className="text-ink-2">{error ?? m.loadingRoster}</p>;
  const checkedPlayers = players.filter((p) => picks[p.id]?.checked);
  const liberoIds = new Set(liberoPicks.map((l) => l.playerId).filter(Boolean));
  const numberCounts = new Map<number, number>();
  for (const p of checkedPlayers) numberCounts.set(picks[p.id].number, (numberCounts.get(picks[p.id].number) ?? 0) + 1);
  const isDuplicate = (id: string) => !!picks[id]?.checked && (numberCounts.get(picks[id].number) ?? 0) > 1;
  const hasDuplicates = checkedPlayers.some((p) => isDuplicate(p.id));
  const tooMany = checkedPlayers.length > MAX_ROSTER;
  // Fields sit on a surface-2 row inside a surface group, so they lift to surface.
  const ON_ROW = '!bg-surface';

  return (
    <form
      onSubmit={submit}
      onChange={() => {
        setSaved(false);
        onDirtyChange?.(true);
      }}
      className="flex flex-col gap-4">
      <fieldset className={FIELDSET}>
        <legend className={LEGEND}>{m.details}</legend>
        <div className={`${GROUP} grid gap-3 sm:grid-cols-2`}>
          <Field label={m.date}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={m.opponent}>
            <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder={m.opponentPlaceholder} />
          </Field>
          <Field label={m.competition}>
            <Select value={competition} onChange={(e) => setCompetition(e.target.value as Competition)}>
              <option value="league">{t.labels.competition.league}</option>
              <option value="cup">{t.labels.competition.cup}</option>
              <option value="friendly">{t.labels.competition.friendly}</option>
              <option value="tournament">{t.labels.competition.tournament}</option>
            </Select>
          </Field>
          <Field label={m.venue}>
            <Select value={homeAway} onChange={(e) => setHomeAway(e.target.value as HomeAway)}>
              <option value="home">{t.matches.shared.home}</option>
              <option value="away">{t.matches.shared.away}</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className={LEGEND}>{m.format}</legend>
        <div className={`${GROUP} grid grid-cols-2 gap-3 sm:grid-cols-5`}>
        <Field label={m.bestOf}>
          <Select value={format.bestOf} onChange={(e) => setNum('bestOf', Number(e.target.value) as 3 | 5)}>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </Select>
        </Field>
        {([
          ['setPoints', m.setPoints],
          ['decidingSetPoints', m.decidingSet],
          ['subsPerSet', m.subsPerSet],
          ['timeoutsPerSet', m.timeoutsPerSet],
        ] as const).map(([key, label]) => (
          <Field key={key} label={label}>
            <Input type="number" min={0} value={format[key]} onChange={(e) => setNum(key, Number(e.target.value))} />
          </Field>
        ))}
        </div>
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className={LEGEND}>{m.roster}</legend>
        <div className={GROUP}>
        <p className={`mb-2 text-callout tabular-nums ${tooMany ? 'font-semibold text-red-strong' : 'text-ink-2'}`}>
          {m.selected(checkedPlayers.length, MAX_ROSTER)}
        </p>
        <ul className={narrow ? 'grid gap-2' : 'grid gap-2 sm:grid-cols-2'}>
          {players.map((p) => (
            <li
              key={p.id}
              className={`flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 ${isDuplicate(p.id) ? 'ring-1 ring-red' : ''}`}>
              <input
                type="checkbox"
                aria-label={m.include(p.fullName)}
                className="h-5 w-5"
                checked={picks[p.id]?.checked ?? false}
                onChange={(e) => setPicks((cur) => ({ ...cur, [p.id]: { ...cur[p.id], checked: e.target.checked } }))}
              />
              <span className="min-w-0 flex-1 truncate text-callout text-ink">#{p.number} {p.fullName}</span>
              <Select
                aria-label={m.roleFor(p.fullName)}
                className={`${ON_ROW} min-h-11 w-24 text-base sm:text-sm`}
                value={picks[p.id]?.role ?? p.positionCategory}
                onChange={(e) =>
                  setPicks((cur) => ({ ...cur, [p.id]: { ...cur[p.id], role: e.target.value as PositionCategory } }))
                }
              >
                {POSITION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.value}</option>
                ))}
              </Select>
              <Input
                type="number"
                aria-label={m.numberFor(p.fullName)}
                className={`w-16 tabular-nums ${ON_ROW}`}
                min={1}
                max={99}
                value={picks[p.id]?.number ?? p.number}
                onChange={(e) => setPicks((cur) => ({ ...cur, [p.id]: { ...cur[p.id], number: Number(e.target.value) } }))}
              />
              {isDuplicate(p.id) && (
                <span className="w-full text-footnote font-semibold text-red-strong">{m.duplicate(picks[p.id].number)}</span>
              )}
            </li>
          ))}
        </ul>
        </div>
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className={LEGEND}>{m.liberos}</legend>
        <div className={`${GROUP} flex flex-col gap-3`}>
        {[0, 1].map((i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <Field label={m.libero(i + 1)}>
              <Select
                aria-label={m.libero(i + 1)}
                
                value={liberoPicks[i].playerId}
                onChange={(e) =>
                  setLiberoPicks((cur) => cur.map((l, j) => (j === i ? { ...l, playerId: e.target.value } : l)))
                }
              >
                <option value="">{m.none}</option>
                {checkedPlayers.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} (#{picks[p.id].number})</option>
                ))}
              </Select>
            </Field>
            <Field label={m.onCourt}>
              <Select
                aria-label={m.liberoMode(i + 1)}
                
                value={liberoPicks[i].mode}
                onChange={(e) =>
                  setLiberoPicks((cur) => cur.map((l, j) => (j === i ? { ...l, mode: e.target.value as LiberoMode } : l)))
                }
              >
                {LIBERO_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        ))}
        {liberoIds.size > 0 && (
          <div>
            <p className={FIELD_LABEL_CLASS}>{m.replaces}</p>
            <div className="flex flex-wrap gap-2">
              {checkedPlayers.filter((p) => !liberoIds.has(p.id)).map((p) => (
                <label key={p.id} className="flex min-h-11 items-center gap-2 rounded-md bg-surface-2 px-3 text-callout tabular-nums text-ink">
                  <input
                    type="checkbox"
                    checked={(replaces ?? []).includes(p.id)}
                    onChange={(e) =>
                      setReplaces((cur) => (e.target.checked ? [...(cur ?? []), p.id] : (cur ?? []).filter((id) => id !== p.id)))
                    }
                  />
                  #{picks[p.id].number}
                </label>
              ))}
            </div>
          </div>
        )}
        </div>
      </fieldset>

      {saved && !error && <p role="status" className="text-callout text-green-strong">{m.saved}</p>}
      {error && <p role="alert" className="text-callout text-red-strong">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>{t.common.cancel}</Button>
        <Button variant="primary" type="submit" disabled={hasDuplicates || tooMany}>{submitLabel}</Button>
      </div>
    </form>
  );
}
