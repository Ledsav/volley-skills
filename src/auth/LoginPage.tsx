import { usePageMeta } from '../layout/usePageMeta';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { GoogleAuthProvider, sendSignInLinkToEmail, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { LegalLinks } from '../legal/LegalLinks';
import { AuthShell } from './AuthShell';
import { takeReturnTo } from './returnTo';
import { useLocale, useT } from '../i18n/I18nProvider';
import { saveEmailForSignIn } from './emailLinkStorage';

const googleProvider = new GoogleAuthProvider();

export function LoginPage() {
  const t = useT().auth.loginPage;
  usePageMeta({ title: t.pageTitle, description: t.pageDescription, robots: 'index', canonicalPath: '/login' });
  const navigate = useNavigate();
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      auth.languageCode = locale;
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/finish-sign-in`,
        handleCodeInApp: true,
      });
      saveEmailForSignIn(email);
      setSent(true);
    } catch {
      setError(t.sendLinkError);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate(takeReturnTo(), { replace: true });
    } catch {
      setError(t.googleError);
    }
  }

  if (sent) {
    return (
      <AuthShell title={t.checkEmail}>
        <p className="text-center text-slate">
          {t.sentTo}<span className="font-medium text-ink">{email}</span>.
        </p>
        <LegalLinks />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t.welcomeBack} navAction={{ to: '/request-access', label: t.requestAccess }}>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
          {t.email}
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          required
          className="mb-4 w-full"
        />
        <Button type="submit" variant="primary" className="w-full gap-2">
          {t.sendLink}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-slate">
        <div className="h-px flex-1 bg-border" />
        {t.or}
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" className="w-full gap-2" onClick={handleGoogleSignIn}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
        {t.continueWithGoogle}
      </Button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/request-access" className="text-blue hover:underline">
          {t.noAccessYet}
        </Link>
      </p>

      <p className="mt-2 text-center text-sm">
        <Link to="/signup" className="text-blue hover:underline">
          {t.createClub}
        </Link>
      </p>

      <LegalLinks />
    </AuthShell>
  );
}
