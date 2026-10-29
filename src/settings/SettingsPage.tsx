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

/** Personal settings only. Pages live in the sidebar (phones: More); sign-out in the account menu. */
export function SettingsPage() {
  const t = useT().settings;
  usePageMeta({ title: t.title });
  const { aiEnabled } = useClubFeatures();
  const [pref, setPref] = useThemePreference();
  const [params] = useSearchParams();
  const view = params.get('view') === 'ai' && aiEnabled ? 'ai' : 'root';

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 p-4 sm:p-6 lg:p-8">
      {view === 'ai' ? (
        <div>
          <PageHeader
            title={t.ai.title}
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
            <ListRow
              title={t.theme}
              trailing={
                <SegmentedControl
                  label={t.theme}
                  semantics="radio"
                  value={pref}
                  onChange={setPref}
                  options={[
                    { id: 'system', label: t.themeSystem },
                    { id: 'light', label: t.themeLight },
                    { id: 'dark', label: t.themeDark },
                  ]}
                />
              }
            />
          </GroupedList>
          <LanguageSettings />
          {aiEnabled && (
            <GroupedList header={t.ai.title} footer={t.ai.description}>
              <ListRow to="/settings?view=ai" title={t.ai.provider} trailing={providerName(readAiSettings().provider)} />
            </GroupedList>
          )}
        </>
      )}
    </div>
  );
}
