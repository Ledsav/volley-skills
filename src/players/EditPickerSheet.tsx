import { ChevronRight } from 'lucide-react';
import { GroupedList, ListRow } from '../components/GroupedList';
import { Sheet } from '../components/Sheet';
import { useT } from '../i18n/I18nProvider';

export type EditTarget = 'skills' | 'plan' | 'contact' | 'guardians';

/** The toolbar's Edit: one list of what can be edited on the card (§6.5). */
export function EditPickerSheet({ onPick, onClose }: { onPick: (section: EditTarget) => void; onClose: () => void }) {
  const c = useT().players.card;
  const rows: { id: EditTarget; label: string }[] = [
    { id: 'skills', label: c.tiles.skills },
    { id: 'plan', label: c.tiles.developmentPlan },
    { id: 'contact', label: c.tiles.contact },
    { id: 'guardians', label: c.tiles.guardians },
  ];
  // A picker, not a form: one close action (Done on phones). The group is a filled inset list so it reads as a
  // group on the white sheet, and each row says it opens something with a chevron.
  return (
    <Sheet title={c.edit} onClose={onClose} variant="view">
      <GroupedList className="[&>ul]:bg-surface-2 [&>ul]:shadow-none">
        {rows.map((r) => (
          <ListRow
            key={r.id}
            title={r.label}
            onClick={() => onPick(r.id)}
            trailing={<ChevronRight size={18} aria-hidden="true" className="text-ink-3" />}
          />
        ))}
      </GroupedList>
    </Sheet>
  );
}
