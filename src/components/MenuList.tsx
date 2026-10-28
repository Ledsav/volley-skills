import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import type { MenuItem } from './Menu';

const ITEM_CLASS =
  'flex min-h-11 w-full items-center gap-2 rounded-sm px-3 text-left text-body focus:outline-none focus-visible:bg-surface-3 hover:bg-surface-3';

interface MenuListProps {
  id: string;
  label: string;
  items: MenuItem[];
  /** Choosing an item or Escape closes with focus returning to the trigger; Tab closes without. */
  onClose: (refocus: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

/** The glass surface, items and keyboard model shared by Menu and context menus. */
export function MenuList({ id, label, items, onClose, className = '', style }: MenuListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    const nodes = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const at = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
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
      onClose(false);
    }
  };

  return (
    <div
      ref={listRef}
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={style}
      className={`menu-pop glass glass-pop min-w-52 rounded-[14px] p-1 text-ink ${className}`.trim()}
    >
      {items.map((item, i) => {
        if (item.kind === 'divider') return <div key={i} role="separator" className="my-1 h-px bg-separator" />;
        const run = () => {
          onClose(true);
          item.onSelect();
        };
        if (item.kind === 'check') {
          return (
            <button key={i} type="button" role="menuitemcheckbox" aria-checked={item.checked} tabIndex={-1} onClick={run} className={ITEM_CLASS}>
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {item.checked && <Check size={16} aria-hidden="true" className="text-ink" />}
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
            {item.icon && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.hint}
          </button>
        );
      })}
    </div>
  );
}
