import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useContextMenu } from '../components/ContextMenu';
import { GroupedList, ListRow } from '../components/GroupedList';
import { LevelPill } from '../components/LevelPill';
import { Menu } from '../components/Menu';
import { useUndoable } from '../components/Notice';
import { PageSkeleton } from '../components/Skeleton';
import { SegmentedControl } from '../components/SegmentedControl';
import { Sheet } from '../components/Sheet';
import { StatTile } from '../components/StatTile';
import { StatusChip } from '../components/StatusChip';
import { SwipeRow } from '../components/SwipeRow';
import { MainAction, Toolbar } from '../components/Toolbar';
import { useSearch } from '../search/SearchProvider';
import { useThemePreference } from '../theme/useTheme';
import type { ThemePreference } from '../theme/theme';
import type { Level } from '../types/player';

// Dev-only page: strings are deliberately not in the i18n catalog.
const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const LONG_OPTIONS = [
  { id: 'a', label: 'Panoramica della squadra' },
  { id: 'b', label: 'Calendario degli allenamenti' },
  { id: 'c', label: 'Test fisici e crescita' },
  { id: 'd', label: 'Partite e statistiche' },
  { id: 'e', label: 'Riconoscimenti di stagione' },
];

interface Sample {
  id: string;
  name: string;
  level: Level | null;
}

const SAMPLES: Sample[] = [
  { id: 's1', name: 'Sample player A', level: 'Beginner' },
  { id: 's2', name: 'Sample player B', level: 'Developing' },
  { id: 's3', name: 'Sample player C', level: 'Advanced' },
  { id: 's4', name: 'Sample player D', level: 'Elite' },
  { id: 's5', name: 'Sample player E', level: null },
];

function SampleRow({ sample, onDelete }: { sample: Sample; onDelete: () => void }) {
  const { targetProps, menu } = useContextMenu({
    label: `${sample.name} actions`,
    items: [
      { kind: 'action', label: 'Open', onSelect: () => {} },
      { kind: 'divider' },
      { kind: 'action', label: 'Delete', danger: true, icon: <Trash2 size={16} aria-hidden="true" />, onSelect: onDelete },
    ],
  });
  return (
    <>
      <ListRow title={sample.name} subtitle="Sample data" trailing={<LevelPill level={sample.level} />} onClick={() => {}} rowProps={targetProps} />
      {menu}
    </>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 mt-8 text-title-3 text-ink">{children}</h2>;
}

export default function UiGallery() {
  const [pref, setPref] = useThemePreference();
  const search = useSearch();
  const [seg, setSeg] = useState('a');
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [rows, setRows] = useState(SAMPLES);
  const [swipeRows, setSwipeRows] = useState(SAMPLES.slice(0, 3));
  const [deleted, setDeleted] = useState(false);
  const undoable = useUndoable();

  const removeWithUndo = (id: string, source: Sample[], set: (rows: Sample[]) => void) => {
    const row = source.find((r) => r.id === id);
    if (!row) return;
    set(source.filter((r) => r.id !== id));
    undoable({
      message: `${row.name} deleted`,
      commit: () => {},
      onUndo: () => set(source),
    });
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <Toolbar
        title="UI gallery"
        actions={
          <Menu
            label="More"
            trigger="⋯"
            items={[
              { kind: 'action', label: 'Sample action', onSelect: () => {} },
              { kind: 'check', label: 'Sample toggle', checked: true, onSelect: () => {} },
            ]}
          />
        }
        mainAction={<MainAction onClick={() => setSheet(true)}>New sample</MainAction>}
      />
      <main className="mx-auto max-w-2xl px-4">
        <h1 className="text-large-title text-ink">UI gallery</h1>
        <p className="mt-1 text-body text-ink-2">Dev-only. Every name below is sample data; nothing is read or written.</p>

        <SectionTitle>Theme</SectionTitle>
        <SegmentedControl label="Theme" options={THEME_OPTIONS} value={pref} onChange={setPref} />

        <SectionTitle>Buttons</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="dangerGhost">Danger ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" size="pill">Pill</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>

        <SectionTitle>Segmented control, long labels</SectionTitle>
        <SegmentedControl label="Sections" semantics="tabs" options={LONG_OPTIONS} value={seg} onChange={setSeg} />

        <SectionTitle>Grouped list with context menu</SectionTitle>
        <p className="mb-2 text-footnote text-ink-2">Right-click, or long-press on a phone.</p>
        <GroupedList header="Sample roster" footer="Sample data only.">
          {rows.map((s) => (
            <SampleRow key={s.id} sample={s} onDelete={() => removeWithUndo(s.id, rows, setRows)} />
          ))}
        </GroupedList>

        <SectionTitle>Swipe rows (phone)</SectionTitle>
        <p className="mb-2 text-footnote text-ink-2">Swipe left on a coarse pointer. A full swipe deletes with undo.</p>
        <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
          {swipeRows.map((s) => (
            <li key={s.id} className="border-b border-separator last:border-b-0">
              <SwipeRow
                trailing={[
                  {
                    label: 'Delete',
                    icon: <Trash2 size={18} aria-hidden="true" />,
                    tone: 'destructive',
                    undoable: true,
                    onAction: () => removeWithUndo(s.id, swipeRows, setSwipeRows),
                  },
                ]}
              >
                <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
                  <span className="text-headline text-ink">{s.name}</span>
                  <LevelPill level={s.level} />
                </div>
              </SwipeRow>
            </li>
          ))}
        </ul>

        <SectionTitle>Level pills</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {(['Beginner', 'Developing', 'Advanced', 'Elite'] as const).map((l) => (
            <LevelPill key={l} level={l} />
          ))}
          <LevelPill level={null} />
        </div>

        <SectionTitle>Sheet, dialog and undo</SectionTitle>
        <GroupedList>
          <ListRow title="Open sheet" subtitle="Drag, flick, or type then close" onClick={() => setSheet(true)} />
          <ListRow title="Open confirm dialog" onClick={() => setConfirm(true)} />
          <ListRow
            title="Delete sample"
            subtitle={deleted ? 'Deleted (pending undo)' : 'Undo for 6 seconds; Ctrl+Z works too'}
            onClick={() => {
              setDeleted(true);
              undoable({
                message: 'Sample deleted',
                commit: () => {},
                onUndo: () => setDeleted(false),
              });
            }}
          />
        </GroupedList>

        <SectionTitle>Shell</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="text-body text-ink underline">
            Open the shell (Today)
          </Link>
          <Button variant="secondary" size="sm" onClick={() => search.open()}>
            Open search palette
          </Button>
        </div>

        <SectionTitle>Stat tiles, chip, skeleton</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Sample average" value="7.4" hint="Sample data" />
          <StatTile label="Sample matches" value="12" />
        </div>
        <div className="mt-3 flex gap-2">
          <StatusChip status="Active" />
          <StatusChip status="Attention" />
          <StatusChip status="Completed" />
        </div>
        <div className="mt-3">
          <PageSkeleton layout="team" label="Loading sample" />
        </div>
        <div className="h-[80vh]" aria-hidden="true" />
      </main>

      {sheet && (
        <Sheet title="Sample sheet" onClose={() => setSheet(false)} guardUnsaved confirm={{ label: 'Done', onConfirm: () => setSheet(false) }}>
          <label className="block text-footnote text-ink-2" htmlFor="gallery-note">
            Sample note
          </label>
          <input id="gallery-note" className="mt-1 w-full rounded-md bg-surface-2 px-3 py-2 text-body text-ink" />
        </Sheet>
      )}
      {confirm && (
        <ConfirmDialog
          title="Delete sample?"
          message="This is a sample confirmation."
          confirmLabel="Delete"
          onConfirm={() => setConfirm(false)}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
