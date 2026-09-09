import { describe, expect, it } from 'vitest';
import { buildTrendSeries } from './physicalTestChart';
import type { PhysicalTest } from '../types/physicalTest';

const common = { notes: '', recordedBy: 'coach-uid', createdAt: null };

describe('buildTrendSeries', () => {
  it('plots the best jump height over time for CMJ, oldest first', () => {
    const tests: PhysicalTest[] = [
      { ...common, id: 'a', testType: 'cmj', attemptsCm: [28, 30], bestCm: 30, date: '2026-01-10' },
      { ...common, id: 'b', testType: 'cmj', attemptsCm: [33, 34], bestCm: 34, date: '2026-06-10' },
    ];

    const series = buildTrendSeries('cmj', tests);

    expect(series.points).toEqual([
      { date: '2026-01-10', value: 30 },
      { date: '2026-06-10', value: 34 },
    ]);
    expect(series.unit).toBe('cm');
    expect(series.lowerIsBetter).toBe(false);
  });

  it('marks time-based sprint results as lower-is-better', () => {
    const series = buildTrendSeries('sprint10m', [
      { ...common, id: 'a', testType: 'sprint10m', attemptsSeconds: [1.9], bestSeconds: 1.9, date: '2026-02-01' },
    ]);

    expect(series.points).toEqual([{ date: '2026-02-01', value: 1.9 }]);
    expect(series.unit).toBe('s');
    expect(series.lowerIsBetter).toBe(true);
  });

  it('averages the two shuttle directions into one value', () => {
    const series = buildTrendSeries('shuttle5105', [
      { ...common, id: 'a', testType: 'shuttle5105', rightFirstSeconds: 5.0, leftFirstSeconds: 5.4, date: '2026-03-01' },
    ]);

    expect(series.points).toEqual([{ date: '2026-03-01', value: 5.2 }]);
  });

  it('plots the derived reaction time in milliseconds', () => {
    const series = buildTrendSeries('reaction', [
      { ...common, id: 'a', testType: 'reaction', attemptsCm: [15, 20, 25], averageCm: 20, reactionTimeMs: 201.9, date: '2026-03-01' },
    ]);

    expect(series.points).toEqual([{ date: '2026-03-01', value: 201.9 }]);
    expect(series.unit).toBe('ms');
    expect(series.lowerIsBetter).toBe(true);
  });

  it('sorts entries by date ascending even when passed out of order', () => {
    const series = buildTrendSeries('growth', [
      { ...common, id: 'b', testType: 'growth', heightCm: 165, bodyMassKg: 55, date: '2026-06-01' },
      { ...common, id: 'a', testType: 'growth', heightCm: 160, bodyMassKg: 52, date: '2026-01-01' },
    ]);

    expect(series.points).toEqual([
      { date: '2026-01-01', value: 160 },
      { date: '2026-06-01', value: 165 },
    ]);
  });

  it('charts only the most recent strength mode when weighted and bodyweight entries are mixed', () => {
    const series = buildTrendSeries('strength', [
      { ...common, id: 'a', testType: 'strength', mode: 'bodyweight', exercise: 'pushUps', reps: 20, date: '2026-01-01' },
      { ...common, id: 'b', testType: 'strength', mode: 'weighted', exercise: 'squat', weightKg: 40, reps6RM: 6, bodyMassRatio: 0.8, date: '2026-03-01' },
      { ...common, id: 'c', testType: 'strength', mode: 'weighted', exercise: 'squat', weightKg: 45, reps6RM: 6, bodyMassRatio: 0.9, date: '2026-06-01' },
    ]);

    expect(series.points).toEqual([
      { date: '2026-03-01', value: 40 },
      { date: '2026-06-01', value: 45 },
    ]);
    expect(series.unit).toBe('kg');
  });

  it('returns an empty point list but still reports the unit for a type with no entries', () => {
    const series = buildTrendSeries('reaction', []);

    expect(series.points).toEqual([]);
    expect(series.unit).toBe('ms');
    expect(series.lowerIsBetter).toBe(true);
  });
});
