import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../layout/usePageMeta';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkillGuideEditor } from '../skillGuide/SkillGuideEditor';
import { PhysicalTestGuideEditor } from '../physicalTestGuide/PhysicalTestGuideEditor';
import { PageHeader } from '../layout/PageHeader';
import { useT } from '../i18n/I18nProvider';

type GuideTab = 'skills' | 'physical';

export function GuidesPage() {
  const t = useT().admin.guidesPage;
  usePageMeta({ title: t.title });
  const [params, setParams] = useSearchParams();
  const tab: GuideTab = params.get('tab') === 'physical' ? 'physical' : 'skills';

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      {/* The active editor publishes the toolbar (title and Save), not the header. */}
      <PageHeader title={t.title} publishChrome={false} />
      <SegmentedControl
        semantics="tabs"
        label={t.title}
        options={[
          { id: 'skills', label: t.skillGuide },
          { id: 'physical', label: t.physicalTestGuide },
        ]}
        value={tab}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
        className="mb-6 max-w-md"
      />
      {/* Both stay mounted so an unsaved edit survives a tab switch. */}
      <div role="tabpanel" hidden={tab !== 'skills'}>
        <SkillGuideEditor active={tab === 'skills'} />
      </div>
      <div role="tabpanel" hidden={tab !== 'physical'}>
        <PhysicalTestGuideEditor />
      </div>
    </div>
  );
}
