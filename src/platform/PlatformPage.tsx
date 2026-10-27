import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../layout/usePageMeta';
import { PageHeader } from '../layout/PageHeader';
import { SectionTabs } from '../components/SectionTabs';
import { AccessRequestsPanel } from '../interest/AccessRequestsPanel';
import { ClubsTable } from './ClubsTable';
import { useT } from '../i18n/I18nProvider';

type PlatformTab = 'clubs' | 'leads';

const TAB_IDS: PlatformTab[] = ['clubs', 'leads'];

export function PlatformPage() {
  const t = useT().platform;
  usePageMeta({ title: t.pageTitle });
  const TABS = TAB_IDS.map((id) => ({ id, label: t.tabs[id] }));
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'clubs';

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <PageHeader title={t.pageTitle} />
      <SectionTabs label={t.sectionsLabel} tabs={TABS} active={active} className="mb-6"
        onChange={(id) => setParams({ tab: id }, { replace: true })} />
      {active === 'clubs' && <ClubsTable />}
      {active === 'leads' && <AccessRequestsPanel />}
    </div>
  );
}
