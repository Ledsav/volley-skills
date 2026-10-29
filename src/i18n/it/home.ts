import type { Catalog } from '../catalog';

export const home = {
  title: 'Oggi',
  loading: 'Caricamento della dashboard...',
  teamsError: 'Impossibile caricare le tue squadre.',
  noAccessTitle: 'Non hai ancora accesso a nessuna squadra',
  noAccessBody: "Un amministratore del club concede l'accesso a squadre e sezioni. Chiedi all'amministratore, oppure invia una richiesta.",
  requestAccess: 'Richiedi accesso',
  planTraining: 'Pianifica un allenamento',
  pickTeam: 'Scegli una squadra',
  shortcuts: {
    title: 'Scorciatoie',
    newMatch: 'Nuova partita',
    newTraining: 'Nuovo allenamento',
    newExercise: 'Nuovo esercizio',
  },
  yourTeams: 'Le tue squadre',
  allTeams: 'Tutte le squadre →',
  showingFirst: (n: number) => `Le prime ${n} squadre.`,
  liveNow: 'In diretta',
  vs: (opponent: string) => `vs ${opponent}`,
  resumeScouting: 'Riprendi lo scouting',
  live: {
    sets: 'set',
    setInPlay: (n: number) => `Set ${n} in corso`,
  },
  nextUp: {
    title: 'Prossimi 7 giorni',
    error: 'Impossibile caricare i prossimi allenamenti.',
    empty: 'Niente nei prossimi 7 giorni.',
  },
  recent: {
    title: 'Ultimi risultati',
    error: 'Impossibile caricare le partite.',
    empty: 'Ancora nessuna partita conclusa.',
    won: 'V',
    lost: 'S',
    mvp: (name: string) => `MVP: ${name}`,
  },
} satisfies Catalog['home'];
