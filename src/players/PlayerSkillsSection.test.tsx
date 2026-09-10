import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import * as playersApi from './playersApi';
import * as skillGuideApi from '../skillGuide/skillGuideApi';
import type { Player } from '../types/player';

vi.mock('./playersApi');
vi.mock('../skillGuide/skillGuideApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const guideConfig = {
  skills: [
    {
      key: 'serve' as const,
      label: 'Serve',
      ranges: [
        { min: 1, max: 3, description: 'Inconsistent, many faults.' },
        { min: 4, max: 6, description: 'Regular float serve.' },
        { min: 7, max: 8, description: 'Tactical serving.' },
        { min: 9, max: 10, description: 'Jump serve with pace.' },
      ],
      howToEvaluate: 'Count % of serves in over 10 attempts.',
    },
  ],
  updatedBy: 'coach',
  updatedAt: null,
};

beforeEach(() => {
  vi.mocked(skillGuideApi.getSkillGuide).mockResolvedValue(guideConfig);
});

/** Harness that supplies the controlled `editing` state plus a header-style trigger. */
function SkillsHarness({
  player,
  onPlayerUpdated = vi.fn(),
  isAdmin = true,
}: {
  player: Player;
  onPlayerUpdated?: (p: Player) => void;
  isAdmin?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      {isAdmin && <button onClick={() => setEditing(true)}>Edit skills</button>}
      <PlayerSkillsSection
        teamId="team-1"
        playerId="player-1"
        player={player}
        onPlayerUpdated={onPlayerUpdated}
        isAdmin={isAdmin}
        editing={editing}
        onEditingChange={setEditing}
      />
    </>
  );
}

const basePlayer: Player = {
  id: 'player-1',
  number: 7,
  fullName: 'Test Player',
  dob: '2012-01-01',
  nationality: 'BEL',
  licenseNumber: 'J-000001',
  positionCategory: 'OH',
  starting: false,
  playerPhone: '',
  guardians: [],
  viewerEmails: [],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: null, notes: '', priority: false },
    attack: { score: null, notes: '', priority: false },
    block: { score: null, notes: '', priority: false },
    set: { score: null, notes: '', priority: false },
    defence: { score: null, notes: '', priority: false },
    reception: { score: null, notes: '', priority: false },
    jump: { score: null, notes: '', priority: false },
    speed: { score: null, notes: '', priority: false },
    iq: { score: null, notes: '', priority: false },
  },
  avgScore: null,
  level: null,
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  consent: { given: false, date: null, confirmedBy: null },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

describe('PlayerSkillsSection', () => {
  it('sets a score, computes avg/level, and saves', async () => {
    vi.spyOn(playersApi, 'updatePlayerSkills').mockResolvedValue(undefined);
    const onPlayerUpdated = vi.fn();

    render(<SkillsHarness player={basePlayer} onPlayerUpdated={onPlayerUpdated} />);

    fireEvent.click(screen.getByText('Edit skills'));
    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Attack'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Save skills'));

    await waitFor(() =>
      expect(playersApi.updatePlayerSkills).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        expect.objectContaining({
          serve: expect.objectContaining({ score: 6 }),
          attack: expect.objectContaining({ score: 8 }),
        }),
        7,
        'Advanced'
      )
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(expect.objectContaining({ avgScore: 7, level: 'Advanced' }));
  });

  it('shows an error message when the save is rejected', async () => {
    vi.spyOn(playersApi, 'updatePlayerSkills').mockRejectedValue({ code: 'permission-denied' });
    const onPlayerUpdated = vi.fn();

    render(<SkillsHarness player={basePlayer} onPlayerUpdated={onPlayerUpdated} />);

    fireEvent.click(screen.getByText('Edit skills'));
    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '99' } });
    fireEvent.click(screen.getByText('Save skills'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onPlayerUpdated).not.toHaveBeenCalled();
  });

  it('marks a skill as a focus area via the priority checkbox', async () => {
    render(<SkillsHarness player={basePlayer} />);
    await screen.findByRole('button', { name: /scoring guide/i });

    fireEvent.click(screen.getByText('Edit skills'));
    const checkboxes = screen.getAllByLabelText('Focus area');
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
  });

  it('marks a priority skill with an inline focus-area icon in that skill row', async () => {
    const focusPlayer: Player = {
      ...basePlayer,
      skills: {
        ...basePlayer.skills,
        attack: { score: 6, notes: '', priority: true },
        iq: { score: 7, notes: '', priority: true },
      },
    };

    render(<SkillsHarness player={focusPlayer} isAdmin={false} />);
    await screen.findByRole('button', { name: /scoring guide/i });

    const icons = screen.getAllByRole('img', { name: 'Focus area' });
    expect(icons).toHaveLength(2);
    expect(within(icons[0].closest('li') as HTMLElement).getByText('Attack')).toBeInTheDocument();
    expect(within(icons[1].closest('li') as HTMLElement).getByText('IQ')).toBeInTheDocument();
    // it is inline on the label line, not a separate row
    expect(icons[0].closest('span')).toHaveTextContent('Attack');
  });

  it('reveals a guide-definition tooltip when the info button is focused', async () => {
    render(<SkillsHarness player={basePlayer} isAdmin={false} />);

    const trigger = await screen.findByRole('button', { name: 'Serve scoring guide' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(trigger);

    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Jump serve with pace.');
    expect(tip).toHaveTextContent('Count % of serves in over 10 attempts.');

    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders scores read-only and hides the edit affordances for a non-admin viewer', async () => {
    const scoredPlayer: Player = {
      ...basePlayer,
      skills: { ...basePlayer.skills, serve: { score: 6, notes: '', priority: false } },
    };

    render(<SkillsHarness player={scoredPlayer} isAdmin={false} />);
    await screen.findByRole('button', { name: /scoring guide/i });

    expect(screen.queryByLabelText('Serve')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit skills')).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText('Focus area')).toHaveLength(0);
    expect(screen.queryByText('Save skills')).not.toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
