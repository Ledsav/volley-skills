import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthHint } from './HealthHint';

describe('HealthHint', () => {
  it('renders the exact text and takes an id', () => {
    render(<HealthHint id="h" />);
    const el = screen.getByText("Don't record health, injury or medical information.");
    expect(el).toHaveAttribute('id', 'h');
  });
});
