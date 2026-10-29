import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { usePageMeta } from '../layout/usePageMeta';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { AiProviderSettings } from './AiProviderSettings';
import { LanguageSettings } from './LanguageSettings';
import { GroupedList, ListRow } from '../components/GroupedList';
import { SegmentedControl } from '../components/SegmentedControl';
import { useThemePreference } from '../theme/useTheme';
import { providerName, readAiSettings } from '../ai/aiSettings';
import { useT } from '../i18n/I18nProvider';
import { PageHeader } from '../layout/PageHeader';
import { focusPageHeading } from '../layout/focusPageHeading';
import { PageContainer } from '../layout/PageContainer';

/** Personal settings only. Pages live in the sidebar (phones: More); sign-out in the account menu. */
export function SettingsPage() {
  const t = useT().settings;
  usePageMeta({ title: t.title });
  const { aiEnabled } = useClubFeatures();
  const [pref, setPref] = useThemePreference();
  const [params] = useSearchParams();
  const view = params.get('view') === 'ai' && aiEnabled ? 'ai' : 'root';

  // /settings and /settings?view=ai share a pathname, so the shell does not move focus: do it here.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    focusPageHeading(document.getElementById('main'));
  }, [view]);

  return (
    <PageContainer width="form" className="flex flex-col gap-8">
      {view === 'ai' ? (
        <div>
          <PageHeader
            title={t.ai.title}
            description={t.ai.description}
            eyebrow={
              <Link to="/settings" className="inline-flex min-h-11 items-center gap-1 text-ink-2 hover:text-ink">
                <ChevronLeft size={16} aria-hidden="true" />
                {t.title}
              </Link>
            }
          />
          <AiProviderSettings />
        </div>
      ) : (
        <>
          <PageHeader title={t.title} className="" />
          <GroupedList header={t.appearanceTitle}>
            <li className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
              <span className="text-headline text-ink">{t.theme}</span>
              <SegmentedControl
                label={t.theme}
                semantics="radio"
                value={pref}
                onChange={setPref}
                className="w-full sm:ml-auto sm:w-fit"
                options={[
                  { id: 'system', label: t.themeSystem },
                  { id: 'light', label: t.themeLight },
                  { id: 'dark', label: t.themeDark },
                ]}
              />
            </li>
          </GroupedList>
          <LanguageSettings />
          {aiEnabled && (
            <GroupedList header={t.ai.title} footer={t.ai.description}>
              <ListRow to="/settings?view=ai" title={t.ai.provider} trailing={providerName(readAiSettings().provider)} />
            </GroupedList>
          )}
        </>
      )}
    </PageContainer>
  );
}
