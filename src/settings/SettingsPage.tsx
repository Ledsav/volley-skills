import { Link } from 'react-router-dom';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';
import { AiProviderSettings } from './AiProviderSettings';
import { SettingsSection } from './SettingsSection';
import { ThemeToggle } from '../theme/ThemeToggle';

export function SettingsPage() {
  const { signOut, unsyncedDialog } = useSignOut();

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Settings</h1>

      <div className="mx-auto flex max-w-md flex-col gap-3 lg:max-w-3xl">
        <SettingsSection title="Appearance" description="Switch between light and dark mode.">
          <ThemeToggle className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-bg sm:w-auto sm:justify-start lg:self-start" />
        </SettingsSection>

        <AiProviderSettings />

        <SettingsSection title="Account" description="Sign out of Volley Skills and clear its data from this device.">
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto lg:self-start"
            onClick={signOut}
          >
            Sign out
          </Button>
        </SettingsSection>

        <Link to="/privacy" className="mt-1 text-sm text-blue hover:underline">
          Privacy policy
        </Link>
      </div>
      {unsyncedDialog}
    </div>
  );
}
