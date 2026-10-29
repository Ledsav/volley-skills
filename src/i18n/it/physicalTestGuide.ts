import type { Catalog } from '../catalog';
import type { PhysicalTestGuideEntry } from '../../types/physicalTestGuide';

export const physicalTestGuide = {
  loadError: 'Impossibile caricare la guida ai test atletici. Aggiorna la pagina.',
  saveError: 'Impossibile salvare la guida ai test atletici. Riprova.',
  saved: 'Guida ai test atletici salvata',
  protocol: 'Protocollo',
  /** Italian fallback until an admin saves the guide; a saved guide shows its stored text in both languages. */
  defaults: [
    {
      key: 'growth',
      label: 'Crescita',
      protocol:
        'Registra altezza (cm) e massa corporea (kg). È il principale indicatore di crescita e contesto: segui le misure esatte nel tempo.',
    },
    {
      key: 'cmj',
      label: 'Salto con contromovimento',
      protocol:
        'Mani sui fianchi, se possibile (l’oscillazione delle braccia aggiunge variabilità). Discesa rapida e salto il più alto possibile. Registra il migliore di 3 tentativi, con circa 45-60 s di recupero tra uno e l’altro. Usa un tappeto a pressione o un’app sul telefono se disponibili; altrimenti usa ogni volta lo stesso metodo con muro e gesso.',
    },
    {
      key: 'approachJump',
      label: 'Salto con rincorsa',
      protocol:
        'Usa la stessa rincorsa a ogni test. Misura prima l’altezza a braccio alzato da fermo, poi l’altezza massima di tocco con 3 tentativi di salto con rincorsa. Salto con rincorsa = tocco massimo − altezza da fermo. Registra entrambe le misure: anche il tocco massimo è significativo per i giocatori.',
    },
    {
      key: 'broadJump',
      label: 'Salto in lungo da fermo',
      protocol:
        'Punta dei piedi dietro la linea, stacco a piedi uniti e atterraggio controllato a piedi uniti. Misura dalla linea di partenza al tallone più arretrato. Tre tentativi, vale il migliore.',
    },
    {
      key: 'sprint10m',
      label: 'Sprint 10 m',
      protocol:
        'Parti 0,5-1 m prima della linea. Misura 10 m. Due o tre tentativi con circa 2 minuti di recupero. Vale il tempo migliore. Le fotocellule sono l’ideale; altrimenti usa lo stesso cronometro o metodo a ogni sessione, oppure riprendi partenza e arrivo al rallentatore.',
    },
    {
      key: 'shuttle5105',
      label: 'Navetta 5-10-5',
      protocol:
        'Disponi tre coni o linee a 5 m l’uno dall’altro e parti da quello centrale. Sprint di 5 m in una direzione, cambio e sprint di 10 m dall’altra parte, cambio e sprint di 5 m fino a tornare al centro. Testa sia partendo da destra sia da sinistra: la differenza tra i due lati spesso è più utile del tempo complessivo.',
    },
    {
      key: 'reaction',
      label: 'Tempo di reazione',
      protocol:
        'Test del righello. L’atleta tiene pollice e indice attorno alla base del righello senza toccarlo; chi testa lo lascia cadere senza preavviso; l’atleta lo afferra. Registra la distanza percorsa. Fai 5 tentativi, scarta il migliore e il peggiore e fai la media dei 3 centrali. Considera questa una misura secondaria: gli esercizi reattivi specifici della pallavolo contano di più per la reazione in partita.',
    },
    {
      key: 'strength',
      label: 'Forza',
      protocol:
        'A questa età non fare un test massimale di 1RM. Quando la tecnica è solida, usa un 6RM pulito in un solo esercizio standard (stacco con trap bar, squat o goblet squat) e confronta ogni atleta con i propri risultati nel tempo. Se non c’è accesso a una palestra, non inventare un test con pesi di qualità inferiore: misura le ripetizioni di flessioni o di split squat come resistenza muscolare e usa i salti per la potenza degli arti inferiori.',
    },
  ] as PhysicalTestGuideEntry[],
} satisfies Catalog['physicalTestGuide'];
