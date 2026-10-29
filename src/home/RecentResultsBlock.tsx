import { Link } from 'react-router-dom';
import { GroupedList } from '../components/GroupedList';
import { formatDate } from '../i18n/format';
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
              // Keyed by team too: match ids repeat across teams. The MVP sits on the second line so the result
              // and opponent keep the row's width on phones.
              <li
                key={`${team.id}/${match.id}`}
                className="relative before:absolute before:left-[52px] before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
              >
                <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-caption font-bold ${won ? 'bg-green-tint text-green-strong' : 'bg-red-tint text-red-strong'}`}
                  >
                    {won ? t.recent.won : t.recent.lost}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Link
                      to={`/teams/${team.id}/matches/${match.id}`}
                      className="truncate text-headline tabular-nums text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus after:absolute after:inset-0"
                    >
                      {match.result.setsUs}–{match.result.setsThem} {t.vs(match.opponent)}
                    </Link>
                    <span className="truncate text-footnote tabular-nums text-ink-2">
                      {team.name} · {formatDate(match.date, 'weekday')}
                      {mvp && (
                        <>
                          {' · '}
                          <Link
                            to={`/teams/${team.id}/matches/${match.id}/awards`}
                            className="relative z-10 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            {t.recent.mvp(mvp)}
                          </Link>
                        </>
                      )}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </GroupedList>
      )}
    </section>
  );
}
