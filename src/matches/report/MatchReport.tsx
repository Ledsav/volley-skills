import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatTile } from '../../components/StatTile';
import { GRADES, SKILLS, type Match, type MatchReportData } from '../../types/match';
import { fmtEff, fmtPct, playerLabel, rosterMap } from '../format';
import { useT } from '../../i18n/I18nProvider';
import { GRADE_BAR_CLASS } from './gradeBarStyles';
import { isManyErrors, isWeakAttack, isWeakReception, weakClass } from '../statFlags';
import { signed, trueMinus } from './signed';

interface MatchReportProps {
  match: Match;
  report: MatchReportData;
  /** Controlled set filter; omit both to let the report own it. */
  set?: number | 'all';
  onSetChange?: (set: number | 'all') => void;
  /** A live match: the set in play and its score, shown after the finished sets. */
  inPlay?: { set: number; us: number; them: number } | null;
}

export function MatchReport({ match, report, set: setProp, onSetChange, inPlay }: MatchReportProps) {
  const tt = useT();
  const lb = tt.labels;
  const rp = tt.matches.report;
  const [localSet, setLocalSet] = useState<number | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
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
  // A live match is not won or lost yet: it is leading, trailing or level.
  const live = match.status === 'live';
  const result = live
    ? us > them ? rp.leading : us < them ? rp.trailing : rp.level
    : us > them ? rp.won : us < them ? rp.lost : null;
  const eff = (x: number | null) => trueMinus(fmtEff(x));

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
          {inPlay && (
            <li className="rounded-md bg-surface px-3 py-2 text-center shadow-card">
              <p className="flex items-center justify-center gap-1 text-caption text-ink-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green" />
                {rp.setInPlay(inPlay.set)}
              </p>
              <p className="text-headline tabular-nums text-ink">{inPlay.us}–{inPlay.them}</p>
            </li>
          )}
        </ol>
      </div>

      <SegmentedControl
        label={rp.set}
        options={[{ id: 'all', label: rp.all }, ...setNumbers.map((n) => ({ id: String(n), label: rp.setN(n) }))]}
        value={String(set)}
        onChange={(id) => setSet(id === 'all' ? 'all' : Number(id))}
        className="w-full sm:w-fit print:hidden"
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label={rp.sideOut} value={fmtPct(t.sideOut.total ? t.sideOut.won / t.sideOut.total : null)} />
        <StatTile label={rp.breakPoint} value={fmtPct(t.breakPoint.total ? t.breakPoint.won / t.breakPoint.total : null)} />
        <StatTile label={rp.receptionPos} value={fmtPct(t.receptionPos)} />
        <StatTile label={rp.attackEff} value={eff(t.attackEff)} />
        <StatTile label={rp.acesErrors} value={`${t.aces} / ${t.serveErrors}`} />
        <StatTile label={rp.oppErrors} value={String(t.oppErrorPoints)} />
      </section>

      <section>
        <h2 className="mb-2 text-title-3 text-ink">{rp.players}</h2>
        {/* Phones: a grouped list with the three key numbers; a tap opens the per-fundamental lines. */}
        <div className="rounded-lg bg-surface shadow-card sm:hidden print:hidden">
          <div aria-hidden="true" className="flex items-center gap-2 px-4 pb-1 pt-2.5 text-caption text-ink-2">
            <span className="min-w-0 flex-1">{rp.player}</span>
            <span className="w-12 text-right">{rp.ptsErr}</span>
            <span className="w-12 text-right">{rp.attEff}</span>
            <span className="w-11 text-right">{rp.recPos}</span>
            <span className="w-4" />
          </div>
          <ul aria-label={rp.players}>
            {players.map((p, i) => {
              const entry = roster.get(p.playerId);
              const open = openId === p.playerId;
              return (
                <li key={p.playerId} className={i > 0 ? 'ml-4 border-t border-separator' : 'ml-4'}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : p.playerId)}
                    className="flex min-h-[52px] w-full items-center gap-2 py-2 pr-4 text-left tabular-nums"
                  >
                    <span className="min-w-0 flex-1 truncate text-headline text-ink">
                      {playerLabel(entry)} {entry?.name}
                    </span>
                    <span className="w-12 text-right text-callout">
                      <span className="text-green-strong">{p.points}</span>
                      <span className="text-ink-2">/</span>
                      <span className={weakClass(isManyErrors(p.errors))}>{p.errors}</span>
                    </span>
                    <span className={`w-12 text-right text-callout ${weakClass(isWeakAttack(p.attackEff))}`}>{eff(p.attackEff)}</span>
                    <span className={`w-11 text-right text-callout ${weakClass(isWeakReception(p.receptionPos))}`}>{fmtPct(p.receptionPos)}</span>
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className={`w-4 shrink-0 text-ink-3 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {open && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pb-3 pr-4">
                      {SKILLS.filter((s) => p.skills[s]).map((s) => {
                        const line = p.skills[s]!;
                        return (
                          <div key={s} className="flex items-center justify-between gap-2">
                            <dt className="truncate text-footnote text-ink-2">{lb.skill[s]}</dt>
                            <dd className="flex items-center gap-1.5 text-footnote tabular-nums text-ink">
                              {line.attempts}
                              <span className="flex h-2 w-12 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                                {GRADES.map((g) =>
                                  line.grades[g] ? (
                                    <span key={g} className={GRADE_BAR_CLASS[g]} style={{ width: `${(line.grades[g] / line.attempts) * 100}%` }} />
                                  ) : null,
                                )}
                              </span>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="hidden overflow-x-auto rounded-lg bg-surface shadow-card sm:block print:block print:overflow-visible print:shadow-none">
          <table className="w-full text-callout tabular-nums">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-caption font-medium text-ink-2">{rp.player}</th>
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
                    <td className={`px-3 py-2 ${weakClass(isWeakAttack(p.attackEff))}`}>{eff(p.attackEff)}</td>
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
                <p className={`text-headline tabular-nums ${weakest ? 'text-red-strong' : 'text-ink'}`}>{signed(rot.won - rot.lost)}</p>
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
          {rp.sourceLead} <span>{sourceParts.join(' · ')}</span>
        </p>
      )}
    </div>
  );
}
