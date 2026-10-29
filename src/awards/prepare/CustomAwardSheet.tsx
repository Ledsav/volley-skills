import { useState } from 'react';
import { FIELD_CLASS } from '../../components/Input';
import { HealthHint } from '../../components/HealthHint';
import { Sheet } from '../../components/Sheet';
import { useT } from '../../i18n/I18nProvider';
import type { Person } from '../../teams/stats/rosterIndex';
import { CUSTOM_NOTE_MAX, CUSTOM_TITLE_MAX } from '../../types/awards';
import { personLabel as label } from './personLabel';

export function CustomAwardSheet({ people, onAdd, onClose }: { people: Person[]; onAdd: (title: string, playerId: string, note: string) => void; onClose: () => void }) {
  const ta = useT().awards.prepare;
  const [title, setTitle] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [note, setNote] = useState('');

  return (
    <Sheet title={ta.customAwardTitle} onClose={onClose} guardUnsaved
      confirm={{ label: ta.addAward, form: 'custom-award-form', disabled: !title.trim() || !playerId }}>
      <form id="custom-award-form" className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !playerId) return;
          onAdd(title.trim(), playerId, note.trim());
        }}>
        <label className="block text-headline text-ink">{ta.awardTitle}
          <input className={`${FIELD_CLASS} mt-1 block w-full text-body font-normal`} maxLength={CUSTOM_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-headline text-ink">{ta.player}
          <select className={`${FIELD_CLASS} mt-1 block w-full text-body font-normal`} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">{ta.choose}</option>
            {people.map((p) => <option key={p.playerId} value={p.playerId}>{label(p)}</option>)}
          </select>
        </label>
        <div>
          <label className="block text-headline text-ink">{ta.note}
            <input aria-describedby="award-note-hint" className={`${FIELD_CLASS} mt-1 block w-full text-body font-normal`} maxLength={CUSTOM_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <HealthHint id="award-note-hint" />
        </div>
      </form>
    </Sheet>
  );
}
