/**
 * Le vocabulaire du dressing : catégories, types de pièce (`garments.kind`)
 * et emplacements de tenue (`outfit_items.slot`).
 *
 * Les `id` partent en base : ils ne changent pas une fois des pièces créées.
 * `garments.kind` n'accepte que des minuscules sans accent ni séparateur
 * (contrainte `^[a-z]{2,20}$`), d'où « sacados » ou « boucles ».
 * La même liste de types est donnée à l'agent (supabase/functions/dressy-agent/prompts.ts).
 */

export type Slot = 'haut' | 'bas' | 'robe' | 'veste' | 'chaussures' | 'sac' | 'accessoire' | 'bijou';

/** Tracés d'icônes, viewBox 0 0 24 24, trait seul. */
const I = {
  haut: 'M8 4 12 6.5 16 4l5 2.5-2 4-2-1V20H7V9.5l-2 1-2-4Z',
  bas: 'M7 3h10l1.5 18h-4.5L12 10l-2 11H5.5Z',
  robe: 'M9 3l3 2 3-2 1.5 4-2 3L20 21H4l5.5-11-2-3Z',
  veste: 'M8 3l4 3 4-3 5 3-1 8-3-1v8H7v-8l-3 1-1-8ZM12 6v15',
  chaussures: 'M3 16h11l6 1.5V20H3ZM3 16V9l3 1 2 3 5 1',
  sac: 'M6 8h12l1 12H5ZM9 8V6a3 3 0 0 1 6 0v2',
  accessoire: 'M3 10h18v4H3ZM13 8.5h4v7h-4Z',
  bijou: 'M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM9.5 6 12 3l2.5 3-2.5 3Z',
  // bijoux
  collier: 'M5 3c0 6 3 10 7 10s7-4 7-10M12 13v2M12 15l-2 2.5 2 2.5 2-2.5Z',
  bracelet: 'M12 6c4.4 0 8 2.7 8 6s-3.6 6-8 6-8-2.7-8-6 3.6-6 8-6ZM12 9c2.8 0 5 1.3 5 3s-2.2 3-5 3-5-1.3-5-3 2.2-3 5-3Z',
  boucles: 'M8 3v4M8 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM8 12l-1.5 6h3ZM16 3v4M16 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM16 12l-1.5 6h3Z',
  montre: 'M9 3h6l1 4H8ZM9 21h6l1-4H8ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 10v2.2l1.5 1',
  broche: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 3v3M12 18v3M3 12h3M18 12h3',
  // accessoires
  bandeau: 'M4 16c0-5.5 3.6-10 8-10s8 4.5 8 10M6.5 16c0-4 2.5-7.3 5.5-7.3s5.5 3.3 5.5 7.3',
  pince: 'M4 10h14l2 2-2 2H4ZM7 10v4M11 10v4',
  foulard: 'M4 5h16l-8 9ZM12 14l-2 6M12 14l3 5',
  echarpe: 'M8 3h5v11l-2.5 7L8 14ZM13 7h4v5l-4 1',
  chapeau: 'M3 16c0-1.5 4-3 9-3s9 1.5 9 3-4 3-9 3-9-1.5-9-3ZM7 14l1-6c.3-1.3 2-2 4-2s3.7.7 4 2l1 6',
  casquette: 'M4 15a8 8 0 0 1 16 0ZM4 15h9l8 2',
  bonnet: 'M5 16a7 7 0 0 1 14 0ZM4 16h16v3H4ZM12 9V6',
  lunettes: 'M3 11l2-3M21 11l-2-3M10 13.5c1.3-1 2.7-1 4 0M6.5 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM17.5 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  gants: 'M7 21v-8L5 9l1.5-1 2 3V4h2v6V3h2v7V4h2v7l1-3 1.5.5L16 14v7Z',
  // sacs
  pochette: 'M3 8h18v10H3ZM3 8l9 6 9-6',
  bandouliere: 'M6 11h12v9H6ZM6 11 12 3l6 8',
  cabas: 'M5 8h14l-1 12H6ZM9 8V5h6v3',
  sacados: 'M7 7h10a2 2 0 0 1 2 2v11H5V9a2 2 0 0 1 2-2ZM9 7V5h6v2M8 14h8',
} as const;

export type Kind = { id: string; label: string; icon?: string };

export type CategoryMeta = { id: string; label: string; slot: Slot; icon: string; kinds: Kind[] };

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'hauts', label: 'Hauts', slot: 'haut', icon: I.haut,
    kinds: [
      { id: 'tshirt', label: 'T-shirt' }, { id: 'chemise', label: 'Chemise' }, { id: 'blouse', label: 'Blouse' },
      { id: 'pull', label: 'Pull' }, { id: 'sweat', label: 'Sweat' }, { id: 'debardeur', label: 'Débardeur' },
      { id: 'top', label: 'Top' },
    ],
  },
  {
    id: 'bas', label: 'Bas', slot: 'bas', icon: I.bas,
    kinds: [
      { id: 'jean', label: 'Jean' }, { id: 'pantalon', label: 'Pantalon' }, { id: 'jupe', label: 'Jupe' },
      { id: 'short', label: 'Short' }, { id: 'legging', label: 'Legging' },
    ],
  },
  {
    id: 'robes', label: 'Robes', slot: 'robe', icon: I.robe,
    kinds: [{ id: 'robe', label: 'Robe' }, { id: 'combinaison', label: 'Combinaison' }],
  },
  {
    id: 'vestes', label: 'Vestes et manteaux', slot: 'veste', icon: I.veste,
    kinds: [
      { id: 'veste', label: 'Veste' }, { id: 'blazer', label: 'Blazer' }, { id: 'manteau', label: 'Manteau' },
      { id: 'trench', label: 'Trench' }, { id: 'doudoune', label: 'Doudoune' }, { id: 'gilet', label: 'Gilet' },
    ],
  },
  {
    id: 'chaussures', label: 'Chaussures', slot: 'chaussures', icon: I.chaussures,
    kinds: [
      { id: 'baskets', label: 'Baskets' }, { id: 'bottines', label: 'Bottines' }, { id: 'bottes', label: 'Bottes' },
      { id: 'escarpins', label: 'Escarpins' }, { id: 'sandales', label: 'Sandales' }, { id: 'mocassins', label: 'Mocassins' },
      { id: 'ballerines', label: 'Ballerines' },
    ],
  },
  {
    id: 'sacs', label: 'Sacs', slot: 'sac', icon: I.sac,
    kinds: [
      { id: 'sacamain', label: 'Sac à main', icon: I.sac }, { id: 'bandouliere', label: 'Bandoulière', icon: I.bandouliere },
      { id: 'pochette', label: 'Pochette', icon: I.pochette }, { id: 'cabas', label: 'Cabas', icon: I.cabas },
      { id: 'sacados', label: 'Sac à dos', icon: I.sacados },
    ],
  },
  {
    id: 'bijoux', label: 'Bijoux', slot: 'bijou', icon: I.bijou,
    kinds: [
      { id: 'collier', label: 'Collier', icon: I.collier }, { id: 'boucles', label: "Boucles d'oreilles", icon: I.boucles },
      { id: 'bracelet', label: 'Bracelet', icon: I.bracelet }, { id: 'bague', label: 'Bague', icon: I.bijou },
      { id: 'montre', label: 'Montre', icon: I.montre }, { id: 'broche', label: 'Broche', icon: I.broche },
    ],
  },
  {
    id: 'accessoires', label: 'Accessoires', slot: 'accessoire', icon: I.accessoire,
    kinds: [
      { id: 'ceinture', label: 'Ceinture', icon: I.accessoire }, { id: 'bandeau', label: 'Bandeau', icon: I.bandeau },
      { id: 'pince', label: 'Pince et barrette', icon: I.pince }, { id: 'foulard', label: 'Foulard', icon: I.foulard },
      { id: 'echarpe', label: 'Écharpe', icon: I.echarpe }, { id: 'chapeau', label: 'Chapeau', icon: I.chapeau },
      { id: 'casquette', label: 'Casquette', icon: I.casquette }, { id: 'bonnet', label: 'Bonnet', icon: I.bonnet },
      { id: 'lunettes', label: 'Lunettes', icon: I.lunettes }, { id: 'gants', label: 'Gants', icon: I.gants },
    ],
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryMeta(id: string): CategoryMeta | undefined {
  return BY_ID.get(id);
}

export function slotFor(categoryId: string): Slot {
  return BY_ID.get(categoryId)?.slot ?? 'accessoire';
}

export function kindOf(categoryId: string, kind: string | null | undefined): Kind | undefined {
  if (!kind) return undefined;
  return BY_ID.get(categoryId)?.kinds.find((k) => k.id === kind);
}

/** L'icône la plus précise connue : celle du type, sinon celle de la catégorie. */
export function iconFor(categoryId: string, kind?: string | null): string {
  return kindOf(categoryId, kind)?.icon ?? BY_ID.get(categoryId)?.icon ?? I.haut;
}

export function isKnownKind(categoryId: string, kind: string): boolean {
  return Boolean(kindOf(categoryId, kind));
}
