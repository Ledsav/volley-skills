import { usePageMeta } from '../layout/usePageMeta';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { AiProviderSettings } from './AiProviderSettings';
import { LanguageSettings } from './LanguageSettings';
import { SettingsSection } from './SettingsSection';
import { ThemeToggle } from '../theme/ThemeToggle';
import { PageHeader } from '../layout/PageHeader';

/** Personal settings only. Pages live in the sidebar (phones: More); sign-out in the account menu. */
export function SettingsPage() {
  usePageMeta({ title: 'Settings' });
  const { aiEnabled } = useClubFeatures();

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-md flex-col gap-3 lg:max-w-3xl lg:gap-4">
        <PageHeader title="Settings" className="mb-3" />

        <SettingsSection title="Appearance" description="Switch between light and dark mode.">
          <ThemeToggle className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-bg sm:w-auto sm:justify-start lg:self-start" />
        </SettingsSection>

        <LanguageSettings />

        {aiEnabled && <AiProviderSettings />}
      </div>
    </div>
  );
}
