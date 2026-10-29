import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { AWARDS_FOR, rankAward } from '../../awards/awardRules';
import { buttonClassName } from '../../components/Button';
import { FIELD_CLASS } from '../../components/Input';
import { Menu, type MenuItem } from '../../components/Menu';
import { SegmentedControl } from '../../components/SegmentedControl';
import { SkeletonBlock } from '../../components/Skeleton';
import { usePublishPageChrome } from '../../layout/PageChrome';
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

  const ready = !!view && view.coverage.scouted > 0;
  usePublishPageChrome({
    title: team.name,
    mainAction: ready
      ? {
          label: t.export,
          icon: Download,
          menu: [
            { kind: 'action', label: t.printPdf, icon: <Printer size={16} />, onSelect: () => window.print() },
            { kind: 'divider' },
            { kind: 'action', label: t.csvEu, icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('eu') },
            { kind: 'action', label: t.csvEn, icon: <FileSpreadsheet size={16} />, onSelect: () => exportCsv('en') },
          ],
        }
      : undefined,
  });

  if (error) return <p role="alert" className="text-callout text-red-strong">{t.loadError}</p>;
  if (!view) {
    return (
      <div role="status" className="space-y-6">
        <span className="sr-only">{tt.teams.shared.loadingStats}</span>
        <SkeletonBlock className="h-11 w-72 max-w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-[104px] rounded-lg" />)}
        </div>
        <SkeletonBlock className="h-52 rounded-lg" />
      </div>
    );
  }

  const { coverage, season, filtered } = view;
  if (coverage.scouted === 0) {
    return <p className="rounded-lg bg-surface p-6 text-callout text-ink-2 shadow-card">{t.none}</p>;
  }
  const total = coverage.scouted + coverage.scoreOnly + coverage.skipped;

  const rangeId = filter.range.kind === 'last' ? (filter.range.count === 5 ? 'last5' : 'last10') : filter.range.kind;
  const competitionLabels: Record<StatsFilter['competition'], string> = {
    all: t.all, league: tt.labels.competition.league, cup: tt.labels.competition.cup,
    friendly: tt.labels.competition.friendly, tournament: tt.labels.competition.tournament,
  };
  const venueLabels: Record<StatsFilter['homeAway'], string> = { all: t.homeAway, home: t.home, away: t.away };
  const filterMenu = <K extends string>(name: string, labels: Record<K, string>, current: K, pick: (k: K) => void) => {
    const text = t.filterValue(name, labels[current]);
    const items: MenuItem[] = (Object.keys(labels) as K[]).map((k) => ({
      kind: 'check', label: labels[k], checked: k === current, onSelect: () => pick(k),
    }));
    return (
      <Menu
        label={text}
        align="start"
        triggerClassName={`${buttonClassName('secondary', 'pill')} min-h-11 gap-1`}
        trigger={<>{text}<ChevronDown size={16} aria-hidden="true" /></>}
        items={items}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <h2 className="text-xl font-semibold">{t.printHeading(team.name, team.season)}</h2>
        <p className="text-sm">{t.printed(formatDateValue(new Date(), 'numeric'))}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <SegmentedControl
          label={t.range}
          className="w-full sm:w-auto"
          options={[
            { id: 'season', label: t.wholeSeason }, { id: 'last5', label: t.last5 },
            { id: 'last10', label: t.last10 }, { id: 'dates', label: t.dates },
          ]}
          value={rangeId}
          onChange={(v) =>
            setFilter({
              ...filter,
              range: v === 'last5' ? { kind: 'last', count: 5 } : v === 'last10' ? { kind: 'last', count: 10 }
                : v === 'dates' ? { kind: 'dates', ...dateBounds(matches ?? []) }
                : { kind: 'season' },
            })
          }
        />
        {filterMenu(t.competition, competitionLabels, filter.competition, (competition) => setFilter({ ...filter, competition }))}
        {filterMenu(t.venue, venueLabels, filter.homeAway, (homeAway) => setFilter({ ...filter, homeAway }))}
        {filter.range.kind === 'dates' && (
          <div className="flex w-full flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-footnote text-ink-2">{t.from}
              <input type="date" className={`${FIELD_CLASS} tabular-nums`} value={filter.range.from}
                onChange={(e) => filter.range.kind === 'dates' && setFilter({ ...filter, range: { ...filter.range, from: e.target.value } })} /></label>
            <label className="flex items-center gap-2 text-footnote text-ink-2">{t.to}
              <input type="date" className={`${FIELD_CLASS} tabular-nums`} value={filter.range.to}
                onChange={(e) => filter.range.kind === 'dates' && setFilter({ ...filter, range: { ...filter.range, to: e.target.value } })} /></label>
          </div>
        )}
      </div>

      <p className="text-footnote text-ink-2 tabular-nums">
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
        <h3 id="trend-h" className="mb-2 text-title-3 text-ink">{t.trend}</h3>
        <TeamTrendChart points={season.trend} />
      </section>
      <section aria-labelledby="rot-h">
        <h3 id="rot-h" className="mb-2 text-title-3 text-ink">{t.rotations}</h3>
        <RotationBars rotations={season.rotations} best={season.bestRotation} weakest={season.weakestRotation} />
      </section>
      <section aria-labelledby="lb-h">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 id="lb-h" className="text-title-3 text-ink">{t.bestPlayers}</h3>
          <Link to={`/teams/${team.id}/awards`} className="inline-flex min-h-11 items-center text-callout text-ink-2 hover:text-ink print:hidden">
            {t.seasonAwards}&nbsp;<span aria-hidden="true">→</span>
          </Link>
        </div>
        <Leaderboards teamId={team.id} rankings={view.rankings} people={view.people} gender={teamGender(team)} players={season.players} />
      </section>
      <section aria-labelledby="pt-h" className="print:break-before-page">
        <h3 id="pt-h" className="mb-2 text-title-3 text-ink">{t.players}</h3>
        <PlayerStatsTable teamId={team.id} rows={season.players} />
      </section>
    </div>
  );
}
