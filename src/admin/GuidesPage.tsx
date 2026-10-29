import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../layout/usePageMeta';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkillGuideEditor } from '../skillGuide/SkillGuideEditor';
import { PhysicalTestGuideEditor } from '../physicalTestGuide/PhysicalTestGuideEditor';
import { PageHeader } from '../layout/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { PageContainer } from '../layout/PageContainer';

type GuideTab = 'skills' | 'physical';

export function GuidesPage() {
  const t = useT().admin.guidesPage;
  usePageMeta({ title: t.title });
  const [params, setParams] = useSearchParams();
  const tab: GuideTab = params.get('tab') === 'physical' ? 'physical' : 'skills';

  return (
    <PageContainer>
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
      <div role="tabpanel" aria-label={t.skillGuide} hidden={tab !== 'skills'}>
        <SkillGuideEditor active={tab === 'skills'} />
      </div>
      <div role="tabpanel" aria-label={t.physicalTestGuide} hidden={tab !== 'physical'}>
        <PhysicalTestGuideEditor active={tab === 'physical'} />
      </div>
    </PageContainer>
  );
}
