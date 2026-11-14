/**
 * Le contrôle d'une tenue par le code (K2, 13/11). Une consigne se contourne ;
 * une règle vérifiée après la réponse, non. Logique pure, testée dans
 * kode.test.ts, partagée par la fonction `kode` et le banc d'essai.
 *
 * Une tenue complète, c'est une base, puis ce qui la complète :
 * - base deux pièces : un haut et un bas ; base une pièce : une robe (robe,
 *   combinaison, salopette), jamais avec un bas, sauf un legging ;
 * - deux hauts seulement en superposition : un haut de dessous et une couche ;
 * - deux vestes au plus, une légère sous une chaude ;
 * - une paire de chaussures dès que le dressing en a, un sac au plus ;
 * - aucune pièce dont la couleur principale est à éviter ;
 * - un seul métal pour les bijoux, celui que la personne préfère ;
 * - une taille qui correspond, quand les deux sont connues.
 *
 * Les moteurs de tenues locaux (mobile/src/state/outfits.ts,
 * web/src/lib/outfits.ts) composent par construction un haut et un bas ou une
 * robe, des chaussures et au plus une veste : ils restent dans ces règles.
 */

import type { Picked } from './wardrobe.ts';

export type PieceControle = {
  id: string;
  ref: string;
  name: string;
  category_id: string;
  kind: string | null;
  colors: string[];
  size?: string | null;
};

export type ProfilControle = {
  /** Identifiants de couleur à éviter (`style_profile.avoid_colours`). */
  avoidColours: string[];
  /** Métaux préférés (`style_profile.metals`) : `or`, `argent`, `or_rose`, `mixte`. */
  metals: string[];
  /** Tailles habituelles, seulement avec l'accord « silhouette ». */
  sizes?: { haut?: string; bas?: string; pointure?: string } | null;
};

export type Controle = { ok: boolean; erreurs: string[] };

/** Les hauts qui se portent dessous ; les autres hauts sont des couches. */
const DESSOUS = new Set(['tshirt', 'top', 'debardeur', 'chemise', 'blouse', 'polo']);
const COUCHES = new Set(['pull', 'sweat', 'capuche', 'chemise']);
/** Les vestes légères, qui passent sous une veste chaude. */
const LEGERES = new Set(['gilet', 'blazer', 'veste']);

const liste = (ps: PieceControle[]) => ps.map((p) => p.ref).join(' et ');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Les erreurs d'une tenue, en clair, pour relancer le modèle (« la tenue a
 * deux bas : p4 et p9 »). `chaussuresDispo` : le dressing a des chaussures
 * que la météo n'écarte pas.
 */
export function controler(pieces: PieceControle[], profil: ProfilControle, chaussuresDispo: boolean): Controle {
  const de = (cat: string) => pieces.filter((p) => p.category_id === cat);
  const hauts = de('hauts'), bas = de('bas'), robes = de('robes'), vestes = de('vestes'), chaussures = de('chaussures'), sacs = de('sacs');
  const erreurs: string[] = [];

  // 1. La base.
  const basHorsLegging = bas.filter((b) => b.kind !== 'legging');
  if (robes.length > 1) erreurs.push(`la tenue a deux pièces de base d'un seul tenant : ${liste(robes)}`);
  if (robes.length && basHorsLegging.length) erreurs.push(`une robe ne se porte pas avec un bas : ${liste([...robes, ...basHorsLegging])}`);
  if (!robes.length && !(hauts.length && bas.length)) {
    erreurs.push(hauts.length ? 'la tenue n’a pas de bas' : bas.length ? 'la tenue n’a pas de haut' : 'la tenue n’a ni haut et bas, ni robe');
  }

  // 2. Au plus un bas, une paire de chaussures, un sac.
  if (bas.length > 1 && !(robes.length && bas.every((b) => b.kind === 'legging'))) erreurs.push(`la tenue a deux bas : ${liste(bas)}`);
  if (chaussures.length > 1) erreurs.push(`la tenue a deux paires de chaussures : ${liste(chaussures)}`);
  if (sacs.length > 1) erreurs.push(`la tenue a deux sacs : ${liste(sacs)}`);

  // 3. Deux hauts seulement en superposition, un seul sur une robe.
  if (hauts.length > 2) erreurs.push(`la tenue a trop de hauts : ${liste(hauts)}`);
  else if (hauts.length === 2) {
    const [a, b] = hauts;
    const superpose = (x: PieceControle, y: PieceControle) => DESSOUS.has(x.kind ?? '') && COUCHES.has(y.kind ?? '') && x.kind !== y.kind;
    if (!superpose(a, b) && !superpose(b, a)) erreurs.push(`deux hauts qui ne se superposent pas : ${liste(hauts)}`);
  }
  if (robes.length && hauts.length > 1) erreurs.push(`trop de hauts sur une robe : ${liste(hauts)}`);

  // 4. Deux vestes au plus, une légère sous une chaude.
  if (vestes.length > 2) erreurs.push(`la tenue a trop de vestes : ${liste(vestes)}`);
  else if (vestes.length === 2 && vestes.filter((v) => LEGERES.has(v.kind ?? '')).length !== 1) {
    erreurs.push(`deux vestes qui ne se superposent pas : ${liste(vestes)}`);
  }

  // 5. Des chaussures dès que le dressing en a.
  if (!chaussures.length && chaussuresDispo) erreurs.push('la tenue n’a pas de chaussures alors que le dressing en a');

  // 6. Les couleurs à éviter (la couleur principale de la pièce).
  const evitees = new Set(profil.avoidColours.map(norm));
  const fautives = pieces.filter((p) => p.colors[0] && evitees.has(norm(p.colors[0])));
  if (fautives.length) erreurs.push(`couleur que la personne évite : ${fautives.map((p) => `${p.ref} (${p.colors[0]})`).join(', ')}`);

  // 7. Les tailles, quand les deux sont connues.
  const s = profil.sizes;
  if (s) {
    const attendue = (p: PieceControle) => (p.category_id === 'hauts' || p.category_id === 'vestes' || p.category_id === 'robes' ? s.haut : p.category_id === 'bas' ? s.bas : p.category_id === 'chaussures' ? s.pointure : undefined);
    const mal = pieces.filter((p) => p.size && attendue(p) && norm(p.size) !== norm(attendue(p)!));
    if (mal.length) erreurs.push(`taille qui ne correspond pas : ${mal.map((p) => `${p.ref} (${p.size})`).join(', ')}`);
  }

  // 8. Un seul métal pour les bijoux, celui que la personne préfère.
  const bijoux = de('bijoux');
  const metal = (p: PieceControle) => (p.colors.includes('dore') ? 'or' : p.colors.includes('argente') ? 'argent' : null);
  const metaux = new Set(bijoux.map(metal).filter(Boolean));
  const prefere = profil.metals.filter((m) => m === 'or' || m === 'argent');
  if (metaux.size > 1 && !profil.metals.includes('mixte')) erreurs.push(`deux métaux mélangés : ${liste(bijoux)}`);
  else if (prefere.length === 1 && [...metaux].some((m) => m !== prefere[0])) erreurs.push(`un bijou d'un autre métal que celui qu'elle préfère : ${liste(bijoux.filter((b) => metal(b) && metal(b) !== prefere[0]))}`);

  return { ok: erreurs.length === 0, erreurs };
}

/** Les pièces visibles d'une tenue (ni bijou ni accessoire), pour comparer deux tenues. */
const visibles = (ps: PieceControle[]) => ps.filter((p) => !['bijoux', 'accessoires'].includes(p.category_id));
const base = (ps: PieceControle[]) => ps.filter((p) => ['hauts', 'bas', 'robes'].includes(p.category_id)).map((p) => p.id).sort().join('+');

/** Une variante doit changer la base, ou au moins deux pièces visibles. */
export function variantePropre(principale: PieceControle[], variante: PieceControle[]): Controle {
  if (base(principale) !== base(variante)) return { ok: true, erreurs: [] };
  // Un échange (des chaussures pour d'autres) compte pour une pièce changée.
  const ajoutees = visibles(variante).filter((p) => !principale.some((x) => x.id === p.id)).length;
  const retirees = visibles(principale).filter((p) => !variante.some((v) => v.id === p.id)).length;
  const changees = Math.max(ajoutees, retirees);
  return changees >= 2 ? { ok: true, erreurs: [] } : { ok: false, erreurs: ['la variante ressemble trop à la tenue principale : change la base ou au moins deux pièces visibles'] };
}

/**
 * Ce que Kodi ne garde jamais en mémoire, même avec l'accord « goûts » : la
 * santé, le corps et les données sensibles (RGPD, art. 9), ni un tiers.
 */
const SENSIBLE = /\b(sant[ée]|malad|douleur|mal (au|à|aux)|enceinte|grossesse|handicap|poids|kilos?|kg|mesure|tour de|taille \d|cm\b|régime|religi|prière|politi|syndic|sexu|orientation|médic|traitement|thérap|dépress|anxi|cicatric|opér(é|ation)|mon mari|ma femme|mon copain|ma copine|mon fils|ma fille|ma mère|mon père)/i;

/** Les faits à retenir, filtrés : deux au plus, courts, jamais sensibles. */
export function aRetenir(v: unknown, accord: boolean): string[] {
  if (!accord) return [];
  return (Array.isArray(v) ? v.map(String) : []).map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 120)).filter((x) => x.length >= 6 && !SENSIBLE.test(x)).slice(0, 2);
}

/**
 * Ce que le code peut réparer sans le modèle : retirer ce qui dépasse, dans
 * l'ordre où Kodi l'a proposé (la première pièce d'un emplacement reste).
 * Ne fabrique jamais une base qui manque.
 */
export function reparer(ps: Picked[], profil: ProfilControle): Picked[] {
  const evitees = new Set(profil.avoidColours.map((c) => c.toLowerCase()));
  const prefere = profil.metals.filter((m) => m === 'or' || m === 'argent');
  const metal = (p: Picked) => (p.garment.colors.includes('dore') ? 'or' : p.garment.colors.includes('argente') ? 'argent' : null);
  let out = ps.filter((p) => !(p.garment.colors[0] && evitees.has(p.garment.colors[0].toLowerCase())));
  if (prefere.length === 1) out = out.filter((p) => p.garment.category_id !== 'bijoux' || !metal(p) || metal(p) === prefere[0]);

  const garde: Picked[] = [];
  const compte = (cat: string) => garde.filter((p) => p.garment.category_id === cat).length;
  const robe = out.some((p) => p.garment.category_id === 'robes');
  for (const p of out) {
    const c = p.garment.category_id, k = p.garment.kind ?? '';
    if (c === 'robes' && compte('robes')) continue;
    if (c === 'bas' && (robe ? k !== 'legging' : compte('bas'))) continue;
    if ((c === 'chaussures' || c === 'sacs') && compte(c)) continue;
    if (c === 'hauts') {
      const h = garde.filter((x) => x.garment.category_id === 'hauts');
      if (h.length >= (robe ? 1 : 2)) continue;
      if (h.length === 1 && (DESSOUS.has(h[0].garment.kind ?? '') === DESSOUS.has(k) && !(k === 'chemise' || h[0].garment.kind === 'chemise'))) continue;
    }
    if (c === 'vestes') {
      const v = garde.filter((x) => x.garment.category_id === 'vestes');
      if (v.length >= 2 || (v.length === 1 && LEGERES.has(v[0].garment.kind ?? '') === LEGERES.has(k))) continue;
    }
    garde.push(p);
  }
  return garde;
}
