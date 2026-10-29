import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, Info, Loader2, Mail, UserX } from 'lucide-react';
import { AuthShell } from '../auth/AuthShell';
import { sendSigningLink } from '../auth/reauth';
import { useSignOut } from '../auth/useSignOut';
import { Button } from '../components/Button';
import { StatusLayout } from '../components/StatusLayout';
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

  const icon =
    view === 'working' ? Loader2
    : view === 'linkExpired' ? Clock
    : view === 'linkSent' ? Mail
    : view === 'wrongAccount' ? UserX
    : view === 'error' ? AlertTriangle
    : Info;

  const actions =
    view === 'linkExpired' ? (
      <Button variant="primary" className="min-h-12 w-full" disabled={busy} onClick={sendNewLink}>{t.sendNewLink}</Button>
    ) : view === 'wrongAccount' ? (
      <Button variant="secondary" className="min-h-12 w-full" onClick={signOut}>{t.signOut}</Button>
    ) : view === 'error' ? (
      <Button variant="primary" className="min-h-12 w-full" onClick={() => void run()}>{t.tryAgain}</Button>
    ) : undefined;

  return (
    <AuthShell>
      <StatusLayout icon={icon} tone={view === 'error' ? 'error' : 'neutral'} title={t.title} actions={actions}>
        {view === 'working' && <p role="status">{t.working}</p>}
        {view === 'linkExpired' && t.linkExpired}
        {view === 'linkSent' && <p role="status">{t.linkSent}</p>}
        {view === 'noDraft' && t.noDraft}
        {view === 'wrongLink' && t.wrongLink}
        {view === 'wrongAccount' && t.wrongAccount}
        {view === 'error' && <p role="alert">{t.error}</p>}
        {resendError && (
          <p role="alert" className="mt-3 text-footnote text-red-strong">{t.resendError}</p>
        )}
      </StatusLayout>
      {unsyncedDialog}
    </AuthShell>
  );
}
