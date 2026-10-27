import type { Catalog } from '../catalog';

export const teams = {
  gender: {
    label: 'Tipo di squadra',
    choose: 'Scegli…',
    women: 'Femminile',
    men: 'Maschile',
    mixed: 'Mista',
    prompt: 'Questa è una squadra femminile, maschile o mista?',
    promptHint: 'Serve per i testi in italiano. Puoi cambiarlo più tardi nelle Impostazioni.',
    saveError: 'Impossibile salvare il tipo di squadra. Riprova.',
    importRequired: (n: number) => `riga ${n}: "gender" è obbligatorio (women, men o mixed)`,
    importInvalid: (n: number) => `riga ${n}: "gender" deve essere women, men o mixed`,
  },
} satisfies Catalog['teams'];
