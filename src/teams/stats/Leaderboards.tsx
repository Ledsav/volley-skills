import { Link } from 'react-router-dom';
import { type AwardRanking } from '../../awards/awardRules';
import { UNKNOWN_PERSON, type Person } from './rosterIndex';
import { BAND_BAR_CLASS, barFraction, leaderBand } from './leaderBars';
import type { TeamPlayerRow } from './teamSeason';
import { useT } from '../../i18n/I18nProvider';
import type { Gender } from '../../i18n/catalog';
import type { Level } from '../../types/player';

const label = (p: Person) => `${p.number !== null ? `#${p.number} ` : ''}${p.name}`;

export function Leaderboards({ teamId, rankings, people, gender = 'mixed', players = [] }: { teamId: string; rankings: AwardRanking[]; people: Map<string, Person>; gender?: Gender; players?: TeamPlayerRow[] }) {
  const t = useT();
  const lb = t.labels;
  const person = (id: string) => people.get(id) ?? UNKNOWN_PERSON(id);
  const ratingsById = new Map(players.map((p) => [p.playerId, p.ratings]));
  const levels: Level[] = ['Beginner', 'Developing', 'Advanced', 'Elite'];
  return (
    <div>
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {rankings.map((r) => {
        const titleId = `lb-${r.id}`;
        return (
          <section key={r.id} aria-labelledby={titleId} className="break-inside-avoid">
            <h3 id={titleId} className="px-4 pb-2 text-caption text-ink-2">{lb.awardTitle[r.id](gender)}</h3>
            <ol className="overflow-hidden rounded-lg bg-surface shadow-card">
              {r.ranked.length === 0 ? (
                <li className="px-4 py-3 text-callout text-ink-2">{t.teams.stats.noData}</li>
              ) : (
                r.ranked.filter((x) => x.rank <= 3).map((x) => {
                  const p = person(x.playerId);
                  const band = leaderBand(r.id, ratingsById.get(x.playerId));
                  return (
                    <li key={x.playerId} className="px-4 [&:not(:first-child)>div]:border-t [&>div]:border-separator">
                      <div className="min-h-[52px] py-2">
                        {/* The value wraps under the name when the card is narrow, so names are never cut. */}
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="w-5 shrink-0 text-footnote text-ink-2 tabular-nums">{x.rank}.</span>
                          <span className="min-w-0 flex-1 basis-32 break-words text-headline">
                            {p.current ? <Link to={`/teams/${teamId}/players/${p.playerId}`} className="text-ink hover:underline">{label(p)}</Link> : <span className="text-ink">{label(p)}</span>}
                          </span>
                          <span className="ml-auto whitespace-nowrap text-callout text-ink-2 tabular-nums">{x.display}{x.attempts !== null ? ` · ${t.teams.stats.attempts(x.attempts)}` : ''}</span>
                        </div>
                        <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2 [print-color-adjust:exact]">
                          <div
                            data-band={band ?? 'none'}
                            className={`h-full rounded-full ${band ? BAND_BAR_CLASS[band] : 'bg-ink-3'}`}
                            style={{ width: `${barFraction(x.value, r.ranked[0].value) * 100}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
            {r.notEnoughData.length > 0 && (
              <p className="mt-2 px-4 text-footnote text-ink-2">{t.teams.stats.notEnoughData(r.notEnoughData.map((id) => label(person(id))).join(', '))}</p>
            )}
          </section>
        );
      })}
    </div>
    {/* Bars take the level band of the player's season rating in that skill (design spec 8.5); say so. */}
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 text-footnote text-ink-2">
      <span>{t.teams.stats.barLegend}</span>
      {levels.map((level) => (
        <span key={level} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${BAND_BAR_CLASS[level]}`} />
          {lb.level[level](gender)}
        </span>
      ))}
    </p>
    </div>
  );
}
