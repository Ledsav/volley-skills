import type { Level } from '../types/player';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

const LEVEL_PILL_CLASS: Record<Level, string> = {
  Beginner: 'bg-red/10 text-red-strong',
  Developing: 'bg-orange/10 text-orange-strong',
  Advanced: 'bg-blue/10 text-blue-strong',
  Elite: 'bg-green/10 text-green-strong',
};

export function levelPillClass(level: Level | null): string {
  return level ? LEVEL_PILL_CLASS[level] : 'bg-bg text-slate';
}

export function LevelPill({ level, className = '', gender = 'mixed' }: { level: Level | null; className?: string; gender?: Gender }) {
  const lb = useT().labels;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${levelPillClass(level)} ${className}`.trim()}
    >
      {level ? lb.level[level](gender) : '—'}
    </span>
  );
}
