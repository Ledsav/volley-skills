import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InfoTooltip } from './InfoTooltip';

function mockPhone() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width: 767px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  // @ts-expect-error restore jsdom's absence of matchMedia
  delete window.matchMedia;
});

describe('InfoTooltip', () => {
  it('a click pins the popover open; a second click or Escape closes it', () => {
    render(
      <InfoTooltip label="Serve scoring guide">
        <p>Jump serve with pace.</p>
      </InfoTooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Serve scoring guide' });

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Jump serve with pace.');
    // leaving hover or focus does not close a pinned popover
    fireEvent.mouseLeave(trigger.parentElement as HTMLElement);
    fireEvent.blur(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('on a phone a tap opens the guide in a sheet titled by its label', async () => {
    mockPhone();
    render(
      <InfoTooltip label="Serve scoring guide">
        <p>Jump serve with pace.</p>
      </InfoTooltip>,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'Serve scoring guide' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Serve scoring guide' }));

    const dialog = await screen.findByRole('dialog', { name: 'Serve scoring guide' });
    expect(dialog).toHaveTextContent('Jump serve with pace.');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await act(async () => undefined);
  });
});
