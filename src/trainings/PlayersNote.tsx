import { TriangleAlert, Users } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';
import { needsMorePlayers } from './suggestions';

/** "Min N players", or the warning when the drill needs more than the training suggests. */
export function PlayersNote({ minPlayers, suggested }: { minPlayers?: number | null; suggested: number | null }) {
  const t = useT();
  if (minPlayers === undefined || minPlayers === null) return null;
  if (needsMorePlayers(minPlayers, suggested)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-tint px-2 text-caption tabular-nums text-orange-strong">
        <TriangleAlert aria-hidden="true" className="h-3 w-3 shrink-0" />
        {t.trainings.playersNote.needs(minPlayers, suggested)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-footnote tabular-nums text-ink-2">
      <Users aria-hidden="true" className="h-3 w-3 shrink-0" />
      {t.trainings.playersNote.min(minPlayers)}
    </span>
  );
}
