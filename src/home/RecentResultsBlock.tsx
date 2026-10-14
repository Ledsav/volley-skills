import { Link } from 'react-router-dom';
import type { FeedMatch } from './homeFeed';

export function RecentResultsBlock({ items, failed, mvpFor }: { items: FeedMatch[]; failed: boolean; mvpFor?: (fm: FeedMatch) => string | null }) {
  return (
    <section aria-labelledby="recent" className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-card">
      <h2 id="recent" className="mb-3 text-lg font-semibold text-ink">Recent results</h2>
      {failed && <p role="alert" className="mb-2 text-sm text-red">Could not load matches.</p>}
      {items.length === 0 ? (
        <p className="text-slate">No finished matches yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((fm) => {
            const { team, match } = fm;
            const won = match.result.setsUs > match.result.setsThem;
            const mvp = mvpFor?.(fm) ?? null;
            return (
              <li key={match.id} className="flex flex-wrap items-center gap-x-3 hover:bg-bg">
                <Link to={`/teams/${team.id}/matches/${match.id}`} className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className={`rounded-sm px-2 py-0.5 text-xs font-bold text-white ${won ? 'bg-green-strong' : 'bg-red-strong'}`}>{won ? 'W' : 'L'}</span>
                  <span className="tabular-nums font-semibold text-ink">{match.result.setsUs}–{match.result.setsThem}</span>
                  <span className="text-ink">vs {match.opponent}</span>
                  <span className="text-sm text-slate">{team.name} · {match.date}</span>
                </Link>
                {mvp && <Link to={`/teams/${team.id}/matches/${match.id}/awards`} className="text-sm text-blue hover:underline">MVP: {mvp}</Link>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
