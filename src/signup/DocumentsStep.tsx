import { useState } from 'react';
import { Button } from '../components/Button';
import { LegalLangSwitcher } from '../legal/LegalLangSwitcher';
import { LegalMarkdown } from '../legal/LegalMarkdown';
import { legalText } from '../legal/legalDocs';
import type { LegalLang } from '../legal/versions';

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
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <a
          href={`/legal/${doc}?v=${encodeURIComponent(version)}&lang=${lang}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onRead}
          className="text-sm text-blue hover:underline"
        >
          Open in a new tab<span className="sr-only"> ({title})</span>
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
        className="max-h-72 overflow-y-auto rounded-md border border-border bg-surface p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <LegalMarkdown text={legalText(doc, version, lang)} />
      </div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-ink">
        <input
          id={id}
          type="checkbox"
          checked={accepted}
          disabled={!read}
          aria-describedby={read ? undefined : hintId}
          onChange={(e) => onAccept(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>I have read and accept the {title}</span>
      </label>
      {!read && (
        <p id={hintId} className="text-xs text-slate">
          Scroll to the end of the text, or open it in a new tab, to enable this box.
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
        doc="terms" title="Terms of Service" version={termsVersion} lang={lang}
        read={read.terms} accepted={accepted.terms}
        onRead={() => setRead((r) => ({ ...r, terms: true }))}
        onAccept={(v) => setAccepted((a) => ({ ...a, terms: v }))}
      />
      <DocBox
        doc="dpa" title="Data Processing Agreement" version={dpaVersion} lang={lang}
        read={read.dpa} accepted={accepted.dpa}
        onRead={() => setRead((r) => ({ ...r, dpa: true }))}
        onAccept={(v) => setAccepted((a) => ({ ...a, dpa: v }))}
      />
      <p className="text-sm text-slate">
        The list of{' '}
        <a href={`/legal/subprocessors?lang=${lang}`} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline">
          Sub-processors
        </a>{' '}
        is part of what you accept.
      </p>
      <div>
        <Button variant="primary" disabled={!(accepted.terms && accepted.dpa)} onClick={onDone}>
          Next
        </Button>
      </div>
    </div>
  );
}
