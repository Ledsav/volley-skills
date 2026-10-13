import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import type { Grade, RosterEntry, Skill } from '../../types/match';
import { GRADE_LABELS, SKILL_LABELS, validGrades } from '../skillGrades';
import { GRADE_CLASS } from './gradeStyles';

interface ActionSheetProps {
  player: RosterEntry;
  isLibero: boolean;
  skills: Skill[];
  onGrade: (skill: Skill, grade: Grade) => void;
  onSub: () => void;
  onClose: () => void;
}

export function ActionSheet({ player, isLibero, skills, onGrade, onSub, onClose }: ActionSheetProps) {
  const [skill, setSkill] = useState<Skill>(skills[0]);

  return (
    <section
      aria-label={`Actions for #${player.number} ${player.name}`}
      className="rounded-lg border border-border bg-surface p-3 shadow-pop"
    >
      <div className="mb-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-semibold text-ink">
          #{player.number} {player.name}
          <span className="ml-2 text-xs font-normal text-slate">{isLibero ? 'Libero' : player.positionCategory}</span>
        </p>
        {!isLibero && (
          <button type="button" onClick={onSub} className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-blue hover:bg-blue/10">
            <ArrowLeftRight size={16} aria-hidden="true" /> Substitute
          </button>
        )}
        <button type="button" aria-label="Close actions" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === skill}
            onClick={() => setSkill(s)}
            className={`min-h-11 rounded-full border px-3 text-sm ${
              s === skill ? 'border-blue bg-blue text-white' : 'border-border bg-surface text-ink'
            }`}
          >
            {SKILL_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {validGrades(skill).map((g) => (
          <button
            key={g}
            type="button"
            aria-label={`${g} ${GRADE_LABELS[skill][g]}`}
            onClick={() => onGrade(skill, g)}
            className={`flex min-h-14 flex-col items-center justify-center rounded-md text-sm font-semibold ${GRADE_CLASS[g]}`}
          >
            <span className="text-lg leading-none" aria-hidden="true">{g}</span>
            <span className="text-xs" aria-hidden="true">{GRADE_LABELS[skill][g]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
