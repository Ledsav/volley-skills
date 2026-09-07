import { useState } from 'react';
import { SkillGuideEditor } from '../skillGuide/SkillGuideEditor';
import { PhysicalTestGuideEditor } from '../physicalTestGuide/PhysicalTestGuideEditor';

type GuideTab = 'skills' | 'physicalTests';

const tabClass = (active: boolean) =>
  `border-b-2 px-1 py-3 text-sm font-medium ${
    active ? 'border-blue text-blue' : 'border-transparent text-slate hover:text-ink'
  }`;

export function GuidesPage() {
  const [tab, setTab] = useState<GuideTab>('skills');

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Guides</h1>
      <nav className="mb-6 flex gap-6 border-b border-border">
        <button onClick={() => setTab('skills')} className={tabClass(tab === 'skills')}>
          Skill Guide
        </button>
        <button onClick={() => setTab('physicalTests')} className={tabClass(tab === 'physicalTests')}>
          Physical Test Guide
        </button>
      </nav>
      {tab === 'skills' && <SkillGuideEditor />}
      {tab === 'physicalTests' && <PhysicalTestGuideEditor />}
    </div>
  );
}
