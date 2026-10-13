import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input } from '../components/Input';
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
import { MAX_ROSTER, buildRoster, defaultRosterIds, validateSetup } from './matchSetup';

interface MatchSetupFormProps {
  teamId: string;
  initial?: MatchSetupInput;
  defaultDate?: string;
  submitLabel: string;
  /** May return the pending write; the form never waits for it (offline), only surfaces a rejection. */
  onSubmit: (input: MatchSetupInput) => Promise<void> | void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/** `role` = this match's role for the player (snapshot only; the profile is untouched). */
type Picks = Record<string, { checked: boolean; number: number; role: PositionCategory }>;
interface LiberoPick { playerId: string; mode: LiberoMode }

const LIBERO_MODES: { value: LiberoMode; label: string }[] = [
  { value: 'always', label: 'Always' },
  { value: 'receiving', label: 'When we receive' },
  { value: 'serving', label: 'When we serve' },
];

export function MatchSetupForm({ teamId, initial, defaultDate, submitLabel, onSubmit, onCancel, onDirtyChange }: MatchSetupFormProps) {
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
      .catch(() => setError('Could not load the team roster.'));
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
      setError(problem);
      return;
    }
    const failed = () => {
      setSaved(false);
      setError('Could not save the match. Please try again.');
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

  if (!players) return <p className="text-slate">{error ?? 'Loading roster…'}</p>;
  const checkedPlayers = players.filter((p) => picks[p.id]?.checked);
  const liberoIds = new Set(liberoPicks.map((l) => l.playerId).filter(Boolean));
  const numberCounts = new Map<number, number>();
  for (const p of checkedPlayers) numberCounts.set(picks[p.id].number, (numberCounts.get(picks[p.id].number) ?? 0) + 1);
  const isDuplicate = (id: string) => !!picks[id]?.checked && (numberCounts.get(picks[id].number) ?? 0) > 1;
  const hasDuplicates = checkedPlayers.some((p) => isDuplicate(p.id));
  const tooMany = checkedPlayers.length > MAX_ROSTER;

  return (
    <form
      onSubmit={submit}
      onChange={() => {
        setSaved(false);
        onDirtyChange?.(true);
      }}
      className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Date
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Opponent
          <Input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Team name" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Competition
          <select className={FIELD_CLASS} value={competition} onChange={(e) => setCompetition(e.target.value as Competition)}>
            <option value="league">League</option>
            <option value="cup">Cup</option>
            <option value="friendly">Friendly</option>
            <option value="tournament">Tournament</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Venue
          <select className={FIELD_CLASS} value={homeAway} onChange={(e) => setHomeAway(e.target.value as HomeAway)}>
            <option value="home">Home</option>
            <option value="away">Away</option>
          </select>
        </label>
      </div>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <legend className="mb-2 text-sm font-semibold text-ink">Format</legend>
        <label className="flex flex-col gap-1 text-xs text-slate">
          Best of
          <select className={FIELD_CLASS} value={format.bestOf} onChange={(e) => setNum('bestOf', Number(e.target.value) as 3 | 5)}>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </label>
        {([
          ['setPoints', 'Set points'],
          ['decidingSetPoints', 'Deciding set'],
          ['subsPerSet', 'Subs / set'],
          ['timeoutsPerSet', 'Timeouts / set'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1 text-xs text-slate">
            {label}
            <Input type="number" min={0} value={format[key]} onChange={(e) => setNum(key, Number(e.target.value))} />
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Match roster</legend>
        <p className={`mb-2 text-sm tabular-nums ${tooMany ? 'font-medium text-red' : 'text-slate'}`}>
          {checkedPlayers.length} / {MAX_ROSTER} selected
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <li
              key={p.id}
              className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 ${isDuplicate(p.id) ? 'border-red' : 'border-border'}`}>
              <input
                type="checkbox"
                aria-label={`Include ${p.fullName}`}
                className="h-5 w-5"
                checked={picks[p.id]?.checked ?? false}
                onChange={(e) => setPicks((cur) => ({ ...cur, [p.id]: { ...cur[p.id], checked: e.target.checked } }))}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">#{p.number} {p.fullName}</span>
              <select
                aria-label={`Role for ${p.fullName}`}
                className={`${FIELD_CLASS} min-h-11 w-20 px-2 text-sm`}
                value={picks[p.id]?.role ?? p.positionCategory}
                onChange={(e) =>
                  setPicks((cur) => ({ ...cur, [p.id]: { ...cur[p.id], role: e.target.value as PositionCategory } }))
                }
              >
                {POSITION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.value}</option>
                ))}
              </select>
              <Input
                type="number"
                aria-label={`Number for ${p.fullName}`}
                className="w-16 tabular-nums"
                min={1}
                max={99}
                value={picks[p.id]?.number ?? p.number}
                onChange={(e) => setPicks((cur) => ({ ...cur, [p.id]: { ...cur[p.id], number: Number(e.target.value) } }))}
              />
              {isDuplicate(p.id) && (
                <span className="w-full text-xs font-medium text-red">Duplicate #{picks[p.id].number}</span>
              )}
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-ink">Liberos</legend>
        {[0, 1].map((i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate">
              {`Libero ${i + 1}`}
              <select
                aria-label={`Libero ${i + 1}`}
                className={FIELD_CLASS}
                value={liberoPicks[i].playerId}
                onChange={(e) =>
                  setLiberoPicks((cur) => cur.map((l, j) => (j === i ? { ...l, playerId: e.target.value } : l)))
                }
              >
                <option value="">None</option>
                {checkedPlayers.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} (#{picks[p.id].number})</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate">
              On court
              <select
                aria-label={`Libero ${i + 1} mode`}
                className={FIELD_CLASS}
                value={liberoPicks[i].mode}
                onChange={(e) =>
                  setLiberoPicks((cur) => cur.map((l, j) => (j === i ? { ...l, mode: e.target.value as LiberoMode } : l)))
                }
              >
                {LIBERO_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
        {liberoIds.size > 0 && (
          <div>
            <p className="mb-1 text-xs text-slate">Libero replaces (in the back row)</p>
            <div className="flex flex-wrap gap-2">
              {checkedPlayers.filter((p) => !liberoIds.has(p.id)).map((p) => (
                <label key={p.id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm">
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
      </fieldset>

      {saved && !error && <p role="status" className="text-sm text-green-strong">Saved.</p>}
      {error && <p role="alert" className="text-sm text-red">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={hasDuplicates || tooMany}>{submitLabel}</Button>
      </div>
    </form>
  );
}
