import { useState } from 'react';
import { Tab } from '../components/Tab';
import { SkillGuideEditor } from '../skillGuide/SkillGuideEditor';
import { PhysicalTestGuideEditor } from '../physicalTestGuide/PhysicalTestGuideEditor';

type GuideTab = 'skills' | 'physicalTests';

export function GuidesPage() {
  const [tab, setTab] = useState<GuideTab>('skills');

  return (
    <div className="w-full bg-bg p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Guides</h1>
      <nav className="mb-6 flex gap-6 border-b border-border">
        <Tab active={tab === 'skills'} onClick={() => setTab('skills')}>
          Skill Guide
        </Tab>
        <Tab active={tab === 'physicalTests'} onClick={() => setTab('physicalTests')}>
          Physical Test Guide
        </Tab>
      </nav>
      {tab === 'skills' && <SkillGuideEditor />}
      {tab === 'physicalTests' && <PhysicalTestGuideEditor />}
    </div>
  );
}
