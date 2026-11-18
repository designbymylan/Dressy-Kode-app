/**
 * Ce que dit la notification « Kodi a fini » (18/11). Logique pure, sans
 * Deno : `node supabase/functions/notifier/composer.test.ts` l'essaie.
 *
 * Une photo = une tâche mère et ses tâches filles (une par pièce). On prévient
 * une fois, quand plus aucune n'est en cours. Tutoiement, aucun nom de modèle
 * ni de fournisseur, aucune marque : le nom d'une pièce est celui de la fiche.
 */

export type Tache = {
  id: string;
  status: string;
  garment_id: string | null;
  target: { name?: string } | null;
  analysis: { name?: string } | null;
};

const FINI = new Set(['done', 'failed']);

/** Plus aucune tâche de la photo n'est en cours. */
export const termine = (taches: Tache[]): boolean => taches.length > 0 && taches.every((t) => FINI.has(t.status));

export type Notif = { title: string; body: string };

const nomDe = (t: Tache) => t.target?.name?.trim() || t.analysis?.name?.trim() || null;

export function message(taches: Tache[]): Notif | null {
  const faites = taches.filter((t) => t.status === 'done' && t.garment_id);
  const ratees = taches.filter((t) => t.status === 'failed');
  if (!faites.length && !ratees.length) return null;

  if (!faites.length) {
    return {
      title: ratees.length > 1 ? 'Kodi n’a pas pu finir tes pièces' : 'Kodi n’a pas pu finir ta pièce',
      body: 'Tu peux réessayer, ou la ranger à la main dans ton dressing.',
    };
  }

  const reste = ratees.length
    ? ratees.length > 1
      ? ` ${ratees.length} n’ont pas pu être dessinées.`
      : ' Une n’a pas pu être dessinée.'
    : '';

  if (faites.length === 1) {
    const nom = nomDe(faites[0]);
    return { title: 'Ta pièce est dans ton dressing', body: `${nom ? `« ${nom} » est prête.` : 'Kodi a fini de la ranger.'}${reste}` };
  }
  return { title: `${faites.length} pièces sont dans ton dressing`, body: `Kodi a fini de ranger ta photo.${reste}` };
}
