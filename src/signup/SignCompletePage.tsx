import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthShell } from '../auth/AuthShell';
import { sendSigningLink } from '../auth/reauth';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';
import { usePageMeta } from '../layout/usePageMeta';
import { readSignDraft } from '../legal/signDraft';
import { commitSignDraft } from './signingApi';

type View = 'working' | 'linkExpired' | 'noDraft' | 'wrongLink' | 'wrongAccount' | 'error' | 'linkSent';

/** /sign/complete: the landing page of the signing link; commits the saved draft once. */
export function SignCompletePage() {
  usePageMeta({ title: 'Completing sign-up' });
  const { signOut, unsyncedDialog } = useSignOut();
  const nonce = useSearchParams()[0].get('sign');
  const [view, setView] = useState<View>('working');
  const [busy, setBusy] = useState(false);
  const [resendError, setResendError] = useState(false);
  // StrictMode runs effects twice in development; the commit must run once.
  const started = useRef(false);

  const run = useCallback(async () => {
    setView('working');
    try {
      const outcome = await commitSignDraft(nonce);
      if (outcome === 'done' || outcome === 'alreadyDone') {
        // Same-uid re-sign-in fires no auth event: a reload refreshes memberships and the club.
        window.location.assign('/');
        return;
      }
      setView(outcome);
    } catch {
      setView('error');
    }
  }, [nonce]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  async function sendNewLink() {
    const draft = readSignDraft(Date.now());
    if (!draft) {
      setView('noDraft');
      return;
    }
    setBusy(true);
    setResendError(false);
    try {
      await sendSigningLink(draft.email, draft.nonce);
      setView('linkSent');
    } catch {
      setResendError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Completing sign-up">
      {view === 'working' && <p role="status" className="text-center text-slate">Completing your sign-up...</p>}

      {view === 'linkExpired' && (
        <>
          <p className="text-center text-slate">The link is older than 15 minutes. Send a new link to confirm again.</p>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" disabled={busy} onClick={sendNewLink}>Send a new link</Button>
          </div>
        </>
      )}

      {view === 'linkSent' && (
        <p role="status" className="text-center text-slate">We&apos;ve sent a new link. Open it in this browser to sign.</p>
      )}

      {view === 'noDraft' && (
        <p className="text-center text-slate">
          There is no signing in progress in this browser. If you started in another browser, open the link there.
        </p>
      )}

      {view === 'wrongLink' && (
        <p className="text-center text-slate">
          This link doesn&apos;t match the signing in progress in this browser. Open the latest link we sent you.
        </p>
      )}

      {view === 'wrongAccount' && (
        <>
          <p className="text-center text-slate">
            Signed in as another account than the one that started this sign-up. Sign out and use the link again.
          </p>
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={signOut}>Sign out</Button>
          </div>
        </>
      )}

      {view === 'error' && (
        <>
          <p role="alert" className="text-center text-red">We could not complete the sign-up. Please try again.</p>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" onClick={() => void run()}>Try again</Button>
          </div>
        </>
      )}

      {resendError && (
        <p role="alert" className="mt-3 text-center text-sm text-red">Could not send a new link. Please try again.</p>
      )}
      {unsyncedDialog}
    </AuthShell>
  );
}
