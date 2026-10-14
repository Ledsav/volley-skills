import { Link } from 'react-router-dom';
import type { FeedItem } from './homeFeed';

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export function NextUpBlock({ items, failed }: { items: FeedItem[]; failed: boolean }) {
  return (
    <section aria-labelledby="next-up" className="mb-6 rounded-lg border border-border bg-surface p-4 shadow-card">
      <h2 id="next-up" className="mb-3 text-lg font-semibold text-ink">Next 7 days</h2>
      {failed && <p role="alert" className="mb-2 text-sm text-red">Could not load upcoming sessions.</p>}
      {items.length === 0 ? (
        <p className="text-slate">Nothing in the next 7 days.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.kind === 'session' ? `s-${item.session.id}` : `m-${item.match.id}`}>
              <Link
                to={item.kind === 'session' ? `/teams/${item.team.id}` : `/teams/${item.team.id}/matches/${item.match.id}`}
                className="flex min-h-11 items-center gap-3 py-2 hover:bg-bg"
              >
                <span className="w-24 shrink-0 text-sm tabular-nums text-slate">{fmtDay(item.date)}</span>
                <span className="rounded-sm bg-bg px-2 py-0.5 text-xs font-medium text-ink">{item.team.name}</span>
                <span className="truncate text-ink">{item.kind === 'session' ? item.session.trainingName : `vs ${item.match.opponent}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
