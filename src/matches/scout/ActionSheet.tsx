import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import type { Grade, RosterEntry, Skill } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';
import { validGrades } from '../skillGrades';
import { tapFlash } from '../../motion/tapFlash';
import { SCOUT_GRADE_CLASS } from './gradeStyles';
import { Kbd } from './Kbd';
import { RoleChip } from './RoleChip';

interface ActionSheetProps {
  player: RosterEntry;
  isLibero: boolean;
  skills: Skill[];
  onGrade: (skill: Skill, grade: Grade) => void;
  onSub: () => void;
  onClose: () => void;
  /** Controlled active fundamental (keyboard shortcuts switch it); uncontrolled when omitted. */
  skill?: Skill;
  onSkillChange?: (skill: Skill) => void;
}

export function ActionSheet({ player, isLibero, skills, onGrade, onSub, onClose, skill: controlledSkill, onSkillChange }: ActionSheetProps) {
  const t = useT();
  const [ownSkill, setOwnSkill] = useState<Skill>(skills[0]);
  const skill = controlledSkill ?? ownSkill;
  const setSkill = (s: Skill) => {
    setOwnSkill(s);
    onSkillChange?.(s);
  };

  return (
    <section
      aria-label={t.scout.actionSheet.actionsFor(player.number, player.name)}
      className="rounded-lg bg-surface p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-ink">
          <span className="min-w-0 truncate text-headline">{player.name}</span>
          <span className="shrink-0 text-callout tabular-nums text-ink-2">#{player.number}</span>
          <RoleChip role={isLibero ? 'L' : player.positionCategory} libero={isLibero} />
        </p>
        {!isLibero && (
          <button type="button" onClick={onSub} className="flex min-h-11 items-center gap-1 rounded-md px-2 text-callout text-ink hover:bg-surface-2">
            <ArrowLeftRight size={16} aria-hidden="true" /> {t.scout.actionSheet.substitute}
          </button>
        )}
        <button type="button" aria-label={t.scout.actionSheet.close} onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {skills.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === skill}
            onPointerDown={(e) => tapFlash(e.currentTarget)}
            onClick={() => setSkill(s)}
            className={`inline-flex min-h-14 shrink-0 items-center gap-1.5 rounded-full px-4 text-callout md:min-h-11 ${
              s === skill ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink'
            }`}
          >
            {t.labels.skill[s]}
            <Kbd>{s}</Kbd>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {validGrades(skill).map((g) => (
          <button
            key={g}
            type="button"
            aria-label={`${g} ${t.labels.grade[skill][g]}`}
            onPointerDown={(e) => tapFlash(e.currentTarget)}
            onClick={() => onGrade(skill, g)}
            className={`relative flex min-h-14 flex-col items-center justify-center rounded-md ${SCOUT_GRADE_CLASS[g]}`}
          >
            <Kbd className="absolute right-1 top-1">{g}</Kbd>
            <span className="text-title-2" aria-hidden="true">{g}</span>
            <span className="text-caption" aria-hidden="true">{t.labels.grade[skill][g]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
