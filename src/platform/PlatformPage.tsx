import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../layout/usePageMeta';
import { PageHeader } from '../layout/PageHeader';
import { SegmentedControl } from '../components/SegmentedControl';
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
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <PageHeader title={t.pageTitle} />
      <SegmentedControl semantics="tabs" label={t.sectionsLabel} options={TABS} value={active}
        onChange={(id) => setParams({ tab: id }, { replace: true })} className="mb-6 w-full sm:w-auto" />
      <div role="tabpanel" aria-label={TABS.find((x) => x.id === active)?.label}>
        {active === 'clubs' && <ClubsTable />}
        {active === 'leads' && <AccessRequestsPanel />}
      </div>
    </div>
  );
}
