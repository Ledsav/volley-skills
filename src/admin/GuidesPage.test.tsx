import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GuidesPage } from './GuidesPage';

vi.mock('../skillGuide/SkillGuideEditor', () => ({ SkillGuideEditor: () => <div>Skill guide content</div> }));
vi.mock('../physicalTestGuide/PhysicalTestGuideEditor', () => ({
  PhysicalTestGuideEditor: () => <div>Physical test guide content</div>,
}));

function LocationProbe() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <GuidesPage />
      <LocationProbe />
    </MemoryRouter>
  );

describe('GuidesPage', () => {
  it('shows the skill guide tab by default and switches to the physical test guide tab', () => {
    renderAt('/admin/guides');
    expect(screen.getByRole('tab', { name: 'Skill guide' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Physical test guide' }));
    expect(screen.getByRole('tab', { name: 'Physical test guide' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Physical test guide content').closest('[role="tabpanel"]')).not.toHaveAttribute('hidden');
    expect(screen.getByText('Skill guide content').closest('[role="tabpanel"]')).toHaveAttribute('hidden');
  });

  it('opens the tab named in ?tab= and writes the choice with replace', () => {
    renderAt('/admin/guides?tab=physical');
    expect(screen.getByRole('tab', { name: 'Physical test guide' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Skill guide' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('/admin/guides?tab=skills');
    expect(screen.getByRole('tab', { name: 'Skill guide' })).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to the skill guide for an unknown tab', () => {
    renderAt('/admin/guides?tab=nope');
    expect(screen.getByRole('tab', { name: 'Skill guide' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps both guides mounted and shows only the active one', () => {
    renderAt('/admin/guides');
    expect(screen.getByText('Physical test guide content').closest('[role="tabpanel"]')).toHaveAttribute('hidden');
    expect(screen.getByText('Skill guide content').closest('[role="tabpanel"]')).not.toHaveAttribute('hidden');
  });
});
