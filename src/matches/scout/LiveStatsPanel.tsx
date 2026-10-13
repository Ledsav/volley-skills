import { Fragment, useState } from 'react';
import { GRADES, type RosterEntry, type Skill } from '../../types/match';
import { fmtEff, fmtPct, playerLabel } from '../format';
import { SKILL_LABELS } from '../skillGrades';
import type { MatchState } from '../scoutEngine';
import { computeStats, liveAlerts } from '../scoutStats';

export function LiveStatsPanel({ state, roster }: { state: MatchState; roster: Map<string, RosterEntry> }) {
  const [scope, setScope] = useState<'set' | 'match'>('set');
  const [openId, setOpenId] = useState<string | null>(null);
  const stats = computeStats(state, scope === 'set' ? { set: state.set } : {});
  const alerts = liveAlerts(state);
  const rows = Object.values(stats.players).sort(
    (a, b) => (roster.get(a.playerId)?.number ?? 0) - (roster.get(b.playerId)?.number ?? 0),
  );
  const t = stats.team;

  return (
    <section aria-label="Live stats" className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-ink">Live</h2>
        <div className="flex gap-1">
          {(['set', 'match'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={`min-h-11 rounded-md px-3 text-sm ${scope === s ? 'bg-navy text-white' : 'text-slate hover:bg-bg'}`}
            >
              {s === 'set' ? 'This set' : 'Match'}
            </button>
          ))}
        </div>
      </div>

      {alerts.length > 0 && (
        <div role="alert" className="mb-2 space-y-1 rounded-md bg-red/10 p-2 text-sm font-medium text-red-strong">
          {alerts.map((a) =>
            a.kind === 'playerErrors' ? (
              <p key={a.playerId}>⚠ {playerLabel(roster.get(a.playerId))} {roster.get(a.playerId)?.name}: {a.errors} errors this set</p>
            ) : (
              <p key="run">⚠ Opp run 0–{a.run} — timeout?</p>
            ),
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs uppercase text-slate">
              <th className="py-1 pr-2 font-medium">Player</th>
              <th className="px-2 font-medium">Serve</th>
              <th className="px-2 font-medium">Rec +</th>
              <th className="px-2 font-medium">Attack</th>
              <th className="px-2 font-medium">Block</th>
              <th className="px-2 font-medium">Pts / Err</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const entry = roster.get(p.playerId);
              const s = p.skills.S;
              const a = p.skills.A;
              const r = p.skills.R;
              const total = p.points + p.errors;
              const open = openId === p.playerId;
              return (
                <Fragment key={p.playerId}>
                  <tr aria-label={`${playerLabel(entry)} ${entry?.name ?? ''}`} className="border-t border-border">
                    <td className="py-1 pr-2 text-ink">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : p.playerId)}
                        className="min-h-11 text-left"
                      >
                        {playerLabel(entry)} <span className="text-slate">{entry?.name}</span>
                      </button>
                    </td>
                    <td className="px-2">{s ? `${s.attempts} · ${s.grades['#']}# ${s.grades['=']}=` : '—'}</td>
                    <td className={`px-2 ${p.receptionPos !== null && p.receptionPos < 0.4 ? 'text-red' : ''}`}>
                      {r ? `${r.attempts} · ${fmtPct(p.receptionPos)}` : '—'}
                    </td>
                    <td className={`px-2 ${p.attackEff !== null && p.attackEff < 0 ? 'text-red' : ''}`}>
                      {a ? `${a.grades['#']}/${a.attempts} ${fmtEff(p.attackEff)}` : '—'}
                    </td>
                    <td className="px-2">{p.skills.B ? `${p.skills.B.grades['#']}#` : '—'}</td>
                    <td className="px-2">
                      <span className="text-green-strong">{p.points}</span> / <span className={p.errors >= 3 ? 'font-semibold text-red' : ''}>{p.errors}</span>
                      <div aria-hidden="true" data-testid={`trend-${p.playerId}`} className="mt-1 flex h-2 w-20 overflow-hidden rounded-full bg-border">
                        {total > 0 && (
                          <>
                            <div className="bg-green" style={{ width: `${(p.points / total) * 100}%` }} />
                            <div className="bg-red" style={{ width: `${(p.errors / total) * 100}%` }} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={6} className="pb-2 pl-2 text-xs text-slate">
                        <ul className="space-y-0.5">
                          {(Object.keys(SKILL_LABELS) as Skill[]).map((k) => {
                            const st = p.skills[k];
                            if (!st) return null;
                            const gs = GRADES.filter((g) => st.grades[g] > 0).map((g) => `${g} ${st.grades[g]}`);
                            return (
                              <li key={k}>
                                {SKILL_LABELS[k]}: {st.attempts}{gs.length > 0 ? ` · ${gs.join(' ')}` : ''}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate">
        Side-out {fmtPct(t.sideOut.total ? t.sideOut.won / t.sideOut.total : null)} · Break {fmtPct(t.breakPoint.total ? t.breakPoint.won / t.breakPoint.total : null)} ·
        Rec + {fmtPct(t.receptionPos)} · Opp errors {t.oppErrorPoints}
        {t.weakestRotation !== null && ` · Weakest rotation ${t.weakestRotation}`}
      </p>
    </section>
  );
}
