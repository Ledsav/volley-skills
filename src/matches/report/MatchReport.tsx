import { useState } from 'react';
import { FIELD_CLASS } from '../../components/Input';
import { GRADES, SKILLS, type Match, type MatchReportData } from '../../types/match';
import { fmtEff, fmtPct, playerLabel, rosterMap } from '../format';
import { SKILL_LABELS } from '../skillGrades';
import { GRADE_CLASS } from '../scout/gradeStyles';

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
  const [localSet, setLocalSet] = useState<number | 'all'>('all');
  const set = setProp ?? localSet;
  const setSet = onSetChange ?? setLocalSet;
  const stats = (set === 'all' ? report.all : report.bySet[set]) ?? report.all;
  const roster = rosterMap(match.roster);
  const t = stats.team;
  const players = Object.values(stats.players).sort(
    (a, b) => (roster.get(a.playerId)?.number ?? 0) - (roster.get(b.playerId)?.number ?? 0),
  );
  const totalSource = stats.sourceCounts.tap + stats.sourceCounts.text;
  const setNumbers = report.sets;

  return (
    <div className="flex flex-col gap-6 print:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tabular-nums text-ink">{report.setsWon.us}–{report.setsWon.them}</p>
          <p className="text-sm tabular-nums text-slate">{report.setScores.map((s) => `${s.us}–${s.them}`).join(' · ')}</p>
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
                <th className="px-2 py-2 font-medium">Player</th>
                {SKILLS.map((s) => (
                  <th key={s} className="px-2 py-2 font-medium">{SKILL_LABELS[s]}</th>
                ))}
                <th className="px-2 py-2 font-medium">Att. eff</th>
                <th className="px-2 py-2 font-medium">Rec +</th>
                <th className="px-2 py-2 font-medium">Pts / Err</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const entry = roster.get(p.playerId);
                return (
                  <tr key={p.playerId} aria-label={`${playerLabel(entry)} ${entry?.name ?? ''}`} className="border-t border-border">
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
                    <td className="px-2">{fmtEff(p.attackEff)}</td>
                    <td className="px-2">{fmtPct(p.receptionPos)}</td>
                    <td className="px-2">{p.points} / {p.errors}</td>
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
          {Math.round((stats.sourceCounts.tap / totalSource) * 100)}% tapped · {Math.round((stats.sourceCounts.text / totalSource) * 100)}% from text
        </p>
      )}
    </div>
  );
}
