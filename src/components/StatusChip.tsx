import type { ObjectiveStatus } from '../types/developmentPlan';

export const STATUS_OPTIONS: ObjectiveStatus[] = ['Not started', 'In progress', 'Active', 'Attention', 'Completed'];

const STATUS_CLASS: Record<ObjectiveStatus, string> = {
  Active: 'bg-green/10 text-green',
  'In progress': 'bg-blue/10 text-blue',
  // bg-ink/text-bg, not text-white: `ink` and `bg` both flip between themes,
  // so this stays the one solid, self-inverting chip in light and dark mode.
  Completed: 'bg-ink text-bg',
  'Not started': 'bg-bg text-slate',
  Attention: 'bg-orange/10 text-orange',
};

export function StatusChip({ status }: { status: ObjectiveStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {status}
    </span>
  );
}
