import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandMark } from './Logo';

describe('Logo', () => {
  it('BrandMark shows the wordmark and a decorative mark', () => {
    const { container } = render(<BrandMark />);
    expect(screen.getByText('Volley Skills')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});
