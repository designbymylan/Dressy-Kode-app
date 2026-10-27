/**
 * La fiche technique d'une pièce (27/10) : ce que la personne renseigne
 * depuis la fiche, champ par champ, surtout par menus déroulants. Les listes
 * de choix dépendent de la catégorie (une coupe de pantalon n'est pas une
 * coupe de chemise). Rien n'est obligatoire.
 */
import { SEASONS, type CategoryId, type Piece } from './wardrobe';

export type Fiche = {
  composition?: { fibre: string; pct: number }[];
  motif?: string;
  manches?: string;
  longueur?: string;
  particularites?: string[];
  entretien?: string;
  pays?: string;
  achatLieu?: string;
  achatEnseigne?: string;
  /** « 2025 » ou « 2025-03 ». */
  achatDate?: string;
  etat?: string;
  occasions?: string[];
};

export type FieldId =
  | 'composition' | 'motif' | 'taille' | 'coupe' | 'manches' | 'longueur' | 'particularites' | 'saison'
  | 'entretien' | 'marque' | 'pays' | 'achatLieu' | 'achatDate' | 'prix' | 'etat' | 'occasions';

export type FieldKind = 'composition' | 'single' | 'multi' | 'size' | 'text' | 'country' | 'shop' | 'date' | 'price';

export const FIBRES = [
  'Coton', 'Lin', 'Laine', 'Cachemire', 'Soie', 'Viscose', 'Polyester', 'Polyamide', 'Élasthanne', 'Acrylique', 'Lyocell', 'Cuir', 'Daim', 'Denim',
];

const MOTIFS = ['Uni', 'Rayé', 'Carreaux', 'Fleuri', 'Imprimé', 'Pois', 'Animalier', 'Géométrique', 'Tie-dye', 'Logo ou inscription'];

const COUPES: Record<CategoryId, string[]> = {
  hauts: ['Ajustée', 'Droite', 'Ample', 'Oversize', 'Courte', 'Longue'],
  bas: ['Skinny', 'Slim', 'Droite', 'Évasée', 'Large', 'Baggy'],
  manteaux: ['Cintrée', 'Droite', 'Ample', 'Oversize', 'Croisée'],
  robes: ['Ajustée', 'Cintrée', 'Droite', 'Évasée', 'Fluide', 'Portefeuille'],
  chaussures: ['Étroite', 'Normale', 'Large'],
  accessoires: [],
};

export const MANCHES = ['Sans manches', 'Courtes', '3/4', 'Longues'];

const LONGUEURS: Partial<Record<CategoryId, string[]>> = {
  bas: ['Short', 'Bermuda', '7/8', 'Long'],
  robes: ['Mini', 'Au genou', 'Midi', 'Maxi'],
  manteaux: ['Court', 'Mi-long', 'Long'],
};

/** Ce que dit l'étiquette ou le site : de quoi la pièce est capable. */
export const TECHNIQUES = ['Léger', 'Respirant', 'Extensible', 'Évacue l’humidité', 'Anti-UV', 'Imperméable', 'Coupe-vent', 'Isolant', 'Sans repassage', 'Éco-responsable'];

const DETAILS: Record<CategoryId, string[]> = {
  hauts: ['Boutons', 'Poche poitrine', 'Col', 'Capuche', 'Zip', 'Doublé'],
  bas: ['Poches', 'Ceinture', 'Taille haute', 'Taille élastique', 'Zip', 'Doublé'],
  manteaux: ['Capuche', 'Poches', 'Zip', 'Boutons', 'Doublé', 'Ceinture'],
  robes: ['Boutons', 'Zip', 'Poches', 'Ceinture', 'Doublée', 'Fendue'],
  chaussures: ['Lacets', 'Zip', 'Semelle épaisse', 'Talon', 'Doublées'],
  accessoires: ['Poches', 'Zip', 'Bandoulière', 'Doublé'],
};

export const ENTRETIENS = ['Machine 30 °', 'Machine 40 °', 'Programme délicat', 'À la main', 'Nettoyage à sec'];

export const LIEUX = ['En magasin', 'En ligne', 'Seconde main', 'Cadeau', 'Créateur ou fait main', 'Famille ou héritage'];

export const ETATS = ['Neuve avec étiquette', 'Neuve sans étiquette', 'Très bon état', 'Bon état', 'Usée'];

export const OCCASIONS = ['Au quotidien', 'Travail', 'Sortie', 'Soirée', 'Cérémonie', 'Sport', 'Vacances', 'À la maison'];

/** Les pays où l'on fabrique le plus de vêtements, et l'Europe en tête. */
export const PAYS = [
  'France', 'Italie', 'Portugal', 'Espagne', 'Allemagne', 'Belgique', 'Pays-Bas', 'Royaume-Uni', 'Pologne', 'Roumanie', 'Bulgarie', 'Grèce', 'Turquie',
  'Maroc', 'Tunisie', 'Égypte', 'Madagascar', 'Île Maurice', 'Éthiopie', 'Chine', 'Inde', 'Bangladesh', 'Pakistan', 'Sri Lanka', 'Vietnam', 'Cambodge',
  'Thaïlande', 'Indonésie', 'Myanmar', 'Philippines', 'Japon', 'Corée du Sud', 'Taïwan', 'États-Unis', 'Mexique', 'Pérou', 'Brésil',
];

/** Les tailles proposées, par rubrique ; la personne peut aussi en écrire une autre. */
export function sizeGroups(cat: CategoryId): { title: string; options: string[] }[] {
  const lettres = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  const eu = Array.from({ length: 9 }, (_, i) => String(34 + i * 2));
  if (cat === 'chaussures') return [{ title: 'Pointure', options: Array.from({ length: 25 }, (_, i) => String(35 + i * 0.5).replace('.', ',')) }];
  if (cat === 'accessoires') return [{ title: 'Taille', options: ['Unique', 'S', 'M', 'L', 'XL'] }];
  if (cat === 'bas') return [{ title: 'Lettres', options: lettres }, { title: 'Europe', options: eu }, { title: 'Jean (W)', options: Array.from({ length: 11 }, (_, i) => `W${26 + i}`) }];
  return [{ title: 'Lettres', options: lettres }, { title: 'Europe', options: eu }];
}

export type FieldDef = {
  id: FieldId;
  label: string;
  /** La phrase de la feuille, en une ligne. */
  ask: string;
  kind: FieldKind;
  /** Vide : toutes les catégories. */
  cats?: CategoryId[];
};

/** Dans l'ordre où la fiche les montre : d'abord ce qu'on lit sur l'étiquette, puis l'achat. */
export const FIELDS: FieldDef[] = [
  { id: 'composition', label: 'Matière', ask: 'De quoi est faite la pièce ?', kind: 'composition' },
  { id: 'taille', label: 'Taille', ask: 'Quelle taille ?', kind: 'size' },
  { id: 'coupe', label: 'Coupe', ask: 'Quelle coupe ?', kind: 'single', cats: ['hauts', 'bas', 'manteaux', 'robes', 'chaussures'] },
  { id: 'manches', label: 'Manches', ask: 'Quelles manches ?', kind: 'single', cats: ['hauts', 'manteaux', 'robes'] },
  { id: 'longueur', label: 'Longueur', ask: 'Quelle longueur ?', kind: 'single', cats: ['bas', 'robes', 'manteaux'] },
  { id: 'motif', label: 'Motif', ask: 'Quel motif ?', kind: 'single' },
  { id: 'particularites', label: 'Particularités', ask: 'Qu’a-t-elle de particulier ?', kind: 'multi' },
  { id: 'saison', label: 'Saison', ask: 'Pour quelle saison ?', kind: 'single' },
  { id: 'entretien', label: 'Entretien', ask: 'Comment l’entretenir ?', kind: 'single' },
  { id: 'pays', label: 'Fabriquée en', ask: 'Où a-t-elle été fabriquée ?', kind: 'country' },
  { id: 'marque', label: 'Marque', ask: 'De quelle marque ?', kind: 'text' },
  { id: 'achatLieu', label: 'Achetée', ask: 'Où l’as-tu eue ?', kind: 'shop' },
  { id: 'achatDate', label: 'Date d’achat', ask: 'Quand ?', kind: 'date' },
  { id: 'prix', label: 'Prix d’achat', ask: 'Combien l’as-tu payée ?', kind: 'price' },
  { id: 'etat', label: 'État', ask: 'Dans quel état ?', kind: 'single' },
  { id: 'occasions', label: 'Occasions', ask: 'Pour quelles occasions ?', kind: 'multi' },
];

export const fieldOf = (id: FieldId) => FIELDS.find((f) => f.id === id)!;

/** Les champs qui ont un sens pour cette pièce. */
export const fieldsFor = (p: Piece) => FIELDS.filter((f) => !f.cats || f.cats.includes(p.category));

/** Les choix d'un champ à choix simple ou multiple, pour cette pièce. */
export function optionsOf(id: FieldId, p: Piece): string[] {
  switch (id) {
    case 'motif': return MOTIFS;
    case 'coupe': return COUPES[p.category];
    case 'manches': return MANCHES;
    case 'longueur': return LONGUEURS[p.category] ?? [];
    case 'particularites': return [...DETAILS[p.category], ...TECHNIQUES];
    case 'saison': return SEASONS.map(cap);
    case 'entretien': return ENTRETIENS;
    case 'etat': return ETATS;
    case 'occasions': return OCCASIONS;
    default: return [];
  }
}

export const cap = (x: string) => (x ? x[0].toUpperCase() + x.slice(1) : x);

export const priceLabel = (n: number) => `${n.toFixed(2).replace('.', ',').replace(',00', '')} €`;

export const compositionText = (c: Fiche['composition']) => (c ?? []).map((x) => `${x.pct} % ${x.fibre.toLowerCase()}`).join(', ');

/** « mars 2025 », « 2025 ». */
export function dateText(d?: string) {
  if (!d) return '';
  const [y, m] = d.split('-');
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return m ? `${MOIS[Number(m) - 1]} ${y}` : y;
}

/** Ce que la fiche montre à droite de chaque ligne ; vide : à renseigner. */
export function valueOf(id: FieldId, p: Piece): string {
  const f = p.fiche ?? {};
  switch (id) {
    case 'composition': return compositionText(f.composition) || (p.material ? cap(p.material) : '');
    case 'taille': return p.size ?? '';
    case 'coupe': return p.fit ? cap(p.fit) : '';
    case 'manches': return f.manches ?? '';
    case 'longueur': return f.longueur ?? '';
    case 'motif': return f.motif ?? '';
    case 'particularites': return (f.particularites ?? []).join(', ');
    case 'saison': return cap(p.season);
    case 'entretien': return f.entretien ?? '';
    case 'pays': return f.pays ?? '';
    case 'marque': return p.brand ?? '';
    case 'achatLieu': return [f.achatLieu, f.achatEnseigne].filter(Boolean).join(' · ');
    case 'achatDate': return dateText(f.achatDate);
    case 'prix': return p.price != null ? priceLabel(p.price) : '';
    case 'etat': return f.etat ?? '';
    case 'occasions': return (f.occasions ?? []).join(', ');
  }
}

/** La part de la fiche déjà remplie, et le prochain champ à renseigner. */
export function completion(p: Piece) {
  const list = fieldsFor(p);
  const missing = list.filter((f) => !valueOf(f.id, p));
  return { done: list.length - missing.length, total: list.length, missing: missing.map((f) => f.id) };
}

/* ---- Lecture et écriture sûres de l'objet `fiche` ---- */

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const list = (v: unknown, max: number) => {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => text(x, 40)).filter((x): x is string => !!x).slice(0, max);
  return out.length ? out : undefined;
};

/** Ne garde de `fiche` que des champs connus, aux formes et aux longueurs bornées. */
export function cleanFiche(raw: unknown): Fiche | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const composition = Array.isArray(r.composition)
    ? r.composition
        .map((x) => {
          const o = x as { fibre?: unknown; pct?: unknown };
          const fibre = text(o?.fibre, 24);
          const pct = Number(o?.pct);
          return fibre && Number.isFinite(pct) && pct > 0 && pct <= 100 ? { fibre, pct: Math.round(pct) } : null;
        })
        .filter((x): x is { fibre: string; pct: number } => !!x)
        .slice(0, 6)
    : [];
  const date = typeof r.achatDate === 'string' && /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(r.achatDate) ? r.achatDate : undefined;
  const out: Fiche = {
    composition: composition.length ? composition : undefined,
    motif: text(r.motif, 24),
    manches: text(r.manches, 24),
    longueur: text(r.longueur, 24),
    particularites: list(r.particularites, 12),
    entretien: text(r.entretien, 32),
    pays: text(r.pays, 40),
    achatLieu: text(r.achatLieu, 32),
    achatEnseigne: text(r.achatEnseigne, 60),
    achatDate: date,
    etat: text(r.etat, 32),
    occasions: list(r.occasions, 8),
  };
  const kept = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
  return Object.keys(kept).length ? (kept as Fiche) : undefined;
}

/* ---- Appliquer une réponse à la pièce ---- */

export type Answer = string | string[] | number | Fiche['composition'] | { lieu?: string; enseigne?: string } | undefined;

const setKeys = (p: Piece, patch: Partial<Fiche>): Piece => ({ ...p, fiche: cleanFiche({ ...p.fiche, ...patch }) });

/** La pièce, avec la réponse donnée à un champ ; une réponse vide retire l'information. */
export function setField(p: Piece, id: FieldId, v: Answer): Piece {
  const s = typeof v === 'string' ? v.trim() || undefined : undefined;
  const l = Array.isArray(v) && typeof v[0] === 'string' ? (v as string[]) : undefined;
  switch (id) {
    case 'composition': {
      const composition = Array.isArray(v) && typeof v[0] === 'object' ? (v as NonNullable<Fiche['composition']>) : undefined;
      const next = setKeys(p, { composition });
      // La matière de l'étiquette suit la composition : Kodi et le dressing la lisent.
      return { ...next, material: composition ? compositionText(next.fiche?.composition).slice(0, 80) : '' };
    }
    case 'taille': return { ...p, size: s?.slice(0, 20) };
    case 'coupe': return { ...p, fit: s?.toLowerCase().slice(0, 40) };
    case 'saison': return { ...p, season: SEASONS.find((x) => cap(x) === s) ?? p.season };
    case 'marque': return { ...p, brand: s?.slice(0, 60) };
    case 'prix': return { ...p, price: typeof v === 'number' && Number.isFinite(v) ? v : undefined };
    case 'achatLieu': {
      const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as { lieu?: string; enseigne?: string };
      return setKeys(p, { achatLieu: o.lieu, achatEnseigne: o.enseigne });
    }
    case 'achatDate': return setKeys(p, { achatDate: s });
    case 'particularites': return setKeys(p, { particularites: l });
    case 'occasions': return setKeys(p, { occasions: l });
    case 'motif': return setKeys(p, { motif: s });
    case 'manches': return setKeys(p, { manches: s });
    case 'longueur': return setKeys(p, { longueur: s });
    case 'entretien': return setKeys(p, { entretien: s });
    case 'pays': return setKeys(p, { pays: s });
    case 'etat': return setKeys(p, { etat: s });
  }
}
