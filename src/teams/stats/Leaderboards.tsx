import { Link } from 'react-router-dom';
import { type AwardRanking } from '../../awards/awardRules';
import { UNKNOWN_PERSON, type Person } from './rosterIndex';
import { useT } from '../../i18n/I18nProvider';
import type { Gender } from '../../i18n/catalog';

const label = (p: Person) => `${p.number !== null ? `#${p.number} ` : ''}${p.name}`;

export function Leaderboards({ teamId, rankings, people, gender = 'mixed' }: { teamId: string; rankings: AwardRanking[]; people: Map<string, Person>; gender?: Gender }) {
  const t = useT();
  const lb = t.labels;
  const person = (id: string) => people.get(id) ?? UNKNOWN_PERSON(id);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rankings.map((r) => {
        const titleId = `lb-${r.id}`;
        return (
          <section key={r.id} aria-labelledby={titleId} className="break-inside-avoid rounded-lg border border-border bg-surface p-4 shadow-card">
            <h3 id={titleId} className="mb-2 font-semibold text-ink">{lb.awardTitle[r.id](gender)}</h3>
            {r.ranked.length === 0 ? (
              <p className="text-sm text-slate">{t.teams.stats.noData}</p>
            ) : (
              <ol className="space-y-1">
                {r.ranked.filter((x) => x.rank <= 3).map((x) => {
                  const p = person(x.playerId);
                  return (
                    <li key={x.playerId} className="flex items-baseline gap-2">
                      <span className="w-5 tabular-nums text-slate">{x.rank}.</span>
                      <span className="flex-1 truncate">
                        {p.current ? <Link to={`/teams/${teamId}/players/${p.playerId}`} className="text-ink hover:underline">{label(p)}</Link> : <span className="text-ink">{label(p)}</span>}
                      </span>
                      <span className="text-sm tabular-nums text-slate">{x.display}{x.attempts !== null ? ` · ${t.teams.stats.attempts(x.attempts)}` : ''}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            {r.notEnoughData.length > 0 && (
              <p className="mt-2 text-xs text-slate">{t.teams.stats.notEnoughData(r.notEnoughData.map((id) => label(person(id))).join(', '))}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
