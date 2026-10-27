import type { Catalog } from '../catalog';

export const common = {
  save: 'Salva',
  cancel: 'Annulla',
  delete: 'Elimina',
  close: 'Chiudi',
  back: 'Indietro',
  loading: 'Caricamento…',
  retry: 'Riprova',
  couldNotSave: 'Impossibile salvare. Riprova.',
  couldNotValidate: 'Impossibile convalidare i dati. Riprova.',
  couldNotUpdateClub: 'Impossibile aggiornare il club. Riprova.',
  couldNotLoadTeam: 'Impossibile caricare la squadra. Riprova.',
  couldNotDeleteSession: 'Impossibile eliminare la sessione. Riprova.',
  couldNotChangeRole: 'Impossibile cambiare il ruolo. Riprova.',
  couldNotUpdateMembership: 'Impossibile aggiornare l’appartenenza. Riprova.',
} satisfies Catalog['common'];
