import { TriangleAlert } from 'lucide-react';
import { Fragment, useState } from 'react';
import { GRADES, SKILLS, type RosterEntry } from '../../types/match';
import { fmtEff, fmtPct, playerLabel } from '../format';
import { useT } from '../../i18n/I18nProvider';
import type { MatchState } from '../scoutEngine';
import { computeStats, liveAlerts } from '../scoutStats';
import { isManyErrors, isWeakAttack, isWeakReception, weakClass } from '../statFlags';

export function LiveStatsPanel({ state, roster }: { state: MatchState; roster: Map<string, RosterEntry> }) {
  const tr = useT();
  const lb = tr.labels;
  const sc = tr.scout.live;
  const [scope, setScope] = useState<'set' | 'match'>('set');
  const [openId, setOpenId] = useState<string | null>(null);
  const stats = computeStats(state, scope === 'set' ? { set: state.set } : {});
  const alerts = liveAlerts(state);
  const rows = Object.values(stats.players).sort(
    (a, b) => (roster.get(a.playerId)?.number ?? 0) - (roster.get(b.playerId)?.number ?? 0),
  );
  const t = stats.team;

  return (
    <section aria-label={sc.aria} className="rounded-lg bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-ink">{sc.title}</h2>
        <div className="inline-flex gap-0.5 rounded-md bg-surface-2 p-0.5">
          {(['set', 'match'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={`min-h-11 rounded-sm px-3 text-callout ${scope === s ? 'bg-surface-3 font-medium text-ink' : 'text-ink-2'}`}
            >
              {s === 'set' ? sc.thisSet : sc.match}
            </button>
          ))}
        </div>
      </div>

      {alerts.length > 0 && (
        <div role="alert" className="mb-2 space-y-1 rounded-md bg-red-tint p-2 text-callout font-medium text-red-strong">
          {alerts.map((a) =>
            a.kind === 'playerErrors' ? (
              <p key={a.playerId} className="flex items-center gap-1.5">
                <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
                {sc.playerErrors(playerLabel(roster.get(a.playerId)), roster.get(a.playerId)?.name ?? '', a.errors)}</p>
            ) : (
              <p key="run" className="flex items-center gap-1.5">
                <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
                {sc.oppRun(a.run)}
              </p>
            ),
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-callout tabular-nums">
          <thead>
            <tr className="text-left text-caption text-ink-2">
              <th scope="col" className="py-1 pr-2 font-medium">{sc.player}</th>
              <th scope="col" className="px-2 font-medium">{lb.skill.S}</th>
              <th scope="col" className="px-2 font-medium">{sc.recPlus}</th>
              <th scope="col" className="px-2 font-medium">{lb.skill.A}</th>
              <th scope="col" className="px-2 font-medium">{lb.skill.B}</th>
              <th scope="col" className="px-2 font-medium">{sc.ptsErr}</th>
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
                  <tr className="border-t border-separator">
                    <td className="py-1 pr-2 text-ink">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : p.playerId)}
                        className="min-h-11 text-left"
                      >
                        {playerLabel(entry)} <span className="text-ink-2">{entry?.name}</span>
                      </button>
                    </td>
                    <td className="px-2">{s ? `${s.attempts} · ${s.grades['#']}# ${s.grades['=']}=` : '—'}</td>
                    <td className={`px-2 ${weakClass(isWeakReception(p.receptionPos))}`}>
                      {r ? `${r.attempts} · ${fmtPct(p.receptionPos)}` : '—'}
                    </td>
                    <td className={`px-2 ${weakClass(isWeakAttack(p.attackEff))}`}>
                      {a ? `${a.grades['#']}/${a.attempts} ${fmtEff(p.attackEff)}` : '—'}
                    </td>
                    <td className="px-2">{p.skills.B ? `${p.skills.B.grades['#']}#` : '—'}</td>
                    <td className="px-2">
                      <span className="text-green-strong">{p.points}</span> / <span className={weakClass(isManyErrors(p.errors))}>{p.errors}</span>
                      <div aria-hidden="true" data-testid={`trend-${p.playerId}`} className="mt-1 flex h-2 w-20 overflow-hidden rounded-full bg-surface-3">
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
                      <td colSpan={6} className="pb-2 pl-2 text-caption text-ink-2">
                        <ul className="space-y-0.5">
                          {SKILLS.map((k) => {
                            const st = p.skills[k];
                            if (!st) return null;
                            const gs = GRADES.filter((g) => st.grades[g] > 0).map((g) => `${g} ${st.grades[g]}`);
                            return (
                              <li key={k}>
                                {lb.skill[k]}: {st.attempts}{gs.length > 0 ? ` · ${gs.join(' ')}` : ''}
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

      <p className="mt-2 text-caption text-ink-2">
        {sc.footer(
          fmtPct(t.sideOut.total ? t.sideOut.won / t.sideOut.total : null),
          fmtPct(t.breakPoint.total ? t.breakPoint.won / t.breakPoint.total : null),
          fmtPct(t.receptionPos),
          t.oppErrorPoints,
          t.weakestRotation,
        )}
      </p>
    </section>
  );
}
