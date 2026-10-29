import { Link } from 'react-router-dom';
import { GroupedList } from '../components/GroupedList';
import { useT } from '../i18n/I18nProvider';
import type { FeedMatch } from './homeFeed';

export function RecentResultsBlock({ items, failed, mvpFor }: { items: FeedMatch[]; failed: boolean; mvpFor?: (fm: FeedMatch) => string | null }) {
  const t = useT().home;
  return (
    <section aria-labelledby="recent">
      <h2 id="recent" className="mb-2 text-title-3 text-ink">{t.recent.title}</h2>
      {failed && <p role="alert" className="mb-2 text-footnote text-red-strong">{t.recent.error}</p>}
      {items.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-footnote text-ink-2 shadow-card">{t.recent.empty}</p>
      ) : (
        <GroupedList>
          {items.map((fm) => {
            const { team, match } = fm;
            const won = match.result.setsUs > match.result.setsThem;
            const mvp = mvpFor?.(fm) ?? null;
            return (
              <li
                key={match.id}
                className="relative flex flex-wrap items-center gap-x-3 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
              >
                <Link
                  to={`/teams/${team.id}/matches/${match.id}`}
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-4 py-2 active:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-caption font-bold ${won ? 'bg-green-tint text-green-strong' : 'bg-red-tint text-red-strong'}`}
                  >
                    {won ? t.recent.won : t.recent.lost}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-headline tabular-nums text-ink">
                      {match.result.setsUs}–{match.result.setsThem} {t.vs(match.opponent)}
                    </span>
                    <span className="truncate text-footnote tabular-nums text-ink-2">{team.name} · {match.date}</span>
                  </span>
                </Link>
                {mvp && (
                  <Link to={`/teams/${team.id}/matches/${match.id}/awards`} className="px-4 text-footnote text-ink-2 hover:underline">
                    {t.recent.mvp(mvp)}
                  </Link>
                )}
              </li>
            );
          })}
        </GroupedList>
      )}
    </section>
  );
}
