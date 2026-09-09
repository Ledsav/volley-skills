import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillRadarChart } from './SkillRadarChart';

describe('SkillRadarChart', () => {
  it('renders an accessible summary of every score', () => {
    render(<SkillRadarChart scores={[7, null]} labels={['Serve', 'Attack']} level="Advanced" />);

    expect(screen.getByRole('img', { name: /Serve 7, Attack not rated/ })).toBeInTheDocument();
  });
});
