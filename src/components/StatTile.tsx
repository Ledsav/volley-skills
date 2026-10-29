interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  title?: string;
  className?: string;
}

/** Design-system stat tile: a card surface, one big tabular number in the `stat` role, label above. */
export function StatTile({ label, value, hint, title, className = '' }: StatTileProps) {
  return (
    <div className={`flex min-w-0 break-inside-avoid flex-col rounded-lg bg-surface p-4 shadow-card ${className}`.trim()} title={title}>
      <p className="text-caption text-ink-2">{label}</p>
      <p className="mt-2 truncate whitespace-nowrap text-stat tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 truncate text-footnote text-ink-2">{hint}</p>}
    </div>
  );
}
