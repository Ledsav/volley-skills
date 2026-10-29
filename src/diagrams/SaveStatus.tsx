import { useT } from '../i18n/I18nProvider';

/** Autosave state in the editor chrome. No live region: it would announce every 3 s. */
export function SaveStatus({ status, onRetry }: { status: 'saved' | 'saving' | 'failed'; onRetry: () => void }) {
  const ed = useT().diagrams.editor;
  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-full px-3 text-footnote font-semibold text-red-strong hover:bg-red-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {ed.status.retry}
      </button>
    );
  }
  return <span className="text-footnote text-ink-2">{status === 'saving' ? ed.status.saving : ed.status.saved}</span>;
}
