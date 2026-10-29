import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../../layout/usePageMeta';
import { PageHeader } from '../../layout/PageHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useAuth } from '../../auth/AuthContext';
import { ProfileTab } from './ProfileTab';
import { PeopleTab } from './PeopleTab';
import { ContractTab } from './ContractTab';
import { ExportTab } from './ExportTab';
import { useT } from '../../i18n/I18nProvider';

type ClubTab = 'profile' | 'people' | 'export' | 'contract';

const TAB_IDS: ClubTab[] = ['profile', 'people', 'export', 'contract'];

/** Tabs whose body publishes the toolbar itself (a main action), so the header must not. */
const OWN_CHROME = new Set<ClubTab>(['people', 'export']);

/**
 * `restricted` (a paused club, or one whose contract has ended) keeps Profile read-only,
 * Export and Contract, and opens on Contract, where the export-window dates are.
 */
export function ClubAreaPage({ restricted = false }: { restricted?: boolean }) {
  const t = useT().clubs.area;
  usePageMeta({ title: t.pageTitle });
  const { club } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = TAB_IDS.filter((id) => !restricted || id !== 'people').map((id) => ({ id, label: t.tabs[id] }));
  const requested = params.get('tab');
  const active = tabs.find((x) => x.id === requested)?.id ?? (restricted ? 'contract' : 'profile');

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <PageHeader title={t.pageTitle} eyebrow={club?.name} publishChrome={!OWN_CHROME.has(active)} />
      <SegmentedControl semantics="tabs" label={t.sectionsLabel} options={tabs} value={active}
        onChange={(id) => setParams({ tab: id }, { replace: true })} className="mb-6 w-full sm:w-auto" />
      <div role="tabpanel" aria-label={tabs.find((x) => x.id === active)?.label}>
        {active === 'profile' && <ProfileTab restricted={restricted} />}
        {active === 'people' && <PeopleTab />}
        {active === 'export' && <ExportTab />}
        {active === 'contract' && <ContractTab />}
      </div>
    </div>
  );
}
