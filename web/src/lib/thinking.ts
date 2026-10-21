/**
 * Les phrases de Kodi pendant qu'il travaille. Hors du composant client
 * KodeThinking, pour que les pages serveur (écrans de chargement) puissent
 * les lire elles aussi.
 */
export const THINKING = {
  chat: [
    'Kodi fouille ton dressing',
    'Kodi assemble les couleurs',
    'Kodi pense à la météo',
    'Kodi essaie une association',
    'Kodi peaufine la tenue',
  ],
  page: [
    'Kodi ouvre ton dressing',
    'Kodi range tes portants',
    'Kodi prépare la page',
  ],
  send: [
    'Kodi reçoit tes photos',
    'Kodi les regarde de près',
  ],
  save: [
    'Kodi note tout ça',
    'Kodi prépare ton espace',
  ],
} as const;

