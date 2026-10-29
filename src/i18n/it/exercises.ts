import type { Catalog } from '../catalog';
import { plural } from '../plural';

export const exercises = {
  import: {
    notObject: (row: number) => `riga ${row}: ogni voce deve essere un oggetto JSON`,
    nameRequired: (row: number) => `riga ${row}: "name" è obbligatorio`,
    categoryInvalid: (row: number, options: string) => `riga ${row}: "category" deve essere uno tra ${options}`,
    descriptionText: (row: number) => `riga ${row}: "description" deve essere un testo`,
    minPlayersRange: (row: number, min: number, max: number) =>
      `riga ${row}: "minPlayers" deve essere un numero intero da ${min} a ${max}`,
    diagramsNotArray: (row: number) => `riga ${row}: "diagrams" deve essere un array`,
    tooManyDiagrams: (row: number, max: number) => `riga ${row}: al massimo ${max} diagrammi per esercizio`,
    diagramNotObject: (row: number, diagram: number) => `riga ${row}: il diagramma ${diagram} deve essere un oggetto`,
    diagramTitle: (row: number, diagram: number, max: number) =>
      `riga ${row}: diagramma ${diagram}: "title" deve avere da 1 a ${max} caratteri`,
    diagramScene: (row: number, diagram: number, why: string) =>
      `riga ${row}: diagramma ${diagram}: la scena non è valida (${why})`,
  },
  page: {
    title: 'Esercizi',
    import: 'Importa',
    importTitle: 'Importa esercizi',
    draftWithAi: 'Bozza con IA',
    newExercise: 'Nuovo esercizio',
    filterByCategory: 'Filtra per categoria',
    all: 'Tutti',
    none: 'Ancora nessun esercizio.',
    loadError: 'Impossibile caricare gli esercizi. Aggiorna la pagina.',
    loadMoreError: 'Impossibile caricare altri esercizi. Riprova.',
    loadMore: 'Carica altri',
    deleteError: "Impossibile eliminare l'esercizio. Riprova.",
    added: (n: number) => `${plural('it', n, { one: '1 esercizio aggiunto', other: `${n} esercizi aggiunti` })}.`,
    imported: (n: number) => `${plural('it', n, { one: '1 esercizio importato', other: `${n} esercizi importati` })}.`,
    deleteTitle: (name: string) => `Eliminare ${name}?`,
    usageUnknown:
      "Non è stato possibile stabilire in quanti allenamenti sia usato questo esercizio. Eliminandolo, alcuni allenamenti potrebbero restare con un esercizio mancante.",
    usedIn: (n: number) =>
      `${plural('it', n, {
        one: "Questo esercizio è usato in 1 allenamento. Eliminandolo, quell'allenamento resterà con un esercizio mancante.",
        other: `Questo esercizio è usato in ${n} allenamenti. Eliminandolo, quegli allenamenti resteranno con un esercizio mancante.`,
      })}`,
    deletedNotice: (n: string) => `Esercizio “${n}” eliminato`,
    rowMenu: (n: string) => `Azioni per ${n}`,
    edit: 'Modifica',
    confirmDelete: 'Sì, elimina esercizio',
  },
  form: {
    editTitle: 'Modifica esercizio',
    newTitle: 'Nuovo esercizio',
    nameRequired: 'Il nome è obbligatorio.',
    minPlayersRange: (min: number, max: number) => `Il numero minimo di giocatori deve essere un intero da ${min} a ${max}.`,
    saveError: "Impossibile salvare l'esercizio. Riprova.",
    createError: "Impossibile creare l'esercizio. Riprova.",
    offline:
      "Sei offline. Per creare un esercizio e aprire il suo editor di diagrammi serve la connessione; usa Salva, oppure riprova quando sei online.",
    createAndAdd: 'Crea e aggiungi diagrammi',
    saving: 'Salvataggio…',
    name: 'Nome',
    nameHint: (example: string, focuses: string) =>
      `Scrivilo come "Focus: cosa si allena", ad es. "${example}". Il focus è uno tra: ${focuses}.`,
    category: 'Categoria',
    minPlayers: 'Giocatori minimi',
    minPlayersHint: 'Il numero minimo di persone per farlo. Facoltativo.',
    description: 'Descrizione',
    diagrams: 'Diagrammi',
    editDiagrams: 'Modifica diagrammi',
    openDiagram: (title: string) => `Apri il diagramma ${title}`,
  },
  detail: {
    deleted: 'Esercizio eliminato',
    previousExercise: 'Esercizio precedente',
    nextExercise: 'Esercizio successivo',
    previous: 'Precedente',
    next: 'Successivo',
    position: (i: number, total: number) => `Esercizio ${i} di ${total}`,
    minutes: (duration: number, from: number, to: number) => `${duration} min · min ${from}–${to}`,
    minPlayers: (n: number) => `Min ${n} giocatori`,
    wasDeleted: 'Questo esercizio è stato eliminato dalla libreria.',
    diagrams: 'Diagrammi',
    loadingDiagrams: 'Caricamento diagrammi…',
    diagramsError: 'Impossibile caricare i diagrammi.',
    noDiagrams: 'Nessun diagramma per questo esercizio.',
    description: 'Descrizione',
    noDescription: 'Nessuna descrizione.',
  },
} satisfies Catalog['exercises'];
