/** A placeholder block shaped like the content it stands in for. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div data-skeleton-block aria-hidden="true" className={`rounded-md bg-surface-2 motion-safe:animate-[pulse_1.6s_ease-in-out_infinite] ${className}`.trim()} />;
}

/**
 * Page-level loading state laid out like the page that is coming, so content
 * fills in place instead of pushing everything down. `label` is announced.
 */
export function PageSkeleton({ layout, label }: { layout: 'player' | 'team' | 'match'; label: string }) {
  return (
    <div role="status" className="w-full p-4 lg:p-6">
      <span className="sr-only">{label}</span>
      {layout === 'player' && (
        <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonBlock className="h-7 w-56 max-w-full" />
              <SkeletonBlock className="h-4 w-40 max-w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <SkeletonBlock className="h-11 w-full max-w-md rounded-[10px]" />
          <SkeletonBlock className="h-64 rounded-lg" />
        </div>
      )}
      {layout === 'team' && (
        <div className="flex flex-col gap-4">
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonBlock className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            {[0, 1].map((i) => (
              <SkeletonBlock key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <div className="overflow-hidden rounded-lg bg-surface shadow-card">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <SkeletonBlock className="h-4 w-40 max-w-full" />
                  <SkeletonBlock className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {layout === 'match' && (
        <div className="flex flex-col gap-4">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-8 w-64" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonBlock key={i} className="h-16" />
            ))}
          </div>
          <SkeletonBlock className="h-64 rounded-lg" />
        </div>
      )}
    </div>
  );
}
