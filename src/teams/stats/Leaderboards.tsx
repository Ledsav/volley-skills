import { Link } from 'react-router-dom';
import { AWARD_TITLES, type AwardRanking } from '../../awards/awardRules';
import { UNKNOWN_PERSON, type Person } from './rosterIndex';

const label = (p: Person) => `${p.number !== null ? `#${p.number} ` : ''}${p.name}`;

export function Leaderboards({ teamId, rankings, people }: { teamId: string; rankings: AwardRanking[]; people: Map<string, Person> }) {
  const person = (id: string) => people.get(id) ?? UNKNOWN_PERSON(id);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rankings.map((r) => {
        const titleId = `lb-${r.id}`;
        return (
          <section key={r.id} aria-labelledby={titleId} className="break-inside-avoid rounded-lg border border-border bg-surface p-4 shadow-card">
            <h3 id={titleId} className="mb-2 font-semibold text-ink">{AWARD_TITLES[r.id]}</h3>
            {r.ranked.length === 0 ? (
              <p className="text-sm text-slate">No data yet</p>
            ) : (
              <ol className="space-y-1">
                {r.ranked.slice(0, 3).map((x) => {
                  const p = person(x.playerId);
                  return (
                    <li key={x.playerId} className="flex items-baseline gap-2">
                      <span className="w-5 tabular-nums text-slate">{x.rank}.</span>
                      <span className="flex-1 truncate">
                        {p.current ? <Link to={`/teams/${teamId}/players/${p.playerId}`} className="text-ink hover:underline">{label(p)}</Link> : <span className="text-ink">{label(p)}</span>}
                      </span>
                      <span className="text-sm tabular-nums text-slate">{x.display}{x.attempts !== null ? ` · ${x.attempts} att.` : ''}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            {r.notEnoughData.length > 0 && (
              <p className="mt-2 text-xs text-slate">Not enough data: {r.notEnoughData.map((id) => label(person(id))).join(', ')}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
