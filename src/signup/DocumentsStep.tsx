import { useState } from 'react';
import { Button } from '../components/Button';
import { LegalLangSwitcher } from '../legal/LegalLangSwitcher';
import { LegalMarkdown } from '../legal/LegalMarkdown';
import { legalText } from '../legal/legalDocs';
import type { LegalLang } from '../legal/versions';
import { useT } from '../i18n/I18nProvider';

interface DocBoxProps {
  doc: 'terms' | 'dpa';
  title: string;
  version: string;
  lang: LegalLang;
  read: boolean;
  accepted: boolean;
  onRead: () => void;
  onAccept: (checked: boolean) => void;
}

function DocBox({ doc, title, version, lang, read, accepted, onRead, onAccept }: DocBoxProps) {
  const id = `accept-${doc}`;
  const hintId = `${id}-hint`;
  const t = useT().signup.documents;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-headline text-ink">{title}</h3>
        <a
          href={`/legal/${doc}?v=${encodeURIComponent(version)}&lang=${lang}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onRead}
          className="text-callout text-ink underline"
        >
          {t.openInNewTab}<span className="sr-only"> ({title})</span>
        </a>
      </div>
      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        lang={lang}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) onRead();
        }}
        className="max-h-72 overflow-y-auto rounded-lg bg-surface p-4 text-base leading-[1.625rem] shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <LegalMarkdown text={legalText(doc, version, lang)} />
      </div>
      <label htmlFor={id} className="flex min-h-11 items-start gap-3 text-body text-ink">
        <input
          id={id}
          type="checkbox"
          checked={accepted}
          disabled={!read}
          aria-describedby={read ? undefined : hintId}
          onChange={(e) => onAccept(e.target.checked)}
          className="mt-1 h-5 w-5 accent-ink"
        />
        <span>{t.accept(title)}</span>
      </label>
      {!read && (
        <p id={hintId} className="text-footnote text-ink-2">
          {t.scrollHint}
        </p>
      )}
    </section>
  );
}

export interface DocumentsStepProps {
  termsVersion: string;
  dpaVersion: string;
  lang: LegalLang;
  onLangChange: (lang: LegalLang) => void;
  onDone: () => void;
}

/** Terms and DPA, each read (or opened) before its checkbox can be ticked. */
export function DocumentsStep({ termsVersion, dpaVersion, lang, onLangChange, onDone }: DocumentsStepProps) {
  const t = useT();
  const [read, setRead] = useState({ terms: false, dpa: false });
  const [accepted, setAccepted] = useState({ terms: false, dpa: false });

  function changeLang(next: LegalLang) {
    // A different text is a different document: it has to be read and accepted again.
    setRead({ terms: false, dpa: false });
    setAccepted({ terms: false, dpa: false });
    onLangChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <LegalLangSwitcher lang={lang} onChange={changeLang} />
      <DocBox
        doc="terms" title={t.legal.docTitles.terms} version={termsVersion} lang={lang}
        read={read.terms} accepted={accepted.terms}
        onRead={() => setRead((r) => ({ ...r, terms: true }))}
        onAccept={(v) => setAccepted((a) => ({ ...a, terms: v }))}
      />
      <DocBox
        doc="dpa" title={t.legal.docTitles.dpa} version={dpaVersion} lang={lang}
        read={read.dpa} accepted={accepted.dpa}
        onRead={() => setRead((r) => ({ ...r, dpa: true }))}
        onAccept={(v) => setAccepted((a) => ({ ...a, dpa: v }))}
      />
      <p className="text-footnote text-ink-2">
        {t.signup.documents.listOf}{' '}
        <a href={`/legal/subprocessors?lang=${lang}`} target="_blank" rel="noopener noreferrer" className="text-ink underline">
          {t.legal.docTitles.subprocessors}
        </a>{' '}
        {t.signup.documents.isPart}
      </p>
      <div>
        <Button variant="primary" disabled={!(accepted.terms && accepted.dpa)} onClick={onDone}>
          {t.signup.shared.next}
        </Button>
      </div>
    </div>
  );
}
