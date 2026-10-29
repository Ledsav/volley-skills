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
  return (
    <Sheet title={c.edit} onClose={onClose}>
      <GroupedList>
        {rows.map((r) => (
          <ListRow key={r.id} title={r.label} onClick={() => onPick(r.id)} />
        ))}
      </GroupedList>
    </Sheet>
  );
}
