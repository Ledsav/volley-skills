import type { Catalog } from '../catalog';

export const signup = {
  shared: {
    createClub: 'Crea il tuo club',
    next: 'Avanti',
    yourName: 'Il tuo nome',
    authority: 'Sono autorizzato/a ad agire per questo club e ne accetto i termini a suo nome',
    nameRequired: 'Inserisci il tuo nome (da 1 a 100 caratteri).',
    authorityRequired: 'Conferma di essere autorizzato/a ad agire per questo club.',
  },
  info: {
    description: 'Configura il tuo club di pallavolo su Volley Skills.',
    signIn: 'Accedi',
    steps: {
      signIn: 'Accedi con la tua email.',
      details: 'Inserisci i dati del tuo club.',
      accept: 'Leggi e accetta le Condizioni di servizio e l’Accordo sul trattamento dei dati.',
      confirm: 'Conferma le clausole che richiedono un’approvazione specifica tramite un link che ti inviamo via email.',
    },
    manual: 'Attiviamo i nuovi club a mano e ti scriveremo via email quando il tuo sarà pronto.',
    start: 'Inizia',
  },
  page: {
    alreadyPending: 'Hai già un club in attesa di attivazione',
    emailWhenActive: 'Ti scriveremo via email quando sarà attivo.',
    clubNameError: 'Inserisci un nome del club da 2 a 80 caratteri.',
    countryError: 'Scegli un paese.',
    step: (step: number) => `Passo ${step} di 3`,
    stepTitles: { details: 'Il tuo club', documents: 'Termini e trattamento dei dati', approval: 'Approvazione specifica' },
    clubName: 'Nome del club',
    country: 'Paese',
    selectCountry: 'Seleziona un paese',
    clubLanguage: 'Lingua del club',
  },
  documents: {
    openInNewTab: 'Apri in una nuova scheda',
    accept: (title: string) => `Ho letto e accetto: ${title}`,
    scrollHint: 'Scorri fino alla fine del testo, o aprilo in una nuova scheda, per attivare questa casella.',
    listOf: 'L’elenco dei',
    isPart: 'fa parte di ciò che accetti.',
  },
  approval: {
    intro:
      'Queste clausole limitano la responsabilità, stabiliscono come il servizio può cambiare o terminare, o decidono come vengono gestite le controversie. Ognuna richiede la tua approvazione specifica.',
    sent: (email: string) => `Abbiamo inviato un link di conferma a ${email}. Aprilo in questo browser per firmare.`,
    approve: 'Approva specificamente queste clausole',
    sendFailed: 'Impossibile inviare il link di conferma. Riprova.',
  },
  complete: {
    title: 'Completamento della registrazione',
    working: 'Stiamo completando la tua registrazione...',
    linkExpired: 'Il link ha più di 15 minuti. Invia un nuovo link per confermare di nuovo.',
    sendNewLink: 'Invia un nuovo link',
    linkSent: 'Abbiamo inviato un nuovo link. Aprilo in questo browser per firmare.',
    noDraft:
      'In questo browser non c’è nessuna firma in corso. Se hai iniziato in un altro browser, apri il link lì.',
    wrongLink:
      'Questo link non corrisponde alla firma in corso in questo browser. Apri l’ultimo link che ti abbiamo inviato.',
    wrongAccount:
      'Hai effettuato l’accesso con un account diverso da quello che ha avviato la registrazione. Esci e usa di nuovo il link.',
    signOut: 'Esci',
    error: 'Non è stato possibile completare la registrazione. Riprova.',
    tryAgain: 'Riprova',
    resendError: 'Impossibile inviare un nuovo link. Riprova.',
  },
} satisfies Catalog['signup'];
