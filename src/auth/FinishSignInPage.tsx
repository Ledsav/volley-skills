import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../firebase/config';
import { AuthShell } from './AuthShell';
import { takeEmailForSignIn } from './emailLinkStorage';

export function FinishSignInPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function completeSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setError('This sign-in link is invalid or has expired.');
        return;
      }
      const email = takeEmailForSignIn();
      if (!email) {
        setError(
          'Could not find the email this link was sent to. Please request a new link from the same browser.'
        );
        return;
      }
      try {
        await signInWithEmailLink(auth, email, window.location.href);
        navigate('/teams', { replace: true });
      } catch {
        setError('This sign-in link could not be used. Please request a new one.');
      }
    }
    void completeSignIn();
  }, [navigate]);

  return (
    <AuthShell title="Volley Skills">
      {error ? (
        <p role="alert" className="text-red">
          {error}
        </p>
      ) : (
        <p className="text-slate">Signing you in...</p>
      )}
    </AuthShell>
  );
}
