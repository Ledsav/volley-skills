import type { Catalog } from '../catalog';
import { plural } from '../plural';

export const search = {
  title: 'Cerca',
  placeholder: 'Cerca squadre, giocatori, partite…',
  groups: {
    recent: 'Recenti',
    goto: 'Vai a',
    actions: 'Azioni',
    teams: 'Squadre',
    players: 'Giocatori',
    matches: 'Partite',
  },
  actions: {
    newTeam: 'Nuova squadra',
    newTraining: 'Nuovo allenamento',
    newExercise: 'Nuovo esercizio',
    newMatch: 'Nuova partita…',
    addPlayer: 'Aggiungi giocatore…',
  },
  chooseTeam: 'Scegli una squadra',
  noResults: (q: string) => `Nessun risultato per ‘${q}’`,
  showAll: (n: number) => `Mostra tutti (${n})`,
  results: (n: number) => `${n} ${plural('it', n, { one: 'risultato', other: 'risultati' })}`,
  loading: 'Caricamento…',
  versus: (opponent: string) => `vs ${opponent}`,
} satisfies Catalog['search'];
