import { usePageMeta } from '../layout/usePageMeta';
import { useState } from 'react';
import { Tab } from '../components/Tab';
import { SkillGuideEditor } from '../skillGuide/SkillGuideEditor';
import { PhysicalTestGuideEditor } from '../physicalTestGuide/PhysicalTestGuideEditor';
import { PageHeader } from '../layout/PageHeader';

type GuideTab = 'skills' | 'physicalTests';

export function GuidesPage() {
  usePageMeta({ title: 'Guides' });
  const [tab, setTab] = useState<GuideTab>('skills');

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <PageHeader title="Guides" />
      <div role="tablist" aria-label="Guides" className="mb-6 flex gap-6 border-b border-border">
        <Tab active={tab === 'skills'} onClick={() => setTab('skills')}>
          Skill Guide
        </Tab>
        <Tab active={tab === 'physicalTests'} onClick={() => setTab('physicalTests')}>
          Physical Test Guide
        </Tab>
      </div>
      {tab === 'skills' && <SkillGuideEditor />}
      {tab === 'physicalTests' && <PhysicalTestGuideEditor />}
    </div>
  );
}
