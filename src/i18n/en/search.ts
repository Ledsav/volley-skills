import { plural } from '../plural';

export const search = {
  title: 'Search',
  placeholder: 'Search teams, players, matches…',
  groups: {
    recent: 'Recent',
    goto: 'Go to',
    actions: 'Actions',
    teams: 'Teams',
    players: 'Players',
    matches: 'Matches',
  },
  actions: {
    newTeam: 'New team',
    newTraining: 'New training',
    newExercise: 'New exercise',
    newMatch: 'New match…',
    addPlayer: 'Add player…',
  },
  chooseTeam: 'Choose a team',
  noResults: (q: string) => `No results for ‘${q}’`,
  showAll: (n: number) => `Show all ${n}`,
  results: (n: number) => `${n} ${plural('en', n, { one: 'result', other: 'results' })}`,
  loading: 'Loading…',
  versus: (opponent: string) => `vs ${opponent}`,
};
