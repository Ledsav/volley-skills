import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useThemePreference } from './useTheme';

function Reader({ id }: { id: string }) {
  const [pref] = useThemePreference();
  return <p data-testid={id}>{pref}</p>;
}

function Setter() {
  const [, set] = useThemePreference();
  return <button onClick={() => set('dark')}>go dark</button>;
}

describe('useThemePreference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    // The OS is dark and the document already follows it, so system -> dark keeps the resolved theme.
    document.documentElement.classList.add('dark');
  });
  afterEach(() => {
    // @ts-expect-error jsdom has no matchMedia
    delete window.matchMedia;
    document.documentElement.classList.remove('dark');
  });

  it('updates every instance even when the resolved theme does not change', () => {
    render(
      <>
        <Reader id="a" />
        <Setter />
      </>,
    );
    expect(screen.getByTestId('a')).toHaveTextContent('system');
    act(() => {
      screen.getByRole('button', { name: 'go dark' }).click();
    });
    expect(screen.getByTestId('a')).toHaveTextContent('dark');
  });
});
