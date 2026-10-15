interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  title?: string;
  className?: string;
}

/**
 * Design-system stat tile (§7 Cards): flat (border, no shadow), dense, one
 * big tabular number in the `stat` role (30/34 extrabold). Label above, so a
 * row of tiles reads label-first like a table header.
 */
export function StatTile({ label, value, hint, title, className = '' }: StatTileProps) {
  return (
    <div className={`flex min-w-0 break-inside-avoid flex-col rounded-lg border border-border bg-surface p-4 ${className}`.trim()} title={title}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-2 truncate whitespace-nowrap text-stat font-extrabold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-slate">{hint}</p>}
    </div>
  );
}
