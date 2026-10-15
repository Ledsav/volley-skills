// src/awards/AwardsPresent.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardModel } from './card/drawAwardCard';
import type { StoryDeps } from './card/drawSlide';
import { PRESET_PALETTES } from './palette';
import { buildStory } from './story/buildStory';
import { AwardsPresent } from './AwardsPresent';

const model = (key: string, name: string): CardModel => ({ key, awardTitle: key, name, number: 7, statLine: null, footer: '', teamName: 'U17', clubName: '', note: '' });
const deps: StoryDeps = {
  palette: PRESET_PALETTES[0],
  cards: [{ key: 'server', title: 'Best server', model: model('server', 'Ana L.') }, { key: 'mvp', title: 'MVP', model: model('mvp', 'Bea S.') }],
  artFor: () => ({ photo: null, cutout: null, background: null }),
  clubName: '',
};
const stat = { id: 'record' as const, kicker: 'This season', big: 7, bigSuffix: '', caption: 'wins out of 10 matches', detail: null };
const story = buildStory({ introTitle: 'Season 2026-27', teamName: 'U17', stats: [stat], awardCount: 2, includeStory: true });
const awardsOnly = buildStory({ introTitle: '', teamName: '', stats: [], awardCount: 2, includeStory: false });

describe('AwardsPresent', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('announces story slides, then award steps, with keyboard navigation', () => {
    render(<AwardsPresent slides={story} deps={deps} onExit={vi.fn()} />);
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('Season 2026-27 — U17');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(live).toHaveTextContent('This season: 7 wins out of 10 matches');
    fireEvent.keyDown(window, { key: ' ' });
    expect(live).toHaveTextContent('Best server');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(live).toHaveTextContent('Best server: Ana L.');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(live).not.toHaveTextContent('Ana L.');
  });

  it('ends on the summary, stays there, and Escape exits', () => {
    const onExit = vi.fn();
    render(<AwardsPresent slides={awardsOnly} deps={deps} onExit={onExit} />);
    for (let i = 0; i < 20; i++) fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('Winners: Best server — Ana L., MVP — Bea S.');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  it('shows one progress segment per scene and fills them as you advance', () => {
    const { container } = render(<AwardsPresent slides={story} deps={deps} onExit={vi.fn()} />);
    const bar = screen.getByRole('progressbar', { name: 'Presentation progress' });
    expect(bar.children).toHaveLength(5); // intro, stat, 2 awards, summary
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(container.querySelector('canvas')!.className).toContain('object-contain');
  });

  it('releases a wake lock that resolves after unmount', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    let resolve!: (l: { release: () => Promise<void> }) => void;
    const request = vi.fn(() => new Promise<{ release: () => Promise<void> }>((r) => { resolve = r; }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const { unmount } = render(<AwardsPresent slides={awardsOnly} deps={deps} onExit={vi.fn()} />);
    unmount();
    resolve({ release });
    await Promise.resolve();
    await Promise.resolve();
    expect(release).toHaveBeenCalled();
    // @ts-expect-error test cleanup
    delete navigator.wakeLock;
  });

  it('never shows runners-up (only winners are in cards)', () => {
    render(<AwardsPresent slides={awardsOnly} deps={deps} onExit={vi.fn()} />);
    expect(screen.queryByText(/Runners-up/)).toBeNull();
  });
});
