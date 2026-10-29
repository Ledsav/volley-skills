import { MoreHorizontal, Pencil, PenTool, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useContextMenu } from '../components/ContextMenu';
import { Menu, type MenuItem } from '../components/Menu';
import { SwipeRow } from '../components/SwipeRow';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { useT } from '../i18n/I18nProvider';
import type { Exercise } from '../types/exercise';

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/**
 * One library entry. Phone: a grouped-list row. From `md`: a gallery card led by the diagram.
 * The row opens the edit sheet; the kebab, the thumbnail and the context menu never do.
 */
export function ExerciseRow({
  exercise,
  onOpen,
  onDelete,
}: {
  exercise: Exercise;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const p = t.exercises.page;
  const navigate = useNavigate();
  const items: MenuItem[] = [
    { kind: 'action', label: p.edit, icon: <Pencil size={16} aria-hidden="true" />, onSelect: onOpen },
    {
      kind: 'action',
      label: t.exercises.form.editDiagrams,
      icon: <PenTool size={16} aria-hidden="true" />,
      onSelect: () => navigate(`/exercises/${exercise.id}/diagram`),
    },
    { kind: 'action', label: t.common.delete, danger: true, icon: <Trash2 size={16} aria-hidden="true" />, onSelect: onDelete },
  ];
  const label = p.rowMenu(exercise.name);
  const { targetProps, menu } = useContextMenu({ label, items });

  return (
    <li className="relative before:absolute before:left-4 before:right-0 before:top-0 before:z-10 before:h-px before:bg-separator first:before:hidden md:overflow-hidden md:rounded-lg md:bg-surface md:shadow-card md:before:hidden">
      <SwipeRow trailing={[{ label: t.common.delete, tone: 'destructive', undoable: true, onAction: onDelete }]}>
        <>
          <div
            role="button"
            tabIndex={0}
            {...targetProps}
            onClick={onOpen}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpen();
              }
            }}
            className="flex min-h-[72px] cursor-pointer gap-3 px-4 py-3 text-left hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus md:min-h-0 md:flex-col md:gap-0 md:p-0"
          >
            <div
              onClick={stop}
              onKeyDown={stop}
              className="shrink-0 self-center empty:hidden md:aspect-[4/3] md:w-full md:self-auto md:overflow-hidden md:bg-surface-2 md:empty:block"
            >
              <DiagramThumbnail
                exerciseId={exercise.id}
                className="block aspect-square w-16 shrink-0 overflow-hidden rounded-md bg-surface-2 md:aspect-auto md:h-full md:w-full md:rounded-none"
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1 md:items-start md:p-3">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-headline text-ink [overflow-wrap:anywhere]">{exercise.name}</p>
                <p className="text-footnote text-ink-2">
                  {t.labels.exerciseCategory[exercise.category]}
                  {exercise.minPlayers ? <span className="tabular-nums"> · {t.trainings.playersNote.min(exercise.minPlayers)}</span> : null}
                </p>
                {exercise.description && (
                  <p className="mt-1 line-clamp-2 text-footnote text-ink-2 md:line-clamp-1">{exercise.description}</p>
                )}
              </div>
              <span onClick={stop} onKeyDown={stop} className="-mr-2 shrink-0 md:-mt-1">
                <Menu
                  label={label}
                  trigger={<MoreHorizontal size={20} aria-hidden="true" />}
                  triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3"
                  items={items}
                />
              </span>
            </div>
          </div>
          {menu}
        </>
      </SwipeRow>
    </li>
  );
}
