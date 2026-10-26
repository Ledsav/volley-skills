import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../layout/usePageMeta';
import { PageHeader } from '../layout/PageHeader';
import { SectionTabs } from '../components/SectionTabs';
import { AccessRequestsPanel } from '../interest/AccessRequestsPanel';
import { ClubsTable } from './ClubsTable';

type PlatformTab = 'clubs' | 'leads';

const TABS: { id: PlatformTab; label: string }[] = [
  { id: 'clubs', label: 'Clubs' },
  { id: 'leads', label: 'Leads' },
];

export function PlatformPage() {
  usePageMeta({ title: 'Platform' });
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'clubs';

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <PageHeader title="Platform" />
      <SectionTabs label="Platform sections" tabs={TABS} active={active} className="mb-6"
        onChange={(id) => setParams({ tab: id }, { replace: true })} />
      {active === 'clubs' && <ClubsTable />}
      {active === 'leads' && <AccessRequestsPanel />}
    </div>
  );
}
