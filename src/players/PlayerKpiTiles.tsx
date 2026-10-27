import { focusAreaKeys, latestTestDate, openObjectiveCount, ratedSkillCount } from './playerDashboard';
import { SKILL_KEYS, type Player } from '../types/player';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import { StatTile } from '../components/StatTile';
import { monthNames } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';

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
  const k = useT().players.kpi;
  const rated = ratedSkillCount(player.skills);
  const focus = focusAreaKeys(player.skills).length;
  const open = openObjectiveCount(player.developmentPlan);
  const lastTestIso = latestTestDate(latestByType);
  const lastTest = lastTestIso ? splitIsoDate(lastTestIso) : null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        label={k.skillsRated}
        value={`${rated} / ${SKILL_KEYS.length}`}
        hint={rated === SKILL_KEYS.length ? k.complete : k.inProgress}
      />
      <StatTile label={k.focusAreas} value={String(focus)} hint={focus === 0 ? k.noneFlagged : k.prioritySkills} />
      <StatTile label={k.openObjectives} value={String(open)} hint={k.notYetCompleted} />
      <StatTile
        label={k.lastPhysicalTest}
        value={lastTest ? lastTest.day : '—'}
        hint={lastTest ? lastTest.year : k.noEntries}
        title={lastTestIso ?? undefined}
      />
    </div>
  );
}
