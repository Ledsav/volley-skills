import { usePageMeta } from '../layout/usePageMeta';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../firebase/config';
import { AlertTriangle, LogIn } from 'lucide-react';
import { StatusLayout } from '../components/StatusLayout';
import { AuthShell } from './AuthShell';
import { takeReturnTo } from './returnTo';
import { takeEmailForSignIn } from './emailLinkStorage';
import { isSignNonce } from '../legal/signDraft';
import { useT } from '../i18n/I18nProvider';

export function FinishSignInPage() {
  const t = useT().auth.finishSignIn;
  usePageMeta({ title: t.pageTitle });
  const navigate = useNavigate();
  const [error, setError] = useState<'invalidLink' | 'emailNotFound' | 'linkFailed' | null>(null);

  useEffect(() => {
    async function completeSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setError('invalidLink');
        return;
      }
      const email = takeEmailForSignIn();
      if (!email) {
        setError('emailNotFound');
        return;
      }
      try {
        await signInWithEmailLink(auth, email, window.location.href);
        const returnTo = takeReturnTo();
        // A signing link (sign-up or re-acceptance) carries its draft's nonce.
        const sign = new URL(window.location.href).searchParams.get('sign');
        navigate(isSignNonce(sign) ? `/sign/complete?sign=${sign}` : returnTo, { replace: true });
      } catch {
        setError('linkFailed');
      }
    }
    void completeSignIn();
  }, [navigate]);

  return (
    <AuthShell>
      {error ? (
        <StatusLayout icon={AlertTriangle} tone="error" title="Volley Skills">
          <p role="alert">{t[error]}</p>
        </StatusLayout>
      ) : (
        <StatusLayout icon={LogIn} title="Volley Skills">
          {t.signingIn}
        </StatusLayout>
      )}
    </AuthShell>
  );
}
