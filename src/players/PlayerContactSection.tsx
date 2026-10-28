import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { FIELD_CLASS, Input } from '../components/Input';
import { updatePlayerContact } from './playersApi';
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
    setError(null);
    const number = Number(shirtNumber) || 0;
    try {
      await updatePlayerContact(teamId, playerId, {
        fullName,
        number,
        positionCategory,
        shirtSize,
        starting,
        playerPhone,
      });
    } catch {
      setError(p.contact.error);
      return;
    }
    onPlayerUpdated({ ...player, fullName, number, positionCategory, shirtSize, starting, playerPhone });
    onEditingChange(false);
  }

  return (
    <div className="flex h-full flex-col">
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm [&>dd]:break-words">
        <dt className="text-slate">{p.shared.number}</dt>
        <dd className="font-medium tabular-nums text-ink">{player.number ? `#${player.number}` : '—'}</dd>
        <dt className="text-slate">{p.shared.position}</dt>
        <dd className="font-medium text-ink">
          {lb.position[player.positionCategory](gender)}
          {player.starting && (
            <span className="ml-2 inline-flex items-center rounded-sm bg-green/10 px-1.5 py-0.5 text-xs font-medium text-green-strong">
              {p.shared.starting}
            </span>
          )}
        </dd>
        <dt className="text-slate">{p.shared.shirtSize}</dt>
        <dd className="font-medium text-ink">{player.shirtSize || '—'}</dd>
        <dt className="text-slate">{p.shared.phone}</dt>
        <dd className="font-medium text-ink">{player.playerPhone || '—'}</dd>
        <dt className="text-slate">{p.shared.license}</dt>
        <dd className="font-medium tabular-nums text-ink">{player.licenseNumber || '—'}</dd>
        <dt className="text-slate">{p.shared.nationality}</dt>
        <dd className="font-medium text-ink">{player.nationality || '—'}</dd>
      </dl>

      {editing && isAdmin && (
        <Dialog title={p.contact.dialogTitle} onClose={() => onEditingChange(false)} guardUnsaved>
          <form onSubmit={handleSave} aria-label={p.contact.formLabel}>
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
              className="mb-4 w-full"
            />

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => onEditingChange(false)}>
                {t.common.cancel}
              </Button>
              <Button variant="primary" type="submit">
                {t.common.save}
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-strong">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </div>
  );
}
