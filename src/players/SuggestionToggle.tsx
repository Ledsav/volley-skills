import { Sparkles } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';

/** Header toggle for match-data suggestions on the skills card. */
export function SuggestionToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const s = useT().players.suggestionToggle;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={s.aria}
      title={on ? s.hide : s.show}
      onClick={() => onChange(!on)}
      className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-footnote font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        on ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2'
      }`}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      {s.label}
    </button>
  );
}
