import { Link } from 'react-router-dom';
import type { FeedItem } from './homeFeed';
import { formatDate } from '../i18n/format';

const fmtDay = (iso: string) =>
  formatDate(iso, 'weekday');

export function NextUpBlock({ items, failed }: { items: FeedItem[]; failed: boolean }) {
  return (
    <section aria-labelledby="next-up" className="rounded-lg border border-border bg-surface p-4 shadow-card">
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
                {/* Phones: title over the team chip, so the title keeps the row's width. */}
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-3">
                  <span className="w-full truncate text-ink sm:w-auto">{item.kind === 'session' ? item.session.trainingName : `vs ${item.match.opponent}`}</span>
                  <span className="max-w-full shrink-0 truncate rounded-sm bg-bg px-2 py-0.5 text-xs font-medium text-ink">{item.team.name}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
