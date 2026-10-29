import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS } from '../../components/Input';
import type { LiberoConfig, RoleMap, RosterEntry, Side } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';
import { shortNames } from '../format';
import { SLOT_ROLE, build51, check51, lineup51Message, slotsFromLineup, type SlotKey, type Slots51 } from '../rotation';

interface SetStartDialogProps {
  setNumber: number;
  roster: RosterEntry[];
  liberos: LiberoConfig[];
  /** Current role per roster player (roster roles merged with the previous set's roles). */
  roles: RoleMap;
  initialLineup: string[];
  initialServing: Side | null;
  /** `roles` is the full per-set role map for the roster (slot picks override the current roles). */
  onStart: (lineup: string[], serving: Side, roles: RoleMap) => void;
  onCancel: () => void;
}

const SLOT_FIELDS: { key: SlotKey }[] = [
  { key: 'setter' },
  { key: 'opposite' },
  { key: 'oh1' },
  { key: 'oh2' },
  { key: 'mb1' },
  { key: 'mb2' },
];

// Seen from behind our baseline: front row P4 P3 P2, back row P5 P6 P1.
const PREVIEW_ZONES = [3, 2, 1, 4, 5, 0];

const EMPTY_SLOTS: Slots51 = { setter: '', oh1: '', mb1: '', opposite: '', oh2: '', mb2: '' };

/**
 * Pre-fill: if the previous lineup is a clean 5-1 under the current roles, read
 * the slots back from it; otherwise fill each slot with the first player whose
 * role matches (previous lineup players first).
 */
function initialSlots(eligible: RosterEntry[], roles: RoleMap, lineup: string[]): { slots: Slots51; zone: number } {
  const setterZone = lineup.findIndex((id) => roles[id] === 'S');
  const zone = setterZone >= 0 ? setterZone + 1 : 1;
  if (lineup.length === 6 && lineup.every(Boolean) && setterZone >= 0 && check51(lineup, roles).length === 0) {
    return { slots: slotsFromLineup(lineup, zone), zone };
  }
  const ordered = [...eligible].sort((a, b) => Number(lineup.includes(b.playerId)) - Number(lineup.includes(a.playerId)));
  const used = new Set<string>();
  const slots = { ...EMPTY_SLOTS };
  for (const { key } of SLOT_FIELDS) {
    const pick = ordered.find((r) => !used.has(r.playerId) && roles[r.playerId] === SLOT_ROLE[key]);
    if (pick) {
      slots[key] = pick.playerId;
      used.add(pick.playerId);
    }
  }
  return { slots, zone };
}

export function SetStartDialog({ setNumber, roster, liberos, roles, initialLineup, initialServing, onStart, onCancel }: SetStartDialogProps) {
  const tr = useT();
  const t = tr.scout.setStart;
  // The scout page does not load the team, so role words use the paired ('mixed') form.
  const pos = tr.labels.position;
  const slotLabel = (key: SlotKey): string => {
    switch (key) {
      case 'setter':
        return pos.S('mixed');
      case 'opposite':
        return pos.O('mixed');
      case 'oh1':
        return t.numbered(pos.OH('mixed'), 1);
      case 'oh2':
        return t.numbered(pos.OH('mixed'), 2);
      case 'mb1':
        return t.numbered(pos.MB('mixed'), 1);
      case 'mb2':
        return t.numbered(pos.MB('mixed'), 2);
    }
  };
  const liberoIds = new Set(liberos.map((l) => l.playerId));
  const eligible = roster.filter((r) => !liberoIds.has(r.playerId));
  const byId = new Map(roster.map((r) => [r.playerId, r]));
  const names = shortNames(roster);
  const [mode, setMode] = useState<'role' | 'manual'>('role');
  const [init] = useState(() => initialSlots(eligible, roles, initialLineup));
  const [slots, setSlots] = useState<Slots51>(init.slots);
  const [setterZone, setSetterZone] = useState(init.zone);
  const [manual, setManual] = useState<string[]>(() => Array.from({ length: 6 }, (_, i) => initialLineup[i] ?? ''));
  const [serving, setServing] = useState<Side | null>(initialServing);

  // A player picked into a slot plays that slot's role for this set.
  const slotRoles: RoleMap = { ...roles };
  for (const { key } of SLOT_FIELDS) if (slots[key]) slotRoles[slots[key]] = SLOT_ROLE[key];

  const lineup = mode === 'role' ? build51(slots, setterZone) : manual;
  const setRoles = mode === 'role' ? slotRoles : roles;
  const filled = lineup.filter(Boolean);
  const error =
    filled.length < 6
      ? mode === 'role' ? t.fillRole : t.fillManual
      : new Set(filled).size < 6
        ? mode === 'role' ? t.dupRole : t.dupManual
        : null;
  const hint = error ?? (serving === null ? t.chooseServe : null);
  const warnings = mode === 'manual' && !error ? check51(manual, roles) : [];

  const switchMode = (next: 'role' | 'manual') => {
    if (next === mode) return;
    if (next === 'manual' && !error) setManual(lineup);
    if (next === 'role') {
      const fromManual = initialSlots(eligible, roles, manual);
      setSlots(fromManual.slots);
      setSetterZone(fromManual.zone);
    }
    setMode(next);
  };

  const optionsFor = (key: SlotKey) =>
    [...eligible].sort(
      (a, b) => Number(roles[b.playerId] === SLOT_ROLE[key]) - Number(roles[a.playerId] === SLOT_ROLE[key]),
    );

  return (
    <Dialog
      title={t.title(setNumber)}
      onClose={onCancel}
      mobileSheet
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>{t.back}</Button>
          <Button
            variant="primary"
            disabled={!!error || serving === null}
            onClick={() => onStart(lineup, serving as Side, Object.fromEntries(roster.map((r) => [r.playerId, setRoles[r.playerId] ?? r.positionCategory])))}
          >
            {t.start}
          </Button>
        </div>
      }
    >
      <div role="group" aria-label={t.modeGroup} className="mb-3 inline-flex gap-0.5 rounded-md bg-surface-2 p-0.5">
        {([['role', t.byRole], ['manual', t.manual]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => switchMode(value)}
            className={`min-h-11 rounded-sm px-4 text-callout font-medium ${mode === value ? 'bg-surface-3 text-ink' : 'text-ink-2'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'role' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {SLOT_FIELDS.map(({ key }) => (
              <label key={key} className="flex flex-col gap-1 text-footnote font-medium text-ink-2">
                {slotLabel(key)}
                <select
                  aria-label={slotLabel(key)}
                  className={`${FIELD_CLASS} min-h-11`}
                  value={slots[key]}
                  onChange={(e) => setSlots((cur) => ({ ...cur, [key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {optionsFor(key).map((r) => (
                    <option key={r.playerId} value={r.playerId}>
                      #{r.number} {r.name} ({roles[r.playerId] ?? r.positionCategory})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="mt-3 flex flex-col gap-1 text-footnote font-medium text-ink-2">
            {t.setterStartsIn}
            <select
              aria-label={t.setterStartsIn}
              className={`${FIELD_CLASS} min-h-11`}
              value={setterZone}
              onChange={(e) => setSetterZone(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((z) => (
                <option key={z} value={z}>P{z}</option>
              ))}
            </select>
          </label>
          <div role="group" aria-label={t.preview} className="mt-3 rounded-md bg-bg p-2">
            <div className="mb-2 h-1 rounded-full bg-ink" aria-hidden="true" />
            <div className="grid grid-cols-3 gap-1">
              {PREVIEW_ZONES.map((zone) => {
                const entry = byId.get(lineup[zone]);
                const role = entry ? slotRoles[entry.playerId] : null;
                const was = entry ? roles[entry.playerId] : null;
                return (
                  <div key={zone} className="flex min-h-14 min-w-0 flex-col items-center justify-center rounded-md bg-surface px-1 text-xs">
                    <span className="text-[11px] text-ink-2">P{zone + 1}</span>
                    {entry ? (
                      <>
                        <span className="max-w-full truncate text-ink">
                          <span className="font-bold">{names.get(entry.playerId)}</span> <span className="tabular-nums">#{entry.number}</span>
                        </span>
                        <span className={role !== was ? 'font-semibold text-ink' : 'text-ink-2'}>
                          {role}{role !== was && was ? t.was(was) : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-2">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-callout text-ink-2">{t.manualHint}</p>
          <div className="grid grid-cols-3 gap-2">
            {PREVIEW_ZONES.map((zone) => (
              <label key={zone} className="flex flex-col gap-1 text-footnote font-medium text-ink-2">
                P{zone + 1}
                <select
                  aria-label={t.position(zone + 1)}
                  className={`${FIELD_CLASS} min-h-11`}
                  value={manual[zone]}
                  onChange={(e) => setManual((cur) => cur.map((id, i) => (i === zone ? e.target.value : id)))}
                >
                  <option value="">—</option>
                  {eligible.map((r) => (
                    <option key={r.playerId} value={r.playerId}>
                      #{r.number} {r.name} ({roles[r.playerId] ?? r.positionCategory})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {warnings.length > 0 && (
            <ul aria-label={t.warnings} className="mt-3 list-disc pl-5 text-callout text-orange-strong">
              {warnings.map((w) => (
                <li key={w.code === 'expected' ? `${w.code}-${w.role}` : w.code}>{lineup51Message(w, tr)}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <fieldset className="mt-4 grid grid-cols-2 gap-2">
        <legend className="mb-1 text-callout font-medium text-ink">{t.firstServe}</legend>
        {(['us', 'them'] as const).map((side) => (
          <label
            key={side}
            className={`relative flex min-h-14 cursor-pointer items-center justify-center rounded-md px-3 text-center text-callout font-medium text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${
              serving === side ? 'bg-surface-3 ring-2 ring-ink' : 'bg-surface-2'
            }`}
          >
            <input type="radio" name="serving" className="sr-only" checked={serving === side} onChange={() => setServing(side)} />
            {side === 'us' ? t.weServe : t.theyServe}
          </label>
        ))}
      </fieldset>
      {hint && <p className="mt-3 text-callout text-ink-2">{hint}</p>}
    </Dialog>
  );
}
