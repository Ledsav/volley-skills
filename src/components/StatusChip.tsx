import type { ObjectiveStatus } from '../types/developmentPlan';
import { useT } from '../i18n/I18nProvider';

export const STATUS_OPTIONS: ObjectiveStatus[] = ['Not started', 'In progress', 'Active', 'Attention', 'Completed'];

const STATUS_CLASS: Record<ObjectiveStatus, string> = {
  Active: 'bg-green-tint text-green-strong',
  'In progress': 'bg-blue-tint text-blue-strong',
  // bg-ink/text-on-ink: both flip between themes, so this stays the one solid chip.
  Completed: 'bg-ink text-on-ink',
  'Not started': 'bg-surface-2 text-ink-2',
  Attention: 'bg-orange-tint text-orange-strong',
};

export function StatusChip({ status }: { status: ObjectiveStatus }) {
  const lb = useT().labels;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-caption ${STATUS_CLASS[status]}`}>
      {lb.objectiveStatus[status]}
    </span>
  );
}
