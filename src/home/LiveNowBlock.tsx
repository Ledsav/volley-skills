import { Link } from 'react-router-dom';
import { useT } from '../i18n/I18nProvider';
import type { FeedMatch } from './homeFeed';

export function LiveNowBlock({ items }: { items: FeedMatch[] }) {
  const t = useT().home;
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="live-now" className="mb-6">
      <h2 id="live-now" className="mb-2 text-title-3 text-ink">{t.liveNow}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(({ team, match }) => (
          <div key={match.id} className="rounded-lg bg-surface p-4 shadow-card">
            <p className="flex items-center gap-2 text-caption text-ink-2">
              <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />
              {team.name}
            </p>
            <p className="mt-1 text-headline text-ink">{t.vs(match.opponent)}</p>
            <p className="mt-1 text-stat tabular-nums text-ink">
              {match.result.setsUs}–{match.result.setsThem}
            </p>
            <Link
              to={`/teams/${team.id}/matches/${match.id}/scout`}
              className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-callout font-semibold text-on-ink pressable hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t.resumeScouting}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
