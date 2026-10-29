import { useT } from '../../i18n/I18nProvider';

export function RotationBars({ rotations, best, weakest }: { rotations: Record<number, { won: number; lost: number }>; best: number | null; weakest: number | null }) {
  const t = useT().teams.stats;
  const max = Math.max(1, ...Object.values(rotations).map((v) => v.won + v.lost));
  return (
    <div className="break-inside-avoid rounded-lg bg-surface p-4 shadow-card">
      <ul className="space-y-1.5">
        {[1, 2, 3, 4, 5, 6].map((r) => {
          const v = rotations[r] ?? { won: 0, lost: 0 };
          return (
            <li key={r} className="flex items-center gap-2 text-callout">
              <span className="w-8 shrink-0 whitespace-nowrap text-ink-2 tabular-nums">{t.rotationShort(r)}</span>
              <span className="flex h-4 flex-1 overflow-hidden rounded-sm bg-surface-2 [print-color-adjust:exact]" aria-label={t.rotationBar(r, v.won, v.lost)} role="img">
                <span className="bg-green" style={{ width: `${(v.won / max) * 100}%` }} />
                <span className="bg-red" style={{ width: `${(v.lost / max) * 100}%` }} />
              </span>
              <span className="w-20 shrink-0 whitespace-nowrap text-right text-ink tabular-nums">{v.won}–{v.lost}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-footnote text-ink-2">{t.rotationsNote}</p>
      <p className="mt-1 text-callout text-ink-2">
        {best !== null && <span className="mr-4">{t.bestRotation(best)}</span>}
        {weakest !== null && <span>{t.weakestRotation(weakest)}</span>}
      </p>
    </div>
  );
}
