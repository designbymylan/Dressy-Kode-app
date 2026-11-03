/**
 * Les tenues du jour composées à partir du dressing, et la manière de les
 * lire de la tête aux pieds. Mêmes règles que l'app mobile
 * (mobile/src/state/outfits.ts et mobile/src/ui/outfit.tsx), sur le
 * vocabulaire du site (lib/wardrobe.ts : « vestes », « sacs »…).
 *
 * Sans importation serveur : ce fichier sert aussi aux composants du navigateur.
 */
import type { Weather } from '@/lib/contexte';

/** Les rangées d'une tenue, de la tête aux pieds. */
export type RowId = 'tete' | 'veste' | 'haut' | 'bas' | 'pieds' | 'main';
export const ROW_ORDER: RowId[] = ['tete', 'veste', 'haut', 'bas', 'pieds', 'main'];
export const ROW_NAME: Record<RowId, string> = {
  tete: 'Visage et cou', veste: 'Veste', haut: 'Haut', bas: 'Bas', pieds: 'Chaussures', main: 'Sac et accessoires',
};

/** Une pièce telle que l'accueil la lit : son image, et ce que le dressing en sait. */
export type HomePiece = {
  id: string;
  name: string;
  category_id: string;
  kind: string | null;
  /** Teinte de la silhouette quand la pièce n'a pas d'image. */
  colour: string | null;
  url: string | null;
  wears: number;
  /** Jours depuis le dernier port ; null : jamais portée. */
  lastWorn: number | null;
  addedDaysAgo: number;
};

/** Une tenue proposée : un titre, sa raison, ses pièces (identifiants). */
export type Outfit = {
  id: string;
  title: string;
  why: string;
  pieces: string[];
  /** Identifiant en base quand la tenue existe déjà (prévue pour aujourd'hui). */
  saved?: string;
};

const plain = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const lcFirst = (t: string) => (t ? t[0].toLowerCase() + t.slice(1) : t);
const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Ce qui se porte sur la tête, le visage ou le cou : en haut de la tenue. */
const HEAD_KINDS = new Set(['foulard', 'echarpe', 'chapeau', 'casquette', 'bonnet', 'lunettes', 'bandeau', 'pince', 'collier', 'boucles']);
const HEAD = /lunette|boucle|oreille|collier|chapeau|bonnet|casquette|beret|foulard|echarpe|bandeau|barrette|serre-tete|pendentif|chaine|ras de cou/;

/** La rangée d'une pièce : la hiérarchie se lit de la tête aux pieds. */
export function rowOf(p: Pick<HomePiece, 'category_id' | 'kind' | 'name'>): RowId {
  switch (p.category_id) {
    case 'chaussures': return 'pieds';
    case 'bas':
    case 'robes': return 'bas';
    case 'vestes': return 'veste';
    case 'hauts': return 'haut';
    case 'sacs': return 'main';
    default: return HEAD_KINDS.has(p.kind ?? '') || HEAD.test(plain(p.name)) ? 'tete' : 'main';
  }
}

/** Les pièces dans l'ordre de la tête aux pieds. */
export function headToToe<P extends Pick<HomePiece, 'category_id' | 'kind' | 'name'>>(pieces: P[]): P[] {
  return [...pieces].sort((a, b) => ROW_ORDER.indexOf(rowOf(a)) - ROW_ORDER.indexOf(rowOf(b)));
}

/** Une tenue est possible avec un haut et un bas, ou une robe. */
export function canCompose(pieces: Pick<HomePiece, 'category_id'>[]): boolean {
  const has = (c: string) => pieces.some((p) => p.category_id === c);
  return has('robes') || (has('hauts') && has('bas'));
}

/** Ce qui manque encore pour une première tenue, dit simplement. */
export function missingForOutfit(pieces: Pick<HomePiece, 'category_id'>[]): string | null {
  if (canCompose(pieces)) return null;
  const has = (c: string) => pieces.some((p) => p.category_id === c);
  if (has('hauts')) return 'un bas (pantalon, jean, jupe) ou une robe';
  if (has('bas')) return 'un haut';
  return 'un haut et un bas, ou une robe';
}

/** Une tenue se reconnaît à ses pièces, dans n'importe quel ordre. */
export const cleTenue = (ids: string[]) => [...ids].sort().join(',');

/** Ce que les tenues proposées doivent éviter : des combinaisons, et des pièces mises en retrait. */
export type Evite = { tenues: Set<string>; retrait: Set<string> };
export const RIEN: Evite = { tenues: new Set(), retrait: new Set() };

/** Combien de temps une pièce écartée seule passe en dernier. */
const RETRAIT_JOURS = 14;

/** « Pas pour moi » : les tenues écartées (table outfit_feedback), lues pour ne pas les reproposer. */
export function evite(rows: { garment_ids: string[]; reason: string; target_ids: string[]; created_at: string }[], now = Date.now()): Evite {
  return {
    tenues: new Set(rows.map((r) => cleTenue(r.garment_ids))),
    retrait: new Set(
      rows
        .filter((r) => r.reason === 'piece' && now - new Date(r.created_at).getTime() <= RETRAIT_JOURS * 86_400_000)
        .flatMap((r) => r.target_ids),
    ),
  };
}

const LEADS: [string, string][] = [
  ['Ta première tenue, ', 'déjà prête.'],
  ['Même base, autre ', 'humeur.'],
  ['Plus simple, encore ', 'plus juste.'],
];

/**
 * Jusqu'à trois tenues, composées des propres pièces de la personne. Les
 * moins portées d'abord : Kodi fait tourner le dressing. Une pièce écartée
 * seule (« Pas pour moi ») passe en dernier. Au-dessous de 17°, une veste
 * s'ajoute si le dressing en a une.
 */
export function suggestOutfits(pieces: HomePiece[], w: Weather | null, av: Evite = RIEN): Outfit[] {
  const rest = (a: HomePiece, b: HomePiece) =>
    Number(av.retrait.has(a.id)) - Number(av.retrait.has(b.id)) || (b.lastWorn ?? 999) - (a.lastWorn ?? 999);
  const by = (c: string) => pieces.filter((p) => p.category_id === c).sort(rest);
  const coats = by('vestes'), tops = by('hauts'), bottoms = by('bas'), dresses = by('robes'), shoes = by('chaussures');
  // Un sac d'abord ; sans sac, un accessoire qui ne se porte pas sur la tête.
  const bags = by('sacs');
  const accs = bags.length ? bags : by('accessoires').filter((p) => rowOf(p) === 'main');

  const out: Outfit[] = [];
  const seen = new Set<string>();
  // On cherche plus loin quand certaines ont été écartées.
  for (let i = 0; i < 12 && out.length < 3; i++) {
    const useDress = dresses.length > 0 && (i % 2 === 1 || !tops.length || !bottoms.length);
    const base = useDress ? [dresses[i % dresses.length]] : tops.length && bottoms.length ? [tops[i % tops.length], bottoms[i % bottoms.length]] : [];
    if (!base.length) break;
    const list = [...base];
    const coat = w && w.t < 17 && coats.length ? coats[i % coats.length] : undefined;
    if (coat) list.unshift(coat);
    if (shoes.length) list.push(shoes[i % shoes.length]);
    if (accs.length) list.push(accs[i % accs.length]);
    const key = cleTenue(list.map((p) => p.id));
    if (seen.has(key) || av.tenues.has(key)) continue;
    seen.add(key);
    const baseLine = useDress ? `${cap(lcFirst(base[0].name))} en pièce centrale.` : `${cap(lcFirst(base[0].name))} avec ${lcFirst(base[1].name)}.`;
    const weatherLine = !w
      ? ''
      : coat
        ? ` ${coat.name} par-dessus : ${w.t}°, ${w.label}.`
        : w.t < 15
          ? ` Il fera ${w.t}° : une veste irait bien par-dessus, dès que tu en ajoutes une.`
          : ` ${w.t}°, ${w.label} : c’est la bonne épaisseur.`;
    out.push({
      id: `g${i}`,
      title: `${LEADS[out.length][0]}${LEADS[out.length][1]}`,
      pieces: list.map((p) => p.id),
      why: `${baseLine}${weatherLine}`,
    });
  }
  return out;
}

/** Les pièces qui dorment : jamais portées ou pas depuis deux mois, mais pas celles qu'on vient d'ajouter. */
export const sleeping = (pieces: HomePiece[]) =>
  pieces
    .filter((p) => p.addedDaysAgo >= 30 && (p.lastWorn === null || p.lastWorn > 60))
    .sort((a, b) => (b.lastWorn ?? 9999) - (a.lastWorn ?? 9999));

/** Part des pièces portées ces 90 derniers jours : l'indicateur « porte mieux ». */
export const usageRate = (pieces: HomePiece[]) =>
  pieces.length ? Math.round((pieces.filter((p) => p.lastWorn !== null && p.lastWorn <= 90).length / pieces.length) * 100) : 0;
