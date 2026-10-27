import { getInitials } from './nameFormat';
import type { Player } from '../types/player';
import { formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

interface PlayerIdentityCardProps {
  player: Player;
  /** The team's grammatical gender, for the position and level wording. */
  gender?: Gender;
}

export function PlayerIdentityCard({ player, gender = 'mixed' }: PlayerIdentityCardProps) {
  const t = useT();
  const lb = t.labels;
  const p = t.players;
  const hasScores = player.avgScore !== null;

  return (
    <section className="flex h-full flex-col gap-5 rounded-lg bg-navy p-5 text-white shadow-card lg:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold">
          {getInitials(player.fullName)}
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-title font-semibold">{player.fullName}</h1>
          <p className="mt-0.5 text-sm text-white/80">
            {player.number ? `#${player.number} · ` : ''}
            {lb.position[player.positionCategory](gender)}
            {player.starting && ` · ${p.shared.starting}`}
          </p>
        </div>
      </div>

      <div className="flex items-end gap-3 border-y border-white/15 py-4">
        <span className="text-4xl font-extrabold tabular-nums leading-none">
          {hasScores ? formatNumber(player.avgScore!, 1) : '—'}
        </span>
        <div className="pb-0.5">
          <p className="text-xs uppercase tracking-wide text-white/60">{p.identity.avgSkillScore}</p>
          {hasScores && player.level ? (
            <span className="mt-1 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
              {lb.level[player.level](gender)}
            </span>
          ) : (
            <span className="mt-1 inline-block text-xs text-white/60">{p.shared.noScores}</span>
          )}
        </div>
      </div>

      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/80">{p.identity.team}</dt>
          <dd className="mt-0.5 font-medium">{player.teamName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/80">{p.identity.ageGroup}</dt>
          <dd className="mt-0.5 font-medium">{player.ageGroup}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/80">{p.identity.season}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{player.season}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/80">{p.identity.dob}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{player.dob || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/80">{p.shared.nationality}</dt>
          <dd className="mt-0.5 font-medium">{player.nationality || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/80">{p.shared.license}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{player.licenseNumber || '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
