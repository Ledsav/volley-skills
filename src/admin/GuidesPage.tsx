import { usePageMeta } from '../layout/usePageMeta';
import { useState } from 'react';
import { Tab } from '../components/Tab';
import { SkillGuideEditor } from '../skillGuide/SkillGuideEditor';
import { PhysicalTestGuideEditor } from '../physicalTestGuide/PhysicalTestGuideEditor';
import { PageHeader } from '../layout/PageHeader';
import { useT } from '../i18n/I18nProvider';

type GuideTab = 'skills' | 'physicalTests';

export function GuidesPage() {
  const t = useT().admin.guidesPage;
  usePageMeta({ title: t.title });
  const [tab, setTab] = useState<GuideTab>('skills');

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <PageHeader title={t.title} />
      <div role="tablist" aria-label={t.title} className="mb-6 flex gap-6 border-b border-border">
        <Tab active={tab === 'skills'} onClick={() => setTab('skills')}>
          {t.skillGuide}
        </Tab>
        <Tab active={tab === 'physicalTests'} onClick={() => setTab('physicalTests')}>
          {t.physicalTestGuide}
        </Tab>
      </div>
      {tab === 'skills' && <SkillGuideEditor />}
      {tab === 'physicalTests' && <PhysicalTestGuideEditor />}
    </div>
  );
}
