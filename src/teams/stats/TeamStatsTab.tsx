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

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-border bg-surface p-3 shadow-card">
      <div className="text-2xl font-extrabold tabular-nums text-ink">{value}</div>
      <div className="text-xs text-slate">{label}</div>
    </div>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 'es'}`;

export function TeamStatsTab({ team }: { team: Team }) {
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

  if (error) return <p role="alert" className="text-red">Could not load team stats.</p>;
  if (!view) return <p className="text-slate">Loading team stats…</p>;

  const { coverage, season, filtered } = view;
  if (coverage.scouted === 0) {
    return <p className="text-slate">No scouted matches yet — scout a match to see team stats.</p>;
  }
  const total = coverage.scouted + coverage.scoreOnly + coverage.skipped;

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <h2 className="text-xl font-semibold">{team.name} · Season {team.season}</h2>
        <p className="text-sm">Printed {new Date().toLocaleDateString()}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm text-slate">
          Competition
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink" value={filter.competition}
            onChange={(e) => setFilter({ ...filter, competition: e.target.value as StatsFilter['competition'] })}>
            <option value="all">All</option><option value="league">League</option><option value="cup">Cup</option>
            <option value="friendly">Friendly</option><option value="tournament">Tournament</option>
          </select>
        </label>
        <label className="text-sm text-slate">
          Range
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink"
            value={filter.range.kind === 'last' ? `last${filter.range.count}` : filter.range.kind}
            onChange={(e) => {
              const v = e.target.value;
              setFilter({
                ...filter,
                range: v === 'last5' ? { kind: 'last', count: 5 } : v === 'last10' ? { kind: 'last', count: 10 }
                  : v === 'dates' ? { kind: 'dates', from: filtered[0]?.date ?? '', to: filtered[filtered.length - 1]?.date ?? '' }
                  : { kind: 'season' },
              });
            }}>
            <option value="season">Whole season</option><option value="last5">Last 5</option><option value="last10">Last 10</option><option value="dates">Dates…</option>
          </select>
        </label>
        {filter.range.kind === 'dates' && (
          <>
            <label className="text-sm text-slate">From <input type="date" className="ml-1 rounded-md border border-border px-2 py-1" value={filter.range.from}
              onChange={(e) => filter.range.kind === 'dates' && setFilter({ ...filter, range: { ...filter.range, from: e.target.value } })} /></label>
            <label className="text-sm text-slate">To <input type="date" className="ml-1 rounded-md border border-border px-2 py-1" value={filter.range.to}
              onChange={(e) => filter.range.kind === 'dates' && setFilter({ ...filter, range: { ...filter.range, to: e.target.value } })} /></label>
          </>
        )}
        <label className="text-sm text-slate">
          Venue
          <select className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-ink" value={filter.homeAway}
            onChange={(e) => setFilter({ ...filter, homeAway: e.target.value as StatsFilter['homeAway'] })}>
            <option value="all">Home & away</option><option value="home">Home</option><option value="away">Away</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Link to={`/teams/${team.id}/awards`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-orange px-4 font-medium text-white hover:bg-orange-strong">
            <Trophy size={16} aria-hidden="true" /> Season awards
          </Link>
          <Menu
            label="Export"
            trigger={<span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4"><Download size={16} aria-hidden="true" /> Export</span>}
            items={[
              { kind: 'action', label: 'Print / PDF', icon: <Printer size={16} />, onSelect: () => window.print() },
              { kind: 'divider' },
              { kind: 'action', label: 'CSV · Excel (Belgium/EU)', icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('eu') },
              { kind: 'action', label: 'CSV · Excel (English) / Sheets', icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('en') },
            ]}
          />
        </div>
      </div>

      <p className="text-sm text-slate">
        Based on {plural(coverage.scouted, 'scouted match')}
        {coverage.scoreOnly > 0 && ` · ${coverage.scoreOnly} score-only`}
        {coverage.skipped > 0 && ` · ${coverage.skipped} skipped (finished before stats existed)`}
        {filtered.length !== total && ` · Showing ${filtered.length} of ${total} matches`}
        {coverage.capped && ' · Showing the latest 60 matches.'}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi value={`${season.record.won}–${season.record.lost}`} label={`Record · sets ${season.record.setsWon}–${season.record.setsLost}`} />
        <Kpi value={fmtPct(season.sideOut)} label="Side-out" />
        <Kpi value={fmtPct(season.breakPoint)} label="Break point" />
        <Kpi value={fmtEff(season.attackEff)} label="Attack eff." />
        <Kpi value={fmtPct(season.receptionPos)} label="Reception +" />
        <Kpi value={`${season.aces} / ${season.serveErrors}`} label="Aces / serve errors" />
        <Kpi value={String(season.oppErrorPoints)} label="Points from opp. errors" />
      </div>

      <section aria-labelledby="trend-h" className="break-inside-avoid">
        <h3 id="trend-h" className="mb-2 font-semibold text-ink">Trend</h3>
        <TeamTrendChart points={season.trend} />
      </section>
      <section aria-labelledby="rot-h">
        <h3 id="rot-h" className="mb-2 font-semibold text-ink">Rotations</h3>
        <RotationBars rotations={season.rotations} best={season.bestRotation} weakest={season.weakestRotation} />
      </section>
      <section aria-labelledby="lb-h">
        <h3 id="lb-h" className="mb-2 font-semibold text-ink">Best players</h3>
        <Leaderboards teamId={team.id} rankings={view.rankings} people={view.people} />
      </section>
      <section aria-labelledby="pt-h" className="print:break-before-page">
        <h3 id="pt-h" className="mb-2 font-semibold text-ink">Players</h3>
        <PlayerStatsTable teamId={team.id} rows={season.players} />
      </section>
    </div>
  );
}

export default TeamStatsTab;
