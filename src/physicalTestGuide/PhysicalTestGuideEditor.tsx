import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { GroupedList, ListRow } from '../components/GroupedList';
import { SkeletonBlock } from '../components/Skeleton';
import { useGuideEditor } from '../admin/useGuideEditor';
import { getPhysicalTestGuide, updatePhysicalTestGuide } from './physicalTestGuideApi';
import { PhysicalTestSheet } from './PhysicalTestSheet';
import { useT } from '../i18n/I18nProvider';
import type { PhysicalTestGuideEntry } from '../types/physicalTestGuide';

export function PhysicalTestGuideEditor({ active = true }: { active?: boolean }) {
  const t = useT();
  const s = t.physicalTestGuide;
  const g = t.admin.guidesPage;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const guide = useGuideEditor<PhysicalTestGuideEntry>({
    load: async () => {
      const r = await getPhysicalTestGuide();
      return { items: r.tests, stored: r.updatedBy !== '' || r.updatedAt !== null };
    },
    save: updatePhysicalTestGuide,
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
        {Array.from({ length: 8 }, (_, i) => (
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
        {guide.items.map((test) => (
          <ListRow
            key={test.key}
            title={t.labels.physicalTest[test.key] ?? test.label}
            subtitle={test.protocol}
            onClick={() => setOpenKey(test.key)}
            trailing={
              <span className="flex items-center gap-2">
                {guide.isEdited(test.key) && (
                  <>
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ink" />
                    <span className="sr-only">{g.unsaved}</span>
                  </>
                )}
                <ChevronRight size={18} aria-hidden="true" className="text-ink-3" />
              </span>
            }
          />
        ))}
      </GroupedList>
      {guide.saveError && (
        <p role="alert" className="mt-3 text-footnote text-red-strong">
          {guide.saveError}
        </p>
      )}
      {open && <PhysicalTestSheet test={open} onApply={guide.replace} onClose={() => setOpenKey(null)} />}
    </div>
  );
}
