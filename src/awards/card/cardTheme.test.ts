import { afterEach, describe, expect, it } from 'vitest';
import { PRESETS, readThemePrefs, themeFromPrefs, writeThemePrefs } from './cardTheme';

describe('cardTheme', () => {
  afterEach(() => localStorage.clear());

  it('has the four presets', () => {
    expect(PRESETS.map((t) => t.id)).toEqual(['navy', 'gold', 'court', 'light']);
  });

  it('defaults to navy, persists, applies custom colours', () => {
    expect(readThemePrefs()).toEqual({ presetId: 'navy', custom: null });
    writeThemePrefs({ presetId: 'gold', custom: { from: '#000000', to: '#ff0000' } });
    const prefs = readThemePrefs();
    expect(themeFromPrefs(prefs)).toMatchObject({ id: 'gold', bgFrom: '#000000', bgTo: '#ff0000' });
  });

  it('ignores corrupt storage and invalid colours', () => {
    localStorage.setItem('vcb.awards.theme', '{bad json');
    expect(readThemePrefs()).toEqual({ presetId: 'navy', custom: null });
    localStorage.setItem('vcb.awards.theme', JSON.stringify({ presetId: 'nope', custom: { from: 'red;}', to: '#fff' } }));
    expect(readThemePrefs()).toEqual({ presetId: 'navy', custom: null });
  });
});
