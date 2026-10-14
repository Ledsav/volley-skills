import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export type MenuItem =
  | { kind: 'action'; label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean }
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

const ITEM_CLASS =
  'flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-sm focus:outline-none focus-visible:bg-bg hover:bg-bg';

/**
 * A button that opens a small list of actions / toggles (WAI-ARIA menu button):
 * arrow keys move between items, Escape or a click outside closes and returns
 * focus to the trigger, choosing an item runs it and closes.
 */
export function Menu({ label, trigger, items, triggerClassName = '', align = 'end', placement = 'down' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onListKeyDown = (e: KeyboardEvent) => {
    const nodes = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(at + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(at - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      nodes[e.key === 'Home' ? 0 : nodes.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

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
        className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue ${triggerClassName}`.trim()}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onListKeyDown}
          className={`absolute z-40 min-w-52 rounded-md border border-border bg-surface p-1 text-ink shadow-pop ${
            align === 'end' ? 'right-0' : 'left-0'
          } ${placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          {items.map((item, i) => {
            if (item.kind === 'divider') return <div key={i} role="separator" className="my-1 h-px bg-border" />;
            const run = () => {
              close(true);
              item.onSelect();
            };
            if (item.kind === 'check') {
              return (
                <button key={i} type="button" role="menuitemcheckbox" aria-checked={item.checked} tabIndex={-1} onClick={run} className={ITEM_CLASS}>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {item.checked && <Check size={16} aria-hidden="true" className="text-blue" />}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.hint}
                </button>
              );
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={run}
                className={`${ITEM_CLASS} ${item.danger ? 'text-red-strong' : ''}`}
              >
                {item.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
