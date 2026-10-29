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
        {items.map(({ team, match }) => {
          const { setsUs, setsThem, sets } = match.result;
          // The match doc keeps finished sets only (the rally score lives in the events), so the card shows the
          // sets with a label, the set in play and the finished set scores.
          const inPlay = setsUs + setsThem + 1;
          return (
            // Match ids repeat across teams (seeded "demo-live"), so the key carries the team.
            <div key={`${team.id}/${match.id}`} className="rounded-lg bg-surface p-4 shadow-card">
              <p className="flex items-center gap-2 text-caption text-ink-2">
                <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />
                {team.name}
              </p>
              <p className="mt-1 text-headline text-ink">{t.vs(match.opponent)}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-stat tabular-nums text-ink">
                  {setsUs}–{setsThem}
                </span>
                <span className="text-footnote text-ink-2">{t.live.sets}</span>
              </p>
              <p className="text-footnote tabular-nums text-ink-2">
                {[t.live.setInPlay(inPlay), ...sets.map((s) => `${s.us}–${s.them}`)].join(' · ')}
              </p>
              <Link
                to={`/teams/${team.id}/matches/${match.id}/scout`}
                className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-callout font-semibold text-on-ink pressable hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t.resumeScouting}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
