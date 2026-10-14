import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import type { CalendarSession } from '../types/calendarSession';
import type { Team } from '../types/team';
import { addDays, liveMatches, nextUp, recentResults, todayIso } from './homeFeed';

const team = (id: string): Team => ({
  id, name: id.toUpperCase(), club: 'Demo VC', ageGroup: 'U17', season: '2026-27', description: '', notes: '',
  adminEmails: [], developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' }, createdBy: '', createdAt: null,
});
const match = (id: string, date: string, status: Match['status'], setsUs = 0, setsThem = 0): Match => ({
  id, date, opponent: `Opp ${id}`, competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster: [], liberos: [],
  status, result: { setsUs, setsThem, sets: [] }, summary: null, usageContribution: null, activeDevice: null,
  createdBy: '', createdAt: null, updatedAt: null,
});
const session = (id: string, date: string): CalendarSession => ({
  id, date, trainingId: 't', trainingBusinessId: 'TR-1', trainingName: `Training ${id}`, notes: '', createdBy: '', createdAt: null,
});

describe('homeFeed', () => {
  it('date helpers', () => {
    expect(addDays('2026-10-14', 7)).toBe('2026-10-21');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(todayIso(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
  });

  it('collects live matches across teams', () => {
    const out = liveMatches([
      { team: team('a'), sessions: [], matches: [match('m1', '2026-10-14', 'live'), match('m2', '2026-10-10', 'finished')] },
      { team: team('b'), sessions: [], matches: [match('m3', '2026-10-14', 'live')] },
    ]);
    expect(out.map((x) => x.match.id)).toEqual(['m1', 'm3']);
  });

  it('next up: sessions and setup matches within [today, today+7], sorted', () => {
    const out = nextUp(
      [
        { team: team('a'), sessions: [session('s1', '2026-10-16'), session('s0', '2026-10-13')], matches: [match('m1', '2026-10-21', 'setup'), match('m9', '2026-10-22', 'setup')] },
        { team: team('b'), sessions: [session('s2', '2026-10-14')], matches: [match('m2', '2026-10-15', 'finished')] },
      ],
      '2026-10-14',
    );
    expect(out.map((i) => (i.kind === 'session' ? i.session.id : i.match.id))).toEqual(['s2', 's1', 'm1']);
  });

  it('recent results: finished only, newest first, limited', () => {
    const matches = ['01', '02', '03', '04', '05', '06'].map((d, i) => match(`m${i}`, `2026-10-${d}`, 'finished', 3, 1));
    const out = recentResults([{ team: team('a'), sessions: [], matches: [...matches, match('live', '2026-10-07', 'live')] }]);
    expect(out.map((x) => x.match.id)).toEqual(['m5', 'm4', 'm3', 'm2', 'm1']);
  });
});
