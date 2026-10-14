import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import type { FeedMatch } from './homeFeed';

export function LiveNowBlock({ items }: { items: FeedMatch[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="live-now" className="mb-6">
      <h2 id="live-now" className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-strong">
        <Radio size={16} aria-hidden="true" /> Live now
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ team, match }) => (
          <div key={match.id} className="rounded-lg border-2 border-red bg-surface p-4 shadow-card">
            <p className="text-xs text-slate">{team.name}</p>
            <p className="mt-1 text-lg font-semibold text-ink">vs {match.opponent}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink">
              {match.result.setsUs}–{match.result.setsThem}
            </p>
            <Link
              to={`/teams/${team.id}/matches/${match.id}/scout`}
              className="mt-3 inline-flex min-h-11 items-center rounded-md bg-red px-4 font-medium text-white hover:bg-red-strong"
            >
              Resume scouting
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
