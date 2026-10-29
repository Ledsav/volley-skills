import { getInitials } from './nameFormat';
import type { Player } from '../types/player';
import { formatDate, formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
import { LevelPill } from '../components/LevelPill';
import { ageFromDob } from './age';

interface PlayerIdentityCardProps {
  player: Player;
  /** The team's grammatical gender, for the position and level wording. */
  gender?: Gender;
}

/**
 * The player header, built for recognition at a glance: the name, then the jersey number, position and level on
 * one line right under it, the team as a footnote and the skill average beside it. The registration facts that
 * the header doesn't already say follow in one group.
 */
export function PlayerIdentityCard({ player, gender = 'mixed' }: PlayerIdentityCardProps) {
  const t = useT();
  const lb = t.labels;
  const p = t.players;
  const hasScores = player.avgScore !== null;
  const age = ageFromDob(player.dob ?? '');

  // Team and age group are already in the header (and the page's back link), so they are not repeated here.
  const facts: { label: string; value: string; numeric?: boolean; title?: string }[] = [
    {
      label: p.identity.dob,
      value: player.dob ? `${formatDate(player.dob, 'short')}${age !== null ? ` · ${t.teams.roster.age(age)}` : ''}` : '—',
      numeric: true,
      title: player.dob || undefined,
    },
    { label: p.identity.season, value: player.season },
    { label: p.shared.nationality, value: player.nationality || '—' },
    { label: p.shared.license, value: player.licenseNumber || '—' },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-3 text-headline text-ink-2 md:h-16 md:w-16 md:text-title-3"
        >
          {getInitials(player.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-title-1 text-ink">{player.fullName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {player.number != null && (
              <span className="text-title-3 tabular-nums text-ink">
                #{player.number}
              </span>
            )}
            <span className="text-headline text-ink">{lb.position[player.positionCategory](gender)}</span>
            {player.starting && (
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-caption text-ink">{p.shared.starting}</span>
            )}
            {hasScores && player.level && <LevelPill level={player.level} gender={gender} />}
            {/* Phones: the average joins this line, so the name gets the full width and never breaks mid-word. */}
            <span className="text-callout tabular-nums text-ink-2 sm:hidden">
              {hasScores ? `${formatNumber(player.avgScore!, 1)} ${p.identity.avgShort}` : p.shared.noScores}
            </span>
          </p>
          <p className="mt-1 text-footnote text-ink-2">{player.teamName}</p>
        </div>
        <div className="hidden shrink-0 flex-col items-end sm:flex">
          <span className="text-title-2 tabular-nums text-ink">{hasScores ? formatNumber(player.avgScore!, 1) : '—'}</span>
          <span className="text-footnote text-ink-2">{hasScores ? p.identity.avgSkillScore : p.shared.noScores}</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-surface p-4 shadow-card sm:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-caption text-ink-2">{f.label}</dt>
            <dd title={f.title} className={`mt-0.5 break-words text-callout text-ink ${f.numeric ? 'tabular-nums' : ''}`.trim()}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
