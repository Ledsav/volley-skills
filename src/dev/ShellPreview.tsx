import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { AppShell } from '../layout/AppShell';
import { PageChromeProvider } from '../layout/PageChrome';
import { PageContainer } from '../layout/PageContainer';
import { PageHeader } from '../layout/PageHeader';
import { RouteLoadError } from '../layout/RouteErrorBoundary';
import { STRIP_GLASS, stickyTop, TEAM_TABS_H } from '../layout/chromeMetrics';
import { useWindowScrolled } from '../layout/useWindowScrolled';
import { SearchProvider, useSearch } from '../search/SearchProvider';
import { ScoutRoot } from '../matches/scout/ScoutRoot';
import { Button } from '../components/Button';
import { FilterChips } from '../components/Chip';
import { Field, Input, Textarea } from '../components/Input';
import { Menu } from '../components/Menu';
import { SegmentedControl } from '../components/SegmentedControl';
import { Select, SelectField } from '../components/Select';
import { Sheet } from '../components/Sheet';
import { SwitchRow } from '../components/Switch';

// Dev-only page (/dev/preview/shell): the real app shell and shared controls over static content, so the shell,
// sheets, fields and strips can be screenshotted without signing in or a working Firestore emulator.
// `?sheet=1` opens a form sheet, `?palette=1` the search palette, `?error=1` the lazy-route error screen
// (`?error=scout` on the scouting canvas).

const TABS = ['Roster', 'Calendar', 'Matches', 'Stats', 'Development plan', 'Physical testing', 'Settings'].map((label) => ({
  id: label.toLowerCase().replace(/ /g, '-'),
  label,
}));
const CHIPS = ['All', 'Warm-up', 'Serve', 'Reception', 'Attack', 'Block', 'Defence', 'Setting', 'Compound', 'Game'].map((label) => ({
  id: label,
  label,
}));
const NAMES = ['Ursula Ubaldini', 'Nina Orsenigo', 'Ilaria Lanzoni', 'Zoe Albertelli', 'Victoria D’ANGELO', 'Tea Tavernini', 'Dalia Daverio', 'Vera Varennes'];

function PaletteOnMount() {
  const { open } = useSearch();
  useEffect(() => open(), [open]);
  return null;
}

function FormFields() {
  const [on, setOn] = useState(true);
  const [chip, setChip] = useState('All');
  return (
    <div className="flex flex-col gap-4">
      <Field label="Full name">
        <Input placeholder="Name and surname" />
      </Field>
      <Field label="Date of birth">
        <Input type="date" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Position" defaultValue="TBD">
          <option>TBD</option>
          <option>Setter</option>
          <option>Outside</option>
        </SelectField>
        <SelectField label="Shirt size" defaultValue="">
          <option value="">Not set</option>
          <option>M</option>
        </SelectField>
      </div>
      <Field label="Notes">
        <Textarea rows={3} />
      </Field>
      <FilterChips label="Category" options={CHIPS} value={chip} onChange={setChip} />
      <label className="flex min-h-11 items-center gap-3 text-body text-ink">
        <input type="checkbox" defaultChecked /> Starting player
      </label>
      <label className="flex min-h-11 items-center gap-3 text-body text-ink">
        <input type="checkbox" /> Captain
      </label>
      <div className="flex gap-6">
        <label className="flex min-h-11 items-center gap-2 text-body text-ink">
          <input type="radio" name="side" defaultChecked /> Home
        </label>
        <label className="flex min-h-11 items-center gap-2 text-body text-ink">
          <input type="radio" name="side" /> Away
        </label>
      </div>
      <SwitchRow label="AI features" description="Drafting and text scouting" checked={on} onChange={setOn} />
      <Field label="Phone">
        <Input type="tel" />
      </Field>
      <Field label="Email">
        <Input type="email" />
      </Field>
    </div>
  );
}

function Content() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(TABS[0].id);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [chip, setChip] = useState('All');
  const [sheet, setSheet] = useState(params.get('sheet') === '1');
  const scrolled = useWindowScrolled();
  return (
    <PageContainer>
      <PageHeader title="U17" eyebrow="2026-2027 · U17" mainAction={{ label: 'Add player', icon: UserPlus, onSelect: () => setSheet(true) }} className="mb-2" />
      <div
        style={{ top: stickyTop('toolbar'), height: TEAM_TABS_H }}
        className={`sticky z-20 -mx-[var(--page-gutter)] flex items-center px-[var(--page-gutter)] ${scrolled ? STRIP_GLASS : 'bg-bg'}`}
      >
        <SegmentedControl semantics="tabs" label="Sections" options={TABS} value={tab} onChange={setTab} className="w-full md:w-fit" />
      </div>
      <div className="mt-4 flex flex-col gap-6">
        <SegmentedControl label="Scope" options={[{ id: 'mine', label: 'Mine' }, { id: 'all', label: 'All' }]} value={scope} onChange={setScope} className="w-full sm:w-fit" />
        <FilterChips label="Filter by category" options={CHIPS} value={chip} onChange={setChip} />
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_200px]">
          <Input placeholder="Search name, position, number" />
          <Select defaultValue="name" aria-label="Sort">
            <option value="name">Sort: name</option>
            <option value="level">Sort: level</option>
          </Select>
          <Input type="date" aria-label="From" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary">Test connection</Button>
          <Button variant="primary">Save</Button>
          <label className="flex min-h-11 items-center gap-2 text-body text-ink">
            <input type="checkbox" defaultChecked /> Remember on this device
          </label>
          <Menu
            label="Tools"
            trigger="Tools ▾"
            triggerClassName="min-h-11 rounded-md bg-surface-2 px-4 text-callout font-semibold text-ink"
            items={[
              { kind: 'check', label: 'Quick score', checked: true, onSelect: () => {} },
              { kind: 'check', label: 'Auto-select next player', checked: false, onSelect: () => {} },
              { kind: 'divider' },
              { kind: 'action', label: 'Keyboard shortcuts', onSelect: () => {} },
              { kind: 'action', label: 'Exit to match', onSelect: () => {} },
            ]}
          />
        </div>
        <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
          {Array.from({ length: 24 }, (_, i) => (
            <li key={i} className="flex min-h-[60px] items-center gap-3 border-b border-separator px-4 last:border-b-0">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-3 text-footnote font-semibold text-ink-2">
                {NAMES[i % NAMES.length].slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-headline text-ink">{NAMES[i % NAMES.length]}</span>
                <span className="block text-callout text-ink-2">Outside · #{i + 1}</span>
              </span>
              <Button variant="secondary" size="sm">Open</Button>
            </li>
          ))}
        </ul>
      </div>
      {sheet && (
        <Sheet title="Add player" onClose={() => setSheet(false)} confirm={{ label: 'Create', onConfirm: () => setSheet(false) }}>
          <FormFields />
        </Sheet>
      )}
      {params.get('palette') === '1' && <PaletteOnMount />}
    </PageContainer>
  );
}

export default function ShellPreview() {
  const [params] = useSearchParams();
  const error = params.get('error');
  if (error === 'scout') return <ScoutRoot><RouteLoadError /></ScoutRoot>;
  if (error) return <RouteLoadError />;
  return (
    <PageChromeProvider>
      <SearchProvider>
        <AppShell>
          <Content />
        </AppShell>
      </SearchProvider>
    </PageChromeProvider>
  );
}
