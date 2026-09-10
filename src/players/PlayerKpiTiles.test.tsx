import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerKpiTiles } from './PlayerKpiTiles';
import type { Player } from '../types/player';
import type { PhysicalTest } from '../types/physicalTest';

const basePlayer: Player = {
  id: 'player-1',
  number: 7,
  fullName: 'Alex Rivera',
  dob: '2011-03-04',
  nationality: 'BEL',
  licenseNumber: 'J-000123',
  positionCategory: 'OH',
  starting: false,
  playerPhone: '',
  guardians: [],
  viewerEmails: [],
  teamName: 'U17 A',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: 6, notes: '', priority: true },
    attack: { score: 7, notes: '', priority: true },
    block: { score: null, notes: '', priority: false },
    set: { score: null, notes: '', priority: false },
    defence: { score: null, notes: '', priority: false },
    reception: { score: null, notes: '', priority: false },
    jump: { score: null, notes: '', priority: false },
    speed: { score: null, notes: '', priority: false },
    iq: { score: null, notes: '', priority: false },
  },
  avgScore: 6.5,
  level: 'Advanced',
  developmentPlan: {
    shortTermObjectives: [{ objective: 'Serve depth', targetDate: '2026-11-01', status: 'In progress', coachComment: '' }],
    seasonObjectives: [{ objective: 'Starter', target: 'Rotation 1', status: 'Not started', coachComment: '' }],
    generalNotes: '',
  },
  consent: { given: false, date: null, confirmedBy: null },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

const cmj: PhysicalTest = {
  id: 't1',
  testType: 'cmj',
  attemptsCm: [],
  bestCm: 40,
  date: '2026-08-12',
  notes: '',
  recordedBy: 'x',
  createdAt: null,
};

describe('PlayerKpiTiles', () => {
  it('summarises rated skills, focus areas, open objectives, and the last test date', () => {
    render(<PlayerKpiTiles player={basePlayer} latestByType={{ cmj }} />);

    expect(screen.getByText('Skills rated')).toBeInTheDocument();
    expect(screen.getByText('2 / 9')).toBeInTheDocument();

    expect(screen.getByText('Focus areas')).toBeInTheDocument();
    expect(screen.getByText('Open objectives')).toBeInTheDocument();

    expect(screen.getByText('Last physical test')).toBeInTheDocument();
    expect(screen.getByText('2026-08-12')).toBeInTheDocument();
  });

  it('shows a dash for the last test when nothing is recorded', () => {
    render(<PlayerKpiTiles player={basePlayer} latestByType={{}} />);
    expect(screen.getByText('Last physical test').closest('div')).toHaveTextContent('—');
  });
});
