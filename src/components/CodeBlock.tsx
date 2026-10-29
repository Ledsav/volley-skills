import { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';

interface CodeBlockProps {
  code: string;
  /** Short label shown in the header bar, e.g. "JSON". */
  language: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

const RESET_AFTER_MS = 2000;

/** Read-only code sample with a header bar and a one-click copy button. */
export function CodeBlock({ code, language }: CodeBlockProps) {
  const t = useT().components;
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState('idle'), RESET_AFTER_MS);
  }

  const Icon = copyState === 'copied' ? Check : copyState === 'failed' ? X : Copy;

  return (
    <div className="overflow-hidden rounded-md border border-separator bg-bg">
      <div className="flex items-center justify-between gap-2 border-b border-separator bg-surface py-1 pl-3 pr-1">
        <span className="text-xs font-medium text-ink-2">{language}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            copyState === 'copied' ? 'text-green-strong' : copyState === 'failed' ? 'text-red-strong' : 'text-ink-2 hover:text-ink'
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-live="polite">{t.codeBlock[copyState]}</span>
        </button>
      </div>
      <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words p-3 text-xs text-ink">
        {code}
      </pre>
    </div>
  );
}
