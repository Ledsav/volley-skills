import { GroupedList, ListRow } from '../components/GroupedList';
import { Sheet } from '../components/Sheet';
import type { Team } from '../types/team';

interface TeamPickerSheetProps {
  title: string;
  teams: Team[];
  onPick: (team: Team) => void;
  onClose: () => void;
}

/** Asks which team an action is for. A bottom sheet on phones, a centred one on desktop. */
export function TeamPickerSheet({ title, teams, onPick, onClose }: TeamPickerSheetProps) {
  return (
    <Sheet title={title} onClose={onClose} detent="content">
      <GroupedList>
        {teams.map((team) => (
          <ListRow key={team.id} title={team.name} subtitle={team.ageGroup} onClick={() => onPick(team)} />
        ))}
      </GroupedList>
    </Sheet>
  );
}
