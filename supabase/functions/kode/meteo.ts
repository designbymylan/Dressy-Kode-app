/**
 * La météo mise en règles, avant que Kodi ne voie le dressing (23/10).
 *
 * Une consigne se contourne ; une pièce qu'on ne transmet pas ne peut pas
 * être proposée. Ce module dit donc, pour une journée donnée, quelles pièces
 * ne doivent pas figurer dans une tenue (et pourquoi). Logique pure, sans
 * réseau ni base : testée à part, comme `wardrobe.ts`.
 *
 * Deux mesures :
 * - le plafond : la chaleur la plus forte qu'un haut ou un bas peut porter
 *   (au plus chaud de la journée) ;
 * - le besoin : la couche qu'il faut prévoir pour le matin ou le soir (au
 *   plus froid de la journée). Une veste ou un manteau peut dépasser le
 *   plafond à condition de servir à passer le froid, et on l'enlève ensuite.
 */

/** Le ciel en sept mots, comme les données du jour (`_shared/donnees/types.ts`). */
export type Ciel = 'soleil' | 'nuages' | 'pluie' | 'averses' | 'neige' | 'orage' | 'brouillard';

/** Une journée de prévision, réduite à ce qui change la tenue. */
export type Jour = {
  min: number;
  max: number;
  ciel: Ciel | string;
  /** Pluie attendue sur la journée, en mm. */
  pluie: number | null;
  /** Indice UV maximal. */
  uv: number | null;
  /** Vent maximal en km/h, quand la source le donne (aujourd’hui). */
  vent?: number | null;
};

export type Conditions = {
  min: number;
  max: number;
  /** De 0 (sans manche) à 4 (grand froid). */
  plafond: number;
  /** De 0 à 4 : la couche à prévoir pour le plus froid de la journée. */
  besoin: number;
  pluie: boolean;
  orage: boolean;
  neige: boolean;
  vent: boolean;
  soleilFort: boolean;
};

/** Chaleur d’une pièce : 0 pour un débardeur, 4 pour une doudoune. */
const CHALEUR_PAR_TYPE: Record<string, number> = {
  // hauts, bas, robes
  debardeur: 0, short: 0, top: 1, tshirt: 1, blouse: 1, chemise: 1, robe: 1, combinaison: 1, jupe: 1, legging: 1,
  jean: 2, pantalon: 2, sweat: 3, pull: 3,
  // vestes
  gilet: 2, blazer: 2, veste: 2, trench: 2, manteau: 3, doudoune: 4,
  // chaussures
  sandales: 0, ballerines: 1, escarpins: 1, mocassins: 1, baskets: 1, bottines: 2, bottes: 3,
  // accessoires chauds
  chapeau: 1, casquette: 0, foulard: 1, echarpe: 2, bonnet: 3, gants: 3,
};

/** Les vestes : elles peuvent dépasser le plafond pour passer le froid. */
const VESTES = new Set(['gilet', 'blazer', 'veste', 'trench', 'manteau', 'doudoune']);

const CHAUD = /\b(laine|cachemire|mohair|polaire|feutre|fourrure|duvet)\b/i;
const LEGER = /\b(lin|soie|viscose|mousseline|voile|modal)\b/i;
const CRAINT_LA_PLUIE = /\b(daim|velours|suede|suède|toile)\b/i;

const borne = (n: number) => Math.min(4, Math.max(0, n));

/** Le plafond : le plus chaud de la journée décide de ce qui se porte sur la peau. */
export function plafondDe(max: number): number {
  if (max >= 32) return 0;
  if (max >= 28) return 1;
  if (max >= 24) return 2;
  if (max >= 20) return 3;
  return 4;
}

/** Le besoin : le plus froid de la journée décide de la couche à prévoir. */
export function besoinDe(min: number): number {
  if (min <= 4) return 4;
  if (min <= 9) return 3;
  if (min <= 14) return 2;
  if (min <= 19) return 1;
  return 0;
}

/** Les conditions d’une journée, à partir de sa prévision. */
export function conditionsDuJour(j: Jour): Conditions {
  const pluie = j.ciel === 'pluie' || j.ciel === 'averses' || j.ciel === 'orage' || (j.pluie ?? 0) >= 1;
  return {
    min: j.min,
    max: j.max,
    plafond: plafondDe(j.max),
    besoin: besoinDe(j.min),
    pluie,
    orage: j.ciel === 'orage',
    neige: j.ciel === 'neige',
    vent: (j.vent ?? 0) >= 30,
    soleilFort: (j.uv ?? 0) >= 6,
  };
}

/** La chaleur d’une pièce, ou `null` quand son type n’en dit rien (bijoux, sacs…). */
export function chaleurDe(kind: string | null, material: string | null): number | null {
  if (!kind || !(kind in CHALEUR_PAR_TYPE)) return null;
  let c = CHALEUR_PAR_TYPE[kind];
  if (material && CHAUD.test(material)) c += 1;
  if (material && LEGER.test(material)) c -= 1;
  return borne(c);
}

/** La pièce à écarter pour cette journée, avec la raison (en français, pour Kodi). `null` si elle convient. */
export function raisonEcarte(
  g: { kind: string | null; material: string | null; season: string | null },
  c: Conditions,
): string | null {
  if (g.kind && ['sandales', 'escarpins'].includes(g.kind) && (c.pluie || c.orage)) return 'chaussures ouvertes sous la pluie';
  if (g.kind && ['sandales', 'ballerines', 'escarpins'].includes(g.kind) && c.neige) return 'chaussures ouvertes dans la neige';
  if (c.pluie && g.material && CRAINT_LA_PLUIE.test(g.material)) return 'matière qui craint la pluie';
  if (c.vent && g.kind && ['jupe', 'robe'].includes(g.kind) && g.material && LEGER.test(g.material)) return 'jupe légère avec le vent';
  if (c.vent && g.kind === 'chapeau') return 'chapeau qui s’envole avec le vent';
  if (g.season === 'hiver' && c.plafond >= 3) return `pièce d’hiver, il fait ${c.max}° au plus chaud`;
  if (g.season === 'ete' && c.besoin >= 3) return `pièce d’été, il fait ${c.min}° le matin`;

  const chaleur = chaleurDe(g.kind, g.material);
  if (chaleur === null || !g.kind) return null;
  const limite = VESTES.has(g.kind) ? Math.min(c.plafond + 1, Math.max(c.besoin, c.plafond)) : c.plafond;
  if (chaleur > limite) return `trop chaud pour la journée, il fait ${c.max}° au plus chaud`;
  return null;
}

/** Les pièces à ne pas proposer ce jour-là : identifiant de la pièce vers sa raison. */
export function interdites(
  pieces: { id: string; kind: string | null; material: string | null; season: string | null }[],
  c: Conditions,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of pieces) {
    const raison = raisonEcarte(p, c);
    if (raison) out.set(p.id, raison);
  }
  return out;
}

/** La météo du jour en une ligne, avec les conseils qui en découlent. */
export function meteoTexte(c: Conditions, quand: string): string {
  const faits = [
    `de ${c.min}° à ${c.max}°`,
    c.pluie && 'pluie',
    c.orage && 'orage',
    c.neige && 'neige',
    c.vent && 'vent fort',
    c.soleilFort && 'soleil fort',
  ].filter(Boolean);
  const conseils = [
    c.besoin >= 3 && 'le matin est froid : une couche chaude qu’on garde ou qu’on enlève',
    c.pluie && 'une veste qui protège, des chaussures fermées',
    c.soleilFort && 'épaules couvertes ou chapeau',
    c.plafond <= 1 && 'il fait chaud : des pièces légères, sans rien de lourd',
  ].filter(Boolean);
  return `Météo ${quand} : ${faits.join(', ')}.${conseils.length ? ` Conseils : ${conseils.join(' ; ')}.` : ''}`;
}
