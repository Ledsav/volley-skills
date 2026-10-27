import { focusAreaKeys, latestTestDate, openObjectiveCount, ratedSkillCount } from './playerDashboard';
import { SKILL_KEYS, type Player } from '../types/player';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import { StatTile } from '../components/StatTile';
import { monthNames } from '../i18n/format';

interface PlayerKpiTilesProps {
  player: Player;
  latestByType: Partial<Record<PhysicalTestType, PhysicalTest | null>>;
}

// "2026-08-12" -> { day: "12 Aug", year: "2026" }. The full ISO date is too wide
// for a quarter-width tile at display size and wrapped at its hyphens.
function splitIsoDate(iso: string): { day: string; year: string } {
  const [year, month, day] = iso.split('-');
  return { day: `${Number(day)} ${monthNames(undefined, 'short')[Number(month) - 1]}`, year };
}

export function PlayerKpiTiles({ player, latestByType }: PlayerKpiTilesProps) {
  const rated = ratedSkillCount(player.skills);
  const focus = focusAreaKeys(player.skills).length;
  const open = openObjectiveCount(player.developmentPlan);
  const lastTestIso = latestTestDate(latestByType);
  const lastTest = lastTestIso ? splitIsoDate(lastTestIso) : null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        label="Skills rated"
        value={`${rated} / ${SKILL_KEYS.length}`}
        hint={rated === SKILL_KEYS.length ? 'Complete' : 'In progress'}
      />
      <StatTile label="Focus areas" value={String(focus)} hint={focus === 0 ? 'None flagged' : 'Priority skills'} />
      <StatTile label="Open objectives" value={String(open)} hint="Not yet completed" />
      <StatTile
        label="Last physical test"
        value={lastTest ? lastTest.day : '—'}
        hint={lastTest ? lastTest.year : 'No entries yet'}
        title={lastTestIso ?? undefined}
      />
    </div>
  );
}
