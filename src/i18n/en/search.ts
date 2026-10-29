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
    exercises: 'Exercises',
    trainings: 'Trainings',
  },
  actions: {
    newTeam: 'New team',
    newTraining: 'New training',
    newExercise: 'New exercise',
    newMatch: 'New match…',
    addPlayer: 'Add player…',
  },
  noTeams: 'No teams yet',
  chooseTeam: 'Choose a team',
  noResults: (q: string) => `No results for ‘${q}’`,
  showAll: (n: number) => `Show all ${n}`,
  showMore: 'Show more',
  offlineNote: 'Exercises and trainings need a connection',
  results: (n: number) => `${n} ${plural('en', n, { one: 'result', other: 'results' })}`,
  loading: 'Loading…',
  versus: (opponent: string) => `vs ${opponent}`,
};
