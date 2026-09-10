import { getInitials } from './nameFormat';
import { POSITION_CATEGORIES, type Player } from '../types/player';

const POSITION_LABELS = Object.fromEntries(POSITION_CATEGORIES.map((c) => [c.value, c.label]));

interface PlayerIdentityCardProps {
  player: Player;
}

export function PlayerIdentityCard({ player }: PlayerIdentityCardProps) {
  const hasScores = player.avgScore !== null;

  return (
    <section className="flex h-full flex-col gap-5 rounded-lg bg-navy p-5 text-white shadow-card lg:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold">
          {getInitials(player.fullName)}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.01em]">{player.fullName}</h1>
          <p className="mt-0.5 text-sm text-white/70">
            {player.number ? `#${player.number} · ` : ''}
            {POSITION_LABELS[player.positionCategory]}
            {player.starting && ' · Starting'}
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3 border-y border-white/15 py-4">
        <span className="text-4xl font-extrabold tabular-nums leading-none">
          {hasScores ? player.avgScore!.toFixed(1) : '—'}
        </span>
        <div className="pb-0.5">
          <p className="text-xs uppercase tracking-wide text-white/60">Avg skill score</p>
          {hasScores && player.level ? (
            <span className="mt-1 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
              {player.level}
            </span>
          ) : (
            <span className="mt-1 inline-block text-xs text-white/60">No scores yet</span>
          )}
        </div>
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Team</dt>
          <dd className="mt-0.5 font-medium">{player.teamName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Age group</dt>
          <dd className="mt-0.5 font-medium">{player.ageGroup}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Season</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{player.season}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Date of birth</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{player.dob || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">Nationality</dt>
          <dd className="mt-0.5 font-medium">{player.nationality || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/50">License</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{player.licenseNumber || '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
