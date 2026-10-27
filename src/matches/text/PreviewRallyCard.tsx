import { Trash2 } from 'lucide-react';
import { FIELD_CLASS } from '../../components/Input';
import { useT } from '../../i18n/I18nProvider';
import { SKILLS, type Grade, type RosterEntry, type Skill } from '../../types/match';
import { validGrades } from '../skillGrades';
import type { BatchIssue, ParsedRally } from './textScout';

interface Props {
  index: number;
  rally: ParsedRally;
  roster: RosterEntry[];
  issues: BatchIssue[];
  onChange: (rally: ParsedRally) => void;
  onDelete: () => void;
}

const SELECT = `${FIELD_CLASS} min-h-11 px-2 py-1 text-base sm:text-sm`;

export function PreviewRallyCard({ index, rally, roster, issues, onChange, onDelete }: Props) {
  const t = useT();
  const n = index + 1;
  const setAction = (i: number, patch: Partial<ParsedRally['actions'][number]>) =>
    onChange({ ...rally, actions: rally.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  return (
    <li className={`rounded-md border p-2 ${issues.some((x) => x.blocking) ? 'border-red' : 'border-border'} bg-surface`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Rally {n}</span>
        <button type="button" aria-label={`Delete rally ${n}`} onClick={onDelete} className="flex h-11 w-11 items-center justify-center rounded-md text-red hover:bg-red/10">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {(rally.subs.length > 0 || rally.timeouts.length > 0) && (
        <p className="mb-1 text-xs text-slate">
          {rally.subs.map((s) => `Sub #${s.inNumber} in for #${s.outNumber}`).concat(rally.timeouts.map((t) => `Timeout ${t.team}`)).join(' · ')}
        </p>
      )}
      <ul className="space-y-1">
        {rally.actions.map((a, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
            <select aria-label={`Rally ${n} action ${i + 1} player`} className={SELECT} value={a.number} onChange={(e) => setAction(i, { number: Number(e.target.value) })}>
              {!roster.some((r) => r.number === a.number) && <option value={a.number}>#{a.number} ?</option>}
              {roster.map((r) => (
                <option key={r.playerId} value={r.number}>#{r.number}</option>
              ))}
            </select>
            <select
              aria-label={`Rally ${n} action ${i + 1} skill`}
              className={SELECT}
              value={a.skill}
              onChange={(e) => {
                const skill = e.target.value as Skill;
                const grades = validGrades(skill);
                setAction(i, { skill, grade: a.grade === null ? null : grades.includes(a.grade) ? a.grade : grades[0] });
              }}
            >
              {SKILLS.map((s) => (
                <option key={s} value={s}>{t.labels.skill[s]}</option>
              ))}
            </select>
            <select
              aria-label={`Rally ${n} action ${i + 1} grade`}
              aria-invalid={a.grade === null ? 'true' : undefined}
              className={a.grade === null ? SELECT.replace('border-border', 'border-red') : SELECT}
              value={a.grade ?? ''}
              onChange={(e) => setAction(i, { grade: e.target.value ? (e.target.value as Grade) : null })}
            >
              {a.grade === null && <option value="">Pick a grade</option>}
              {a.grade !== null && !validGrades(a.skill).includes(a.grade) && <option value={a.grade}>{a.grade} ?</option>}
              {validGrades(a.skill).map((g) => (
                <option key={g} value={g}>{g} {t.labels.grade[a.skill][g]}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Delete rally ${n} action ${i + 1}`}
              onClick={() => onChange({ ...rally, actions: rally.actions.filter((_, j) => j !== i) })}
              className="flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-2 flex items-center gap-2 text-sm text-ink">
        Point
        <select
          aria-label={`Rally ${n} point`}
          className={SELECT}
          value={rally.point ? rally.point.winner : ''}
          onChange={(e) =>
            onChange({ ...rally, point: e.target.value ? { winner: e.target.value as 'us' | 'them', reason: rally.point?.reason ?? null } : null })
          }
        >
          <option value="">From the actions</option>
          <option value="us">Us</option>
          <option value="them">Them</option>
        </select>
        {rally.point?.reason && <span className="text-xs text-slate">{t.labels.pointReason[rally.point.reason]}</span>}
      </label>
      {issues.map((x, i) => (
        <p key={i} className={`mt-1 text-xs ${x.blocking ? 'text-red' : 'text-orange-strong'}`}>{x.message}</p>
      ))}
    </li>
  );
}
