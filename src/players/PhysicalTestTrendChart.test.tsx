import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhysicalTestTrendChart } from './PhysicalTestTrendChart';
import type { TrendSeries } from './physicalTestChart';

describe('PhysicalTestTrendChart', () => {
  it('renders nothing when there are no points', () => {
    const series: TrendSeries = { points: [], unit: 'cm', lowerIsBetter: false };
    const { container } = render(<PhysicalTestTrendChart series={series} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the single value and a hint when there is only one point', () => {
    const series: TrendSeries = { points: [{ date: '2026-01-10', value: 30 }], unit: 'cm', lowerIsBetter: false };
    render(<PhysicalTestTrendChart series={series} />);
    expect(screen.getByText(/2026-01-10/)).toBeInTheDocument();
    expect(screen.getByText('Add another entry to see a trend.')).toBeInTheDocument();
  });

  it('renders a chart with an accessible summary for 2+ points', () => {
    const series: TrendSeries = {
      points: [
        { date: '2026-01-10', value: 30 },
        { date: '2026-02-10', value: 34 },
      ],
      unit: 'cm',
      lowerIsBetter: false,
    };
    render(<PhysicalTestTrendChart series={series} />);
    expect(screen.getByRole('img', { name: /2026-01-10: 30 cm, 2026-02-10: 34 cm/ })).toBeInTheDocument();
  });

  it('shows a "lower is better" caption for time-based metrics', () => {
    const series: TrendSeries = {
      points: [
        { date: '2026-01-10', value: 1.85 },
        { date: '2026-02-10', value: 1.79 },
      ],
      unit: 's',
      lowerIsBetter: true,
    };
    render(<PhysicalTestTrendChart series={series} />);
    expect(screen.getByText('Lower is better')).toBeInTheDocument();
  });
});
