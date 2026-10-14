import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { FIELD_CLASS } from './Input';
import { Tab } from './Tab';

interface SectionTabsProps<T extends string> {
  /** Names the picker and the tablist for screen readers. */
  label: string;
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

/**
 * Page sections: a full-width native picker on phones (underline tabs don't fit a
 * phone-width card), underline tabs from `sm` up. Same sections, same order.
 */
export function SectionTabs<T extends string>({ label, tabs, active, onChange, className = '' }: SectionTabsProps<T>) {
  const id = useId();
  return (
    <div className={className}>
      <div className="relative sm:hidden">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <select
          id={id}
          value={active}
          onChange={(e) => onChange(e.target.value as T)}
          className={`${FIELD_CLASS} min-h-11 w-full cursor-pointer appearance-none pr-10 font-medium`}
        >
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate" aria-hidden="true" />
      </div>
      <div role="tablist" aria-label={label} className="hidden flex-wrap gap-x-4 border-b border-border sm:flex md:gap-x-6">
        {tabs.map((t) => (
          <Tab key={t.id} active={active === t.id} onClick={() => onChange(t.id)}>
            {t.label}
          </Tab>
        ))}
      </div>
    </div>
  );
}
