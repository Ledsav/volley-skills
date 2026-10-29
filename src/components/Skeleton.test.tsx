import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSkeleton } from './Skeleton';

describe('PageSkeleton', () => {
  it.each(['player', 'team', 'match'] as const)('announces loading for the %s layout and respects reduced motion', (layout) => {
    const { container } = render(<PageSkeleton layout={layout} label="Loading page…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading page…');
    const blocks = container.querySelectorAll('[data-skeleton-block]');
    expect(blocks.length).toBeGreaterThan(2);
    blocks.forEach((b) => expect(b).toHaveClass('motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]'));
  });
});
