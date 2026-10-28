import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useDrag } from '@use-gesture/react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { useMediaQuery } from './useMediaQuery';
import { useModalLayer } from './useModalLayer';
import { useT } from '../i18n/I18nProvider';
import { animateSpring, SPRING_DEFAULT, SPRING_FLICK } from '../motion/spring';
import { nearest, project, rubberband } from '../motion/gesture';
import { useReducedMotion } from '../motion/useReducedMotion';
import { decideRelease } from './sheetRelease';

export interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Desktop max width: 560 (`md`) or 720 (`lg`) px. */
  size?: 'md' | 'lg';
  /** Pinned bottom bar (desktop and phone). */
  footer?: ReactNode;
  /** Header confirm on phones, footer confirm on desktop. `form` submits that form instead of calling `onConfirm`. */
  confirm?: { label: string; onConfirm?: () => void; form?: string; disabled?: boolean };
  /** Unsaved changes: every close path asks "Discard changes?" first. */
  dirty?: boolean;
  /** Treat the sheet as dirty once any field inside it changes. */
  guardUnsaved?: boolean;
  /** Phone starting detent. */
  detent?: 'content' | 'large';
}

const PHONE_QUERY = '(max-width: 767px)';

const SheetCloseContext = createContext<() => void>(() => {});

/** The sheet's guarded close, for Cancel buttons inside it. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSheetClose(): () => void {
  return useContext(SheetCloseContext);
}

const DESKTOP_WIDTH: Record<NonNullable<SheetProps['size']>, string> = {
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
};

export function Sheet(props: SheetProps) {
  const { title, onClose, children, size = 'md', footer, confirm, dirty = false, guardUnsaved = false, detent = 'content' } = props;
  const t = useT().components;
  const phone = useMediaQuery(PHONE_QUERY, false);
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [edited, setEdited] = useState(false);
  const markEdited = guardUnsaved ? () => setEdited(true) : undefined;
  const isDirty = dirty || edited;

  const requestClose = useCallback(() => {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  }, [isDirty, onClose]);

  // Focus the panel once on mount only; re-running would steal focus from an input being typed into.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useModalLayer(requestClose, panelRef);

  // ---- Phone: vertical position in px from the large detent (0) down to closed (height). ----
  const yRef = useRef(0);
  const animRef = useRef<{ stop: () => number } | null>(null);
  const detentsRef = useRef({ large: 0, content: 0, height: 0 });

  const paint = useCallback((y: number) => {
    yRef.current = y;
    const panel = panelRef.current;
    if (panel) panel.style.transform = `translateY(${y}px)`;
    // The panel is full height and translated, so its bottom edge is below the screen at the content detent.
    // Pull the footer back up by the same amount so it stays at the visible bottom; it travels down with the sheet below that.
    const footer = footerRef.current;
    if (footer) footer.style.transform = `translateY(${-Math.min(y, detentsRef.current.content)}px)`;
    const scrim = scrimRef.current;
    const h = detentsRef.current.height;
    if (scrim && h > 0) scrim.style.opacity = String(Math.min(1, Math.max(0, 1 - y / h)));
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
      animRef.current = animateSpring({
        from: yRef.current,
        to: target,
        velocity,
        params: Math.abs(velocity) > 300 ? SPRING_FLICK : SPRING_DEFAULT,
        onUpdate: paint,
        onComplete,
      });
    },
    [paint, reduced],
  );

  useLayoutEffect(() => {
    if (!phone) return;
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      const bodyStyle = bodyRef.current ? getComputedStyle(bodyRef.current) : null;
      const bodyPadding = bodyStyle ? (parseFloat(bodyStyle.paddingTop) || 0) + (parseFloat(bodyStyle.paddingBottom) || 0) : 0;
      const height = panel.offsetHeight;
      const contentHeight =
        (headerRef.current?.offsetHeight ?? 0) +
        (innerRef.current?.offsetHeight ?? 0) +
        bodyPadding +
        (footerRef.current?.offsetHeight ?? 0);
      // Long forms start large, as the spec says: content over 60% of the viewport opens large.
      const startsLarge = detent === 'large' || contentHeight > 0.6 * window.innerHeight;
      return { height, content: startsLarge ? 0 : Math.max(0, height - contentHeight) };
    };
    const first = measure();
    detentsRef.current = { large: 0, content: first.content, height: first.height };
    paint(reduced ? first.content : first.height);
    if (!reduced) moveTo(first.content);

    // Content or footer size changes (a field appears, text wraps): keep a resting content detent snug.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const prev = detentsRef.current;
        const next = measure();
        const resting = !animRef.current && Math.abs(yRef.current - prev.content) < 1;
        detentsRef.current = { large: 0, content: next.content, height: next.height };
        if (resting && next.content !== prev.content) paint(next.content);
      });
      if (innerRef.current) observer.observe(innerRef.current);
      if (footerRef.current) observer.observe(footerRef.current);
    }
    return () => {
      observer?.disconnect();
      animRef.current?.stop();
      animRef.current = null;
    };
    // Re-run only on layout switch; later drags use the detents above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const bindDrag = useDrag(
    ({ first, last, movement: [, my], velocity: [, vy], direction: [, dy], memo }) => {
      const { height, large, content } = detentsRef.current;
      let start = memo as number | undefined;
      if (first || start === undefined) {
        start = animRef.current?.stop() ?? yRef.current;
        animRef.current = null;
      }
      const raw = start + my;
      const y = raw < 0 ? -rubberband(-raw, height) : raw;
      if (!last) {
        paint(y);
        return start;
      }
      const downVelocity = vy * dy; // px/ms, positive downward
      const verdict = decideRelease({ offset: my, velocity: downVelocity, height: Math.max(1, height - start), dirty: isDirty });
      if (verdict === 'close') {
        moveTo(height, downVelocity * 1000, onClose);
      } else if (verdict === 'guard') {
        moveTo(nearest(content === large ? [large] : [large, content], start), 0);
        setConfirmDiscard(true);
      } else {
        const points = content === large ? [large] : [large, content];
        moveTo(nearest(points, Math.max(0, y + project(downVelocity * 1000))), downVelocity * 1000);
      }
      return start;
    },
    { axis: 'y', filterTaps: true, pointer: { touch: true } },
  );

  // ---- Desktop entry: fade + scale .96 -> 1 (opacity only under reduced motion). ----
  useEffect(() => {
    if (phone) return;
    const panel = panelRef.current;
    if (!panel || typeof panel.animate !== 'function') return;
    const frames = reduced
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: 'scale(0.96)' },
          { opacity: 1, transform: 'scale(1)' },
        ];
    const a = panel.animate(frames, { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    return () => a.cancel();
  }, [phone, reduced]);

  const confirmButton = confirm && (
    <Button
      variant={phone ? 'ghost' : 'primary'}
      type={confirm.form ? 'submit' : 'button'}
      form={confirm.form}
      disabled={confirm.disabled}
      onClick={confirm.form ? undefined : confirm.onConfirm}
    >
      {confirm.label}
    </Button>
  );

  const body = (
    <div ref={bodyRef} onChange={markEdited} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 [scrollbar-gutter:stable] md:px-6">
      <div ref={innerRef}>{children}</div>
    </div>
  );

  const bottomBar =
    footer || (!phone && confirm) ? (
      <footer
        ref={footerRef}
        onChange={markEdited}
        className="flex shrink-0 items-center justify-end gap-3 border-t border-separator bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-6 md:pb-3"
      >
        {footer ?? (
          <>
            <Button variant="ghost" onClick={requestClose}>
              {t.cancel}
            </Button>
            {confirmButton}
          </>
        )}
      </footer>
    ) : null;

  const discard = confirmDiscard && (
    <ConfirmDialog
      title={t.discardTitle}
      message={t.discardMessage}
      confirmLabel={t.discard}
      onCancel={() => setConfirmDiscard(false)}
      onConfirm={() => {
        setConfirmDiscard(false);
        onClose();
      }}
    />
  );

  if (phone) {
    return (
      <SheetCloseContext.Provider value={requestClose}>
        <div key="sheet" className="fixed inset-0 z-50">
          <div ref={scrimRef} data-testid="dialog-backdrop" className="absolute inset-0 bg-[var(--scrim)]" onClick={requestClose} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-layout="sheet"
            data-detent={detent}
            tabIndex={-1}
            style={{ height: 'calc(100dvh - 2.75rem)' }}
            className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-xl bg-surface shadow-sheet focus:outline-none"
          >
            <div ref={headerRef} {...bindDrag()} className="shrink-0 touch-none select-none border-b border-separator">
              <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-ink-3/40" aria-hidden="true" />
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2">
                <div className="justify-self-start">
                  <Button variant="ghost" onClick={requestClose}>
                    {t.cancel}
                  </Button>
                </div>
                <h2 className="min-w-0 truncate text-headline text-ink">{title}</h2>
                <div className="justify-self-end">
                  {confirmButton ??
                    (footer || guardUnsaved || dirty ? null : (
                      <Button variant="ghost" onClick={requestClose}>
                        {t.done}
                      </Button>
                    ))}
                </div>
              </div>
              <button type="button" onClick={requestClose} aria-label={t.close} className="sr-only">
                {t.close}
              </button>
            </div>
            {body}
            {bottomBar}
          </div>
        </div>
        {discard}
      </SheetCloseContext.Provider>
    );
  }

  return (
    <SheetCloseContext.Provider value={requestClose}>
      <div
        key="dialog"
        data-testid="dialog-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4"
        onClick={requestClose}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-layout="dialog"
          data-detent={detent}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-surface shadow-pop focus:outline-none ${DESKTOP_WIDTH[size]}`}
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-6 py-4">
            <h2 className="min-w-0 truncate text-title-2 text-ink">{title}</h2>
            <button
              type="button"
              onClick={requestClose}
              aria-label={t.close}
              className="pressable -mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>
          {body}
          {bottomBar}
        </div>
      </div>
      {discard}
    </SheetCloseContext.Provider>
  );
}
