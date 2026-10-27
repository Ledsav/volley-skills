import type { Catalog } from '../catalog';
import { plural } from '../plural';

const privacyNote = 'Non scrivere nomi né altri dati personali: questo testo viene inviato al tuo fornitore di IA.';

export const aiDraft = {
  naming: {
    exerciseExample: 'Ricezione: battute miste sul bersaglio',
    trainingExample: 'Ricezione + free ball: controllo e conversione',
    trainingHint: (example: string) =>
      `Scrivilo come "Focus + focus: obiettivo", ad es. "${example}". Fascia d’età e numero di giocatori hanno i loro campi.`,
  },
  prompt: {
    language: 'Italiano',
    descriptionHeadings: {
      purpose: 'Obiettivo:',
      setup: 'Impostazione:',
      howItRuns: 'Come si svolge:',
      coachingPoints: 'Punti tecnici:',
      easier: 'Più facile:',
      harder: 'Più difficile:',
    },
  },
  issues: {
    pickCategory: 'Scegli una categoria.',
    noDiagram: 'Non è stato proposto nessun diagramma.',
    diagramUnusable: 'Il diagramma non è utilizzabile.',
    itemsDropped: (n: number) =>
      `${plural('it', n, { one: 'È stato scartato 1 elemento', other: `Sono stati scartati ${n} elementi` })} del diagramma.`,
    stepsNotInLibrary: (n: number) =>
      plural('it', n, {
        one: '1 passaggio usava un esercizio che non è nella libreria ed è stato scartato.',
        other: `${n} passaggi usavano esercizi che non sono nella libreria e sono stati scartati.`,
      }),
    newExercisesOff: (n: number) =>
      plural('it', n, {
        one: '1 nuovo esercizio è stato scartato perché i nuovi esercizi sono disattivati.',
        other: `${n} nuovi esercizi sono stati scartati perché i nuovi esercizi sono disattivati.`,
      }),
    newNoCategory: (n: number) =>
      plural('it', n, {
        one: '1 nuovo esercizio non aveva una categoria valida ed è stato scartato.',
        other: `${n} nuovi esercizi non avevano una categoria valida e sono stati scartati.`,
      }),
  },
  saveErrors: {
    needsCategory: (name: string) => `“${name}” richiede una categoria.`,
    addFailed: (name: string) => `Impossibile aggiungere “${name}”.`,
    diagramMissing: (name: string) => `“${name}” è stato aggiunto senza il suo diagramma: aggiungine uno nell'editor dei diagrammi.`,
    alreadyAdded: (names: string) => `Già aggiunti: ${names}.`,
    trainingFailedKept: "I nuovi esercizi sono stati salvati, l'allenamento no. Riprova a salvare.",
    trainingFailed: "Impossibile salvare l'allenamento. Riprova.",
    offlineExercises: 'Sei offline. Per salvare le bozze serve la connessione.',
    offlineTraining: 'Sei offline. Per salvare serve la connessione.',
  },
  errors: {
    notConfigured: "Configura prima un fornitore di IA nelle Impostazioni.",
    unauthorized: 'Chiave rifiutata: controllala nelle Impostazioni.',
    rateLimited: 'Limite di richieste raggiunto: riprova tra un momento.',
    unreachable: 'Impossibile raggiungere il fornitore di IA.',
    badResponse: 'La risposta del modello non è utilizzabile. Riprova o riformula la richiesta.',
    privacyBlocked: 'Nessun fornitore per questo modello mantiene private le richieste (zero data retention). Scegli un altro modello nelle Impostazioni.',
    http: 'Il fornitore di IA ha restituito un errore.',
    rateLimitedIn: (sec: number) => `Limite di richieste raggiunto: riprova tra ${sec} s.`,
    generic: 'Qualcosa è andato storto. Riprova.',
  },
  badge: 'Bozza IA',
  saving: 'Salvataggio…',
  drafting: 'Preparazione della bozza…',
  openSettings: 'Apri Impostazioni',
  regenerate: 'Rigenera',
  generate: 'Genera',
  noDiagram: 'Nessun diagramma',
  exerciseDialog: {
    title: 'Bozza di esercizi con IA',
    request: 'Di cosa hai bisogno?',
    requestPlaceholder: 'Esercizi di ricezione per 9 giocatori, U15, un campo',
    privacy: privacyNote,
    category: 'Categoria',
    any: 'Qualsiasi',
    howMany: 'Quanti',
    saveKept: (n: number) => `Salva ${n} ${plural('it', n, { one: 'tenuto', other: 'tenuti' })}`,
  },
  trainingDialog: {
    title: "Bozza di allenamento con IA",
    goal: 'Obiettivo',
    goalPlaceholder: 'Ricezione sotto pressione, 12 giocatori, un campo',
    privacy: privacyNote,
    ageGroup: 'Fascia d’età',
    totalMinutes: 'Minuti totali',
    suggestedPlayers: 'Giocatori consigliati',
    suggestedPlayersHint: 'Facoltativo. La bozza usa solo esercizi che questo numero di giocatori (±3) può svolgere.',
    targets: 'Obiettivi',
    allowNew: 'Consenti nuovi esercizi',
    openInBuilder: "Apri nell'editor",
  },
  exerciseReview: {
    diagramFor: (name: string) => `Diagramma di ${name}`,
    name: 'Nome',
    category: 'Categoria',
    pickCategory: 'Scegli una categoria',
    description: 'Descrizione',
    addedToLibrary: 'Aggiunto alla libreria',
    keep: 'Tieni',
    keepAria: (name: string) => `Tieni ${name}`,
    edit: 'Modifica',
    done: 'Fatto',
    editAria: (name: string) => `Modifica ${name}`,
    doneAria: (name: string) => `Fine modifica di ${name}`,
  },
  trainingReview: {
    trainingName: "Nome dell'allenamento",
    ageGroupTarget: 'Fascia d’età di riferimento',
    description: 'Descrizione',
    minutesOfTarget: (total: number, target: number) => `${total} / ${target} min`,
    steps: 'Passaggi',
    isNew: 'Nuovo',
    isLibrary: 'Libreria',
    view: (name: string) => `Vedi ${name}`,
    minutesFor: (name: string) => `Minuti per ${name}`,
    moveUp: (name: string) => `Sposta su ${name}`,
    moveDown: (name: string) => `Sposta giù ${name}`,
    remove: (name: string) => `Rimuovi ${name}`,
    diagramFor: (name: string) => `Diagramma di ${name}`,
  },
} satisfies Catalog['aiDraft'];
