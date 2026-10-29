import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MenuList } from './MenuList';

export type MenuItem =
  | { kind: 'action'; label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean; hint?: ReactNode; disabled?: boolean }
  | { kind: 'check'; label: string; checked: boolean; onSelect: () => void; hint?: ReactNode }
  | { kind: 'divider' };

interface MenuProps {
  /** Accessible name of the trigger and the menu. */
  label: string;
  /** Visible trigger content. */
  trigger: ReactNode;
  items: MenuItem[];
  triggerClassName?: string;
  /** Which edge of the trigger the menu aligns to, and whether it opens upward (sidebar footer). */
  align?: 'start' | 'end';
  placement?: 'down' | 'up';
}

/**
 * A button that opens a small list of actions / toggles (WAI-ARIA menu button):
 * arrow keys move between items, Escape or a click outside closes and returns
 * focus to the trigger, choosing an item runs it and closes.
 */
export function Menu({ label, trigger, items, triggerClassName = '', align = 'end', placement = 'down' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${triggerClassName}`.trim()}
      >
        {trigger}
      </button>
      {open && (
        <MenuList
          id={menuId}
          label={label}
          items={items}
          onClose={close}
          className={`absolute z-40 ${align === 'end' ? 'right-0' : 'left-0'} ${
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{ transformOrigin: `${placement === 'up' ? 'bottom' : 'top'} ${align === 'end' ? 'right' : 'left'}` }}
        />
      )}
    </div>
  );
}
