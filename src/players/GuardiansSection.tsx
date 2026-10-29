import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Input, FIELD_CLASS } from '../components/Input';
import { Sheet } from '../components/Sheet';
import { useSave } from '../components/useSave';
import { updatePlayerGuardians } from './playersApi';
import { usePlayerSync } from './playerSync';
import type { Guardian, Player } from '../types/player';
import { useT } from '../i18n/I18nProvider';

interface GuardiansSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
  isAdmin: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export function GuardiansSection({
  teamId,
  playerId,
  player,
  onPlayerUpdated,
  isAdmin,
  editing,
  onEditingChange,
}: GuardiansSectionProps) {
  const sync = usePlayerSync();
  const { save } = useSave();
  const t = useT();
  const p = t.players;
  const [guardians, setGuardians] = useState<Guardian[]>(player.guardians);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (editing) {
      setGuardians(player.guardians);
      setError(null);
    }
  }, [editing, player.guardians]);

  function updateGuardian(index: number, updates: Partial<Guardian>) {
    setGuardians((current) => current.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  }

  function addGuardian() {
    setGuardians((current) => [...current, { relation: 'mother', name: '', phone: '', email: '' }]);
  }

  function removeGuardian(index: number) {
    setGuardians((current) => current.filter((_, i) => i !== index));
  }

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
    try {
      const done = await save(() => updatePlayerGuardians(teamId, playerId, guardians), {
        onQueued: (w) => sync.queued('guardians', w),
      });
      if (!done) return;
    } catch {
      setError(p.guardians.error);
      return;
    }
    onPlayerUpdated({ ...player, guardians });
    onEditingChange(false);
  }

  function handleCancel() {
    setGuardians(player.guardians);
    onEditingChange(false);
  }

  return (
    <div className="flex h-full flex-col">
      {player.guardians.length === 0 ? (
        <p className="text-callout text-ink-2">{p.guardians.none}</p>
      ) : (
        <ul className="divide-y divide-separator">
          {player.guardians.map((guardian, index) => (
            <li key={index} className="flex min-h-11 flex-col justify-center gap-0.5 py-3">
              <p className="text-headline text-ink">
                {guardian.name}
                <span className="ml-2 text-callout font-normal text-ink-2">{p.shared.relations[guardian.relation]}</span>
              </p>
              <p className="text-callout tabular-nums text-ink-2">{guardian.phone || '—'}</p>
              <p className="break-all text-callout text-ink-2">{guardian.email || '—'}</p>
            </li>
          ))}
        </ul>
      )}

      {editing && isAdmin && (
        <Sheet
          title={p.guardians.dialogTitle}
          onClose={handleCancel}
          guardUnsaved
          confirm={{ label: t.common.save, form: 'player-guardians-form', disabled: saving }}
        >
          <form id="player-guardians-form" onSubmit={handleSave} aria-label={p.guardians.dialogTitle}>
            {guardians.map((guardian, index) => (
              <div key={index} className="mb-4 rounded-lg border border-separator p-3">
                <label htmlFor={`edit-guardian-relation-${index}`} className="mb-1 block text-sm font-medium text-ink">
                  {p.shared.relation}
                </label>
                <select
                  id={`edit-guardian-relation-${index}`}
                  className={`${FIELD_CLASS} mb-3 w-full`}
                  value={guardian.relation}
                  onChange={(e) => updateGuardian(index, { relation: e.target.value as Guardian['relation'] })}
                >
                  <option value="mother">{p.shared.relations.mother}</option>
                  <option value="father">{p.shared.relations.father}</option>
                  <option value="other">{p.shared.relations.other}</option>
                </select>

                <label htmlFor={`edit-guardian-name-${index}`} className="mb-1 block text-sm font-medium text-ink">
                  {p.shared.guardianName}
                </label>
                <Input
                  id={`edit-guardian-name-${index}`}
                  value={guardian.name}
                  onChange={(e) => updateGuardian(index, { name: e.target.value })}
                  required
                  className="mb-3 w-full"
                />

                <label htmlFor={`edit-guardian-phone-${index}`} className="mb-1 block text-sm font-medium text-ink">
                  {p.shared.guardianPhone}
                </label>
                <Input
                  id={`edit-guardian-phone-${index}`}
                  value={guardian.phone}
                  onChange={(e) => updateGuardian(index, { phone: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`edit-guardian-email-${index}`} className="mb-1 block text-sm font-medium text-ink">
                  {p.shared.guardianEmail}
                </label>
                <Input
                  id={`edit-guardian-email-${index}`}
                  type="email"
                  value={guardian.email}
                  onChange={(e) => updateGuardian(index, { email: e.target.value })}
                  className="mb-3 w-full"
                />

                {guardians.length > 1 && (
                  <Button variant="dangerGhost" size="sm" onClick={() => removeGuardian(index)}>
                    {p.shared.removeGuardian}
                  </Button>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addGuardian} className="mb-4">
              {p.shared.addGuardian}
            </Button>

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
