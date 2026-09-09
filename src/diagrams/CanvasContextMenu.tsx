import { useEffect, useRef } from 'react';

export interface MenuAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface Props {
  x: number;
  y: number;
  actions: MenuAction[];
  onClose: () => void;
}

/**
 * A dumb, fixed-position context menu. It knows nothing about the editor: the
 * caller supplies the actions and decides what each one does. It closes itself
 * on an outside pointerdown, Escape, or any window scroll/resize.
 */
export function CanvasContextMenu({ x, y, actions, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-40 rounded-md border border-border bg-surface py-1 shadow-pop"
      style={{ left: x, top: y }}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          disabled={action.disabled}
          onClick={() => {
            action.onSelect();
            onClose();
          }}
          className="flex min-h-9 w-full items-center px-3 text-left text-sm text-ink hover:bg-bg disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
