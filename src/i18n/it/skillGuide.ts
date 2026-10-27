import type { Catalog } from '../catalog';
import type { SkillGuideEntry } from '../../types/skillGuide';

export const skillGuide = {
  loadError: 'Impossibile caricare la guida alle abilità. Aggiorna la pagina.',
  saveError: 'Impossibile salvare la guida alle abilità. Riprova.',
  howToEvaluate: 'Come valutare',
  /** Italian fallback until an admin saves the guide; a saved guide shows its stored text in both languages. */
  defaults: [
    {
      key: 'serve',
      label: 'Battuta',
      ranges: [
        { min: 1, max: 3, description: 'Irregolare, molti errori.' },
        { min: 4, max: 6, description: 'Float o jump float regolare, regge sotto pressione.' },
        { min: 7, max: 8, description: 'Battuta tattica, con direzione ed effetto.' },
        { min: 9, max: 10, description: 'Jump serve veloce, precisa e indirizzata sulle zone.' },
      ],
      howToEvaluate:
        'Conta la percentuale di battute in campo su 10 tentativi. Dai il punteggio in base a precisione, costanza e varietà tattica osservate in partita o in esercizio.',
    },
    {
      key: 'attack',
      label: 'Attacco',
      ranges: [
        { min: 1, max: 3, description: 'Problemi nel gesto del braccio, rincorsa prevedibile.' },
        { min: 4, max: 6, description: 'Colpo pulito con rincorsa a due passi, poche zone.' },
        { min: 7, max: 8, description: 'Attacca in più zone, si adatta all’alzata.' },
        { min: 9, max: 10, description: 'Chiude con continuità, legge il muro, attacca anche da seconda linea.' },
      ],
      howToEvaluate:
        'Registra la percentuale di punti in attacco e di errori in una partita a 3 set o in un esercizio contro muro. Osserva i tempi della rincorsa, la velocità del braccio e la capacità di cambiare direzione al colpo.',
    },
    {
      key: 'block',
      label: 'Muro',
      ranges: [
        { min: 1, max: 3, description: 'Tempo in ritardo, mani corte rispetto alla rete, spesso mani-out e palle sul muro.' },
        { min: 4, max: 6, description: 'Legge l’alzatore, tempo corretto da fermo, chiude la rete sulle palle veloci.' },
        { min: 7, max: 8, description: 'Si sposta e chiude il muro a due, toglie la diagonale o la linea su chiamata.' },
        { min: 9, max: 10, description: 'Legge presto l’attaccante, entra con le mani e spinge, ferma o indirizza la maggior parte degli attacchi.' },
      ],
      howToEvaluate:
        'Conta muri punto, tocchi ed errori di muro in un set o in un esercizio di muro. Valuta il tempo, la penetrazione delle mani oltre la rete e la chiusura con il secondo muratore.',
    },
    {
      key: 'set',
      label: 'Alzata',
      ranges: [
        { min: 1, max: 3, description: 'Contatto o posizione della palla irregolari.' },
        { min: 4, max: 6, description: 'Alzata in palleggio affidabile verso la banda dalla posizione 3.' },
        { min: 7, max: 8, description: 'Alzate dietro, veloci, si adatta a una ricezione imprecisa.' },
        { min: 9, max: 10, description: 'Controlla il ritmo, inganna il muro, guida la squadra.' },
      ],
      howToEvaluate:
        'Valuta la qualità del contatto, la precisione di altezza e distanza dell’alzata e le scelte tattiche in situazioni di gioco. Conta la percentuale di alzate fuori posizione.',
    },
    {
      key: 'defence',
      label: 'Difesa',
      ranges: [
        { min: 1, max: 3, description: 'Solo reattiva, lettura scarsa.' },
        { min: 4, max: 6, description: 'Difende le palle molto forti se è in posizione.' },
        { min: 7, max: 8, description: 'Anticipa la linea d’attacco, copre i pallonetti, buon lavoro di piedi.' },
        { min: 9, max: 10, description: 'Controlla la direzione della difesa, guida il sistema difensivo.' },
      ],
      howToEvaluate:
        'Valuta la percentuale di difese riuscite negli esercizi di pepper e in partita. Osserva il lavoro di piedi, l’angolo delle braccia e la lettura del linguaggio del corpo dell’attaccante.',
    },
    {
      key: 'reception',
      label: 'Ricezione',
      ranges: [
        { min: 1, max: 3, description: 'Braccia instabili, non riesce a indirizzare la palla.' },
        { min: 4, max: 6, description: 'Riceve con continuità in zona 3 su battute di media velocità.' },
        { min: 7, max: 8, description: 'Gestisce float e jump serve, ricezione per il cambio palla.' },
        { min: 9, max: 10, description: 'Alta percentuale di ricezioni perfette, si muove bene sotto pressione.' },
      ],
      howToEvaluate:
        'Misura la qualità della ricezione (scala 0-3) su almeno 15 ricezioni e calcola il punteggio medio. Osserva lo spostamento verso la palla e la costanza delle braccia.',
    },
    {
      key: 'jump',
      label: 'Salto',
      ranges: [
        { min: 1, max: 3, description: 'Meno di 30 cm in verticale.' },
        { min: 4, max: 6, description: '30-40 cm, tempo di salto di base.' },
        { min: 7, max: 8, description: '40-50 cm, buon tempo per muro e attacco.' },
        { min: 9, max: 10, description: 'Oltre 50 cm, tempo da élite per l’età.' },
      ],
      howToEvaluate:
        'Misura il salto verticale da fermo (cm) con il test a muro. Nota: il salto con rincorsa può dare un risultato diverso. Abbinalo all’osservazione del tempo di muro nelle ripetizioni dal vivo.',
    },
    {
      key: 'speed',
      label: 'Velocità',
      ranges: [
        { min: 1, max: 3, description: 'Primo passo lento, copre poco campo.' },
        { min: 4, max: 6, description: 'Reazione nella media, copre la zona vicina.' },
        { min: 7, max: 8, description: 'Primo passo rapido, buon raggio laterale.' },
        { min: 9, max: 10, description: 'Velocità da élite, anticipa, arriva su ogni palla.' },
      ],
      howToEvaluate:
        'Usa il tempo sui 5 m o un test di agilità laterale. Integra con l’osservazione in partita della rapidità del primo passo e della copertura del campo in difesa.',
    },
    {
      key: 'iq',
      label: 'Lettura del gioco',
      ranges: [
        { min: 1, max: 3, description: 'Non è consapevole della situazione di gioco.' },
        { min: 4, max: 6, description: 'Conosce le rotazioni di base e il proprio ruolo.' },
        { min: 7, max: 8, description: 'Legge gli avversari, fa buone scelte tattiche.' },
        { min: 9, max: 10, description: 'Guida i compagni in campo, controlla il ritmo, comanda il sistema.' },
      ],
      howToEvaluate:
        'Osserva in partita o in amichevole: chiama le giocate, riconosce gli accoppiamenti sfavorevoli, si corregge dopo gli errori? Valuta la qualità delle decisioni su un’intera partita, non solo le giocate spettacolari.',
    },
  ] as SkillGuideEntry[],
} satisfies Catalog['skillGuide'];
