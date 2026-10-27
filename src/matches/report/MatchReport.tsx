import { useState } from 'react';
import { FIELD_CLASS } from '../../components/Input';
import { GRADES, SKILLS, type Match, type MatchReportData } from '../../types/match';
import { fmtEff, fmtPct, playerLabel, rosterMap } from '../format';
import { useT } from '../../i18n/I18nProvider';
import { GRADE_CLASS } from '../scout/gradeStyles';
import { isManyErrors, isWeakAttack, isWeakReception, weakClass } from '../statFlags';

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs text-slate">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

interface MatchReportProps {
  match: Match;
  report: MatchReportData;
  /** Controlled set filter; omit both to let the report own it. */
  set?: number | 'all';
  onSetChange?: (set: number | 'all') => void;
}

export function MatchReport({ match, report, set: setProp, onSetChange }: MatchReportProps) {
  const lb = useT().labels;
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
    stats.sourceCounts.tap > 0 && `${Math.round((stats.sourceCounts.tap / totalSource) * 100)}% tapped`,
    stats.sourceCounts.text > 0 && `${Math.round((stats.sourceCounts.text / totalSource) * 100)}% from text`,
    imported > 0 && 'Imported from DataVolley',
  ].filter(Boolean);
  const setNumbers = report.sets;

  return (
    <div className="match-report flex flex-col gap-6 print:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-stat font-extrabold tabular-nums text-ink">{report.setsWon.us}–{report.setsWon.them}</p>
          <p className="text-sm tabular-nums text-slate">{report.setScores.map((s) => `${s.us}–${s.them}`).join(' · ')}</p>
          {set !== 'all' && <p className="hidden text-sm font-semibold text-ink print:block">Set {set} only</p>}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink print:hidden">
          Set
          <select aria-label="Set" className={FIELD_CLASS} value={set} onChange={(e) => setSet(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All</option>
            {setNumbers.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Side-out" value={fmtPct(t.sideOut.total ? t.sideOut.won / t.sideOut.total : null)} />
        <Kpi label="Break point" value={fmtPct(t.breakPoint.total ? t.breakPoint.won / t.breakPoint.total : null)} />
        <Kpi label="Reception +" value={fmtPct(t.receptionPos)} />
        <Kpi label="Attack eff." value={fmtEff(t.attackEff)} />
        <Kpi label="Aces / serve errors" value={`${t.aces} / ${t.serveErrors}`} />
        <Kpi label="Opp. errors" value={String(t.oppErrorPoints)} />
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-ink">Players</h2>
        <div className="overflow-x-auto rounded-lg border border-border print:overflow-visible">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-bg text-left text-xs uppercase text-slate">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium">Player</th>
                {SKILLS.map((s) => (
                  <th scope="col" key={s} className="px-2 py-2 font-medium">{lb.skill[s]}</th>
                ))}
                <th scope="col" className="px-2 py-2 font-medium">Att. eff</th>
                <th scope="col" className="px-2 py-2 font-medium">Rec +</th>
                <th scope="col" className="px-2 py-2 font-medium">Pts / Err</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const entry = roster.get(p.playerId);
                return (
                  <tr key={p.playerId} className="border-t border-border">
                    <td className="whitespace-nowrap px-2 py-2 text-ink">{playerLabel(entry)} {entry?.name}</td>
                    {SKILLS.map((s) => {
                      const line = p.skills[s];
                      if (!line) return <td key={s} className="px-2 text-slate">—</td>;
                      return (
                        <td key={s} className="px-2">
                          <span className="block text-xs">{line.attempts}</span>
                          <span className="flex h-2 w-16 overflow-hidden rounded-full" aria-hidden="true">
                            {GRADES.map((g) =>
                              line.grades[g] ? (
                                <span key={g} className={GRADE_CLASS[g]} style={{ width: `${(line.grades[g] / line.attempts) * 100}%` }} />
                              ) : null,
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className={`px-2 ${weakClass(isWeakAttack(p.attackEff))}`}>{fmtEff(p.attackEff)}</td>
                    <td className={`px-2 ${weakClass(isWeakReception(p.receptionPos))}`}>{fmtPct(p.receptionPos)}</td>
                    <td className="px-2">
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
        <h2 className="mb-2 font-semibold text-ink">Rotations</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[1, 6, 5, 4, 3, 2].map((r) => {
            const rot = t.rotations[r] ?? { won: 0, lost: 0 };
            const weakest = t.weakestRotation === r;
            return (
              <div key={r} className={`rounded-md border p-2 text-center ${weakest ? 'border-red bg-red/10' : 'border-border'}`}>
                <p className="text-xs text-slate">Rot {r}</p>
                <p className="font-semibold tabular-nums text-ink">{rot.won - rot.lost > 0 ? '+' : ''}{rot.won - rot.lost}</p>
                <p className="text-xs tabular-nums text-slate">{rot.won}–{rot.lost}</p>
              </div>
            );
          })}
        </div>
      </section>

      {stats.timeoutEffects.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-ink">Timeouts</h2>
          <ul className="space-y-1 text-sm text-ink">
            {stats.timeoutEffects.map((e, i) => (
              <li key={i} className="tabular-nums">
                Set {e.set} · T/O {e.team} at {e.score.us}–{e.score.them} → next rallies {e.won}–{e.lost}
              </li>
            ))}
          </ul>
        </section>
      )}

      {totalSource > 0 && (
        <p className="text-xs text-slate">
          {sourceParts.join(' · ')}
        </p>
      )}
    </div>
  );
}
