import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileSpreadsheet, Printer, Trophy } from 'lucide-react';
import { AWARDS_FOR, rankAward } from '../../awards/awardRules';
import { Menu } from '../../components/Menu';
import { downloadText } from '../../export/exportJson';
import { fmtEff, fmtPct } from '../../matches/format';
import { listFinishedMatches, loadTeamRoster } from '../../matches/matchesApi';
import type { CsvFormat } from '../../matches/report/reportCsv';
import type { Match } from '../../types/match';
import type { Player } from '../../types/player';
import type { Team } from '../../types/team';
import { Leaderboards } from './Leaderboards';
import { PlayerStatsTable } from './PlayerStatsTable';
import { RotationBars } from './RotationBars';
import { latestRosterIndex, withCurrentRoster } from './rosterIndex';
import { parseStatsFilter, statsFilterToParams } from './statsFilterParams';
import { TeamTrendChart } from './TeamTrendChart';
import { filterMatches, seasonCoverage, teamSeason, type StatsFilter } from './teamSeason';
import { teamStatsCsv, teamStatsCsvFileName } from './teamStatsCsv';
import { StatTile } from '../../components/StatTile';
import { formatDateValue } from '../../i18n/format';
import { useT } from '../../i18n/I18nProvider';
import { teamGender } from '../teamGender';

function dateBounds(all: Match[]): { from: string; to: string } {
  const dates = all.map((m) => m.date).sort();
  return { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' };
}

export default function TeamStatsTab({ team }: { team: Team }) {
  const tt = useT();
  const t = tt.teams.stats;
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [error, setError] = useState(false);
  const [params, setParams] = useSearchParams();
  const filter = parseStatsFilter(params);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listFinishedMatches(team.id), loadTeamRoster(team.id).catch(() => [] as Player[])])
      .then(([ms, players]) => {
        if (cancelled) return;
        setMatches(ms);
        setRoster(players);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [team.id]);

  const view = useMemo(() => {
    if (!matches) return null;
    const people = withCurrentRoster(latestRosterIndex(matches), roster);
    const filtered = filterMatches(matches, filter);
    return {
      people, filtered, coverage: seasonCoverage(matches), season: teamSeason(filtered, people),
      rankings: AWARDS_FOR.season.map((id) => rankAward(id, 'season', filtered)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, roster, params.toString()]);

  function setFilter(next: StatsFilter) {
    const p = statsFilterToParams(next);
    // keep non-filter params (e.g. ?tab=stats) so the page stays on this tab
    const tab = params.get('tab');
    if (tab) p.set('tab', tab);
    setParams(p, { replace: true });
  }

  function exportCsv(format: CsvFormat) {
    if (!view) return;
    downloadText(teamStatsCsvFileName(team.name, view.filtered), teamStatsCsv(view.season.players, format), 'text/csv;charset=utf-8');
  }

  if (error) return <p role="alert" className="text-red-strong">{t.loadError}</p>;
  if (!view) return <p className="text-slate">{tt.teams.shared.loadingStats}</p>;

  const { coverage, season, filtered } = view;
  if (coverage.scouted === 0) {
    return <p className="text-slate">{t.none}</p>;
  }
  const total = coverage.scouted + coverage.scoreOnly + coverage.skipped;

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <h2 className="text-xl font-semibold">{t.printHeading(team.name, team.season)}</h2>
        <p className="text-sm">{t.printed(formatDateValue(new Date(), 'numeric'))}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm text-slate">
          {t.competition}
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink" value={filter.competition}
            onChange={(e) => setFilter({ ...filter, competition: e.target.value as StatsFilter['competition'] })}>
            <option value="all">{t.all}</option><option value="league">{tt.labels.competition.league}</option><option value="cup">{tt.labels.competition.cup}</option>
            <option value="friendly">{tt.labels.competition.friendly}</option><option value="tournament">{tt.labels.competition.tournament}</option>
          </select>
        </label>
        <label className="text-sm text-slate">
          {t.range}
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink"
            value={filter.range.kind === 'last' ? `last${filter.range.count}` : filter.range.kind}
            onChange={(e) => {
              const v = e.target.value;
              setFilter({
                ...filter,
                range: v === 'last5' ? { kind: 'last', count: 5 } : v === 'last10' ? { kind: 'last', count: 10 }
                  : v === 'dates' ? { kind: 'dates', ...dateBounds(matches ?? []) }
                  : { kind: 'season' },
              });
            }}>
            <option value="season">{t.wholeSeason}</option><option value="last5">{t.last5}</option><option value="last10">{t.last10}</option><option value="dates">{t.dates}</option>
          </select>
        </label>
        {filter.range.kind === 'dates' && (
          <>
            <label className="text-sm text-slate">{t.from} <input type="date" className="ml-1 rounded-md border border-border px-2 py-1" value={filter.range.from}
              onChange={(e) => filter.range.kind === 'dates' && setFilter({ ...filter, range: { ...filter.range, from: e.target.value } })} /></label>
            <label className="text-sm text-slate">{t.to} <input type="date" className="ml-1 rounded-md border border-border px-2 py-1" value={filter.range.to}
              onChange={(e) => filter.range.kind === 'dates' && setFilter({ ...filter, range: { ...filter.range, to: e.target.value } })} /></label>
          </>
        )}
        <label className="text-sm text-slate">
          {t.venue}
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink" value={filter.homeAway}
            onChange={(e) => setFilter({ ...filter, homeAway: e.target.value as StatsFilter['homeAway'] })}>
            <option value="all">{t.homeAway}</option><option value="home">{t.home}</option><option value="away">{t.away}</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Link to={`/teams/${team.id}/awards`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-orange-strong px-4 font-medium text-on-ink hover:opacity-90">
            <Trophy size={16} aria-hidden="true" /> {t.seasonAwards}
          </Link>
          <Menu
            label={t.export}
            trigger={<span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4"><Download size={16} aria-hidden="true" /> {t.export}</span>}
            items={[
              { kind: 'action', label: t.printPdf, icon: <Printer size={16} />, onSelect: () => window.print() },
              { kind: 'divider' },
              { kind: 'action', label: t.csvEu, icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('eu') },
              { kind: 'action', label: t.csvEn, icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('en') },
            ]}
          />
        </div>
      </div>

      <p className="text-sm text-slate">
        {t.basedOn(coverage.scouted)}
        {coverage.scoreOnly > 0 && ` · ${t.scoreOnly(coverage.scoreOnly)}`}
        {coverage.skipped > 0 && ` · ${t.skipped(coverage.skipped)}`}
        {filter.range.kind === 'last'
          ? ` · ${t.showingLast(filter.range.count)}`
          : filtered.length !== total && ` · ${t.showingOf(filtered.length, total)}`}
        {coverage.capped && ` · ${t.capped}`}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={`${season.record.won}–${season.record.lost}`} label={t.record} hint={t.sets(season.record.setsWon, season.record.setsLost)} />
        <StatTile value={fmtPct(season.sideOut)} label={t.sideOut} />
        <StatTile value={fmtPct(season.breakPoint)} label={t.breakPoint} />
        <StatTile value={fmtEff(season.attackEff)} label={t.attackEff} />
        <StatTile value={fmtPct(season.receptionPos)} label={t.receptionPos} />
        <StatTile value={`${season.aces} / ${season.serveErrors}`} label={t.acesServeErrors} />
        <StatTile value={String(season.oppErrorPoints)} label={t.oppErrors} />
      </div>

      <section aria-labelledby="trend-h" className="break-inside-avoid">
        <h3 id="trend-h" className="mb-2 font-semibold text-ink">{t.trend}</h3>
        <TeamTrendChart points={season.trend} />
      </section>
      <section aria-labelledby="rot-h">
        <h3 id="rot-h" className="mb-2 font-semibold text-ink">{t.rotations}</h3>
        <RotationBars rotations={season.rotations} best={season.bestRotation} weakest={season.weakestRotation} />
      </section>
      <section aria-labelledby="lb-h">
        <h3 id="lb-h" className="mb-2 font-semibold text-ink">{t.bestPlayers}</h3>
        <Leaderboards teamId={team.id} rankings={view.rankings} people={view.people} gender={teamGender(team)} />
      </section>
      <section aria-labelledby="pt-h" className="print:break-before-page">
        <h3 id="pt-h" className="mb-2 font-semibold text-ink">{t.players}</h3>
        <PlayerStatsTable teamId={team.id} rows={season.players} />
      </section>
    </div>
  );
}
