import type { Catalog } from '../catalog';
import { plural } from '../plural';

export const calendar = {
  tab: {
    matchVs: (opponent: string) => `vs ${opponent}`,
    matchResult: (opponent: string, setsUs: number, setsThem: number) => `vs ${opponent} ${setsUs}–${setsThem}`,
    loadError: 'Impossibile caricare le sessioni del calendario. Aggiorna la pagina.',
    removeError: 'Impossibile rimuovere la sessione. Riprova.',
    previousMonth: 'Mese precedente',
    nextMonth: 'Mese successivo',
    removeTitle: 'Rimuovere questa sessione?',
    removeMessage: (label: string, date: string) => `${label} del ${date}`,
    removeConfirm: 'Sì, rimuovi',
    todayDate: (date: string) => `Oggi, ${date}`,
    removeSession: (businessId: string, date: string) => `Rimuovi ${businessId} del ${date}`,
    addTrainingOn: (date: string) => `Aggiungi allenamento il ${date}`,
    addMatchOn: (date: string) => `Aggiungi partita il ${date}`,
    add: 'Aggiungi',
    match: 'Partita',
    addTraining: 'Aggiungi allenamento',
    dayLabel: (isToday: boolean, day: string, count: number) =>
      `${isToday ? 'Oggi, ' : ''}${day}${
        count ? `, ${count} ${plural('it', count, { one: 'allenamento', other: 'allenamenti' })}` : ''
      }`,
    trainingsOn: (day: string) => `Allenamenti di ${day}`,
    noTrainings: 'Nessun allenamento in programma.',
  },
  assign: {
    title: 'Assegna allenamento',
    loadError: 'Impossibile caricare gli allenamenti. Riprova.',
    loadMoreError: 'Impossibile caricare altri allenamenti. Riprova.',
    searchError: 'Impossibile cercare quell’allenamento. Riprova.',
    pickTraining: 'Scegli un allenamento da assegnare.',
    assignError: 'Impossibile assegnare l’allenamento. Riprova.',
    date: 'Data',
    findByBusinessId: 'Cerca per ID',
    find: 'Cerca',
    training: 'Allenamento',
    noneAvailable: 'Nessun allenamento disponibile.',
    loadMore: 'Carica altri',
    exercisesIn: (name: string) => `Esercizi in ${name}`,
    exercisesLabel: 'Esercizi dell’allenamento',
    collapse: (name: string) => `Comprimi ${name}`,
    expand: (name: string) => `Espandi ${name}`,
    deletedExercise: 'Esercizio eliminato',
    minutes: (n: number) => `${n} min`,
    noDescription: 'Nessuna descrizione.',
    notes: 'Note',
    saving: 'Salvataggio…',
    assign: 'Assegna',
  },
} satisfies Catalog['calendar'];
