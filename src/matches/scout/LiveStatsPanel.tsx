import { TriangleAlert } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { GRADES, SKILLS, type RosterEntry } from '../../types/match';
import { fmtEff, fmtPct, playerLabel } from '../format';
import { useT } from '../../i18n/I18nProvider';
import type { MatchState } from '../scoutEngine';
import { computeStats, liveAlerts } from '../scoutStats';
import { isManyErrors, isWeakAttack, isWeakReception, weakClass } from '../statFlags';
import { trueMinus } from '../report/signed';

/** "Hazel Kessler" → "Hazel K.": one line in a 360–400 px column; the full name stays in the accessible name. */
function compactName(name: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] ?? '';
  return `${words[0]} ${words[words.length - 1][0]}.`;
}

/** A number cell: the headline figure, with an optional caption line under it. */
function Cell({ top, sub, className = '' }: { top: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <td className={`px-1 py-1.5 text-right align-top ${className}`}>
      <span className="block text-callout leading-5">{top}</span>
      {sub !== undefined && <span className="block text-caption leading-4 text-ink-2">{sub}</span>}
    </td>
  );
}

const DASH = <span className="text-ink-3">—</span>;

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
  const eff = (x: number | null) => trueMinus(fmtEff(x));
  const sum = (f: (p: (typeof rows)[number]) => number) => rows.reduce((n, p) => n + f(p), 0);
  const totals = {
    points: sum((p) => p.points),
    errors: sum((p) => p.errors),
    serves: sum((p) => p.skills.S?.attempts ?? 0),
    receptions: sum((p) => p.skills.R?.attempts ?? 0),
    kills: sum((p) => p.skills.A?.grades['#'] ?? 0),
    attacks: sum((p) => p.skills.A?.attempts ?? 0),
    blocks: sum((p) => p.skills.B?.grades['#'] ?? 0),
  };
  const kpis: { label: string; value: string }[] = [
    { label: sc.sideOut, value: fmtPct(t.sideOut.total ? t.sideOut.won / t.sideOut.total : null) },
    { label: sc.breakPoint, value: fmtPct(t.breakPoint.total ? t.breakPoint.won / t.breakPoint.total : null) },
    { label: sc.oppErrors, value: String(t.oppErrorPoints) },
    { label: sc.weakest, value: t.weakestRotation !== null ? String(t.weakestRotation) : '—' },
  ];

  return (
    <section aria-label={sc.aria} className="rounded-lg bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-headline text-ink">{sc.title}</h2>
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

      {/* Fixed columns sized for the 360–400 px side column and phones: no sideways scroll, one line per name. */}
      <table className="w-full table-fixed tabular-nums">
        <colgroup>
          <col />
          <col className="w-[3.25rem]" />
          <col className="w-11" />
          <col className="w-11" />
          <col className="w-12" />
          <col className="w-9" />
        </colgroup>
        <thead>
          <tr className="text-caption text-ink-2">
            <th scope="col" className="py-1 pr-1 text-left font-medium">{sc.player}</th>
            <th scope="col" className="truncate px-1 text-right font-medium">{sc.ptsErr}</th>
            <th scope="col" className="truncate px-1 text-right font-medium">{lb.skill.S}</th>
            <th scope="col" className="truncate px-1 text-right font-medium">{sc.recPlus}</th>
            <th scope="col" className="truncate px-1 text-right font-medium">{lb.skill.A}</th>
            <th scope="col" className="truncate pl-1 text-right font-medium">{lb.skill.B}</th>
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
                  <td className="py-0.5 pr-1 align-top">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${playerLabel(entry)} ${entry?.name ?? ''}`.trim()}
                      onClick={() => setOpenId(open ? null : p.playerId)}
                      className="flex min-h-11 w-full min-w-0 items-center gap-1.5 text-left text-callout"
                    >
                      <span className="w-7 shrink-0 text-ink-2">{playerLabel(entry)}</span>{' '}
                      <span className="min-w-0 truncate font-medium text-ink">{compactName(entry?.name)}</span>
                    </button>
                  </td>
                  <td className="px-1 py-1.5 text-right align-top">
                    <span className="block text-callout leading-5">
                      <span className="text-green-strong">{p.points}</span>
                      <span className="text-ink-2">/</span>
                      <span className={weakClass(isManyErrors(p.errors))}>{p.errors}</span>
                    </span>
                    <span aria-hidden="true" data-testid={`trend-${p.playerId}`} className="mt-1 ml-auto flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      {total > 0 && (
                        <>
                          <span className="bg-green" style={{ width: `${(p.points / total) * 100}%` }} />
                          <span className="bg-red" style={{ width: `${(p.errors / total) * 100}%` }} />
                        </>
                      )}
                    </span>
                  </td>
                  <Cell top={s ? s.attempts : DASH} sub={s ? `${s.grades['#']}# ${s.grades['=']}=` : undefined} />
                  <Cell
                    className={weakClass(isWeakReception(p.receptionPos))}
                    top={r ? fmtPct(p.receptionPos) : DASH}
                    sub={r ? `×${r.attempts}` : undefined}
                  />
                  <Cell
                    className={weakClass(isWeakAttack(p.attackEff))}
                    top={a ? eff(p.attackEff) : DASH}
                    sub={a ? `${a.grades['#']}/${a.attempts}` : undefined}
                  />
                  <Cell className="pr-0" top={p.skills.B ? p.skills.B.grades['#'] : DASH} />
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} className="pb-2 pl-8 text-caption text-ink-2">
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
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-separator font-semibold text-ink">
              <th scope="row" className="py-1.5 pr-1 text-left align-top text-callout font-semibold">{sc.team}</th>
              <Cell
                top={
                  <>
                    <span className="text-green-strong">{totals.points}</span>
                    <span className="text-ink-2">/</span>
                    {totals.errors}
                  </>
                }
              />
              <Cell top={totals.serves || DASH} sub={totals.serves ? `${t.aces}# ${t.serveErrors}=` : undefined} />
              <Cell
                className={weakClass(isWeakReception(t.receptionPos))}
                top={totals.receptions ? fmtPct(t.receptionPos) : DASH}
                sub={totals.receptions ? `×${totals.receptions}` : undefined}
              />
              <Cell
                className={weakClass(isWeakAttack(t.attackEff))}
                top={totals.attacks ? eff(t.attackEff) : DASH}
                sub={totals.attacks ? `${totals.kills}/${totals.attacks}` : undefined}
              />
              <Cell className="pr-0" top={totals.blocks} />
            </tr>
          </tfoot>
        )}
      </table>

      <dl className="mt-3 grid grid-cols-4 gap-1.5">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 rounded-md bg-surface-2 px-2 py-1.5">
            <dt className="text-caption leading-4 text-ink-2">{k.label}</dt>
            <dd className="text-callout font-semibold tabular-nums text-ink">{k.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
