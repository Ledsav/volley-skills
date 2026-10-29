import { FileDown, FolderOpen, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useContextMenu } from '../components/ContextMenu';
import { Menu, type MenuItem } from '../components/Menu';
import { SwipeRow } from '../components/SwipeRow';
import { useT } from '../i18n/I18nProvider';
import type { Training } from '../types/training';

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/** One training in the library: opens the plan; the kebab and the context menu offer Open, Edit, Export PDF, Delete. */
export function TrainingRow({
  training,
  onOpen,
  onEdit,
  onExportPdf,
  onDelete,
}: {
  training: Training;
  onOpen: () => void;
  onEdit: () => void;
  onExportPdf: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const p = t.trainings.page;
  const items: MenuItem[] = [
    { kind: 'action', label: p.open, icon: <FolderOpen size={16} aria-hidden="true" />, onSelect: onOpen },
    { kind: 'action', label: p.edit, icon: <Pencil size={16} aria-hidden="true" />, onSelect: onEdit },
    { kind: 'action', label: p.exportPdf, icon: <FileDown size={16} aria-hidden="true" />, onSelect: onExportPdf },
    { kind: 'action', label: p.delete, danger: true, icon: <Trash2 size={16} aria-hidden="true" />, onSelect: onDelete },
  ];
  const label = p.rowMenu(training.businessId);
  const { targetProps, menu } = useContextMenu({ label, items });

  return (
    <li className="relative before:absolute before:left-4 before:right-0 before:top-0 before:z-10 before:h-px before:bg-separator first:before:hidden">
      <SwipeRow trailing={[{ label: p.delete, tone: 'destructive', undoable: true, onAction: onDelete }]}>
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
            className="flex min-h-[60px] cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className="shrink-0 text-callout tabular-nums text-ink-2">{training.businessId}</span>
                <span className="min-w-0 truncate text-headline text-ink">{training.name}</span>
              </p>
              <p className="text-footnote tabular-nums text-ink-2">
                {p.summary(
                  training.ageGroupTarget || '—',
                  training.exercises.length,
                  training.exercises.reduce((s, e) => s + e.durationMinutes, 0),
                )}
              </p>
            </div>
            <span onClick={stop} onKeyDown={stop} className="-mr-2 shrink-0">
              <Menu
                label={label}
                trigger={<MoreHorizontal size={20} aria-hidden="true" />}
                triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-3"
                items={items}
              />
            </span>
          </div>
          {menu}
        </>
      </SwipeRow>
    </li>
  );
}
