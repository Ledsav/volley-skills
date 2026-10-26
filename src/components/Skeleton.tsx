/** A placeholder block shaped like the content it stands in for. */
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div data-skeleton-block aria-hidden="true" className={`rounded-md bg-border/60 motion-safe:animate-pulse ${className}`.trim()} />;
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <SkeletonBlock className="h-64 rounded-lg lg:col-span-4" />
          <div className="flex flex-col gap-4 lg:col-span-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} className="h-20 rounded-lg" />
              ))}
            </div>
            <SkeletonBlock className="h-64 rounded-lg" />
          </div>
        </div>
      )}
      {layout === 'team' && (
        <div className="flex flex-col gap-4">
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonBlock className="h-10 w-full max-w-xl" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-32 rounded-lg" />
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
