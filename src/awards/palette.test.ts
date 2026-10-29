// src/awards/palette.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import {
  PRESET_PALETTES, allPalettes, contrast, isValidPalette, readPalettePrefs, selectedPalette, slideColors, writePalettePrefs, type Palette,
} from './palette';

const p = (colors: string[]): Palette => ({ id: 'x', name: 'X', colors });

describe('palette', () => {
  afterEach(() => localStorage.clear());

  it('computes WCAG contrast', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('cycles background and takes the accent two colours later', () => {
    const pal = p(['#111111', '#222222', '#FFFFFF', '#EEEEEE']);
    expect(slideColors(pal, 0).bg).toBe('#111111');
    expect(slideColors(pal, 0).accent).toBe('#FFFFFF');
    expect(slideColors(pal, 5).bg).toBe('#222222');
  });

  it('picks white text on dark and ink text on light backgrounds', () => {
    const pal = p(['#000000', '#FFFFFF', '#000000', '#FFFFFF']);
    expect(slideColors(pal, 0).text).toBe('#FFFFFF');
    expect(slideColors(pal, 1).text).toBe('#0F172A');
  });

  it('falls back to the text colour when the accent lacks 3:1 contrast', () => {
    const pal = p(['#101010', '#202020', '#151515', '#303030']);
    const c = slideColors(pal, 0);
    expect(c.accent).toBe(c.text);
  });

  it('every preset slide has readable text', () => {
    for (const pal of PRESET_PALETTES) {
      for (let i = 0; i < pal.colors.length; i++) {
        const c = slideColors(pal, i);
        expect(contrast(c.bg, c.text)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c.bg, c.accent)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('validates palettes', () => {
    expect(isValidPalette(p(['#000000', '#111111', '#222222', '#333333']))).toBe(true);
    expect(isValidPalette(p(['#000000', '#111111']))).toBe(false);
    expect(isValidPalette(p(['#000000', '#111111', '#222222', 'red']))).toBe(false);
    expect(isValidPalette({ id: 'x', colors: [] })).toBe(false);
  });

  it('defaults to the first preset with nothing stored', () => {
    const prefs = readPalettePrefs();
    expect(prefs).toEqual({ selectedId: PRESET_PALETTES[0].id, custom: [] });
    expect(selectedPalette(prefs)).toBe(PRESET_PALETTES[0]);
  });

  it('a coach who never chose a palette gets Night', () => {
    expect(readPalettePrefs().selectedId).toBe('night');
  });

  it('Night is true black with white ink and a white accent', () => {
    const night = PRESET_PALETTES.find((x) => x.id === 'night')!;
    for (let i = 0; i < 4; i++) expect(slideColors(night, i)).toMatchObject({ bg: '#000000', text: '#FFFFFF', accent: '#FFFFFF' });
  });

  it('a stored preset choice is kept', () => {
    localStorage.setItem('vcb.awards.palette', 'navy');
    localStorage.setItem('vcb.awards.palettes', '[]');
    expect(readPalettePrefs().selectedId).toBe('navy');
  });

  it('a legacy theme with an unknown preset still migrates onto Navy', () => {
    const navy = PRESET_PALETTES.find((x) => x.id === 'navy')!;
    localStorage.setItem('vcb.awards.theme', JSON.stringify({ presetId: 'ghost', custom: null }));
    expect(readPalettePrefs().selectedId).toBe('navy');
    localStorage.clear();
    localStorage.setItem('vcb.awards.theme', JSON.stringify({ presetId: 'ghost', custom: { from: '#123456', to: '#654321' } }));
    expect(readPalettePrefs().custom[0].colors.slice(2)).toEqual(navy.colors.slice(2));
  });

  it('round-trips custom palettes and the selection', () => {
    const custom = { id: 'custom-1', name: 'Mine', colors: ['#000000', '#111111', '#222222', '#333333'] };
    writePalettePrefs({ selectedId: 'custom-1', custom: [custom] });
    const prefs = readPalettePrefs();
    expect(selectedPalette(prefs)).toEqual(custom);
    expect(allPalettes(prefs)).toHaveLength(PRESET_PALETTES.length + 1);
  });

  it('invalid stored palettes fall back to presets without throwing', () => {
    localStorage.setItem('vcb.awards.palettes', '{"not":"an array"}');
    localStorage.setItem('vcb.awards.palette', 'ghost');
    expect(readPalettePrefs()).toEqual({ selectedId: PRESET_PALETTES[0].id, custom: [] });
    localStorage.setItem('vcb.awards.palettes', JSON.stringify([{ id: 'c', name: 'Bad', colors: ['#000000'] }]));
    expect(readPalettePrefs().custom).toEqual([]);
  });

  it('migrates the old theme preference (preset)', () => {
    localStorage.setItem('vcb.awards.theme', JSON.stringify({ presetId: 'gold', custom: null }));
    expect(readPalettePrefs()).toEqual({ selectedId: 'gold', custom: [] });
  });

  it('migrates the old custom gradient into a custom palette', () => {
    localStorage.setItem('vcb.awards.theme', JSON.stringify({ presetId: 'navy', custom: { from: '#123456', to: '#654321' } }));
    const prefs = readPalettePrefs();
    expect(prefs.custom).toHaveLength(1);
    expect(prefs.custom[0].colors.slice(0, 2)).toEqual(['#123456', '#654321']);
    expect(prefs.custom[0].colors.length).toBeGreaterThanOrEqual(4);
    expect(prefs.selectedId).toBe(prefs.custom[0].id);
  });
});
