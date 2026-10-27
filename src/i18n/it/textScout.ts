import type { Catalog } from '../catalog';
import type { Side } from '../../types/match';

const SIDE: Record<Side, string> = { us: 'noi', them: 'loro' };
const SIDE_TO: Record<Side, string> = { us: 'a noi', them: 'a loro' };
const serves = (weServe: boolean) => (weServe ? 'battiamo noi' : 'battono loro');

export const textScout = {
  panel: {
    ariaLabel: 'Scouting a testo',
    title: 'Testo',
    close: 'Chiudi',
    inserting: (after, us, them, set, rot, weServe) =>
      `Inserimento ${after ? 'dopo' : 'a'} ${us}–${them} · Set ${set} · Rot ${rot} · ${serves(weServe)}`,
    startSetFirst: 'Inizia prima il set.',
    noProvider: 'Nessun provider IA configurato.',
    openSettings: 'Apri Impostazioni',
    offline: 'Offline: le note sono salvate, elaborale quando torni online.',
    matchNotes: 'Note della partita',
    placeholder: '7 ace\n12 ricezione scarsa, 2 alzata, 9 punto in attacco\nerrore avv. · TO loro · entra 8 al posto di 9',
    tipResult: 'Suggerimento: aggiungi il risultato (punto, fuori, murato, buona…).',
    tipDictate: 'Suggerimento: tocca il microfono della tastiera per dettare, ad esempio "buona battuta del 7, poi punto in attacco del 12".',
    privacy: 'Le note vengono inviate al tuo provider IA: usa solo i numeri di maglia, senza nomi (nemmeno degli avversari) né informazioni su infortuni o salute.',
    process: 'Elabora',
    cancel: 'Annulla',
    processing: (i, total) => (total > 1 ? `Elaborazione ${i}/${total}…` : 'Elaborazione…'),
    cancelled: 'Annullato.',
    timedOut: 'Tempo scaduto: le note sono state conservate.',
    wentWrong: 'Qualcosa è andato storto. Le note sono state conservate.',
    retryIn: (provider, sec) => `Limite di richieste di ${provider} raggiunto: riprova tra ${sec} s.`,
    tryAgainSoon: (provider) => `Limite di richieste di ${provider} raggiunto: riprova tra un momento.`,
    localHint: 'Ollama / LM Studio è in esecuzione e consente questo sito?',
    errors: {
      notConfigured: 'Configura prima un provider IA nelle Impostazioni.',
      unauthorized: 'Chiave rifiutata: controllala nelle Impostazioni.',
      rateLimited: 'Limite di richieste raggiunto.',
      unreachable: 'Impossibile raggiungere il provider IA. Le note sono state conservate.',
      badResponse: 'Impossibile interpretare la risposta: modifica le note o inserisci con i tocchi.',
      privacyBlocked: 'Nessun provider per questo modello mantiene private le tue note (zero data retention). Scegli un altro modello nelle Impostazioni.',
      http: 'Il provider IA ha restituito un errore. Le note sono state conservate.',
    },
    scoreChange: (fromUs, fromThem, us, them, rot, weServe) =>
      `${fromUs}–${fromThem} → ${us}–${them} · Rot ${rot} · ${serves(weServe)}`,
    laterWarnings: (n) => `${n} eventi successivi avranno degli avvisi dopo questo inserimento: controlla la cronologia.`,
    notUnderstood: 'Non compreso:',
    actualUs: 'Punteggio reale: noi',
    actualUsAria: 'Punteggio reale noi',
    actualThem: 'loro',
    actualThemAria: 'Punteggio reale loro',
    mismatch: (us, them, actualUs, actualThem) =>
      `La ricostruzione dà ${us}–${them}, il punteggio reale è ${actualUs}–${actualThem}. Controlla gli scambi senza vincitore.`,
    discard: 'Scarta',
    merge: 'Unisci',
  },
  preview: {
    rally: (n) => `Scambio ${n}`,
    deleteRally: (n) => `Elimina scambio ${n}`,
    sub: (inNumber, outNumber) => `Cambio: entra #${inNumber} al posto di #${outNumber}`,
    timeout: (team) => `Time-out ${SIDE[team]}`,
    playerAria: (n, i) => `Scambio ${n} azione ${i} giocatore`,
    skillAria: (n, i) => `Scambio ${n} azione ${i} fondamentale`,
    gradeAria: (n, i) => `Scambio ${n} azione ${i} valutazione`,
    deleteActionAria: (n, i) => `Elimina scambio ${n} azione ${i}`,
    pickGrade: 'Scegli una valutazione',
    point: 'Punto',
    pointAria: (n) => `Scambio ${n} punto`,
    fromActions: 'Dalle azioni',
    us: 'Noi',
    them: 'Loro',
  },
  issues: {
    unknownNumber: (n) => `Il #${n} non è nella rosa di questa partita.`,
    missingGrade: (n, skill) => `Scegli una valutazione per #${n} ${skill}.`,
    invalidGrade: (skill, grade) => `${skill} non ha la valutazione "${grade}".`,
    conflictingWinner: (actions, notes) => `Le azioni assegnano il punto ${SIDE_TO[actions]}, le note ${SIDE_TO[notes]}.`,
    noWinner: 'Nessun vincitore per questo scambio.',
  },
} satisfies Catalog['textScout'];
