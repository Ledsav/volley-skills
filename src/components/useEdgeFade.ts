import { useLayoutEffect, type RefObject } from 'react';

/**
 * Marks a horizontal scroller (`.scroll-strip`) with `data-fade-start` / `data-fade-end` while there is hidden
 * content past that edge, so the CSS fades only the edges that hide something. Writes attributes directly (no
 * re-render) on scroll and resize. `deps` re-measures when the content changes.
 */
export function useEdgeFade(ref: RefObject<HTMLElement>, deps: unknown[] = []): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      // Under 1 px is rounding, not hidden content. RTL scrolls with a negative scrollLeft.
      const at = Math.abs(el.scrollLeft);
      el.toggleAttribute('data-fade-start', max > 1 && at > 1);
      el.toggleAttribute('data-fade-end', max > 1 && at < max - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    }
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
