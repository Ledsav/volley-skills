import type { FeedItem } from './homeFeed';
import { Button } from '../components/Button';
import { GroupedList, ListRow } from '../components/GroupedList';
import { useT } from '../i18n/I18nProvider';
import { formatDate } from '../i18n/format';

const fmtDay = (iso: string) => formatDate(iso, 'weekday');

export function NextUpBlock({ items, failed, onPlan }: { items: FeedItem[]; failed: boolean; onPlan?: () => void }) {
  const t = useT().home;
  return (
    <section aria-labelledby="next-up">
      <h2 id="next-up" className="mb-2 text-title-3 text-ink">{t.nextUp.title}</h2>
      {failed && <p role="alert" className="mb-2 text-footnote text-red-strong">{t.nextUp.error}</p>}
      {items.length === 0 ? (
        <div className="rounded-lg bg-surface p-4 shadow-card">
          <p className="text-footnote text-ink-2">{t.nextUp.empty}</p>
          {onPlan && (
            <Button variant="secondary" onClick={onPlan} className="mt-3">
              {t.planTraining}
            </Button>
          )}
        </div>
      ) : (
        <GroupedList>
          {items.map((item) => (
            <ListRow
              key={item.kind === 'session' ? `s-${item.session.id}` : `m-${item.match.id}`}
              // B1: a session opens the team calendar on that session.
              to={
                item.kind === 'session'
                  ? `/teams/${item.team.id}?tab=calendar&session=${item.session.id}`
                  : `/teams/${item.team.id}/matches/${item.match.id}`
              }
              title={item.kind === 'session' ? item.session.trainingName : t.vs(item.match.opponent)}
              subtitle={<span className="tabular-nums">{fmtDay(item.date)} · {item.team.name}</span>}
            />
          ))}
        </GroupedList>
      )}
    </section>
  );
}
