import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '../../components/Button';
import { FIELD_LABEL_CLASS } from '../../components/Input';
import { Select } from '../../components/Select';
import { Switch } from '../../components/Switch';
import { useT } from '../../i18n/I18nProvider';
import type { Person } from '../../teams/stats/rosterIndex';
import { MAX_CUSTOM_AWARDS } from '../../types/awards';
import type { AwardsPrepareProps } from '../AwardsPrepare';
import { CustomAwardSheet } from './CustomAwardSheet';
import { personLabel as label } from './personLabel';

type Props = Pick<AwardsPrepareProps, 'awards' | 'people' | 'onAction'>;

const ICON_BUTTON = 'h-11 w-11';

/** Step 1: who wins each award, in what order, and which are hidden. */
export function ChooseStep({ awards, people, onAction }: Props) {
  const t = useT();
  const ta = t.awards.prepare;
  const [adding, setAdding] = useState(false);
  const customCount = awards.filter((a) => a.kind === 'custom').length;
  const byId = new Map(people.map((p) => [p.playerId, p]));
  const who = (id: string): Person => byId.get(id) ?? { playerId: id, name: t.teams.stats.unknownPlayer, number: null, current: false };

  return (
    <>
      <ol className="space-y-3">
        {awards.map((a, i) => {
          const titleId = `award-${a.key}`;
          return (
            <li key={a.key}>
              <section aria-labelledby={titleId} className={`space-y-2 rounded-lg bg-surface p-4 shadow-card ${a.hidden ? 'opacity-60' : ''}`}>
                <h2 id={titleId} className="text-headline text-ink">{a.title}</h2>
                {a.kind === 'stats' ? (
                  <label className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <span className={`${FIELD_LABEL_CLASS} sm:mb-0`}>{ta.winner}</span>
                    <Select className="min-h-11 w-full min-w-0 max-w-full sm:w-auto" value={a.overridden ? a.winner?.playerId ?? '' : ''}
                      onChange={(e) => onAction({ type: 'pick', key: a.key, playerId: e.target.value || null })}>
                      <option value="">{a.suggested ? ta.statsChoice(label(who(a.suggested.playerId))) : ta.statsChoiceNone}</option>
                      {people.map((p) => <option key={p.playerId} value={p.playerId}>{label(p)}</option>)}
                    </Select>
                  </label>
                ) : (
                  <p className="text-callout text-ink">{a.winner ? label(a.winner) : '—'}{a.note && <span className="text-ink-2"> · {a.note}</span>}</p>
                )}
                {a.winner === null && <p className="text-footnote text-orange-strong">{ta.noWinner}</p>}
                {a.statLine && <p className="text-footnote tabular-nums text-ink-2">{a.statLine}</p>}
                {a.overridden && a.suggested && <p className="text-footnote text-ink-2">{ta.statsSuggest(label(who(a.suggested.playerId)))}</p>}
                {a.runnersUp.length > 0 && (
                  <p className="text-footnote text-ink-2">{ta.runnersUp(a.runnersUp.map((r) => label(who(r.playerId))).join(', '))}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {a.kind === 'stats' && (
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-callout text-ink-2">
                      <Switch checked={a.hidden} onChange={(hidden) => onAction({ type: 'hide', key: a.key, hidden })} aria-label={ta.hide} /> {ta.hide}
                    </label>
                  )}
                  <span className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" className={ICON_BUTTON} aria-label={ta.moveUp(a.title)} disabled={i === 0} onClick={() => onAction({ type: 'move', key: a.key, dir: -1 })}><ArrowUp size={16} aria-hidden="true" /></Button>
                    <Button variant="ghost" size="icon" className={ICON_BUTTON} aria-label={ta.moveDown(a.title)} disabled={i === awards.length - 1} onClick={() => onAction({ type: 'move', key: a.key, dir: 1 })}><ArrowDown size={16} aria-hidden="true" /></Button>
                    {a.kind === 'custom' && <Button variant="dangerGhost" size="sm" onClick={() => onAction({ type: 'removeCustom', key: a.key })}>{ta.remove}</Button>}
                  </span>
                </div>
              </section>
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        <Button variant="secondary" disabled={customCount >= MAX_CUSTOM_AWARDS} onClick={() => setAdding(true)}>{ta.customAward}</Button>
      </div>

      {adding && (
        <CustomAwardSheet
          people={people}
          onClose={() => setAdding(false)}
          onAdd={(title, playerId, note) => {
            onAction({ type: 'addCustom', title, playerId, note });
            setAdding(false);
          }}
        />
      )}
    </>
  );
}
