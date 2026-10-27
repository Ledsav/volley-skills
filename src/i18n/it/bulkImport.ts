import type { Catalog } from '../catalog';
import { plural } from '../plural';

export const bulkImport = {
  issues: {
    blank: "incolla o carica prima del JSON",
    invalidJson: (message: string) => `JSON non valido: ${message}`,
    notArray: 'il livello principale deve essere un array JSON (parentesi quadre)',
    empty: "l'array è vuoto — non c'è niente da importare",
    tooMany: (max: number) => `si possono importare al massimo ${max} voci per volta; dividi il file in gruppi più piccoli`,
  },
  exampleFormat: 'Formato di esempio',
  pasteJson: 'Incolla il JSON',
  chooseFile: '…oppure scegli un file',
  validate: 'Verifica',
  checking: 'Verifica in corso…',
  ready: (n: number) => `${plural('it', n, { one: '1 voce pronta', other: `${n} voci pronte` })} da importare.`,
  importError: 'Impossibile importare. Non è stato salvato nulla. Riprova.',
  import: 'Importa',
  importing: 'Importazione…',
} satisfies Catalog['bulkImport'];
