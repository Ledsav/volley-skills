export function RotationBars({ rotations, best, weakest }: { rotations: Record<number, { won: number; lost: number }>; best: number | null; weakest: number | null }) {
  const max = Math.max(1, ...Object.values(rotations).map((v) => v.won + v.lost));
  return (
    <div className="break-inside-avoid">
      <ul className="space-y-1.5">
        {[1, 2, 3, 4, 5, 6].map((r) => {
          const v = rotations[r] ?? { won: 0, lost: 0 };
          return (
            <li key={r} className="flex items-center gap-2 text-sm">
              <span className="w-6 tabular-nums text-slate">R{r}</span>
              <span className="flex h-4 flex-1 overflow-hidden rounded-sm bg-bg [print-color-adjust:exact]" aria-label={`Rotation ${r}: ${v.won} won, ${v.lost} lost`} role="img">
                <span className="bg-green" style={{ width: `${(v.won / max) * 100}%` }} />
                <span className="bg-red" style={{ width: `${(v.lost / max) * 100}%` }} />
              </span>
              <span className="w-14 text-right tabular-nums text-ink">{v.won}–{v.lost}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sm text-slate">
        {best !== null && <span className="mr-4">Best rotation: {best}</span>}
        {weakest !== null && <span>Weakest rotation: {weakest}</span>}
      </p>
    </div>
  );
}
