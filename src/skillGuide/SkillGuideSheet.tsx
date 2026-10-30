import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Textarea } from '../components/Input';
import { bandBorderClass } from './bandColor';
import { useT } from '../i18n/I18nProvider';
import type { SkillGuideEntry } from '../types/skillGuide';
import { LIMITS } from '../types/limits';

/** One skill's guide text in a sheet. Done hands the edit back to the page draft; Save stays in the toolbar. */
export function SkillGuideSheet({
  skill,
  onApply,
  onClose,
}: {
  skill: SkillGuideEntry;
  onApply: (skill: SkillGuideEntry) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [local, setLocal] = useState(skill);
  const label = t.labels.playerSkill[skill.key] ?? skill.label;

  function updateRange(index: number, value: string) {
    setLocal((cur) => ({ ...cur, ranges: cur.ranges.map((r, i) => (i === index ? { ...r, description: value } : r)) }));
  }

  return (
    <Sheet
      title={label}
      size="lg"
      detent="large"
      guardUnsaved
      onClose={onClose}
      confirm={{
        label: t.components.done,
        onConfirm: () => {
          onApply(local);
          onClose();
        },
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {local.ranges.map((range, index) => (
          <div key={`${range.min}-${range.max}`} className={`rounded-md border-l-4 bg-surface-2 p-3 ${bandBorderClass(range.min)}`}>
            <label htmlFor={`${skill.key}-range-${index}`} className="mb-1 block text-callout text-ink-2 tabular-nums">
              {`${range.min}-${range.max}`}
            </label>
            <Textarea
              id={`${skill.key}-range-${index}`}
              maxLength={LIMITS.longText}
              value={range.description}
              onChange={(e) => updateRange(index, e.target.value)}
              className="w-full bg-surface"
            />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <label htmlFor={`${skill.key}-how-to-evaluate`} className="mb-1 block text-callout text-ink-2">
          {t.skillGuide.howToEvaluate}
        </label>
        <Textarea
          id={`${skill.key}-how-to-evaluate`}
          maxLength={LIMITS.longText}
          value={local.howToEvaluate}
          onChange={(e) => setLocal((cur) => ({ ...cur, howToEvaluate: e.target.value }))}
        />
      </div>
    </Sheet>
  );
}
