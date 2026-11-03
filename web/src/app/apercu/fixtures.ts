/**
 * Les données inventées des planches /apercu/accueil et /apercu/calendrier :
 * le compte de démonstration d'Alice (comme dans l'app mobile), avec les
 * vignettes détourées de public/pieces quand elles existent et la silhouette
 * de la catégorie sinon. Aucune donnée réelle.
 */
import type { Bloc, Contexte } from '@/lib/contexte';
import type { OutfitPiece } from '@/lib/kode';
import type { HomePiece } from '@/lib/outfits';
import { parisDay } from '@/lib/dates';

const piece = (
  id: string, name: string, category_id: string, kind: string, colour: string | null,
  wears: number, lastWorn: number | null, addedDaysAgo: number, img?: string,
): HomePiece => ({ id, name, category_id, kind, colour, url: img ? `/pieces/${img}.webp` : null, wears, lastWorn, addedDaysAgo });

export const PIECES: HomePiece[] = [
  piece('m1', 'Trench camel', 'vestes', 'trench', '#C49A6C', 14, 12, 420),
  piece('m6', 'Veste de survêtement', 'vestes', 'veste', '#3A3C41', 11, 20, 500, 'veste-survetement'),
  piece('h1', 'Sweat à capuche', 'hauts', 'sweat', '#A7A29A', 18, 8, 460, 'sweat-capuche'),
  piece('h2', 'Pull côtelé crème', 'hauts', 'pull', '#EDE3D1', 9, 35, 400),
  piece('h3', 'Chemise ciel', 'hauts', 'chemise', '#C9DAEA', 5, 120, 260),
  piece('b1', 'Jean gris', 'bas', 'jean', '#8C8C90', 40, 2, 900, 'jean-gris'),
  piece('b2', 'Pantalon noir', 'bas', 'pantalon', '#2B2B2E', 19, 4, 650, 'pantalon-noir'),
  piece('b3', 'Jogging gris', 'bas', 'pantalon', '#A7A29A', 7, 22, 300, 'jogging-gris'),
  piece('r3', 'Robe vert sapin', 'robes', 'robe', '#2F4A3C', 0, null, 90),
  piece('c1', 'Sabots', 'chaussures', 'mocassins', '#7E4F2C', 20, 12, 600, 'sabots'),
  piece('c5', 'Escarpins noirs', 'chaussures', 'escarpins', '#26231F', 5, 210, 650),
  piece('a1', 'Cabas cognac', 'sacs', 'cabas', '#A8703E', 30, 3, 750, 'sac'),
  piece('a5', 'Ceinture cognac', 'accessoires', 'ceinture', '#7E4F2C', 21, 9, 700, 'ceinture'),
];

export const byId = new Map(PIECES.map((p) => [p.id, p]));

export const asOutfitPiece = (p: HomePiece): OutfitPiece => ({ id: p.id, name: p.name, slot: '', category: p.category_id, colour: p.colour, url: p.url });

/** Une tenue inventée : son titre, ses pièces. */
export const outfit = (ids: string[], title: string) => ({ id: `o-${title}`, title, pieces: ids.map((id) => asOutfitPiece(byId.get(id)!)) });

const bloc = <T,>(valeur: T, mention: string): Bloc<T> => ({
  valeur, source: null, mention, maj: new Date().toISOString(), etat: 'frais', message: null,
});

/** La météo d'Alice sur sept jours (la même que la démonstration de l'app mobile). */
export const MOTS = [
  { max: 14, min: 9, ciel: 'averses', libelle: 'averses vers midi' },
  { max: 16, min: 10, ciel: 'nuages', libelle: 'nuageux' },
  { max: 18, min: 11, ciel: 'soleil', libelle: 'ensoleillé' },
  { max: 15, min: 10, ciel: 'pluie', libelle: 'pluie l’après-midi' },
  { max: 13, min: 8, ciel: 'nuages', libelle: 'couvert' },
  { max: 17, min: 10, ciel: 'soleil', libelle: 'ensoleillé' },
  { max: 19, min: 12, ciel: 'soleil', libelle: 'grand beau' },
  { max: 16, min: 11, ciel: 'nuages', libelle: 'voilé' },
  { max: 14, min: 9, ciel: 'averses', libelle: 'averses' },
  { max: 19, min: 12, ciel: 'soleil', libelle: 'ensoleillé' },
  { max: 17, min: 11, ciel: 'nuages', libelle: 'nuageux' },
  { max: 15, min: 9, ciel: 'pluie', libelle: 'pluie' },
  { max: 13, min: 8, ciel: 'nuages', libelle: 'couvert' },
  { max: 16, min: 10, ciel: 'soleil', libelle: 'ensoleillé' },
] as const;

export function contexteFictif(): Contexte {
  return {
    jour: parisDay(0),
    ville: bloc({ nom: 'Paris' }, ''),
    meteo: bloc({
      maintenant: { t: 14, ressenti: 12, ciel: 'averses', vent: 12 },
      jours: MOTS.map((m, i) => ({ date: parisDay(i), max: m.max, min: m.min, ciel: m.ciel, libelle: m.libelle, pluie: null, uv: null })),
    }, 'Météo : Open-Meteo'),
    soleil: bloc({ lever: '07:12', coucher: '17:31' }, 'Soleil : Open-Meteo'),
    feries: bloc([{ date: parisDay(8), nom: 'Armistice 1918' }], 'Jours fériés : data.gouv.fr'),
    ponts: bloc([], 'Ponts : calculés'),
    vacances: bloc([], 'Vacances : data.education.gouv.fr'),
    tendances: bloc([{ kind: 'trench', libelle: 'Le camel', variation: 24 }], 'Tendances : Google Trends'),
    fete: bloc({ prenoms: 'Hubert' }, 'Fête du jour : calendrier'),
  };
}
