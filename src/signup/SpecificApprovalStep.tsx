import { useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { LegalMarkdown } from '../legal/LegalMarkdown';
import { specificClauses } from '../legal/specificClauses';
import type { LegalLang } from '../legal/versions';

export interface SpecificApprovalStepProps {
  termsVersion: string;
  dpaVersion: string;
  lang: LegalLang;
  email: string;
  /** Saves the draft and sends the signing link; rejects when sending fails. */
  onSend: () => Promise<void>;
}

/** The clauses that need a separate, specific approval, and the button that sends the signing link. */
export function SpecificApprovalStep({ termsVersion, dpaVersion, lang, email, onSend }: SpecificApprovalStepProps) {
  const clauses = useMemo(() => specificClauses(termsVersion, dpaVersion, lang), [termsVersion, dpaVersion, lang]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState('sending');
    setError(null);
    try {
      await onSend();
      setState('sent');
    } catch {
      setState('idle');
      setError('Could not send the confirmation link. Please try again.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate">
        These clauses limit liability, set how the service can change or end, or decide how disputes are handled. Each one needs your specific approval.
      </p>
      <div lang={lang} className="flex flex-col gap-4">
        {clauses.map((c) => (
          <article key={c.id} className="rounded-md border border-border bg-surface p-4">
            <h3 className="mb-2 text-base font-semibold text-ink">{c.id}. {c.heading}</h3>
            <LegalMarkdown text={c.text} />
          </article>
        ))}
      </div>

      {state === 'sent' ? (
        <p role="status" className="text-sm text-ink">
          We&apos;ve sent a confirmation link to {email}. Open it in this browser to sign.
        </p>
      ) : (
        <div>
          <Button variant="primary" disabled={state === 'sending'} onClick={send}>
            Approve these clauses specifically
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
    </div>
  );
}
