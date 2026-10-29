import { useState } from 'react';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlayerSkillsSection } from './PlayerSkillsSection';
import * as playersApi from './playersApi';
import * as skillGuideApi from '../skillGuide/skillGuideApi';
import { NoticeProvider } from '../components/Notice';
import { PlayerSyncProvider } from './playerSync';
import type { Player } from '../types/player';
import type { MatchRatings } from './matchRating';

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
  ratings,
  showSuggestions = true,
}: {
  player: Player;
  onPlayerUpdated?: (p: Player) => void;
  isAdmin?: boolean;
  ratings?: MatchRatings;
  showSuggestions?: boolean;
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
        ratings={ratings}
        showSuggestions={showSuggestions}
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
  shirtSize: '',
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
  it('shows no match lines without ratings', () => {
    render(<SkillsHarness player={basePlayer} />);
    expect(screen.queryByText(/^Match /)).not.toBeInTheDocument();
  });

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

  it('Cancel on an edited skills sheet asks to discard; a clean Cancel closes at once', () => {
    render(<SkillsHarness player={basePlayer} />);

    fireEvent.click(screen.getByText('Edit skills'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Serve')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Edit skills'));
    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(screen.getByLabelText('Serve')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByLabelText('Serve')).not.toBeInTheDocument();
  });

  it('a second Save while saving writes once', async () => {
    let finish: () => void = () => {};
    vi.spyOn(playersApi, 'updatePlayerSkills').mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    render(<SkillsHarness player={basePlayer} />);

    fireEvent.click(screen.getByText('Edit skills'));
    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '6' } });
    const save = screen.getByRole('button', { name: 'Save skills' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(playersApi.updatePlayerSkills).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(screen.queryByLabelText('Serve')).not.toBeInTheDocument());
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

describe('match suggestions', () => {
  const withServe = (score: number) => ({ ...basePlayer, skills: { ...basePlayer.skills, serve: { score, notes: '', priority: false } } });
  const serveRating: MatchRatings = { serve: { rating: 7.75, attempts: 20 }, attack: { rating: null, attempts: 8 } };
  const ghosts = (el: HTMLElement) => within(el).getAllByTestId('skill-segment').filter((s) => s.dataset.ghost).length;

  it('draws the suggestion on the meter with the match data in a tooltip, not as text', () => {
    render(<SkillsHarness player={withServe(5)} ratings={serveRating} />);
    const serveMeter = screen.getByTitle('Match 7.8 · 20 att. — suggests 8');
    expect(ghosts(serveMeter)).toBe(3);
    expect(screen.queryByText(/^Match /)).not.toBeInTheDocument();
    // not enough data: nothing to suggest, nothing drawn
    expect(screen.queryByRole('button', { name: /Adapt Attack/ })).not.toBeInTheDocument();
  });

  it('Adapt applies the suggestion and saves at once', async () => {
    const save = vi.spyOn(playersApi, 'updatePlayerSkills').mockResolvedValue(undefined);
    save.mockClear();
    const onPlayerUpdated = vi.fn();
    render(<SkillsHarness player={withServe(5)} ratings={serveRating} onPlayerUpdated={onPlayerUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adapt Serve to 8' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith('team-1', 'player-1', expect.objectContaining({ serve: expect.objectContaining({ score: 8 }) }), 8, 'Elite'),
    );
    expect(onPlayerUpdated).toHaveBeenCalledWith(expect.objectContaining({ avgScore: 8, level: 'Elite' }));
  });

  it("Adapt is a 44 px pill in the suggestion's colour", () => {
    render(<SkillsHarness player={withServe(5)} ratings={serveRating} />);
    const up = screen.getByRole('button', { name: 'Adapt Serve to 8' });
    expect(up).toHaveClass('min-h-11', 'rounded-full', 'text-green-strong');
    cleanup();
    render(<SkillsHarness player={withServe(10)} ratings={serveRating} />);
    expect(screen.getByRole('button', { name: 'Adapt Serve to 8' })).toHaveClass('text-orange-strong');
  });

  it('hides a suggestion that already matches the score', () => {
    render(<SkillsHarness player={withServe(8)} ratings={serveRating} />);
    expect(screen.queryByRole('button', { name: /Adapt Serve/ })).not.toBeInTheDocument();
    expect(screen.queryByTitle(/suggests/)).not.toBeInTheDocument();
  });

  it('switched off: no ghosts, no Adapt, no Use in the editor', () => {
    render(<SkillsHarness player={withServe(5)} ratings={serveRating} showSuggestions={false} />);
    expect(screen.queryByRole('button', { name: /Adapt Serve/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Edit skills'));
    expect(screen.queryByRole('button', { name: 'Use 8 for Serve' })).not.toBeInTheDocument();
  });

  it('in the editor, Use fills the score without saving and the suggestion then disappears', () => {
    const save = vi.spyOn(playersApi, 'updatePlayerSkills').mockResolvedValue(undefined);
    save.mockClear();
    render(<SkillsHarness player={withServe(5)} ratings={serveRating} />);
    fireEvent.click(screen.getByText('Edit skills'));
    fireEvent.click(screen.getByRole('button', { name: 'Use 8 for Serve' }));
    expect(screen.getByLabelText('Serve')).toHaveValue(8);
    expect(screen.queryByRole('button', { name: 'Use 8 for Serve' })).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('offline saves', () => {
  const offline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const renderOffline = (props: Parameters<typeof SkillsHarness>[0]) =>
    render(
      <NoticeProvider>
        <PlayerSyncProvider>
          <SkillsHarness {...props} />
        </PlayerSyncProvider>
      </NoticeProvider>,
    );

  it('offline, the skills sheet closes as soon as the write is queued', async () => {
    offline();
    vi.spyOn(playersApi, 'updatePlayerSkills').mockReturnValue(new Promise(() => undefined));
    renderOffline({ player: basePlayer });
    fireEvent.click(screen.getByText('Edit skills'));
    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '6' } });
    fireEvent.click(screen.getByText('Save skills'));
    await waitFor(() => expect(screen.queryByLabelText('Serve')).not.toBeInTheDocument());
    expect(screen.getByText('Saved on this device · will sync')).toBeInTheDocument();
  });

  it('offline, Adapt shows the offline notice, not the adapted toast', async () => {
    offline();
    vi.spyOn(playersApi, 'updatePlayerSkills').mockReturnValue(new Promise(() => undefined));
    const player = { ...basePlayer, skills: { ...basePlayer.skills, serve: { score: 5, notes: '', priority: false } } };
    renderOffline({ player, ratings: { serve: { rating: 7.75, attempts: 20 } } });
    fireEvent.click(screen.getByRole('button', { name: 'Adapt Serve to 8' }));
    expect(await screen.findByText('Saved on this device · will sync')).toBeInTheDocument();
    expect(screen.queryByText(/set to 8/)).not.toBeInTheDocument();
  });
});
