import { focusAreaKeys, latestTestDate, openObjectiveCount, ratedSkillCount } from './playerDashboard';
import { SKILL_KEYS, type Player } from '../types/player';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

interface PlayerKpiTilesProps {
  player: Player;
  latestByType: Partial<Record<PhysicalTestType, PhysicalTest | null>>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-08-12" -> { day: "12 Aug", year: "2026" }. The full ISO date is too wide
// for a quarter-width tile at display size and wrapped at its hyphens.
function splitIsoDate(iso: string): { day: string; year: string } {
  const [year, month, day] = iso.split('-');
  return { day: `${Number(day)} ${MONTHS[Number(month) - 1]}`, year };
}

function StatTile({ label, value, hint, title }: { label: string; value: string; hint?: string; title?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border bg-surface p-4" title={title}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-2 truncate whitespace-nowrap text-3xl font-extrabold leading-none tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-slate">{hint}</p>}
    </div>
  );
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
