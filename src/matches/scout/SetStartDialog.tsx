import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { FIELD_CLASS } from '../../components/Input';
import type { LiberoConfig, RoleMap, RosterEntry, Side } from '../../types/match';
import { SLOT_ROLE, build51, check51, slotsFromLineup, type SlotKey, type Slots51 } from '../rotation';

interface SetStartDialogProps {
  setNumber: number;
  roster: RosterEntry[];
  liberos: LiberoConfig[];
  /** Current role per roster player (roster roles merged with the previous set's roles). */
  roles: RoleMap;
  initialLineup: string[];
  initialServing: Side;
  /** `roles` is the full per-set role map for the roster (slot picks override the current roles). */
  onStart: (lineup: string[], serving: Side, roles: RoleMap) => void;
  onCancel: () => void;
}

const SLOT_FIELDS: { key: SlotKey; label: string }[] = [
  { key: 'setter', label: 'Setter' },
  { key: 'opposite', label: 'Opposite' },
  { key: 'oh1', label: 'Outside 1' },
  { key: 'oh2', label: 'Outside 2' },
  { key: 'mb1', label: 'Middle 1' },
  { key: 'mb2', label: 'Middle 2' },
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
  const liberoIds = new Set(liberos.map((l) => l.playerId));
  const eligible = roster.filter((r) => !liberoIds.has(r.playerId));
  const byId = new Map(roster.map((r) => [r.playerId, r]));
  const [mode, setMode] = useState<'role' | 'manual'>('role');
  const [init] = useState(() => initialSlots(eligible, roles, initialLineup));
  const [slots, setSlots] = useState<Slots51>(init.slots);
  const [setterZone, setSetterZone] = useState(init.zone);
  const [manual, setManual] = useState<string[]>(() => Array.from({ length: 6 }, (_, i) => initialLineup[i] ?? ''));
  const [serving, setServing] = useState<Side>(initialServing);

  // A player picked into a slot plays that slot's role for this set.
  const slotRoles: RoleMap = { ...roles };
  for (const { key } of SLOT_FIELDS) if (slots[key]) slotRoles[slots[key]] = SLOT_ROLE[key];

  const lineup = mode === 'role' ? build51(slots, setterZone) : manual;
  const setRoles = mode === 'role' ? slotRoles : roles;
  const filled = lineup.filter(Boolean);
  const error =
    filled.length < 6
      ? mode === 'role' ? 'Fill all six slots.' : 'Fill all six positions.'
      : new Set(filled).size < 6
        ? mode === 'role' ? 'A player is in two slots.' : 'A player is in two positions.'
        : null;
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
      title={`Start set ${setNumber}`}
      onClose={onCancel}
      mobileSheet
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Back</Button>
          <Button
            variant="primary"
            disabled={!!error}
            onClick={() => onStart(lineup, serving, Object.fromEntries(roster.map((r) => [r.playerId, setRoles[r.playerId] ?? r.positionCategory])))}
          >
            Start set
          </Button>
        </div>
      }
    >
      <div role="group" aria-label="Lineup mode" className="mb-3 inline-flex rounded-md border border-border p-0.5">
        {([['role', 'By role'], ['manual', 'Manual']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => switchMode(value)}
            className={`min-h-11 rounded-sm px-4 text-sm font-medium ${mode === value ? 'bg-blue text-white' : 'text-ink hover:bg-bg'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'role' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {SLOT_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1 text-xs font-medium text-slate">
                {label}
                <select
                  aria-label={label}
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
          <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-slate">
            Setter starts in
            <select
              aria-label="Setter starts in"
              className={`${FIELD_CLASS} min-h-11`}
              value={setterZone}
              onChange={(e) => setSetterZone(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((z) => (
                <option key={z} value={z}>P{z}</option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Lineup preview" className="mt-3 rounded-md border-2 border-orange-strong bg-orange/10 p-2">
            <div className="mb-2 h-1 rounded-full bg-ink" aria-hidden="true" />
            <div className="grid grid-cols-3 gap-1">
              {PREVIEW_ZONES.map((zone) => {
                const entry = byId.get(lineup[zone]);
                const role = entry ? slotRoles[entry.playerId] : null;
                const was = entry ? roles[entry.playerId] : null;
                return (
                  <div key={zone} className="flex min-h-12 flex-col items-center justify-center rounded-sm bg-surface text-xs">
                    <span className="text-[10px] text-slate">P{zone + 1}</span>
                    {entry ? (
                      <>
                        <span className="font-bold tabular-nums text-ink">#{entry.number}</span>
                        <span className={role !== was ? 'font-medium text-blue-strong' : 'text-slate'}>
                          {role}{role !== was && was ? ` (was ${was})` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate">P1 is the server. Front row: P4, P3, P2.</p>
          <div className="grid grid-cols-3 gap-2">
            {PREVIEW_ZONES.map((zone) => (
              <label key={zone} className="flex flex-col gap-1 text-xs font-medium text-slate">
                P{zone + 1}
                <select
                  aria-label={`Position P${zone + 1}`}
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
            <ul aria-label="Lineup warnings" className="mt-3 list-disc pl-5 text-sm text-orange-strong">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </>
      )}

      <fieldset className="mt-4 flex gap-4">
        <legend className="mb-1 text-sm font-medium text-ink">First serve</legend>
        {(['us', 'them'] as const).map((side) => (
          <label key={side} className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="radio" name="serving" checked={serving === side} onChange={() => setServing(side)} />
            {side === 'us' ? 'We serve' : 'They serve'}
          </label>
        ))}
      </fieldset>
      {error && <p className="mt-3 text-sm text-slate">{error}</p>}
    </Dialog>
  );
}
