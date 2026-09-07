import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuidesPage } from './GuidesPage';

vi.mock('../skillGuide/SkillGuideEditor', () => ({ SkillGuideEditor: () => <div>Skill guide content</div> }));
vi.mock('../physicalTestGuide/PhysicalTestGuideEditor', () => ({
  PhysicalTestGuideEditor: () => <div>Physical test guide content</div>,
}));

describe('GuidesPage', () => {
  it('shows the skill guide tab by default and switches to the physical test guide tab', () => {
    render(<GuidesPage />);

    expect(screen.getByText('Skill guide content')).toBeInTheDocument();
    expect(screen.queryByText('Physical test guide content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Physical Test Guide'));

    expect(screen.getByText('Physical test guide content')).toBeInTheDocument();
    expect(screen.queryByText('Skill guide content')).not.toBeInTheDocument();
  });
});
