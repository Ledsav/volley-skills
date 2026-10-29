import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FIELD_CLASS, Input } from '../components/Input';
import { Sheet } from '../components/Sheet';
import { useSave } from '../components/useSave';
import { updatePlayerContact } from './playersApi';
import { usePlayerSync } from './playerSync';
import { POSITION_CATEGORIES, SHIRT_SIZES, type Player, type PositionCategory, type ShirtSize } from '../types/player';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

interface PlayerContactSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
  isAdmin: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** The team's grammatical gender, for the position wording. */
  gender?: Gender;
}

export function PlayerContactSection({
  teamId,
  playerId,
  player,
  onPlayerUpdated,
  isAdmin,
  editing,
  onEditingChange,
  gender = 'mixed',
}: PlayerContactSectionProps) {
  const sync = usePlayerSync();
  const { save } = useSave();
  const t = useT();
  const lb = t.labels;
  const p = t.players;
  const [fullName, setFullName] = useState(player.fullName);
  const [shirtNumber, setShirtNumber] = useState(player.number ? String(player.number) : '');
  const [positionCategory, setPositionCategory] = useState<PositionCategory>(player.positionCategory);
  const [shirtSize, setShirtSize] = useState<ShirtSize | ''>(player.shirtSize ?? '');
  const [starting, setStarting] = useState(player.starting);
  const [playerPhone, setPlayerPhone] = useState(player.playerPhone);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (editing) {
      setFullName(player.fullName);
      setShirtNumber(player.number ? String(player.number) : '');
      setPositionCategory(player.positionCategory);
      setShirtSize(player.shirtSize ?? '');
      setStarting(player.starting);
      setPlayerPhone(player.playerPhone);
      setError(null);
    }
  }, [
    editing,
    player.fullName,
    player.number,
    player.positionCategory,
    player.shirtSize,
    player.starting,
    player.playerPhone,
  ]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await doSave();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function doSave() {
    setError(null);
    const number = Number(shirtNumber) || 0;
    try {
      const done = await save(
        () =>
          updatePlayerContact(teamId, playerId, {
            fullName,
            number,
            positionCategory,
            shirtSize,
            starting,
            playerPhone,
          }),
        { onQueued: (w) => sync.queued('contact', w) },
      );
      if (!done) return;
    } catch {
      setError(p.contact.error);
      return;
    }
    onPlayerUpdated({ ...player, fullName, number, positionCategory, shirtSize, starting, playerPhone });
    onEditingChange(false);
  }

  return (
    <div className="flex h-full flex-col">
      <dl className="divide-y divide-separator text-body">
        <div className="flex min-h-11 items-center justify-between gap-4 py-2">
          <dt className="text-ink-2">{p.shared.number}</dt>
          <dd className="text-right tabular-nums text-ink">{player.number ? `#${player.number}` : '—'}</dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 py-2">
          <dt className="text-ink-2">{p.shared.position}</dt>
          <dd className="text-right text-ink">
            {lb.position[player.positionCategory](gender)}
            {player.starting && (
              <span className="ml-2 inline-flex items-center rounded-sm bg-green-tint px-1.5 py-0.5 text-footnote font-medium text-green-strong">
                {p.shared.starting}
              </span>
            )}
          </dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 py-2">
          <dt className="text-ink-2">{p.shared.shirtSize}</dt>
          <dd className="text-right tabular-nums text-ink">{player.shirtSize || '—'}</dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 py-2">
          <dt className="text-ink-2">{p.shared.phone}</dt>
          <dd className="break-words text-right tabular-nums text-ink">{player.playerPhone || '—'}</dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 py-2">
          <dt className="text-ink-2">{p.shared.license}</dt>
          <dd className="text-right tabular-nums text-ink">{player.licenseNumber || '—'}</dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 py-2">
          <dt className="text-ink-2">{p.shared.nationality}</dt>
          <dd className="text-right text-ink">{player.nationality || '—'}</dd>
        </div>
      </dl>

      {editing && isAdmin && (
        <Sheet
          title={p.contact.dialogTitle}
          onClose={() => onEditingChange(false)}
          guardUnsaved
          confirm={{ label: t.common.save, form: 'player-contact-form', disabled: saving }}
        >
          <form id="player-contact-form" onSubmit={handleSave} aria-label={p.contact.formLabel}>
            <label htmlFor="player-name" className="mb-1 block text-sm font-medium text-ink">
              {p.contact.name}
            </label>
            <Input
              id="player-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mb-3 w-full"
            />

            <label htmlFor="player-number" className="mb-1 block text-sm font-medium text-ink">
              {p.contact.shirtNumber}
            </label>
            <Input
              id="player-number"
              type="number"
              min="0"
              value={shirtNumber}
              onChange={(e) => setShirtNumber(e.target.value)}
              className="mb-3 w-full"
            />

            <label htmlFor="player-position-category" className="mb-1 block text-sm font-medium text-ink">
              {p.shared.position}
            </label>
            <select
              id="player-position-category"
              value={positionCategory}
              onChange={(e) => setPositionCategory(e.target.value as PositionCategory)}
              className={`${FIELD_CLASS} mb-3 w-full text-base sm:text-sm`}
            >
              {POSITION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {lb.position[c.value](gender)}
                </option>
              ))}
            </select>

            <label htmlFor="player-shirt-size" className="mb-1 block text-sm font-medium text-ink">
              {p.shared.shirtSize}
            </label>
            <select
              id="player-shirt-size"
              value={shirtSize}
              onChange={(e) => setShirtSize(e.target.value as ShirtSize | '')}
              className={`${FIELD_CLASS} mb-3 w-full text-base sm:text-sm`}
            >
              <option value="">{p.shared.notSet}</option>
              {SHIRT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
              <input type="checkbox" checked={starting} onChange={(e) => setStarting(e.target.checked)} />
              {p.contact.startingPlayer}
            </label>

            <label htmlFor="player-phone" className="mb-1 block text-sm font-medium text-ink">
              {p.shared.phone}
            </label>
            <Input
              id="player-phone"
              value={playerPhone}
              onChange={(e) => setPlayerPhone(e.target.value)}
              className="mb-3 w-full"
            />

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-strong">
                {error}
              </p>
            )}
          </form>
        </Sheet>
      )}
    </div>
  );
}
