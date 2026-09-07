import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { findTrainingByBusinessId, listTrainings } from '../trainings/trainingsApi';
import type { Training } from '../types/training';
import { createCalendarSession } from './calendarApi';

interface AssignTrainingDialogProps {
  teamId: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AssignTrainingDialog({ teamId, date, onClose, onSaved }: AssignTrainingDialogProps) {
  const { firebaseUser } = useAuth();
  const [sessionDate, setSessionDate] = useState(date);
  const [options, setOptions] = useState<Training[]>([]);
  const [businessId, setBusinessId] = useState('');
  const [selected, setSelected] = useState<Training | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listTrainings().then((page) => setOptions(page.trainings));
  }, []);

  async function searchByBusinessId() {
    if (!businessId.trim()) return;
    const found = await findTrainingByBusinessId(businessId.trim());
    setOptions(found ? [found] : []);
    setSelected(found);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError('Pick a training to assign.');
      return;
    }
    if (!firebaseUser) return;
    setError(null);
    try {
      await createCalendarSession(
        teamId,
        {
          date: sessionDate,
          trainingId: selected.id,
          trainingBusinessId: selected.businessId,
          trainingName: selected.name,
          notes,
        },
        firebaseUser.uid
      );
      onSaved();
    } catch {
      setError('Could not assign the training. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label="Assign training"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">Assign training</h2>

        <label htmlFor="session-date" className="mb-1 block text-sm font-medium text-ink">
          Date
        </label>
        <Input
          id="session-date"
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
        />

        <label htmlFor="session-bid" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Find by business ID
        </label>
        <div className="flex gap-2">
          <Input
            id="session-bid"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="TR-0007"
          />
          <Button variant="secondary" size="sm" onClick={() => void searchByBusinessId()}>
            Find
          </Button>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1 text-sm font-medium text-ink">Training</legend>
          <ul className="divide-y divide-border rounded-md border border-border">
            {options.length === 0 && <li className="p-2 text-sm text-slate">No trainings available.</li>}
            {options.map((training) => (
              <li key={training.id} className="p-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="training"
                    checked={selected?.id === training.id}
                    onChange={() => setSelected(training)}
                  />
                  <span className="tabular-nums text-slate">{training.businessId}</span>
                  <span className="text-ink">{training.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <label htmlFor="session-notes" className="mb-1 mt-4 block text-sm font-medium text-ink">
          Notes
        </label>
        <Textarea id="session-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Assign
          </Button>
        </div>
      </form>
    </div>
  );
}
