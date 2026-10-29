import type { Catalog } from '../catalog';

export const auth = {
  shell: {
    tagline1: 'Giocatori. Progressi.',
    tagline2: 'Insieme.',
    pitch:
      'Segui le abilità di ogni giocatore, pianifica il suo sviluppo e gestisci gli allenamenti, tutto in un unico posto. Pensato per allenatori e club.',
  },
  shared: {
    noAccess: 'Non hai accesso a questa pagina.',
  },
  loginPage: {
    pageTitle: 'Accedi',
    pageDescription: 'Accedi a Volley Skills, lo strumento di squadra per i club di pallavolo.',
    sendLinkError: "Impossibile inviare il link di accesso. Controlla l'indirizzo email e riprova.",
    googleError: 'Impossibile accedere con Google. Riprova.',
    checkEmail: 'Controlla la tua email',
    sentTo: 'Abbiamo inviato un link di accesso a ',
    welcomeBack: 'Bentornato/a',
    requestAccess: 'Richiedi accesso',
    email: 'Email',
    emailPlaceholder: 'allenatore@tuoclub.it',
    sendLink: 'Invia link di accesso',
    or: 'oppure',
    continueWithGoogle: 'Continua con Google',
    noAccessYet: "Non hai ancora l'accesso?",
    requestEarlyAccess: "Richiedi l'accesso anticipato",
    openOnThisDevice: 'Aprilo su questo dispositivo.',
    createClub: 'Crea il tuo club',
  },
  finishSignIn: {
    pageTitle: 'Accesso in corso',
    invalidLink: 'Questo link di accesso non è valido o è scaduto.',
    emailNotFound:
      "Impossibile trovare l'email a cui è stato inviato questo link. Richiedi un nuovo link dallo stesso browser.",
    linkFailed: 'Impossibile usare questo link di accesso. Richiedine uno nuovo.',
    signingIn: 'Accesso in corso...',
  },
  requireAuth: {
    loading: 'Caricamento...',
    wentWrong: "Qualcosa è andato storto durante l'accesso. ",
    tryAgain: 'Riprova',
  },
  signOut: {
    unsyncedTitle: 'Azioni di scouting non sincronizzate',
    unsyncedMessage:
      'Alcune azioni di scouting non sono ancora state sincronizzate. Uscire comunque? Andranno perse.',
    signOutAnyway: 'Esci comunque',
  },
} satisfies Catalog['auth'];
