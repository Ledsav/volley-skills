import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { LevelPill } from '../components/LevelPill';
import { useContextMenu } from '../components/ContextMenu';
import { SkeletonBlock } from '../components/Skeleton';
import { computeLevel } from '../players/skillMath';
import { useT } from '../i18n/I18nProvider';
import type { Team } from '../types/team';
import { getTeamSummary, type TeamSummary } from './teamsApi';
import { teamGender } from './teamGender';

/** Up to two letters from a team name, for the card monogram. */
function teamMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface TeamCardProps {
  team: Team;
  /** `card` is always a card; `responsive` is a grouped row on phones and a card from `md`. */
  layout: 'card' | 'responsive';
  /** Right-click / long-press menu: Open, Open in new tab. */
  withMenu?: boolean;
}

type Summary = { status: 'pending' } | { status: 'failed' } | { status: 'done'; value: TeamSummary };

export function TeamCard({ team, layout, withMenu = false }: TeamCardProps) {
  const t = useT().teams;
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary>({ status: 'pending' });
  const path = `/teams/${team.id}`;
  const gender = teamGender(team);

  useEffect(() => {
    let cancelled = false;
    getTeamSummary(team.id).then(
      (value) => {
        if (!cancelled) setSummary({ status: 'done', value });
      },
      () => {
        if (!cancelled) setSummary({ status: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [team.id]);

  const { targetProps, menu } = useContextMenu({
    label: t.list.rowMenu(team.name),
    disabled: !withMenu,
    items: [
      { kind: 'action', label: t.list.open, onSelect: () => navigate(path) },
      { kind: 'action', label: t.list.openNewTab, onSelect: () => window.open(path, '_blank', 'noopener') },
    ],
  });

  const responsive = layout === 'responsive';
  const surface = responsive
    ? 'relative min-h-[52px] gap-3 px-4 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden md:min-h-0 md:rounded-lg md:bg-surface md:p-4 md:shadow-card md:before:hidden md:pressable'
    : 'rounded-lg bg-surface p-4 shadow-card pressable';

  return (
    <li className={responsive ? 'md:contents' : undefined}>
      <Link
        to={path}
        {...(withMenu ? targetProps : undefined)}
        className={`flex h-full items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${surface}`}
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-3 text-footnote font-semibold text-ink-2"
        >
          {teamMonogram(team.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col py-2 md:py-0">
          <span className="truncate text-headline text-ink">{team.name}</span>
          <span className="truncate text-footnote tabular-nums text-ink-2">
            {team.ageGroup} · {t.list.season(team.season)}
          </span>
          {summary.status === 'pending' && <SkeletonBlock className="mt-1 h-4 w-24" />}
          {summary.status === 'done' && (
            <span className="mt-1 flex flex-wrap items-center gap-2 text-footnote tabular-nums text-ink-2">
              {t.summary.players(summary.value.players, gender)}
              <LevelPill level={computeLevel(summary.value.avgScore)} gender={gender} />
            </span>
          )}
          {responsive && team.description && (
            <span className="mt-1 line-clamp-2 hidden text-footnote text-ink-2 md:block">{team.description}</span>
          )}
        </span>
        {responsive && <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-3 md:hidden" />}
      </Link>
      {withMenu && menu}
    </li>
  );
}
