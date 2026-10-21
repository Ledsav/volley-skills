import { usePageMeta } from '../layout/usePageMeta';
import { Link } from 'react-router-dom';
import { BookOpen, Building2, ChevronRight, KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { usePendingSignups } from '../interest/usePendingSignups';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';
import { AiProviderSettings } from './AiProviderSettings';
import { SettingsSection } from './SettingsSection';
import { ThemeToggle } from '../theme/ThemeToggle';
import { PageHeader } from '../layout/PageHeader';

const ADMIN_LINK = 'flex min-h-11 items-center gap-3 px-3 py-2 text-sm font-medium text-ink hover:bg-bg';

export function SettingsPage() {
  usePageMeta({ title: 'Settings' });
  const { signOut, unsyncedDialog } = useSignOut();
  const { access, isPlatformAdmin } = useAuth();
  const { aiEnabled } = useClubFeatures();
  const canGuides = !!access?.sections.guides;
  const isClubAdmin = !!access?.isClubAdmin;
  const pendingSignups = usePendingSignups(!!isPlatformAdmin);

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-md flex-col gap-3 lg:max-w-3xl lg:gap-4">
        <PageHeader title="Settings" className="mb-3" />

        <SettingsSection title="Appearance" description="Switch between light and dark mode.">
          <ThemeToggle className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-bg sm:w-auto sm:justify-start lg:self-start" />
        </SettingsSection>

        {aiEnabled && <AiProviderSettings />}

        {/* The phone bottom bar has no room for admin pages; this is their way in there. */}
        {(canGuides || isClubAdmin || isPlatformAdmin) && (
          <SettingsSection title="Admin" description="Club-wide guides and who can sign in.">
            <nav aria-label="Admin" className="flex flex-col divide-y divide-border rounded-md border border-border">
              {canGuides && (
                <Link to="/admin/guides" className={ADMIN_LINK}>
                  <BookOpen size={18} strokeWidth={1.5} aria-hidden="true" className="text-slate" />
                  <span className="flex-1">Guides</span>
                  <ChevronRight size={16} aria-hidden="true" className="text-slate" />
                </Link>
              )}
              {isClubAdmin && (
                <Link to="/club" className={ADMIN_LINK}>
                  <KeyRound size={18} strokeWidth={1.5} aria-hidden="true" className="text-slate" />
                  <span className="flex-1">Club</span>
                  <ChevronRight size={16} aria-hidden="true" className="text-slate" />
                </Link>
              )}
              {isPlatformAdmin && (
                <Link to="/platform" className={ADMIN_LINK}>
                  <Building2 size={18} strokeWidth={1.5} aria-hidden="true" className="text-slate" />
                  <span className="flex-1">Platform</span>
                  {pendingSignups > 0 && (
                    <span className="rounded-full bg-orange-strong px-1.5 py-0.5 text-xs font-semibold text-white">
                      {pendingSignups}<span className="sr-only"> pending requests</span>
                    </span>
                  )}
                  <ChevronRight size={16} aria-hidden="true" className="text-slate" />
                </Link>
              )}
            </nav>
          </SettingsSection>
        )}

        <SettingsSection title="Account" description="Sign out of Volley Skills and clear its data from this device.">
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto lg:self-start"
            onClick={signOut}
          >
            Sign out
          </Button>
          <Link to="/privacy" className="inline-flex min-h-11 items-center self-start text-sm text-blue hover:underline">
            Privacy policy
          </Link>
        </SettingsSection>
      </div>
      {unsyncedDialog}
    </div>
  );
}
