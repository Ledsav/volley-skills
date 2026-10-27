import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthShell } from '../auth/AuthShell';
import { sendSigningLink } from '../auth/reauth';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';
import { useT } from '../i18n/I18nProvider';
import { usePageMeta } from '../layout/usePageMeta';
import { readSignDraft } from '../legal/signDraft';
import { commitSignDraft } from './signingApi';

type View = 'working' | 'linkExpired' | 'noDraft' | 'wrongLink' | 'wrongAccount' | 'error' | 'linkSent';

/** /sign/complete: the landing page of the signing link; commits the saved draft once. */
export function SignCompletePage() {
  const t = useT().signup.complete;
  usePageMeta({ title: t.title });
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
    <AuthShell title={t.title}>
      {view === 'working' && <p role="status" className="text-center text-slate">{t.working}</p>}

      {view === 'linkExpired' && (
        <>
          <p className="text-center text-slate">{t.linkExpired}</p>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" disabled={busy} onClick={sendNewLink}>{t.sendNewLink}</Button>
          </div>
        </>
      )}

      {view === 'linkSent' && (
        <p role="status" className="text-center text-slate">{t.linkSent}</p>
      )}

      {view === 'noDraft' && (
        <p className="text-center text-slate">
          {t.noDraft}
        </p>
      )}

      {view === 'wrongLink' && (
        <p className="text-center text-slate">
          {t.wrongLink}
        </p>
      )}

      {view === 'wrongAccount' && (
        <>
          <p className="text-center text-slate">
            {t.wrongAccount}
          </p>
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={signOut}>{t.signOut}</Button>
          </div>
        </>
      )}

      {view === 'error' && (
        <>
          <p role="alert" className="text-center text-red">{t.error}</p>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" onClick={() => void run()}>{t.tryAgain}</Button>
          </div>
        </>
      )}

      {resendError && (
        <p role="alert" className="mt-3 text-center text-sm text-red">{t.resendError}</p>
      )}
      {unsyncedDialog}
    </AuthShell>
  );
}
