import { signOut } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import { Button } from '../components/Button';
import { ThemeToggle } from '../theme/ThemeToggle';

export function SettingsPage() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(auth);
    navigate('/login', { replace: true });
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.01em] text-ink">Settings</h1>

      <div className="mx-auto flex max-w-md flex-col gap-3">
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-ink">Appearance</p>
            <p className="text-sm text-slate">Switch between light and dark mode.</p>
          </div>
          <ThemeToggle className="flex w-full shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-bg sm:w-auto sm:justify-start" />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-ink">Account</p>
            <p className="text-sm text-slate">Sign out of Volley Skills on this device.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </Button>
        </section>

        <Link to="/privacy" className="mt-1 text-sm text-blue hover:underline">
          Privacy policy
        </Link>
      </div>
    </div>
  );
}
