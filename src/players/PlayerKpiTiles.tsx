import { focusAreaKeys, latestTestDate, openObjectiveCount, ratedSkillCount } from './playerDashboard';
import { SKILL_KEYS, type Player } from '../types/player';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

interface PlayerKpiTilesProps {
  player: Player;
  latestByType: Partial<Record<PhysicalTestType, PhysicalTest | null>>;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-2 text-3xl font-extrabold leading-none tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
    </div>
  );
}

export function PlayerKpiTiles({ player, latestByType }: PlayerKpiTilesProps) {
  const rated = ratedSkillCount(player.skills);
  const focus = focusAreaKeys(player.skills).length;
  const open = openObjectiveCount(player.developmentPlan);
  const lastTest = latestTestDate(latestByType);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        label="Skills rated"
        value={`${rated} / ${SKILL_KEYS.length}`}
        hint={rated === SKILL_KEYS.length ? 'Complete' : 'In progress'}
      />
      <StatTile label="Focus areas" value={String(focus)} hint={focus === 0 ? 'None flagged' : 'Priority skills'} />
      <StatTile label="Open objectives" value={String(open)} hint="Not yet completed" />
      <StatTile label="Last physical test" value={lastTest ?? '—'} hint={lastTest ? 'Most recent entry' : 'No entries yet'} />
    </div>
  );
}
