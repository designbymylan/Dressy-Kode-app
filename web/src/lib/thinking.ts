/**
 * Les phrases de Kode pendant qu'il travaille. Hors du composant client
 * KodeThinking, pour que les pages serveur (écrans de chargement) puissent
 * les lire elles aussi.
 */
export const THINKING = {
  chat: [
    'Kode fouille ton dressing',
    'Kode assemble les couleurs',
    'Kode pense à la météo',
    'Kode essaie une association',
    'Kode peaufine la tenue',
  ],
  page: [
    'Kode ouvre ton dressing',
    'Kode range tes portants',
    'Kode prépare la page',
  ],
  send: [
    'Kode reçoit tes photos',
    'Kode les regarde de près',
  ],
  save: [
    'Kode note tout ça',
    'Kode prépare ton espace',
  ],
} as const;

