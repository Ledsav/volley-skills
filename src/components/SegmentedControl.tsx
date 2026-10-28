import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useReducedMotion } from '../motion/useReducedMotion';

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** `radio` for a single choice, `tabs` when the options switch panels in place. */
  semantics?: 'radio' | 'tabs';
  className?: string;
}

/** iOS-style segmented control: a sliding thumb on a scrollable track that never wraps its labels. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  semantics = 'radio',
  className = '',
}: SegmentedControlProps<T>) {
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const isTabs = semantics === 'tabs';

  useLayoutEffect(() => {
    const el = optionRefs.current.get(value);
    if (!el) return;
    const measure = () => setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    el.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    if (typeof ResizeObserver === 'undefined' || !trackRef.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [value, options]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = options[next].id;
    onChange(id);
    optionRefs.current.get(id)?.focus();
  };

  return (
    <div
      ref={trackRef}
      role={isTabs ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={`relative flex overflow-x-auto whitespace-nowrap rounded-[10px] bg-surface-2 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`.trim()}
    >
      {thumb && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-0.5 left-0 top-0.5 rounded-[8px] bg-[rgb(var(--color-segment-thumb))] shadow-card ${
            reduced ? '' : 'transition-transform duration-300 ease-drawer'
          }`}
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
        />
      )}
      {options.map((o, i) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              if (el) optionRefs.current.set(o.id, el);
              else optionRefs.current.delete(o.id);
            }}
            type="button"
            role={isTabs ? 'tab' : 'radio'}
            {...(isTabs ? { 'aria-selected': selected } : { 'aria-checked': selected })}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative z-10 min-h-11 flex-1 shrink-0 cursor-pointer rounded-[8px] px-3 text-callout font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              selected ? 'text-ink' : 'text-ink-2'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
