import { useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../../layout/usePageMeta';
import { PageHeader } from '../../layout/PageHeader';
import { SectionTabs } from '../../components/SectionTabs';
import { useAuth } from '../../auth/AuthContext';
import { ProfileTab } from './ProfileTab';
import { PeopleTab } from './PeopleTab';
import { ContractTab } from './ContractTab';

type ClubTab = 'profile' | 'people' | 'contract';

const ALL_TABS: { id: ClubTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'people', label: 'People & access' },
  { id: 'contract', label: 'Contract' },
];

/** `restricted` (a club whose contract has ended) keeps Profile read-only and Contract only. */
export function ClubAreaPage({ restricted = false }: { restricted?: boolean }) {
  usePageMeta({ title: 'Club' });
  const { club } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = restricted ? ALL_TABS.filter((t) => t.id !== 'people') : ALL_TABS;
  const requested = params.get('tab');
  const active = tabs.find((t) => t.id === requested)?.id ?? 'profile';

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <PageHeader title="Club" eyebrow={club?.name} />
      <SectionTabs label="Club sections" tabs={tabs} active={active} className="mb-6"
        onChange={(id) => setParams({ tab: id }, { replace: true })} />
      {active === 'profile' && <ProfileTab restricted={restricted} />}
      {active === 'people' && <PeopleTab />}
      {active === 'contract' && <ContractTab />}
    </div>
  );
}
