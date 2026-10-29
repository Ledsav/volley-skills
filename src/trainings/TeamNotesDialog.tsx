import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Sheet, SheetCancelButton } from '../components/Sheet';
import { Textarea } from '../components/Input';
import { LevelPill } from '../components/LevelPill';
import { listPlayers } from '../players/playersApi';
import { sortRoster } from '../players/rosterSort';
import { getTeam } from '../teams/teamsApi';
import type { Player } from '../types/player';
import type { TeamNotes } from './pdf/buildTrainingPdf';
import { HealthHint } from '../components/HealthHint';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';
import { teamGender } from '../teams/teamGender';

/** What the coach typed, kept by the caller so reopening the step doesn't lose it. */
export interface TeamNotesDraft {
  general: string;
  absent: string[];
  notes: Record<string, string>;
}

interface TeamNotesDialogProps {
  teamId: string;
  date: string;
  initialGeneral: string;
  draft?: TeamNotesDraft;
  onCancel: () => void;
  onConfirm: (notes: TeamNotes, draft: TeamNotesDraft) => void;
}

/**
 * The team step of a calendar session's PDF export: who is expected and what
 * to look at for each player. Names and levels go into the shared PDF.
 */
export function TeamNotesDialog({ teamId, date, initialGeneral, draft, onCancel, onConfirm }: TeamNotesDialogProps) {
  const t = useT();
  const lb = t.labels;
  const m = t.trainings.teamNotes;
  const [teamName, setTeamName] = useState('');
  // No team doc (or one that predates the field) reads as mixed: the paired wording.
  const [gender, setGender] = useState<Gender>('mixed');
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [general, setGeneral] = useState(draft?.general ?? initialGeneral);
  const [absent, setAbsent] = useState<Set<string>>(new Set(draft?.absent ?? []));
  const [notes, setNotes] = useState<Record<string, string>>(draft?.notes ?? {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A roster is small (one team), so read every page.
      const all: Player[] = [];
      let after = null;
      do {
        const page = await listPlayers(teamId, after);
        all.push(...page.players);
        after = page.hasMore ? page.lastDoc : null;
      } while (after);
      const team = await getTeam(teamId);
      if (cancelled) return;
      setTeamName(team?.name ?? '');
      setGender(team ? teamGender(team) : 'mixed');
      setPlayers(sortRoster(all.filter((p) => !p.leftClubAt), 'lineup'));
    })().catch(() => {
      if (!cancelled) setError(m.loadError);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  function toggle(id: string) {
    setAbsent((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    const expected = (players ?? []).filter((p) => !absent.has(p.id));
    onConfirm(
      {
        teamName,
        gender,
        date,
        general,
        players: expected.map((p) => ({
          name: p.fullName,
          position: p.positionCategory === 'TBD' ? '' : lb.position[p.positionCategory](gender),
          level: p.level,
          note: (notes[p.id] ?? '').trim(),
        })),
      },
      { general, absent: [...absent], notes },
    );
  }

  const expectedCount = players ? players.length - players.filter((p) => absent.has(p.id)).length : 0;

  return (
    <Sheet
      title={m.title(teamName)}
      size="lg"
      detent="large"
      onClose={onCancel}
      footer={
        <>
          <SheetCancelButton className="hidden md:inline-flex" />
          <Button variant="primary" onClick={confirm} disabled={!players} className="flex-1 sm:flex-none">
            {m.createPdf}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-callout text-ink-2">
          {m.intro(gender)}
        </p>

        <div>
          <label htmlFor="team-notes-general" className="mb-1 block text-callout font-medium text-ink">
            {m.generalNotes}
          </label>
          <Textarea id="team-notes-general" aria-describedby="team-notes-general-hint" value={general} onChange={(e) => setGeneral(e.target.value)} rows={2} />
          <HealthHint id="team-notes-general-hint" />
        </div>

        {error && (
          <p role="alert" className="text-callout text-red-strong">
            {error}
          </p>
        )}
        {!players && !error && <p className="text-callout text-ink-2">{m.loadingTeam}</p>}

        {players && (
          <div>
            <p className="mb-2 text-callout font-medium text-ink">
              {m.expectedPlayers(gender)} <span className="tabular-nums text-ink-2">({m.expectedCount(expectedCount, players.length)})</span>
            </p>
            <ul aria-label={m.expectedPlayers(gender)} className="rounded-lg bg-surface-2">
              {players.map((p) => {
                const expected = !absent.has(p.id);
                return (
                  <li
                    key={p.id}
                    className="relative p-3 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator first:before:hidden"
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={expected}
                        onChange={() => toggle(p.id)}
                        className="h-5 w-5 shrink-0 accent-[rgb(var(--color-ink))]"
                      />
                      <span className="min-w-0 flex-1 truncate text-headline text-ink">{p.fullName}</span>
                      {p.positionCategory !== 'TBD' && (
                        <span className="text-footnote text-ink-2">{lb.position[p.positionCategory](gender)}</span>
                      )}
                      <LevelPill level={p.level} gender={gender} />
                    </label>
                    {expected && (
                      <Textarea
                        aria-label={m.playerNoteLabel(p.fullName)}
                        aria-describedby="team-notes-player-hint"
                        placeholder={m.playerNotePlaceholder}
                        value={notes[p.id] ?? ''}
                        onChange={(e) => setNotes((current) => ({ ...current, [p.id]: e.target.value }))}
                        rows={1}
                        className="mt-2"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            <HealthHint id="team-notes-player-hint" />
          </div>
        )}
      </div>
    </Sheet>
  );
}
