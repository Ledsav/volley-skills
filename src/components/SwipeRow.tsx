import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDrag } from '@use-gesture/react';
import { useMediaQuery } from './useMediaQuery';
import { animateSpring, SPRING_DEFAULT } from '../motion/spring';
import { rubberband } from '../motion/gesture';
import { useReducedMotion } from '../motion/useReducedMotion';

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  tone: 'destructive' | 'neutral';
  undoable: boolean;
  onAction: () => void;
}

const ACTION_WIDTH = 76;
const OPEN_VELOCITY = 0.3; // px/ms

/** Where a release lands. Offsets are signed: negative reveals trailing actions, positive the leading one. */
// eslint-disable-next-line react-refresh/only-export-components
export function swipeRelease(i: {
  offset: number;
  velocity: number;
  width: number;
  actionsWidth: number;
  fullSwipe: boolean;
}): 'commit' | 'open' | 'closed' {
  const abs = Math.abs(i.offset);
  if (i.fullSwipe && abs > 0.5 * i.width) return 'commit';
  if (abs > i.actionsWidth / 2) return 'open';
  if (i.velocity !== 0 && Math.sign(i.velocity) === Math.sign(i.offset) && Math.abs(i.velocity) > OPEN_VELOCITY) return 'open';
  return 'closed';
}

const TONE_CLASS = {
  destructive: 'bg-red-strong text-on-ink',
  neutral: 'bg-surface-3 text-ink',
} as const;

function ActionButton({ action, onDone }: { action: SwipeAction; onDone: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={() => {
        onDone();
        action.onAction();
      }}
      style={{ width: ACTION_WIDTH }}
      className={`flex h-full flex-col items-center justify-center gap-1 text-footnote font-semibold ${TONE_CLASS[action.tone]}`}
    >
      {action.icon}
      <span>{action.label}</span>
    </button>
  );
}

/**
 * Phone swipe actions (coarse pointers only). Keyboard and screen-reader users reach the same actions through
 * the row's "⋯" menu, so the buttons here stay hidden from them while closed.
 */
export function SwipeRow({
  children,
  trailing = [],
  leading,
  disabled = false,
}: {
  children: ReactNode;
  trailing?: SwipeAction[];
  leading?: SwipeAction;
  disabled?: boolean;
}) {
  const coarse = useMediaQuery('(pointer: coarse)', false);
  const reduced = useReducedMotion();
  const enabled = coarse && !disabled && (trailing.length > 0 || !!leading);
  const [state, setState] = useState<'closed' | 'open'>('closed');
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const animRef = useRef<{ stop: () => number } | null>(null);

  const trailingWidth = trailing.length * ACTION_WIDTH;
  const leadingWidth = leading ? ACTION_WIDTH : 0;

  const paint = useCallback((x: number) => {
    xRef.current = x;
    const el = contentRef.current;
    if (el) el.style.transform = x === 0 ? '' : `translateX(${x}px)`;
  }, []);

  const moveTo = useCallback(
    (target: number, velocity = 0, onComplete?: () => void) => {
      animRef.current?.stop();
      animRef.current = null;
      if (reduced) {
        paint(target);
        onComplete?.();
        return;
      }
      animRef.current = animateSpring({ from: xRef.current, to: target, velocity, params: SPRING_DEFAULT, onUpdate: paint, onComplete });
    },
    [paint, reduced],
  );

  useEffect(
    () => () => {
      animRef.current?.stop();
    },
    [],
  );

  const close = useCallback(() => {
    setState('closed');
    moveTo(0);
  }, [moveTo]);

  const bind = useDrag(
    ({ first, last, movement: [mx], velocity: [vx], direction: [dx], memo }) => {
      let start = memo as number | undefined;
      if (first || start === undefined) {
        start = animRef.current?.stop() ?? xRef.current;
        animRef.current = null;
      }
      const width = rootRef.current?.offsetWidth || 360;
      const raw = start + mx;
      const firstUndoable = trailing[0]?.undoable ?? false;
      const leadUndoable = leading?.undoable ?? false;
      // Content follows 1:1 inside the reachable range, with resistance beyond it.
      let x = raw;
      if (raw < 0) {
        const reach = trailing.length === 0 ? 0 : firstUndoable ? width : trailingWidth;
        x = raw >= -reach ? raw : -(reach + rubberband(-raw - reach, width));
      } else if (raw > 0) {
        const reach = leadingWidth === 0 ? 0 : leadUndoable ? width : leadingWidth;
        x = raw <= reach ? raw : reach + rubberband(raw - reach, width);
      }
      if (!last) {
        paint(x);
        return start;
      }
      const side = x < 0 ? 'trailing' : 'leading';
      const actionsWidth = side === 'trailing' ? trailingWidth : leadingWidth;
      const fullSwipe = side === 'trailing' ? firstUndoable : leadUndoable;
      const verdict =
        actionsWidth === 0
          ? 'closed'
          : swipeRelease({ offset: x, velocity: vx * dx, width, actionsWidth, fullSwipe });
      const sign = side === 'trailing' ? -1 : 1;
      if (verdict === 'commit') {
        const action = side === 'trailing' ? trailing[0] : leading;
        moveTo(sign * width, vx * dx * 1000, () => {
          action?.onAction();
          setState('closed');
          paint(0);
        });
      } else if (verdict === 'open') {
        setState('open');
        moveTo(sign * actionsWidth, vx * dx * 1000);
      } else {
        setState('closed');
        moveTo(0, vx * dx * 1000);
      }
      return start;
    },
    { axis: 'x', threshold: 10, filterTaps: true, pointer: { touch: true }, enabled },
  );

  if (!enabled) return <div data-state="closed">{children}</div>;

  const hidden = state === 'closed';
  return (
    <div ref={rootRef} data-state={state} className="relative overflow-hidden">
      {leading && (
        <div aria-hidden={hidden || undefined} className="absolute inset-y-0 left-0 flex">
          <ActionButton action={leading} onDone={close} />
        </div>
      )}
      {trailing.length > 0 && (
        <div aria-hidden={hidden || undefined} className="absolute inset-y-0 right-0 flex">
          {trailing.map((a) => (
            <ActionButton key={a.label} action={a} onDone={close} />
          ))}
        </div>
      )}
      <div ref={contentRef} {...bind()} className="relative bg-surface" style={{ touchAction: 'pan-y' }}>
        {children}
      </div>
    </div>
  );
}
