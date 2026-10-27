import type { Catalog } from '../catalog';

export const clubs = {
  status: {
    pending: 'In attesa',
    active: 'Attivo',
    suspended: 'In pausa',
    terminating: 'In chiusura',
    deleted: 'Eliminato',
  },
  clubFallback: 'Club',
  yourClubFallback: 'Il tuo club',
  gate: {
    contractEndedInstead:
      'Il tuo club ha scelto di terminare il contratto invece di accettare i termini aggiornati. I termini che hai accettato restano validi fino alla scadenza.',
  },
  statusScreen: {
    pending: {
      title: 'Il tuo club è in attesa di attivazione',
      body: (club: string) => `${club} è stato configurato e sarà disponibile non appena verrà attivato.`,
    },
    locked: {
      title: "L'accesso del tuo club è in pausa",
      body: (club: string) =>
        `L'accesso a ${club} è per ora in pausa. Contatta l'amministratore del club per saperne di più.`,
    },
    ended: {
      title: 'Il contratto del tuo club è terminato',
      body: (club: string) => `Il contratto di ${club} è terminato e i suoi dati non sono più disponibili.`,
    },
    emailWhenActive: 'Ti scriveremo via email quando sarà attivo.',
    accepted: 'Accettati:',
    termsOfService: (version: string) => `Termini di servizio ${version}`,
    and: ' e ',
    dpa: (version: string) => `Accordo sul trattamento dei dati ${version}`,
    switchTo: (club: string) => `Passa a ${club}`,
    signOut: 'Esci',
  },
  welcome: {
    title: 'Benvenuto/a su Volley Skills',
    noLongerAccess: 'Non hai più accesso a questo club.',
    askAdmin: (email: string) =>
      `Chiedi all'amministratore del club di aggiungere ${email} al tuo club, poi accedi di nuovo.`,
    openPlatform: 'Apri la pagina della piattaforma',
    createClub: 'Crea un club',
    switchTo: (club: string) => `Passa a ${club}`,
    signOut: 'Esci',
  },
  endingBanner: {
    adminWithExport: (end: string, exportBy: string) =>
      `Il tuo contratto termina il ${end}. Esporta i tuoi dati entro il ${exportBy}.`,
    member: (end: string) => `Il contratto del tuo club termina il ${end}.`,
  },
  area: {
    pageTitle: 'Club',
    sectionsLabel: 'Sezioni del club',
    tabs: {
      profile: 'Profilo',
      people: 'Persone e accessi',
      export: 'Esporta',
      contract: 'Contratto',
    },
  },
  profile: {
    nameLabel: 'Nome del club',
    nameLength: 'Il nome del club deve avere tra 2 e 80 caratteri.',
    country: 'Paese',
    aiTitle: 'Funzioni IA',
    aiDescription:
      'Permette al tuo staff di usare la bozza con IA e lo scouting da testo con la propria chiave del provider. Disattivato per impostazione predefinita.',
    growthTitle: 'Test di crescita',
    growthDescription:
      'Altezza e massa corporea possono essere dati sanitari. Attiva solo se il tuo club ha una base giuridica per registrarli.',
    referenceTitle: 'Non citare il nostro club come cliente',
    referenceDescription: 'Non indicheremo il tuo club come cliente di riferimento.',
    saved: 'Dati del club salvati',
  },
  people: {
    loadFailed: 'Impossibile caricare le persone. Aggiorna la pagina.',
    invalidEmail: 'Inserisci un indirizzo email valido.',
    alreadyMember: (email: string) => `${email} è già membro.`,
    addFailed: 'Impossibile aggiungere questa persona. Riprova.',
    removeFailed: 'Impossibile rimuovere questa persona. Riprova.',
    transferFailed: 'Impossibile trasferire la titolarità. Riprova.',
    sections: { exercises: 'Esercizi', trainings: 'Allenamenti', guides: 'Guide' },
    addByEmail: 'Aggiungi una persona via email',
    role: 'Ruolo',
    member: 'Membro',
    admin: 'Amministratore',
    addPerson: 'Aggiungi persona',
    people: 'Persone',
    owner: 'Titolare',
    selectPerson: "Seleziona una persona per gestirne l'accesso.",
    adminsFullAccess: 'Gli amministratori hanno accesso completo a ogni squadra e sezione.',
    sectionsLegend: 'Sezioni',
    teamsLegend: 'Squadre',
    makeMember: 'Rendi membro',
    makeAdmin: 'Rendi amministratore',
    makeOwner: 'Rendi titolare',
    removeFromClub: 'Rimuovi dal club',
    reason: {
      owner: 'Il titolare del club resta amministratore. Trasferisci prima la titolarità.',
      lastAdmin: 'Un club ha bisogno di almeno un amministratore.',
      demoteFirst: 'Rendi prima questa persona membro, poi potrai rimuoverla.',
    },
    removeTitle: (email: string) => `Rimuovere ${email} dal club?`,
    removeMessage: 'Perde subito ogni accesso alle squadre e alle sezioni di questo club.',
    removeConfirm: 'Rimuovi',
    demoteTitle: 'Smettere di essere amministratore?',
    demoteMessage:
      'Perdi l\'accesso da amministratore a questo club, compresa questa pagina. Poi la pagina si ricarica.',
    demoteConfirm: 'Rendimi membro',
    ownerTitle: (email: string) => `Rendere ${email} titolare del club?`,
    ownerMessage: 'Il titolare riceve la fatturazione e i contatti sul contratto. Tu resti amministratore.',
    ownerConfirm: 'Rendi titolare',
  },
  contract: {
    requested: 'Fine del contratto richiesta',
    requestFailed: 'Impossibile inviare la richiesta. Riprova.',
    status: 'Stato',
    fullUseUntil: (date: string) => `Uso completo fino al ${date}`,
    exportUntil: (date: string) => `Esportazione dei dati fino al ${date}`,
    acceptedTerms: 'Termini accettati',
    acceptedSummary: (versionKey: string, date: string | null, by: string) =>
      `${versionKey}, accettati ${date ? `il ${date} ` : ''}da ${by}`,
    notAccepted: 'Non ancora accettati',
    terms: 'Termini',
    dpa: 'DPA',
    subprocessors: 'Sub-responsabili',
    requestedOn: (date: string, by: string) => `Fine del contratto richiesta il ${date} da ${by}`,
    endOurContract: 'Termina il nostro contratto',
    questionsPrefix: 'Domande sul contratto? Contatta ',
    questionsSuffix: '.',
    confirmTitle: 'Terminare il contratto del tuo club?',
    confirmMessage:
      'Ci verrà comunicato che vuoi andartene. Il tuo club mantiene l\'uso completo e una finestra per esportare i dati fino alla data di fine che confermeremo.',
    confirmLabel: 'Richiedi la fine del contratto',
  },
  export: {
    starting: 'Avvio',
    downloaded: 'Esportazione scaricata',
    failed: (message: string) => `Esportazione non riuscita: ${message}. Non è stato scaricato nulla.`,
    title: 'Esporta i dati del tuo club',
    description:
      "Un unico file ZIP con tutto ciò che il tuo club ha archiviato: squadre, giocatori, test atletici, partite con ogni evento di scouting, la libreria, le guide e gli elenchi di accesso. Il file README.txt al suo interno spiega ogni file. Contiene dati personali di minorenni, quindi conservalo in un posto sicuro.",
    download: 'Scarica esportazione',
    progress: {
      clubAndPeople: 'Club e persone',
      team: (i: number, n: number, name: string) => `Squadra ${i} di ${n}: ${name}`,
      library: 'Libreria',
      guidesAndAccess: 'Guide e accessi',
    },
  },
} satisfies Catalog['clubs'];
