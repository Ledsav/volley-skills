import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedAward } from './resolveAwards';
import { AwardsPrepare, type AwardsPrepareProps } from './AwardsPrepare';
import { PRESET_PALETTES, slideColors } from './palette';

const ana = { playerId: 'a', name: 'Ana Lopez', number: 7, current: true };
const bea = { playerId: 'b', name: 'Bea Smit', number: 9, current: true };
const award = (over: Partial<ResolvedAward>): ResolvedAward => ({
  key: 'attacker', title: 'Best attacker', kind: 'stats', winner: ana, statLine: '+40% att. eff. · 40 att.',
  suggested: { playerId: 'a', value: 0.4, display: '+40% att. eff.', attempts: 40, rank: 1 },
  runnersUp: [{ playerId: 'b', value: 0.3, display: '+30% att. eff.', attempts: 33, rank: 2 }],
  overridden: false, hidden: false, note: '', ...over,
});

function setup(over: Partial<AwardsPrepareProps> = {}) {
  const props: AwardsPrepareProps = {
    heading: 'Season 2026–27', awards: [award({}), award({ key: 'mvp', title: 'MVP' })], people: [ana, bea], saveState: 'saved',
    nameStyle: 'firstInitial', onNameStyle: vi.fn(), palettePrefs: { selectedId: 'navy', custom: [] }, onPalettePrefs: vi.fn(),
    includeStory: true, onIncludeStory: vi.fn(), storyLabel: 'Include season story', colorsFor: () => slideColors(PRESET_PALETTES[0], 0), photoAllowed: () => true, branding: { clubLogo: null, sponsors: [], mono: true }, onClubLogo: vi.fn(), onAddSponsors: vi.fn(), onRemoveSponsor: vi.fn(), onLogosMono: vi.fn(), cutouts: new Map(), onCutout: vi.fn().mockResolvedValue(undefined),
    hasBackground: false, onBackground: vi.fn(), artFor: () => ({ photo: null, cutout: null, background: null }), photos: new Map(), onPhoto: vi.fn(), cardFor: () => null,
    onAction: vi.fn(), onPresent: vi.fn(), onExportAll: vi.fn(), onExportOne: vi.fn(), onExportSummary: vi.fn(), onRecordVideo: vi.fn(), videoAvailable: true, onClose: vi.fn(), ...over,
  };
  render(<AwardsPrepare {...props} />);
  return props;
}

describe('AwardsPrepare', () => {
  it('lists awards with suggested winner and runners-up', () => {
    setup();
    const row = screen.getByRole('region', { name: 'Best attacker' });
    expect(within(row).getByText('+40% att. eff. · 40 att.')).toBeInTheDocument();
    expect(within(row).getByText(/Runners-up: #9 Bea Smit/)).toBeInTheDocument();
  });

  it('picking a winner and hiding dispatch actions', () => {
    const p = setup();
    const row = screen.getByRole('region', { name: 'Best attacker' });
    fireEvent.change(within(row).getByLabelText('Winner'), { target: { value: 'b' } });
    expect(p.onAction).toHaveBeenCalledWith({ type: 'pick', key: 'attacker', playerId: 'b' });
    fireEvent.change(within(row).getByLabelText('Winner'), { target: { value: '' } });
    expect(p.onAction).toHaveBeenCalledWith({ type: 'pick', key: 'attacker', playerId: null });
    fireEvent.click(within(row).getByRole('switch', { name: 'Hide' }));
    expect(p.onAction).toHaveBeenCalledWith({ type: 'hide', key: 'attacker', hidden: true });
  });

  it('shows the stats suggestion when overridden', () => {
    setup({ awards: [award({ winner: bea, overridden: true, statLine: null })] });
    expect(screen.getByText('Stats suggest: #7 Ana Lopez')).toBeInTheDocument();
  });

  it('reorders with buttons; first cannot move up', () => {
    const p = setup();
    const first = screen.getByRole('region', { name: 'Best attacker' });
    expect(within(first).getByRole('button', { name: 'Move Best attacker up' })).toBeDisabled();
    fireEvent.click(within(first).getByRole('button', { name: 'Move Best attacker down' }));
    expect(p.onAction).toHaveBeenCalledWith({ type: 'move', key: 'attacker', dir: 1 });
  });

  it('adds a custom award; limit of 5', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Custom award' }));
    fireEvent.change(screen.getByLabelText('Award title'), { target: { value: 'Spirit of the team' } });
    fireEvent.change(screen.getByLabelText('Player'), { target: { value: 'b' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add award' }));
    expect(p.onAction).toHaveBeenCalledWith({ type: 'addCustom', title: 'Spirit of the team', playerId: 'b', note: '' });
  });

  it('disables custom award when 5 exist', () => {
    const customs = Array.from({ length: 5 }, (_, i) => award({ key: `c${i}`, kind: 'custom', title: `C${i}` }));
    setup({ awards: customs });
    expect(screen.getByRole('button', { name: '+ Custom award' })).toBeDisabled();
  });

  it('disables present and export with a hint when no winners', () => {
    setup({ awards: [award({ winner: null, suggested: null, runnersUp: [] })] });
    expect(screen.getByRole('button', { name: /Present/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    expect(screen.getByText(/Pick at least one winner/)).toBeInTheDocument();
  });

  it('shows a surfaced error as an alert', () => {
    setup({ notice: 'Could not export the cards. Please try again.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not export');
  });

  it('save indicator and present', () => {
    const p = setup({ saveState: 'offline' });
    expect(screen.getByText('Offline — will sync')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Present/ }));
    expect(p.onPresent).toHaveBeenCalled();
  });

  it('switches palette and toggles the story', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    fireEvent.change(screen.getByLabelText('Palette'), { target: { value: 'wrapped' } });
    expect(p.onPalettePrefs).toHaveBeenCalledWith({ selectedId: 'wrapped', custom: [] });
    fireEvent.click(screen.getByLabelText('Include season story'));
    expect(p.onIncludeStory).toHaveBeenCalledWith(false);
  });

  it('saves a new custom palette and selects it', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'New palette' }));
    fireEvent.change(screen.getByLabelText('Palette name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    const calls = vi.mocked(p.onPalettePrefs).mock.calls;
    const prefs = calls[calls.length - 1][0];
    expect(prefs.custom).toHaveLength(1);
    expect(prefs.selectedId).toBe(prefs.custom[0].id);
  });

  it('warns not to use photos of players as the background image', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText("Don't use photos that show players.")).toBeInTheDocument();
  });

  it('disables photo controls for a winner without consent and says why', () => {
    setup({ photoAllowed: () => false });
    fireEvent.click(screen.getByRole('tab', { name: 'Photos' }));
    expect(screen.getAllByText('No photo consent on file — the card shows the jersey number.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Add photo')).not.toBeInTheDocument();
  });

  it('offers background removal for a consented photo and shows progress, then an error on failure', async () => {
    const onCutout = vi.fn().mockRejectedValue(new Error('x'));
    setup({ photos: new Map([['attacker', document.createElement('canvas')]]), onCutout });
    fireEvent.click(screen.getByRole('tab', { name: 'Photos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove background' }));
    expect(screen.getByText('Preparing on this device…')).toBeInTheDocument();
    expect(await screen.findByText('Could not remove the background. The original photo is kept.')).toBeInTheDocument();
    expect(onCutout).toHaveBeenCalledWith('attacker', true);
  });

  it('export menu offers cards, summary and video (video disabled when unsupported)', () => {
    const p = setup({ videoAvailable: false });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Summary card/ }));
    expect(p.onExportSummary).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const video = screen.getByRole('menuitem', { name: /Video export isn't supported in this browser/ });
    expect(video).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(video);
    expect(p.onRecordVideo).not.toHaveBeenCalled();
  });

  it('branding: uploads a club logo and sponsor logos, removes one, and toggles original colours', () => {
    const logo = document.createElement('canvas');
    const p = setup({ branding: { clubLogo: null, sponsors: [logo, logo], mono: true } });
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const file = new File(['x'], 'l.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Club logo'), { target: { files: [file] } });
    expect(p.onClubLogo).toHaveBeenCalledWith(file);
    fireEvent.change(screen.getByLabelText('Add sponsor logos'), { target: { files: [file, file] } });
    expect(p.onAddSponsors).toHaveBeenCalledWith([file, file]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove sponsor 2' }));
    expect(p.onRemoveSponsor).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText('Logos in original colours'));
    expect(p.onLogosMono).toHaveBeenCalledWith(false);
  });

  it('branding: stops adding sponsors at six', () => {
    const logo = document.createElement('canvas');
    setup({ branding: { clubLogo: logo, sponsors: Array(6).fill(logo), mono: true } });
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByLabelText('Add sponsor logos')).toBeDisabled();
    expect(screen.getByText('Up to 6 sponsors')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove club logo' })).toBeInTheDocument();
  });

  it('is split into Choose, Photos and Preview, starting on Choose', () => {
    setup();
    const tabs = within(screen.getByRole('tablist', { name: 'Award steps' })).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Choose' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Best attacker' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Palette')).toBeNull();
  });

  it('a running cut-out survives a step change', async () => {
    let resolve!: () => void;
    const onCutout = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    setup({ photos: new Map([['attacker', document.createElement('canvas')]]), onCutout });
    fireEvent.click(screen.getByRole('tab', { name: 'Photos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove background' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Photos' }));
    expect(screen.getByText('Preparing on this device…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove background' })).toBeDisabled();
    await act(async () => { resolve(); });
    expect(screen.queryByText('Preparing on this device…')).toBeNull();
    expect(onCutout).toHaveBeenCalledTimes(1);
    expect(onCutout).toHaveBeenCalledWith('attacker', true);
  });

  it('Cancel on the custom award sheet after typing asks to discard', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Custom award' }));
    const sheet = screen.getByRole('dialog');
    fireEvent.change(within(sheet).getByLabelText('Award title'), { target: { value: 'Spirit' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Discard changes?');
  });

  it('Preview shows each card with its PNG, hidden awards included', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const model = (key: string) => ({ key, awardTitle: key, name: 'Ana L.', number: 7, statLine: null, footer: '', teamName: 'U17', clubName: '', note: '' });
    const p = setup({ awards: [award({}), award({ key: 'mvp', title: 'MVP', hidden: true })], cardFor: (a) => model(a.key) });
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    const png = screen.getAllByRole('button', { name: 'PNG' });
    expect(png).toHaveLength(2);
    fireEvent.click(png[0]);
    expect(p.onExportOne).toHaveBeenCalledWith('attacker');
  });
});
