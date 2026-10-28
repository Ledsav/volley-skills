import type { Level } from '../types/player';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

const LEVEL_PILL_CLASS: Record<Level, string> = {
  Beginner: 'bg-red-tint text-red-strong',
  Developing: 'bg-orange-tint text-orange-strong',
  Advanced: 'bg-blue-tint text-blue-strong',
  Elite: 'bg-green-tint text-green-strong',
};

export function levelPillClass(level: Level | null): string {
  return level ? LEVEL_PILL_CLASS[level] : 'bg-surface-2 text-ink-2';
}

export function LevelPill({ level, className = '', gender = 'mixed' }: { level: Level | null; className?: string; gender?: Gender }) {
  const lb = useT().labels;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption tabular-nums ${levelPillClass(level)} ${className}`.trim()}
    >
      {level ? lb.level[level](gender) : '—'}
    </span>
  );
}
