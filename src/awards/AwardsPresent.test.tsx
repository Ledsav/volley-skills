import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESETS } from './card/cardTheme';
import type { CardModel } from './card/drawAwardCard';
import { AwardsPresent } from './AwardsPresent';

const model = (key: string, name: string): CardModel => ({ key, awardTitle: key, name, number: 7, statLine: null, footer: '', teamName: 'U17', note: '' });
const cards = [
  { key: 'server', title: 'Best server', model: model('server', 'Ana L.') },
  { key: 'mvp', title: 'MVP', model: model('mvp', 'Bea S.') },
];

describe('AwardsPresent', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('announces the current step for screen readers and advances with keys', () => {
    render(<AwardsPresent cards={cards} theme={PRESETS[0]} artFor={() => ({ photo: null, background: null })} onExit={vi.fn()} />);
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('Best server');
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(live).toHaveTextContent('Best server: Ana L.');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(live).not.toHaveTextContent('Ana L.');
  });

  it('final slide lists all winners; Escape exits', () => {
    const onExit = vi.fn();
    render(<AwardsPresent cards={cards} theme={PRESETS[0]} artFor={() => ({ photo: null, background: null })} onExit={onExit} />);
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Winners' })).toBeInTheDocument();
    expect(screen.getByText('Ana L.')).toBeInTheDocument();
    expect(screen.getByText('Bea S.')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  it('never shows runners-up (only winners are in cards)', () => {
    render(<AwardsPresent cards={cards} theme={PRESETS[0]} artFor={() => ({ photo: null, background: null })} onExit={vi.fn()} />);
    expect(screen.queryByText(/Runners-up/)).toBeNull();
  });
});
