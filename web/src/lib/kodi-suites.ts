/**
 * Les puces sous la dernière réponse de Kodi (12/11) et celle de sa variante
 * déjà prête (Kodi v2, maquette validée le 14/11), sans code serveur : le
 * composant de conversation les lit côté navigateur. Les mêmes que l'app
 * (`suitesDe`, mobile/src/state/kode.ts).
 */

/** Chaque puce compte comme une question ; Kodi relit la conversation. */
export const SUITES = ['Une autre idée', 'Plus habillée', 'Plus décontractée'];

/** Le nom d'une direction de variante (DIRECTION_LIBELLES, supabase/functions/kode/prompt.ts). */
export const VARIANTE_LIBELLES: Record<string, string> = {
  plus_habillee: 'Plus habillée',
  plus_decontractee: 'Plus décontractée',
  plus_chaude: 'Plus chaude',
  plus_legere: 'Plus légère',
  plus_audacieuse: 'Plus audacieuse',
  plus_sobre: 'Plus sobre',
  piece_oubliee: 'Avec une pièce oubliée',
  autre_base: 'Sur une autre base',
};

export type VarianteVue = { direction: string; titre: string; servie: boolean };

/** Les puces : les trois de toujours, et celle de la variante prête (qui ne compte pas). */
export function suitesDe(variante: VarianteVue | null | undefined): { label: string; prete: boolean }[] {
  const v = variante && !variante.servie ? VARIANTE_LIBELLES[variante.direction] : undefined;
  const base = SUITES.map((label) => ({ label, prete: label === v }));
  return v && !base.some((x) => x.prete) ? [...base, { label: v, prete: true }] : base;
}
