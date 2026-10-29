import { getInitials } from './nameFormat';
import type { Player } from '../types/player';
import { formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
import { LevelPill } from '../components/LevelPill';

interface PlayerIdentityCardProps {
  player: Player;
  /** The team's grammatical gender, for the position and level wording. */
  gender?: Gender;
}

/** The player header: avatar, name, subline, average and level, then the registration facts in one group. */
export function PlayerIdentityCard({ player, gender = 'mixed' }: PlayerIdentityCardProps) {
  const t = useT();
  const lb = t.labels;
  const p = t.players;
  const hasScores = player.avgScore !== null;

  const facts: { label: string; value: string; numeric?: boolean }[] = [
    { label: p.identity.team, value: player.teamName },
    { label: p.identity.ageGroup, value: player.ageGroup },
    { label: p.identity.season, value: player.season, numeric: true },
    { label: p.identity.dob, value: player.dob || '—', numeric: true },
    { label: p.shared.nationality, value: player.nationality || '—' },
    { label: p.shared.license, value: player.licenseNumber || '—', numeric: true },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-surface-3 text-title-3 text-ink-2 md:h-16 md:w-16">
          {getInitials(player.fullName)}
        </div>
        <div className="min-w-0 md:flex-1">
          <h1 className="break-words text-title-1 text-ink">{player.fullName}</h1>
          <p className="mt-0.5 text-callout tabular-nums text-ink-2">
            {player.number ? `#${player.number} · ` : ''}
            {lb.position[player.positionCategory](gender)}
            {player.starting && ` · ${p.shared.starting}`}
          </p>
          <p className="text-footnote text-ink-2">{player.teamName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1 md:items-end">
          <span className="text-title-2 tabular-nums text-ink">{hasScores ? formatNumber(player.avgScore!, 1) : '—'}</span>
          <p className="text-footnote text-ink-2">{p.identity.avgSkillScore}</p>
          {hasScores && player.level ? (
            <LevelPill level={player.level} gender={gender} />
          ) : (
            <span className="text-footnote text-ink-2">{p.shared.noScores}</span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-surface p-4 shadow-card sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-caption text-ink-2">{f.label}</dt>
            <dd className={`mt-0.5 break-words text-callout text-ink ${f.numeric ? 'tabular-nums' : ''}`.trim()}>{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
