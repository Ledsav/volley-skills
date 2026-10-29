import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { LegalMarkdown } from '../legal/LegalMarkdown';
import { specificClauses } from '../legal/specificClauses';
import type { LegalLang } from '../legal/versions';
import { useT } from '../i18n/I18nProvider';

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
  const t = useT().signup.approval;
  const clauses = useMemo(() => specificClauses(termsVersion, dpaVersion, lang), [termsVersion, dpaVersion, lang]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState(false);
  // UI-only: ticks are never stored. A different text (language or version) has to be ticked again.
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setTicked(new Set());
  }, [lang, termsVersion, dpaVersion]);
  const allTicked = clauses.every((c) => ticked.has(c.id));

  function toggle(id: string, on: boolean) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function send() {
    setState('sending');
    setError(false);
    try {
      await onSend();
      setState('sent');
    } catch {
      setState('idle');
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-2">{t.intro}</p>
      <ul lang={lang} className="overflow-hidden rounded-lg bg-surface shadow-card">
        {clauses.map((c, i) => (
          <li key={c.id} className={i > 0 ? 'border-t border-separator' : undefined}>
            <article className="p-4">
              <h3 className="text-headline text-ink">{c.id}. {c.heading}</h3>
              <div className="text-base leading-[1.625rem]">
                <LegalMarkdown text={c.text} />
              </div>
              <label htmlFor={`approve-${c.id}`} className="mt-3 flex min-h-11 items-start gap-3 text-body text-ink">
                <input
                  id={`approve-${c.id}`}
                  type="checkbox"
                  checked={ticked.has(c.id)}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                  className="mt-1 h-5 w-5 accent-ink"
                />
                <span>{t.approveClause(c.id)}</span>
              </label>
            </article>
          </li>
        ))}
      </ul>

      {state === 'sent' ? (
        <p role="status" className="text-body text-ink">
          {t.sent(email)}
        </p>
      ) : (
        <div>
          <Button variant="primary" disabled={state === 'sending' || !allTicked} onClick={send}>
            {t.approve}
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-footnote text-red-strong">{t.sendFailed}</p>}
    </div>
  );
}
