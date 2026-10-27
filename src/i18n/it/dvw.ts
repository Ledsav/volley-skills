import type { Catalog } from '../catalog';
import { plural } from '../plural';

/** "riga 3" o "righe 1, 2, 3, 4, 5, …": al massimo le prime cinque righe. */
const lineList = (lines: number[]) =>
  `${plural('it', lines.length, { one: 'riga', other: 'righe' })} ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? ', …' : ''}`;
const actions = (n: number) => `${n} ${plural('it', n, { one: 'azione', other: 'azioni' })}`;
const FIX = 'segna i tuoi centrali come Centrale nella rosa della squadra, poi importa di nuovo.';

export const dvw = {
  lineList,
  messages: {
    notDvw: 'Questo non sembra un file DataVolley.',
    unsupportedRegulation: 'Regolamento non supportato: si possono importare solo partite indoor con rally point.',
    noRallies: 'Questo file non contiene scambi rilevati.',
    playerNoJersey: (line) => `Saltata una riga giocatore senza numero di maglia: "${line}"`,
    setNumberMismatch: (set, lines) =>
      `Set ${set}: ${lines.length} ${plural('it', lines.length, { one: 'riga di scouting ha', other: 'righe di scouting hanno' })} un numero di set mancante o diverso (${lineList(lines)}); sono stati usati i marcatori di set.`,
    sameAppPlayer: (first, second) => `Due giocatori del file sono associati allo stesso giocatore dell’app (#${first} e #${second}).`,
    tooManyLiberos: 'L’app accetta al massimo due liberi: salta gli altri o associali ad altri giocatori.',
    liberoReplaces: (jerseys) =>
      `Letto dal file: il libero sostituisce ${jerseys.map((j) => `#${j}`).join(', ')} in seconda linea. Se non è corretto, ${FIX}`,
    liberoNeverOnCourt: `Il libero non entra mai in campo: ${FIX}`,
    startersUnmapped: (set) => `Associa o mantieni tutti i titolari: l’app richiede sei giocatori in campo nel set ${set}.`,
    tooLong: 'Questa partita è troppo lunga per essere importata (più di 1.900 eventi).',
    unlistedJersey: (jersey, line) => `Il #${jersey} non è nell’elenco giocatori del file (visto per la prima volta alla riga ${line}).`,
    droppedGrade: (skill, grade, lines) =>
      `${lines.length} ${plural('it', lines.length, { one: 'azione', other: 'azioni' })} di ${skill} "${grade}" ${plural('it', lines.length, { one: 'scartata', other: 'scartate' })}: nell’app non esiste questa valutazione (${lineList(lines)}).`,
    droppedUnknownPlayer: (lines) =>
      `${actions(lines.length)} di un giocatore sconosciuto ($$) ${plural('it', lines.length, { one: 'scartata', other: 'scartate' })} (${lineList(lines)}).`,
    droppedForJersey: (reason, jersey, lines) =>
      `${actions(lines.length)} del #${jersey} ${plural('it', lines.length, { one: 'scartata', other: 'scartate' })}: ${reason === 'unmapped' ? 'giocatore non associato' : 'lo scambio era già deciso'} (${lineList(lines)}).`,
    subUnmapped: (line, out, inn) => `Riga ${line}: il cambio #${out} → #${inn} ha un giocatore non associato, saltato.`,
    endedOtherWay: (line, pointLine, winner) =>
      `Riga ${line}: questa azione ha chiuso lo scambio nell’altro senso; la riga ${pointLine} assegna il punto ${winner === 'us' ? 'a noi' : 'agli avversari'}, azione scartata.`,
    scoreDiffers: 'Il punteggio ricostruito è diverso dai punteggi dei set nel file.',
  },
  review: {
    alreadyImported: (date, opponent) => `Questo file è già stato importato il ${date} contro ${opponent}.`,
    openExisting: 'Apri la partita esistente',
    date: 'Data',
    opponent: 'Avversario',
    competition: 'Competizione',
    league: 'Campionato',
    cup: 'Coppa',
    friendly: 'Amichevole',
    tournament: 'Torneo',
    format: 'Formato',
    bestOf3: 'Al meglio dei 3 set',
    bestOf5: 'Al meglio dei 5 set',
    whichTeam: 'Quale squadra siamo noi',
    home: 'casa',
    visiting: 'ospite',
    roster: 'Rosa',
    notInList: 'Non nell’elenco giocatori',
    unknownRole: 'Sconosciuto',
    mapAria: (jersey, name) => `Associa #${jersey} ${name}`,
    skip: 'Salta',
    checks: 'Controlli',
    set: 'Set',
    file: 'File',
    pointLines: 'Righe punto',
    replayed: 'Ricostruito',
    setN: (n) => `Set ${n}`,
    corrections: (n) => `${n} ${plural('it', n, { one: 'correzione', other: 'correzioni' })} del punteggio`,
    correctionLines: (lines) => `(righe ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? ', …' : ''})`,
    events: 'Eventi:',
    eventTypes: { setStart: 'inizio set', action: 'azione', point: 'punto', sub: 'cambio', timeout: 'time-out', correction: 'correzione', setEnd: 'fine set' },
    none: 'nessuno',
    ignored: (n) => `${n} ${plural('it', n, { one: 'riga ignorata', other: 'righe ignorate' })}`,
    scoresDiffer: 'I punteggi dei set ricostruiti sono diversi da quelli del file.',
    checkedScores: 'Ho controllato i punteggi',
    cancel: 'Annulla',
    import: 'Importa',
  },
  dialog: {
    title: 'Importa da DataVolley (.dvw)',
    tooLarge: 'Questo file supera i 2 MB.',
    readError: 'Impossibile leggere questo file. Controlla la connessione e riprova.',
    imported: 'Partita importata.',
    discardError: 'Impossibile scartare l’importazione parziale. Controlla la connessione e riprova.',
    importing: (done, total) => `Importazione… ${done}/${total}`,
    notFinished: 'L’importazione non è terminata. Riprova o scarta ciò che è stato scritto.',
    discard: 'Scarta',
    retry: 'Riprova',
    fileLabel: 'File DVW',
    help: 'Scegli un file di scouting DataVolley (fino a 2 MB). Viene letto su questo dispositivo; i nomi dei giocatori al suo interno si vedono solo durante la revisione. Funziona anche con gli export .dvw di Click&Scout e VolleyStation.',
    reading: 'Lettura del file…',
    disclaimer: 'Non affiliato a Data Project o Genius Sports. DataVolley è un marchio del suo titolare.',
  },
} satisfies Catalog['dvw'];
