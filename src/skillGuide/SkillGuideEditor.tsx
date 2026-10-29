import { useState } from 'react';
import { GroupedList, ListRow } from '../components/GroupedList';
import { SkeletonBlock } from '../components/Skeleton';
import { useGuideEditor } from '../admin/useGuideEditor';
import { getSkillGuide, updateSkillGuide } from './skillGuideApi';
import { SkillGuideSheet } from './SkillGuideSheet';
import { useT } from '../i18n/I18nProvider';
import type { SkillGuideEntry } from '../types/skillGuide';

export function SkillGuideEditor({ active = true }: { active?: boolean }) {
  const t = useT();
  const s = t.skillGuide;
  const g = t.admin.guidesPage;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const guide = useGuideEditor<SkillGuideEntry>({
    load: async () => {
      const r = await getSkillGuide();
      return { items: r.skills, stored: r.updatedBy !== '' || r.updatedAt !== null };
    },
    save: updateSkillGuide,
    reloadOn: s,
    messages: { loadError: s.loadError, saveError: s.saveError, saved: s.saved },
    active,
  });

  if (guide.loadError) {
    return (
      <p role="alert" className="p-6 text-red-strong">
        {guide.loadError}
      </p>
    );
  }

  if (!guide.loaded) {
    return (
      <div role="status" className="overflow-hidden rounded-lg bg-surface shadow-card">
        <span className="sr-only">{g.loading}</span>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex min-h-[52px] items-center px-4">
            <SkeletonBlock className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const open = guide.items.find((x) => x.key === openKey) ?? null;

  return (
    <div>
      <GroupedList>
        {guide.items.map((skill) => (
          <ListRow
            key={skill.key}
            title={t.labels.playerSkill[skill.key] ?? skill.label}
            subtitle={skill.howToEvaluate}
            onClick={() => setOpenKey(skill.key)}
            trailing={
              guide.isEdited(skill.key) ? (
                <>
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ink" />
                  <span className="sr-only">{g.unsaved}</span>
                </>
              ) : undefined
            }
          />
        ))}
      </GroupedList>
      {guide.saveError && (
        <p role="alert" className="mt-3 text-footnote text-red-strong">
          {guide.saveError}
        </p>
      )}
      {open && <SkillGuideSheet skill={open} onApply={guide.replace} onClose={() => setOpenKey(null)} />}
    </div>
  );
}
