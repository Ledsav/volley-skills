import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input, FIELD_CLASS } from '../components/Input';
import { updatePlayerGuardians } from './playersApi';
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
  const t = useT();
  const p = t.players;
  const [guardians, setGuardians] = useState<Guardian[]>(player.guardians);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      await updatePlayerGuardians(teamId, playerId, guardians);
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
        <p className="text-sm text-slate">{p.guardians.none}</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {player.guardians.map((guardian, index) => (
            <li key={index} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
              <p className="font-medium text-ink">
                {guardian.name}
                <span className="ml-2 font-normal text-slate">{p.shared.relations[guardian.relation]}</span>
              </p>
              <p className="text-slate">{guardian.phone || '—'}</p>
              <p className="break-all text-slate">{guardian.email || '—'}</p>
            </li>
          ))}
        </ul>
      )}

      {editing && isAdmin && (
        <Dialog title={p.guardians.dialogTitle} onClose={handleCancel} guardUnsaved>
          <form onSubmit={handleSave} aria-label={p.guardians.dialogTitle}>
            {guardians.map((guardian, index) => (
              <div key={index} className="mb-4 rounded-md border border-border p-3">
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

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleCancel}>
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
