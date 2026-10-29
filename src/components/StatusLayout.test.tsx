import { render, screen } from '@testing-library/react';
import { Mail } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { StatusLayout } from './StatusLayout';

describe('StatusLayout', () => {
  it('renders the icon tile, a focusable h1 title, the body and the actions', () => {
    const { container } = render(
      <StatusLayout icon={Mail} title="Check your email" actions={<button>Resend</button>}>
        Sent to you
      </StatusLayout>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toHaveAttribute('tabindex', '-1');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Sent to you')).toBeInTheDocument();
    expect(container.firstElementChild).toContainElement(screen.getByRole('button', { name: 'Resend' }));
  });

  it('omits the tile and the heading when not given', () => {
    const { container } = render(<StatusLayout>Body</StatusLayout>);
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('puts the role on the root so a heading inside an alert is announced', () => {
    render(<StatusLayout role="alert" title="No access" />);
    expect(screen.getByRole('alert')).toContainElement(screen.getByRole('heading'));
  });

  it('colours the icon red for errors', () => {
    const { container } = render(<StatusLayout icon={Mail} tone="error" title="x" />);
    expect(container.querySelector('svg')!.parentElement).toHaveClass('text-red-strong');
  });
});
