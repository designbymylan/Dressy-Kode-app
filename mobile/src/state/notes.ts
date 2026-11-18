/**
 * Noter le dessin d'une pièce (18/11) : trois notes de 1 à 5, une seule fois
 * par pièce, modifiable. Elles mesurent la bêta ; Kodi ne les lit pas.
 */
export type NoteDessin = { temps: number; qualite: number; rendu: number };

export type Critere = keyof NoteDessin;

/** Les trois critères, dans l'ordre où on les juge : l'attente, puis l'image, puis la ressemblance. */
export const CRITERES: { id: Critere; label: string; detail: string }[] = [
  { id: 'temps', label: 'Le temps', detail: 'Kodi a-t-il été assez rapide ?' },
  { id: 'qualite', label: 'La qualité', detail: 'Netteté, détails, couleurs' },
  { id: 'rendu', label: 'Le rendu final', detail: 'Ressemble-t-il à ta pièce ?' },
];

/** Ce que dit une note, pour le lecteur d'écran et pour l'œil. */
export const MOTS = ['Décevant', 'Moyen', 'Correct', 'Bien', 'Excellent'] as const;

export const estNote = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;

/** Les trois notes sont données : sans elles, rien ne s'envoie. */
export const complete = (n: Partial<NoteDessin>): n is NoteDessin => estNote(n.temps) && estNote(n.qualite) && estNote(n.rendu);

/** La moyenne des trois, à une décimale (« 4,3 »). */
export const moyenne = (n: NoteDessin) => (Math.round(((n.temps + n.qualite + n.rendu) / 3) * 10) / 10).toString().replace('.', ',');
