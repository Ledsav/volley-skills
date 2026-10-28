import { SegmentedControl } from './SegmentedControl';

interface SectionTabsProps<T extends string> {
  /** Names the tablist for screen readers. */
  label: string;
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

/** Page sections as a segmented control at every width (it scrolls sideways when the labels don't fit). */
export function SectionTabs<T extends string>({ label, tabs, active, onChange, className = '' }: SectionTabsProps<T>) {
  return <SegmentedControl semantics="tabs" label={label} options={tabs} value={active} onChange={onChange} className={className} />;
}
