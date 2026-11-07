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
  /** Saison notée sur la pièce (« hiver », « ete »…) ; inconnue : toute l'année. */
  season?: string | null;
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
export type Evite = { tenues: Set<string>; retrait: Set<string>; aimees?: Set<string> };
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
  ['Ta tenue, ', 'déjà prête.'],
  ['Une autre ', 'allure.'],
  ['Plus simple, encore ', 'plus juste.'],
];
/** Le tout premier jour (rien encore porté) : le moment où l'app tient sa promesse. */
const FIRST: [string, string] = ['Ta première tenue, ', 'déjà prête.'];

/** La saison d'une pièce, qu'elle vienne de la base (« toute_annee ») ou de l'app (« toute l’année »). */
type Saison = 'hiver' | 'ete' | 'mi' | 'tout';
export function saisonDe(s: string | null | undefined): Saison {
  const x = plain(s ?? '');
  if (x.startsWith('hiver')) return 'hiver';
  if (x.startsWith('ete')) return 'ete';
  if (x.startsWith('mi')) return 'mi';
  return 'tout';
}

/** L'accord d'une pièce avec la température du jour : 0 va bien, négatif à éviter (un gros pull à 25°, une robe d'été à 8°). */
export function accordMeteo(s: Saison, t: number | null): number {
  if (t === null) return 0;
  if (s === 'hiver') return t >= 22 ? -100 : t >= 18 ? -35 : 0;
  if (s === 'ete') return t <= 11 ? -100 : t <= 16 ? -35 : 0;
  if (s === 'mi') return t >= 28 || t <= 3 ? -35 : 0;
  return 0;
}

/** Au-delà de deux mois au repos, une pièce « dort » : c'est elle que Kodi ressort. */
const DORT = 60;
/** Une pièce déjà retenue dans une tenue du jour pèse moins pour la suivante : trois tenues, trois allures. */
const DEJA_PRISE = 40;

/**
 * Jusqu'à trois tenues, composées des propres pièces de la personne.
 * Toutes les combinaisons haut et bas, et chaque robe, sont pesées : les
 * pièces au repos depuis longtemps d'abord (Kodi fait tourner le dressing),
 * celles qui vont avec la météo du jour, un coup de cœur un peu plus ; une
 * pièce écartée seule (« Pas pour moi ») passe en dernier. Les trois tenues
 * retenues partagent le moins de pièces possible. Au-dessous de 17° (21° s'il
 * pleut), une veste s'ajoute si le dressing en a une.
 */
export function suggestOutfits(pieces: HomePiece[], w: Weather | null, av: Evite = RIEN): Outfit[] {
  const t = w ? w.t : null;
  const poids = (p: HomePiece) =>
    (av.retrait.has(p.id) ? -500 : 0) + Math.min(p.lastWorn ?? DORT, DORT) + (av.aimees?.has(p.id) ? 30 : 0) + accordMeteo(saisonDe(p.season), t);
  const by = (c: string) => pieces.filter((p) => p.category_id === c).sort((a, b) => poids(b) - poids(a));
  const coats = by('vestes'), tops = by('hauts'), bottoms = by('bas'), dresses = by('robes'), shoes = by('chaussures');
  // Un sac d'abord ; sans sac, un accessoire qui ne se porte pas sur la tête.
  const bags = by('sacs');
  const accs = bags.length ? bags : by('accessoires').filter((p) => rowOf(p) === 'main');

  type Base = { pieces: HomePiece[]; score: number };
  const bases: Base[] = [
    ...tops.flatMap((top) => bottoms.map((bottom) => ({ pieces: [top, bottom], score: (poids(top) + poids(bottom)) / 2 }))),
    ...dresses.map((d) => ({ pieces: [d], score: poids(d) })),
  ];
  const used = new Set<string>();
  const libre = (p: HomePiece) => poids(p) - (used.has(p.id) ? DEJA_PRISE : 0);
  const meilleure = (list: HomePiece[]) => (list.length ? list.reduce((a, b) => (libre(b) > libre(a) ? b : a)) : undefined);
  const pluie = w?.kind === 'pluie' || w?.kind === 'averses';
  const froid = t !== null && (t < 17 || (pluie && t < 21));
  const firstDay = pieces.every((p) => p.wears === 0);

  const out: Outfit[] = [];
  const leads = new Set<string>();
  const tried = new Set<Base>();
  while (out.length < 3) {
    let base: Base | undefined;
    let best = -Infinity;
    for (const b of bases) {
      if (tried.has(b)) continue;
      const s = b.score - DEJA_PRISE * b.pieces.filter((p) => used.has(p.id)).length;
      if (s > best) [base, best] = [b, s];
    }
    if (!base) break;
    tried.add(base);
    const coat = froid ? meilleure(coats) : undefined;
    const shoe = meilleure(shoes);
    const acc = meilleure(accs);
    const list = [...(coat ? [coat] : []), ...base.pieces, ...(shoe ? [shoe] : []), ...(acc ? [acc] : [])];
    if (av.tenues.has(cleTenue(list.map((p) => p.id)))) continue;
    for (const p of list) used.add(p.id);

    // La raison : ce que la tenue réunit, puis la pièce qui dormait ou la météo.
    const [a, b] = base.pieces;
    const sur = coat ? ` et ${lcFirst(coat.name)} par-dessus` : '';
    const line1 = b ? `${cap(a.name)} avec ${lcFirst(b.name)}${sur}.` : `${cap(a.name)} en pièce centrale${coat ? `, ${lcFirst(coat.name)} par-dessus` : ''}.`;
    const star = [...base.pieces, ...(coat ? [coat] : []), ...(shoe ? [shoe] : [])]
      .filter((p) => (p.lastWorn === null ? p.addedDaysAgo >= 30 : p.lastWorn > DORT))
      .sort((x, y) => (y.lastWorn ?? y.addedDaysAgo) - (x.lastWorn ?? x.addedDaysAgo))[0];
    // La pièce qui ouvre la phrase n'est pas renommée.
    const qui = star === a ? '' : `${cap(star?.name ?? '')} : `;
    const line2 = star
      ? star.lastWorn === null
        ? ` ${qui}${qui ? 'p' : 'P'}remière sortie en ${star.addedDaysAgo} jours.`
        : ` ${qui}${qui ? 'a' : 'A'}u repos depuis ${star.lastWorn} jours.`
      : !w
        ? ''
        : coat
          ? ` ${w.t}°, ${w.label}.`
          : w.t < 15
            ? ` Il fera ${w.t}° : une veste irait bien, dès que tu en ajoutes une.`
            : ` ${w.t}°, ${w.label} : c’est la bonne épaisseur.`;
    const wanted: [string, string] | null = star
      ? star.lastWorn === null ? ['Son tour ', 'est venu.'] : ['Ressortie du ', 'placard.']
      : coat && pluie ? ['Pluie prévue, allure ', 'nette.'] : null;
    const lead =
      (wanted && !leads.has(wanted.join('')) && wanted) ||
      (out.length === 0 && firstDay ? FIRST : LEADS.find((l) => !leads.has(l.join(''))) ?? LEADS[0]);
    leads.add(lead.join(''));
    out.push({ id: `g-${cleTenue(list.map((p) => p.id))}`, title: `${lead[0]}${lead[1]}`, pieces: list.map((p) => p.id), why: `${line1}${line2}` });
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
