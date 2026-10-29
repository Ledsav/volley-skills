import { useState } from 'react';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatTile } from '../../components/StatTile';
import { GRADES, SKILLS, type Match, type MatchReportData } from '../../types/match';
import { fmtEff, fmtPct, playerLabel, rosterMap } from '../format';
import { useT } from '../../i18n/I18nProvider';
import { GRADE_BAR_CLASS } from './gradeBarStyles';
import { isManyErrors, isWeakAttack, isWeakReception, weakClass } from '../statFlags';

interface MatchReportProps {
  match: Match;
  report: MatchReportData;
  /** Controlled set filter; omit both to let the report own it. */
  set?: number | 'all';
  onSetChange?: (set: number | 'all') => void;
}

export function MatchReport({ match, report, set: setProp, onSetChange }: MatchReportProps) {
  const tt = useT();
  const lb = tt.labels;
  const rp = tt.matches.report;
  const [localSet, setLocalSet] = useState<number | 'all'>('all');
  const set = setProp ?? localSet;
  const setSet = onSetChange ?? setLocalSet;
  const stats = (set === 'all' ? report.all : report.bySet[set]) ?? report.all;
  const roster = rosterMap(match.roster);
  const t = stats.team;
  const players = Object.values(stats.players).sort(
    (a, b) => (roster.get(a.playerId)?.number ?? 0) - (roster.get(b.playerId)?.number ?? 0),
  );
  const imported = stats.sourceCounts.import ?? 0;
  const totalSource = stats.sourceCounts.tap + stats.sourceCounts.text + imported;
  const sourceParts = [
    stats.sourceCounts.tap > 0 && rp.tapped(Math.round((stats.sourceCounts.tap / totalSource) * 100)),
    stats.sourceCounts.text > 0 && rp.fromText(Math.round((stats.sourceCounts.text / totalSource) * 100)),
    imported > 0 && rp.imported,
  ].filter(Boolean);
  const setNumbers = report.sets;

  const { us, them } = report.setsWon;
  const result = us > them ? rp.won : us < them ? rp.lost : null;

  return (
    <div className="match-report flex flex-col gap-8 print:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {result && <p className="text-headline text-ink-2">{result}</p>}
          <p className="text-stat tabular-nums text-ink">{us}–{them}</p>
          {set !== 'all' && <p className="hidden text-sm font-semibold text-ink print:block">{rp.setOnly(set)}</p>}
        </div>
        <ol aria-label={rp.setScores} className="flex gap-2 overflow-x-auto">
          {report.setScores.map((s, i) => (
            <li key={i} className="rounded-md bg-surface px-3 py-2 text-center shadow-card">
              <p className="text-caption text-ink-2">{rp.setN(i + 1)}</p>
              <p className={`text-headline tabular-nums ${s.us > s.them ? 'text-ink' : 'text-ink-2'}`}>{s.us}–{s.them}</p>
            </li>
          ))}
        </ol>
      </div>

      <SegmentedControl
        label={rp.set}
        options={[{ id: 'all', label: rp.all }, ...setNumbers.map((n) => ({ id: String(n), label: rp.setN(n) }))]}
        value={String(set)}
        onChange={(id) => setSet(id === 'all' ? 'all' : Number(id))}
        className="w-full sm:w-auto print:hidden"
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label={rp.sideOut} value={fmtPct(t.sideOut.total ? t.sideOut.won / t.sideOut.total : null)} />
        <StatTile label={rp.breakPoint} value={fmtPct(t.breakPoint.total ? t.breakPoint.won / t.breakPoint.total : null)} />
        <StatTile label={rp.receptionPos} value={fmtPct(t.receptionPos)} />
        <StatTile label={rp.attackEff} value={fmtEff(t.attackEff)} />
        <StatTile label={rp.acesErrors} value={`${t.aces} / ${t.serveErrors}`} />
        <StatTile label={rp.oppErrors} value={String(t.oppErrorPoints)} />
      </section>

      <section>
        <h2 className="mb-2 text-title-3 text-ink">{rp.players}</h2>
        <div className="overflow-x-auto rounded-lg bg-surface shadow-card print:overflow-visible print:shadow-none">
          <table className="w-full text-callout tabular-nums">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-caption font-medium text-ink-2">{rp.player}</th>
                {SKILLS.map((s) => (
                  <th scope="col" key={s} className="px-3 py-2 text-left text-caption font-medium text-ink-2">{lb.skill[s]}</th>
                ))}
                <th scope="col" className="px-3 py-2 text-left text-caption font-medium text-ink-2">{rp.attEff}</th>
                <th scope="col" className="px-3 py-2 text-left text-caption font-medium text-ink-2">{rp.recPos}</th>
                <th scope="col" className="px-3 py-2 text-left text-caption font-medium text-ink-2">{rp.ptsErr}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {players.map((p) => {
                const entry = roster.get(p.playerId);
                return (
                  <tr key={p.playerId} className="break-inside-avoid">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-2 text-headline">{playerLabel(entry)} {entry?.name}</td>
                    {SKILLS.map((s) => {
                      const line = p.skills[s];
                      if (!line) return <td key={s} className="px-3 py-2 text-ink-2">—</td>;
                      return (
                        <td key={s} className="px-3 py-2">
                          <span className="block text-footnote">{line.attempts}</span>
                          <span className="flex h-2.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                            {GRADES.map((g) =>
                              line.grades[g] ? (
                                <span key={g} className={GRADE_BAR_CLASS[g]} style={{ width: `${(line.grades[g] / line.attempts) * 100}%` }} />
                              ) : null,
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2 ${weakClass(isWeakAttack(p.attackEff))}`}>{fmtEff(p.attackEff)}</td>
                    <td className={`px-3 py-2 ${weakClass(isWeakReception(p.receptionPos))}`}>{fmtPct(p.receptionPos)}</td>
                    <td className="px-3 py-2">
                      <span className="text-green-strong">{p.points}</span> / <span className={weakClass(isManyErrors(p.errors))}>{p.errors}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-title-3 text-ink">{rp.rotations}</h2>
        <p className="mb-3 text-footnote text-ink-2">{rp.rotationsNote}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[1, 6, 5, 4, 3, 2].map((r) => {
            const rot = t.rotations[r] ?? { won: 0, lost: 0 };
            const weakest = t.weakestRotation === r;
            return (
              <div key={r} className={`break-inside-avoid rounded-md p-3 text-center ${weakest ? 'bg-red-tint ring-1 ring-inset ring-red' : 'bg-surface shadow-card'}`}>
                <p className="text-caption text-ink-2">{rp.rot(r)}</p>
                <p className={`text-headline tabular-nums ${weakest ? 'text-red-strong' : 'text-ink'}`}>{rot.won - rot.lost > 0 ? '+' : ''}{rot.won - rot.lost}</p>
                <p className="text-footnote tabular-nums text-ink-2">{rot.won}–{rot.lost}</p>
              </div>
            );
          })}
        </div>
      </section>

      {stats.timeoutEffects.length > 0 && (
        <section>
          <h2 className="mb-2 text-title-3 text-ink">{rp.timeouts}</h2>
          <ul className="divide-y divide-separator rounded-lg bg-surface shadow-card">
            {stats.timeoutEffects.map((e, i) => (
              <li key={i} className="break-inside-avoid px-4 py-3 text-callout tabular-nums text-ink">
                {rp.timeoutLine(e.set, e.team, e.score.us, e.score.them, e.won, e.lost)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {totalSource > 0 && (
        <p className="text-footnote text-ink-2">
          {sourceParts.join(' · ')}
        </p>
      )}
    </div>
  );
}
