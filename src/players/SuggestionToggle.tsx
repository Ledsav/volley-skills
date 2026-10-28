import { Sparkles } from 'lucide-react';
import { useT } from '../i18n/I18nProvider';

/** Header toggle for match-data suggestions on the skills card (sits beside "Edit skills"). */
export function SuggestionToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const s = useT().players.suggestionToggle;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={s.aria}
      title={on ? s.hide : s.show}
      onClick={() => onChange(!on)}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
        on ? 'bg-blue/10 text-blue-strong hover:bg-blue/15' : 'text-slate hover:bg-bg hover:text-ink'
      }`}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      {s.label}
    </button>
  );
}
