import type { Catalog } from '../catalog';

export const onboarding = {
  welcome: {
    title: (club: string) => `Benvenuto in ${club}`,
    subtitle: 'Volley Skills',
    continue: 'Continua',
    teams: { title: 'Squadre e giocatori', line: 'Crea le tue squadre e tieni una scheda per ogni giocatore.' },
    coaches: { title: 'Porta i tuoi allenatori', line: 'Aggiungi allenatori e scegli cosa può vedere ciascuno.' },
    sessions: { title: 'Pianifica ogni sessione', line: 'Metti gli allenamenti in calendario e condividili in PDF.' },
    scouting: { title: 'Scouting in diretta', line: 'Registra una partita punto per punto e ottieni le statistiche dopo.' },
    library: { title: "Un'unica libreria del club", line: 'Esercizi con schemi del campo, condivisi da tutti gli allenatori.' },
    view: { title: 'Guarda le tue squadre', line: 'Segui le squadre e i giocatori a cui hai accesso.' },
  },
  checklist: {
    title: 'Per iniziare',
    progress: (done: number, total: number) => `${done} di ${total}`,
    more: 'Altro',
    hide: 'Nascondi',
    hidden: 'Per iniziare nascosto',
    readyClub: 'Il tuo club è pronto.',
    readyYou: 'È tutto pronto.',
    stepDone: (title: string) => `${title}, fatto`,
    team: { title: 'Crea la tua prima squadra', help: 'Parti dalla squadra che alleni.' },
    players: { title: 'Aggiungi i tuoi giocatori', help: 'Aggiungili uno a uno o importa un elenco.' },
    coach: { title: 'Aggiungi un allenatore', help: "Dai a un altro allenatore l'accesso a una squadra." },
    session: { title: 'Pianifica un allenamento', help: 'Metti la prossima sessione in calendario.' },
    match: { title: 'Fai lo scouting di una partita', help: 'Registrala in diretta o importa un file DataVolley.' },
  },
  tips: {
    search: {
      title: 'Trova tutto',
      lineMac: 'Premi ⌘K per passare a qualsiasi squadra, giocatore, partita o esercizio.',
      lineOther: 'Premi Ctrl K per passare a qualsiasi squadra, giocatore, partita o esercizio.',
      linePhone: "Tocca l'icona di ricerca per passare a qualsiasi squadra, giocatore, partita o esercizio.",
    },
    rowActions: {
      title: 'Azioni rapide',
      lineTouch: 'Tieni premuto o scorri su un giocatore per le azioni rapide.',
      linePointer: 'Clicca con il tasto destro su un giocatore per le azioni rapide.',
    },
    scoutStart: {
      title: 'Come funziona lo scouting',
      line: "Tocca un giocatore, poi il fondamentale e il voto. Ti suggeriamo la prossima azione probabile; Annulla corregge l'ultimo tocco.",
    },
    pdfShare: { title: 'Condividere un PDF', line: 'Tocca Condividi PDF per crearlo, poi Condividi PDF pronto per inviarlo.' },
    diagram: { title: 'Disegna un esercizio', line: 'Trascina giocatori, palloni e frecce dalla palette sul campo.' },
  },
  dismiss: 'Chiudi il suggerimento',
  settings: {
    showAgain: 'Mostra di nuovo i suggerimenti',
    showAgainHelp: 'Benvenuto, Per iniziare e suggerimenti, su tutti i tuoi dispositivi',
    shown: 'I suggerimenti verranno mostrati di nuovo.',
  },
} satisfies Catalog['onboarding'];
