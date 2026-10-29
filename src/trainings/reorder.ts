import { useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useDrag } from '@use-gesture/react';
import { useReducedMotion } from '../motion/useReducedMotion';

/** A copy of `list` with the item at `from` moved to `to`. */
export function moveRow<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Index the dragged row lands on: how many other rows' midpoints lie above `y`. */
export function dropIndex(mids: readonly number[], from: number, y: number): number {
  let count = 0;
  mids.forEach((mid, i) => {
    if (i !== from && mid < y) count += 1;
  });
  return count;
}

/** Drag-handle reordering for a vertical list; Move up/down buttons stay for keyboard and assistive tech. */
export function useRowReorder(opts: { count: number; onMove: (from: number, to: number) => void }): {
  listRef: RefObject<HTMLUListElement>;
  handleProps: (index: number) => ReturnType<ReturnType<typeof useDrag>>;
  rowStyle: (index: number) => CSSProperties | undefined;
} {
  const reduced = useReducedMotion();
  const listRef = useRef<HTMLUListElement>(null);
  const mids = useRef<number[]>([]);
  const dragging = useRef<{ index: number; my: number } | null>(null);
  const [, force] = useRerender();

  const bind = useDrag(
    ({ args: [index], first, last, movement: [, my], tap }) => {
      if (tap) return;
      const from = index as number;
      if (first) {
        const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
        mids.current = rows.map((el) => {
          const r = el.getBoundingClientRect();
          return r.top + r.height / 2;
        });
      }
      if (last) {
        dragging.current = null;
        force();
        const mid = mids.current[from];
        if (mid === undefined) return;
        const to = Math.min(opts.count - 1, dropIndex(mids.current, from, mid + my));
        if (to !== from) opts.onMove(from, to);
        return;
      }
      dragging.current = { index: from, my };
      force();
    },
    { axis: 'y', filterTaps: true, pointer: { touch: true } },
  );

  return {
    listRef,
    handleProps: (index) => bind(index),
    rowStyle: (index) => {
      const d = dragging.current;
      if (!d || d.index !== index) return undefined;
      return {
        transform: `translateY(${d.my}px)${reduced ? '' : ' scale(1.02)'}`,
        position: 'relative',
        zIndex: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,.12)',
      };
    },
  };
}

function useRerender(): [number, () => void] {
  const [n, setN] = useState(0);
  return [n, () => setN((v) => v + 1)];
}
