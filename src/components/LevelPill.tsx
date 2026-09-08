import type { Level } from '../types/player';

const LEVEL_PILL_CLASS: Record<Level, string> = {
  Beginner: 'bg-red/10 text-red',
  Developing: 'bg-orange/10 text-orange',
  Advanced: 'bg-blue/10 text-blue',
  Elite: 'bg-green/10 text-green',
};

export function levelPillClass(level: Level | null): string {
  return level ? LEVEL_PILL_CLASS[level] : 'bg-bg text-slate';
}

export function LevelPill({ level, className = '' }: { level: Level | null; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${levelPillClass(level)} ${className}`.trim()}
    >
      {level ?? '—'}
    </span>
  );
}
