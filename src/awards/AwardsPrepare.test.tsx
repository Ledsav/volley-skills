import { fireEvent, render, screen, within } from '@testing-library/react';
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
    includeStory: true, onIncludeStory: vi.fn(), storyLabel: 'Include season story', colorsFor: () => slideColors(PRESET_PALETTES[0], 0), photoAllowed: () => true,
    hasBackground: false, onBackground: vi.fn(), artFor: () => ({ photo: null, cutout: null, background: null }), photos: new Map(), onPhoto: vi.fn(), cardFor: () => null,
    onAction: vi.fn(), onPresent: vi.fn(), onExportAll: vi.fn(), onExportOne: vi.fn(), onClose: vi.fn(), ...over,
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
    fireEvent.click(within(row).getByRole('checkbox', { name: 'Hide' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Add award' }));
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
    expect(screen.getByRole('button', { name: /Export cards/ })).toBeDisabled();
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
    fireEvent.change(screen.getByLabelText('Palette'), { target: { value: 'wrapped' } });
    expect(p.onPalettePrefs).toHaveBeenCalledWith({ selectedId: 'wrapped', custom: [] });
    fireEvent.click(screen.getByLabelText('Include season story'));
    expect(p.onIncludeStory).toHaveBeenCalledWith(false);
  });

  it('saves a new custom palette and selects it', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'New palette' }));
    fireEvent.change(screen.getByLabelText('Palette name'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    const calls = vi.mocked(p.onPalettePrefs).mock.calls;
    const prefs = calls[calls.length - 1][0];
    expect(prefs.custom).toHaveLength(1);
    expect(prefs.selectedId).toBe(prefs.custom[0].id);
  });

  it('disables photo controls for a winner without consent and says why', () => {
    setup({ photoAllowed: () => false });
    expect(screen.getAllByText('No photo consent on file — the card shows the jersey number.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Add photo')).not.toBeInTheDocument();
  });
});
