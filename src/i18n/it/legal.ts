import type { Catalog } from '../catalog';

export const legal = {
  docTitles: {
    terms: 'Condizioni di servizio',
    dpa: 'Accordo sul trattamento dei dati',
    subprocessors: 'Sub-responsabili',
    privacy: 'Informativa sulla privacy',
    dpiaPack: 'Pacchetto di supporto alla DPIA',
  },
  page: {
    description: (title: string) => `${title} di Volley Skills.`,
    backToApp: "Torna all'app",
    versionInForce: (version: string, since: string) => `Versione ${version}, in vigore dal ${since}`,
    version: (version: string) => `Versione ${version}`,
    notFound: 'Non abbiamo trovato questo testo legale.',
  },
  langSwitcher: 'Lingua del testo legale',
  links: {
    label: 'Note legali',
    terms: 'Condizioni',
    dpa: 'DPA',
    reportContent: 'Segnala un contenuto',
  },
  banner: {
    termsUpdated: (date: string) => `Le Condizioni di servizio aggiornate entrano in vigore il ${date} — `,
    dpaUpdated: (date: string) => `L'Accordo sul trattamento dei dati aggiornato entra in vigore il ${date} — `,
    review: 'consulta',
    reviewTerms: ' le Condizioni di servizio',
    reviewDpa: " l'Accordo sul trattamento dei dati",
    subprocessorsChange: (date: string) =>
      `L'elenco dei sub-responsabili cambia il ${date}. Puoi opporti entro 15 giorni da questo avviso.`,
    seeList: "Vedi l'elenco",
    contactOperator: "Contatta l'operatore",
  },
  review: {
    titleUpdated: 'Consulta le Condizioni e il DPA aggiornati',
    titleFirst: 'Accetta le Condizioni e il DPA',
    dontAgree: "Non sei d'accordo?",
  },
} satisfies Catalog['legal'];
