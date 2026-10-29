import { Children, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { useEdgeFade } from './useEdgeFade';

/**
 * A horizontally scrolling row (filter chips, a bench strip, set scores): no scrollbar, and a fade on the edge
 * that hides more content. Layout (flex, gap, padding) comes from `className`.
 */
export function ScrollStrip({
  children,
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEdgeFade(ref, [Children.count(children)]);
  return (
    <div ref={ref} className={`scroll-strip overflow-x-auto ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
