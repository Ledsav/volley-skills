import type { ObjectiveStatus } from '../types/developmentPlan';

export const STATUS_OPTIONS: ObjectiveStatus[] = ['Not started', 'In progress', 'Active', 'Attention', 'Completed'];

const STATUS_CLASS: Record<ObjectiveStatus, string> = {
  Active: 'bg-green/10 text-green',
  'In progress': 'bg-blue/10 text-blue',
  Completed: 'bg-ink text-white',
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
