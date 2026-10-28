import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { MenuItem } from './Menu';
import { MenuList } from './MenuList';

export const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;
const MARGIN = 8;
const SWALLOW_MS = 300;

interface Options {
  label: string;
  items: MenuItem[] | (() => MenuItem[]);
  disabled?: boolean;
}

type TargetProps = Pick<
  HTMLAttributes<HTMLElement>,
  'onContextMenu' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onClickCapture'
>;

/** Right-click and touch/pen long-press menus. Spread `targetProps` on the row and render `menu` once. */
export function useContextMenu({ label, items, disabled }: Options): { targetProps: TargetProps; menu: ReactNode } {
  const [at, setAt] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const id = useId();
  const targetRef = useRef<HTMLElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swallowClick = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const open = useCallback((x: number, y: number) => {
    const list = typeof itemsRef.current === 'function' ? itemsRef.current() : itemsRef.current;
    setPos({ x, y });
    setAt({ x, y, items: list });
  }, []);

  const releasePress = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
    if (targetRef.current) {
      targetRef.current.style.userSelect = '';
      targetRef.current.style.setProperty('-webkit-touch-callout', '');
    }
  };

  const close = useCallback((refocus: boolean) => {
    setAt(null);
    if (refocus) targetRef.current?.focus();
  }, []);

  // Clamp to the viewport (8 px margin) once the menu has a size.
  useLayoutEffect(() => {
    const el = holderRef.current?.firstElementChild as HTMLElement | null | undefined;
    if (!at || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w === 0 && h === 0) return;
    setPos({
      x: Math.max(MARGIN, Math.min(at.x, window.innerWidth - w - MARGIN)),
      y: Math.max(MARGIN, Math.min(at.y, window.innerHeight - h - MARGIN)),
    });
  }, [at]);

  useEffect(() => {
    if (!at) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (holderRef.current && !holderRef.current.contains(e.target as Node)) setAt(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [at]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const targetProps: TargetProps = {
    onContextMenu: (e) => {
      if (disabled) return;
      e.preventDefault();
      targetRef.current = e.currentTarget;
      if (at) return;
      if (e.clientX === 0 && e.clientY === 0) {
        // Keyboard invocation (Shift+F10 / Menu key) reports no pointer position.
        const r = e.currentTarget.getBoundingClientRect();
        open(r.left, r.bottom);
      } else open(e.clientX, e.clientY);
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      swallowClick.current = false;
      if (disabled || (e.pointerType !== 'touch' && e.pointerType !== 'pen')) return;
      const target = e.currentTarget;
      targetRef.current = target;
      start.current = { x: e.clientX, y: e.clientY };
      target.style.userSelect = 'none';
      target.style.setProperty('-webkit-touch-callout', 'none');
      const { clientX, clientY } = e;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        swallowClick.current = true;
        open(clientX, clientY);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      const s = start.current;
      if (!s || timer.current === undefined) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE) releasePress();
    },
    onPointerUp: () => {
      releasePress();
      // The click that ends the press follows pointerup at once; a later one (keyboard) is a real click.
      if (swallowClick.current) setTimeout(() => (swallowClick.current = false), SWALLOW_MS);
    },
    onPointerCancel: () => {
      swallowClick.current = false;
      releasePress();
    },
    onClickCapture: (e) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  const menu = at
    ? createPortal(
        <div ref={holderRef}>
          <MenuList
            id={id}
            label={label}
            items={at.items}
            onClose={close}
            className="fixed z-50"
            style={{ left: pos?.x ?? at.x, top: pos?.y ?? at.y, transformOrigin: 'top left' }}
          />
        </div>,
        document.body,
      )
    : null;

  return { targetProps, menu };
}
