import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input, FIELD_CLASS } from '../components/Input';
import { updatePlayerGuardians } from './playersApi';
import type { Guardian, Player } from '../types/player';

interface GuardiansSectionProps {
  teamId: string;
  playerId: string;
  player: Player;
  onPlayerUpdated: (player: Player) => void;
  isAdmin: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

const RELATION_LABEL: Record<Guardian['relation'], string> = {
  mother: 'Mother',
  father: 'Father',
  other: 'Other',
};

export function GuardiansSection({
  teamId,
  playerId,
  player,
  onPlayerUpdated,
  isAdmin,
  editing,
  onEditingChange,
}: GuardiansSectionProps) {
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
      setError('Could not save guardians. Please try again.');
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
        <p className="text-sm text-slate">No guardians on file.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {player.guardians.map((guardian, index) => (
            <li key={index} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
              <p className="font-medium text-ink">
                {guardian.name}
                <span className="ml-2 font-normal text-slate">{RELATION_LABEL[guardian.relation]}</span>
              </p>
              <p className="text-slate">{guardian.phone || '—'}</p>
              <p className="break-all text-slate">{guardian.email || '—'}</p>
            </li>
          ))}
        </ul>
      )}

      {editing && isAdmin && (
        <Dialog title="Edit guardians" onClose={handleCancel}>
          <form onSubmit={handleSave} aria-label="Edit guardians">
            {guardians.map((guardian, index) => (
              <div key={index} className="mb-4 rounded-md border border-border p-3">
                <label htmlFor={`edit-guardian-relation-${index}`} className="mb-1 block text-sm font-medium text-ink">
                  Relation
                </label>
                <select
                  id={`edit-guardian-relation-${index}`}
                  className={`${FIELD_CLASS} mb-3 w-full`}
                  value={guardian.relation}
                  onChange={(e) => updateGuardian(index, { relation: e.target.value as Guardian['relation'] })}
                >
                  <option value="mother">Mother</option>
                  <option value="father">Father</option>
                  <option value="other">Other</option>
                </select>

                <label htmlFor={`edit-guardian-name-${index}`} className="mb-1 block text-sm font-medium text-ink">
                  Guardian name
                </label>
                <Input
                  id={`edit-guardian-name-${index}`}
                  value={guardian.name}
                  onChange={(e) => updateGuardian(index, { name: e.target.value })}
                  required
                  className="mb-3 w-full"
                />

                <label htmlFor={`edit-guardian-phone-${index}`} className="mb-1 block text-sm font-medium text-ink">
                  Guardian phone
                </label>
                <Input
                  id={`edit-guardian-phone-${index}`}
                  value={guardian.phone}
                  onChange={(e) => updateGuardian(index, { phone: e.target.value })}
                  className="mb-3 w-full"
                />

                <label htmlFor={`edit-guardian-email-${index}`} className="mb-1 block text-sm font-medium text-ink">
                  Guardian email
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
                    Remove guardian
                  </Button>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addGuardian} className="mb-4">
              + Add guardian
            </Button>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save
              </Button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red">
                {error}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </div>
  );
}
