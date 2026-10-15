import { Sparkles } from 'lucide-react';

/** Header toggle for match-data suggestions on the skills card (sits beside "Edit skills"). */
export function SuggestionToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="Match suggestions"
      title={on ? 'Hide match suggestions' : 'Show match suggestions'}
      onClick={() => onChange(!on)}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
        on ? 'bg-blue/10 text-blue hover:bg-blue/15' : 'text-slate hover:bg-bg hover:text-ink'
      }`}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      Suggestions
    </button>
  );
}
