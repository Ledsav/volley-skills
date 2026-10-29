import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import type { Grade, RosterEntry, Skill } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';
import { validGrades } from '../skillGrades';
import { tapFlash } from '../../motion/tapFlash';
import { SCOUT_GRADE_CLASS } from './gradeStyles';
import { Kbd } from './Kbd';
import { RoleChip } from './RoleChip';
import { ScrollStrip } from '../../components/ScrollStrip';

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
      className="rounded-lg bg-surface p-2 md:p-3"
    >
      {/* One row: who, the fundamentals (scrolls sideways), Substitute, Close. */}
      <div className="mb-1.5 flex items-center gap-1.5 md:mb-2">
        <p className="hidden shrink-0 items-center gap-1.5 text-ink md:flex md:max-w-[10rem]">
          <span className="hidden min-w-0 truncate text-headline lg:inline">{player.name}</span>
          <span className="shrink-0 text-callout tabular-nums text-ink-2">#{player.number}</span>
          <RoleChip role={isLibero ? 'L' : player.positionCategory} libero={isLibero} />
        </p>
        {/* The fundamentals scroll in their own lane, left of Substitute and Close; the strip fades the edge that hides more. */}
        <ScrollStrip className="flex min-w-0 flex-1 gap-1.5">
          {skills.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === skill}
              onPointerDown={(e) => tapFlash(e.currentTarget)}
              onClick={() => setSkill(s)}
              className={`inline-flex min-h-14 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-callout md:min-h-11 md:px-4 ${
                s === skill ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink'
              }`}
            >
              {t.labels.skill[s]}
              <Kbd>{s}</Kbd>
            </button>
          ))}
        </ScrollStrip>
        {!isLibero && (
          <button
            type="button"
            onClick={onSub}
            aria-label={t.scout.actionSheet.substitute}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-callout text-ink hover:bg-surface-2"
          >
            <ArrowLeftRight size={16} aria-hidden="true" />
            <span className="hidden lg:inline">{t.scout.actionSheet.substitute}</span>
          </button>
        )}
        <button type="button" aria-label={t.scout.actionSheet.close} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {/* One row of six on every screen; each stays 56 px tall. */}
      <div className="grid grid-cols-6 gap-1 md:gap-2">
        {validGrades(skill).map((g) => (
          <button
            key={g}
            type="button"
            aria-label={`${g} ${t.labels.grade[skill][g]}`}
            onPointerDown={(e) => tapFlash(e.currentTarget)}
            onClick={() => onGrade(skill, g)}
            className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-md px-1 max-[379px]:px-0.5 ${SCOUT_GRADE_CLASS[g]}`}
          >
            <Kbd className="absolute right-1 top-1">{g}</Kbd>
            <span className="text-title-3 md:text-title-2" aria-hidden="true">{g}</span>
            {/* Up to two short lines ("Free / ball") instead of an ellipsis; still inside the 56 px button. On 360 px phones the
                label steps down a size so a long word ("Pressure") fits instead of breaking mid-word. */}
            <span className="line-clamp-2 max-w-full hyphens-auto break-words text-center text-[11px] font-medium leading-[13px] max-[379px]:text-[10px] md:text-caption" aria-hidden="true">
              {t.labels.grade[skill][g]}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
