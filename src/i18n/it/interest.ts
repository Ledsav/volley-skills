import type { Catalog } from '../catalog';
import { plural } from '../plural';

export const interest = {
  roles: {
    coach: 'Allenatore/trice',
    guardian: 'Genitore/tutore',
    player: 'Giocatore/trice',
    other: 'Altro',
  },
  requestAccess: {
    pageTitle: 'Richiedi accesso',
    pageDescription: "Richiedi l'accesso a Volley Skills.",
    submitError: 'Impossibile inviare la richiesta. Riprova.',
    thanks: 'Grazie!',
    gotRequest: "Abbiamo ricevuto la tua richiesta e ti contatteremo per l'accesso anticipato.",
    backToSignIn: "Torna all'accesso",
    heading: 'Iniziamo a configurare tutto',
    signIn: 'Accedi',
    intro: "Raccontaci qualcosa di te e ti contatteremo quando l'accesso sarà pronto.",
    name: 'Nome',
    namePlaceholder: 'Giulia Rossi',
    email: 'Email',
    emailPlaceholder: 'tu@esempio.it',
    iAm: 'Sono...',
    privacyBefore:
      "Usiamo il tuo nome e la tua email solo per valutare questa richiesta e contattarti riguardo all'accesso, e li eliminiamo una volta gestita. Se hai meno di 16 anni, chiedi a un genitore o tutore di inviare la richiesta al posto tuo. Leggi l'",
    privacyLink: 'informativa sulla privacy',
    submit: 'Richiedi accesso',
    alreadyHaveAccess: 'Hai già accesso? Accedi',
  },
  panel: {
    loadError: 'Impossibile caricare le richieste di accesso. Aggiorna la pagina.',
    loadMoreError: 'Impossibile caricare altre richieste. Riprova.',
    updateError: 'Impossibile aggiornare questa richiesta. Riprova.',
    deleteError: 'Impossibile eliminare questa richiesta. Riprova.',
    heading: 'Richieste di accesso',
    newCount: (n: number) => `${n} ${plural('it', n, { one: 'nuova', other: 'nuove' })}`,
    empty: "Nessuno ha ancora richiesto l'accesso.",
    newBadge: 'Nuova',
    grantAccess: 'Concedi accesso',
    markReviewed: 'Segna come vista',
    delete: 'Elimina',
    loadMore: 'Carica altre',
    deleteTitle: (name: string) => `Eliminare la richiesta di ${name}?`,
    deleteMessage: "Nome ed email vengono rimossi definitivamente. Concedi prima l'accesso se deve mantenerlo.",
    deleteConfirm: 'Elimina richiesta',
  },
} satisfies Catalog['interest'];
