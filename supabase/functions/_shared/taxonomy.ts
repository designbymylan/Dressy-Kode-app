/**
 * La taxonomie fermée de Dresskode : la SEULE liste des valeurs qu'une fiche
 * de pièce peut prendre (spec « Pipeline d'ajout de vêtements », 20/11).
 *
 * Tout en part :
 *   - le schéma JSON imposé au modèle d'étiquetage (`schemaEtiquetage`) ;
 *   - la validation du serveur avant toute écriture (`validerEtiquettes`) ;
 *   - les contraintes SQL de la base (`sqlTaxonomie`, recopié dans une
 *     migration par `node tools/taxonomie.mjs`) ;
 *   - les sélecteurs de l'app et du site (copies générées par le même outil :
 *     `mobile/src/data/taxonomy.ts`, `web/src/lib/taxonomy.ts`, jamais à la main).
 *
 * Les identifiants sont ceux déjà en base (décision du 20/11 : on garde la
 * taxonomie en place, en français, plus riche que celle de la spec). Un
 * identifiant ne change jamais une fois des pièces créées : on en ajoute.
 *
 * Fichier pur (ni Deno, ni Node, ni React) : il tourne partout.
 */

export const TAXONOMIE_VERSION = 1;

export type Genre = 'm' | 'f';

export type TypeDePiece = {
  id: string;
  label: string;
  /** Le nom donné à la pièce quand il diffère du libellé (« Pince » plutôt que « Pince et barrette »). */
  nom?: string;
  genre: Genre;
  pluriel?: boolean;
};

export type Categorie = { id: string; label: string; types: readonly TypeDePiece[] };

const t = (id: string, label: string, genre: Genre, opts: { nom?: string; pluriel?: boolean } = {}): TypeDePiece => ({ id, label, genre, ...opts });

export const CATEGORIES: readonly Categorie[] = [
  {
    id: 'hauts', label: 'Hauts', types: [
      t('tshirt', 'T-shirt', 'm'), t('chemise', 'Chemise', 'f'), t('blouse', 'Blouse', 'f'), t('polo', 'Polo', 'm'),
      t('pull', 'Pull', 'm'), t('sweat', 'Sweat', 'm'), t('capuche', 'Sweat à capuche', 'm'), t('debardeur', 'Débardeur', 'm'),
      t('top', 'Top', 'm'),
    ],
  },
  {
    id: 'bas', label: 'Bas', types: [
      t('jean', 'Jean', 'm'), t('pantalon', 'Pantalon', 'm'), t('chino', 'Chino', 'm'), t('jupe', 'Jupe', 'f'),
      t('jupeculotte', 'Jupe-culotte', 'f'), t('short', 'Short', 'm'), t('legging', 'Legging', 'm'),
    ],
  },
  {
    id: 'robes', label: 'Robes', types: [t('robe', 'Robe', 'f'), t('combinaison', 'Combinaison', 'f'), t('salopette', 'Salopette', 'f')],
  },
  {
    id: 'vestes', label: 'Vestes et manteaux', types: [
      t('veste', 'Veste', 'f'), t('blazer', 'Blazer', 'm'), t('manteau', 'Manteau', 'm'), t('trench', 'Trench', 'm'),
      t('doudoune', 'Doudoune', 'f'), t('gilet', 'Gilet', 'm'),
    ],
  },
  {
    id: 'chaussures', label: 'Chaussures', types: [
      t('baskets', 'Baskets', 'f', { pluriel: true }), t('bottines', 'Bottines', 'f', { pluriel: true }),
      t('bottes', 'Bottes', 'f', { pluriel: true }), t('escarpins', 'Escarpins', 'm', { pluriel: true }),
      t('sandales', 'Sandales', 'f', { pluriel: true }), t('mules', 'Mules', 'f', { pluriel: true }),
      t('mocassins', 'Mocassins', 'm', { pluriel: true }), t('derbies', 'Derbies', 'm', { pluriel: true }),
      t('ballerines', 'Ballerines', 'f', { pluriel: true }),
    ],
  },
  {
    id: 'sacs', label: 'Sacs', types: [
      t('sacamain', 'Sac à main', 'm'), t('bandouliere', 'Bandoulière', 'm', { nom: 'Sac bandoulière' }),
      t('pochette', 'Pochette', 'f'), t('cabas', 'Cabas', 'm'), t('sacados', 'Sac à dos', 'm'),
    ],
  },
  {
    id: 'bijoux', label: 'Bijoux', types: [
      t('collier', 'Collier', 'm'), t('boucles', "Boucles d'oreilles", 'f', { pluriel: true }), t('bracelet', 'Bracelet', 'm'),
      t('bague', 'Bague', 'f'), t('montre', 'Montre', 'f'), t('broche', 'Broche', 'f'),
    ],
  },
  {
    id: 'accessoires', label: 'Accessoires', types: [
      t('ceinture', 'Ceinture', 'f'), t('bandeau', 'Bandeau', 'm'), t('pince', 'Pince et barrette', 'f', { nom: 'Pince' }),
      t('foulard', 'Foulard', 'm'), t('echarpe', 'Écharpe', 'f'), t('chapeau', 'Chapeau', 'm'), t('casquette', 'Casquette', 'f'),
      t('bonnet', 'Bonnet', 'm'), t('lunettes', 'Lunettes', 'f', { pluriel: true }), t('gants', 'Gants', 'm', { pluriel: true }),
    ],
  },
];

/**
 * Les couleurs. `hex` : teinte de référence (pastilles, comparaison avec le
 * profil). `formes` : l'adjectif accordé [masc. sing., fém. sing., masc. plur.,
 * fém. plur.], pour nommer la pièce sans texte libre (« Jupe noire »).
 */
export type Couleur = { id: string; label: string; hex: string; formes: readonly [string, string, string, string] };

const inv = (s: string) => [s, s, s, s] as const;
const acc = (ms: string, fs: string, mp = `${ms}s`, fp = `${fs}s`) => [ms, fs, mp, fp] as const;

export const COULEURS: readonly Couleur[] = [
  { id: 'noir', label: 'Noir', hex: '#0D0D0E', formes: acc('noir', 'noire') },
  { id: 'anthracite', label: 'Anthracite', hex: '#3F3F44', formes: inv('anthracite') },
  { id: 'gris', label: 'Gris', hex: '#8C8C90', formes: acc('gris', 'grise', 'gris', 'grises') },
  { id: 'blanc', label: 'Blanc', hex: '#FFFFFF', formes: acc('blanc', 'blanche') },
  { id: 'creme', label: 'Crème', hex: '#F0E9DC', formes: inv('crème') },
  { id: 'beige', label: 'Beige', hex: '#D9C9AE', formes: acc('beige', 'beige') },
  { id: 'camel', label: 'Camel', hex: '#B0833F', formes: inv('camel') },
  { id: 'marron', label: 'Marron', hex: '#5C4327', formes: inv('marron') },
  { id: 'bordeaux', label: 'Bordeaux', hex: '#6B1F2E', formes: inv('bordeaux') },
  { id: 'rouge', label: 'Rouge', hex: '#B22B27', formes: acc('rouge', 'rouge') },
  { id: 'orange', label: 'Orange', hex: '#D2601A', formes: inv('orange') },
  { id: 'moutarde', label: 'Moutarde', hex: '#C9992B', formes: inv('moutarde') },
  { id: 'jaune', label: 'Jaune', hex: '#E8C33A', formes: acc('jaune', 'jaune') },
  { id: 'olive', label: 'Vert olive', hex: '#5A6340', formes: inv('vert olive') },
  { id: 'vert', label: 'Vert', hex: '#2F6B48', formes: acc('vert', 'verte') },
  { id: 'marine', label: 'Bleu marine', hex: '#26334D', formes: inv('bleu marine') },
  { id: 'bleu', label: 'Bleu', hex: '#4A76A8', formes: acc('bleu', 'bleue') },
  { id: 'ciel', label: 'Bleu ciel', hex: '#A8C8E0', formes: inv('bleu ciel') },
  { id: 'violet', label: 'Violet', hex: '#6B4E8C', formes: acc('violet', 'violette') },
  { id: 'rose', label: 'Rose', hex: '#D9959F', formes: acc('rose', 'rose') },
  { id: 'dore', label: 'Doré', hex: '#C9A55C', formes: acc('doré', 'dorée') },
  { id: 'argente', label: 'Argenté', hex: '#BFC3C9', formes: acc('argenté', 'argentée') },
];

type Valeur = { id: string; label: string };

/** Matière apparente (nouveau le 20/11 : avant, du texte libre). « autre » en cas de doute. */
export const MATIERES: readonly Valeur[] = [
  { id: 'coton', label: 'Coton' }, { id: 'denim', label: 'Denim' }, { id: 'laine', label: 'Laine' },
  { id: 'maille', label: 'Maille' }, { id: 'lin', label: 'Lin' }, { id: 'soie', label: 'Soie' },
  { id: 'cuir', label: 'Cuir' }, { id: 'daim', label: 'Daim' }, { id: 'velours', label: 'Velours' },
  { id: 'synthetique', label: 'Synthétique' }, { id: 'metal', label: 'Métal' }, { id: 'autre', label: 'Autre' },
];

/** « autre » ajouté le 20/11 : le modèle répond « autre » plutôt que de deviner. */
export const MOTIFS: readonly Valeur[] = [
  { id: 'uni', label: 'Uni' }, { id: 'rayures', label: 'Rayures' }, { id: 'carreaux', label: 'Carreaux' },
  { id: 'imprime', label: 'Imprimé' }, { id: 'fleuri', label: 'Fleuri' }, { id: 'pois', label: 'Pois' },
  { id: 'logo', label: 'Logo' }, { id: 'graphique', label: 'Graphique' }, { id: 'texture', label: 'Texture' },
  { id: 'autre', label: 'Autre' },
];

export const COUPES: readonly Valeur[] = [
  { id: 'ajustee', label: 'Ajustée' }, { id: 'droite', label: 'Droite' }, { id: 'ample', label: 'Ample' },
  { id: 'oversize', label: 'Oversize' }, { id: 'evasee', label: 'Évasée' }, { id: 'sans_objet', label: 'Sans objet' },
];

/** Plusieurs possibles (spec) ; l'ancienne colonne `season` en est déduite (`saisonResumee`). */
export const SAISONS: readonly Valeur[] = [
  { id: 'printemps', label: 'Printemps' }, { id: 'ete', label: 'Été' }, { id: 'automne', label: 'Automne' }, { id: 'hiver', label: 'Hiver' },
];

/** Le niveau d'habillage, de 1 à 5, déjà lu par Kodi (`garments.fiche.habillage`). */
export const HABILLAGES: readonly { id: number; label: string }[] = [
  { id: 1, label: 'Sport et détente' }, { id: 2, label: 'Décontracté' }, { id: 3, label: 'Polyvalent' },
  { id: 4, label: 'Habillé' }, { id: 5, label: 'Très habillé' },
];

// ---------------------------------------------------------------- lecture

export const IDS = {
  categories: CATEGORIES.map((c) => c.id),
  types: CATEGORIES.flatMap((c) => c.types.map((k) => k.id)),
  couleurs: COULEURS.map((c) => c.id),
  matieres: MATIERES.map((m) => m.id),
  motifs: MOTIFS.map((m) => m.id),
  coupes: COUPES.map((m) => m.id),
  saisons: SAISONS.map((s) => s.id),
  habillages: HABILLAGES.map((h) => h.id),
};

const CATEGORIE = new Map(CATEGORIES.map((c) => [c.id, c]));
const TYPE = new Map(CATEGORIES.flatMap((c) => c.types.map((k) => [k.id, { ...k, categorie: c.id }] as const)));
const COULEUR = new Map(COULEURS.map((c) => [c.id, c]));

export const categorie = (id: string | null | undefined) => (id ? CATEGORIE.get(id) : undefined);
export const typeDePiece = (id: string | null | undefined) => (id ? TYPE.get(id) : undefined);
export const couleur = (id: string | null | undefined) => (id ? COULEUR.get(id) : undefined);
/** La catégorie d'un type (un type n'appartient qu'à une catégorie). */
export const categorieDuType = (id: string) => TYPE.get(id)?.categorie;

export function libelle(liste: readonly { id: string | number; label: string }[], id: string | number | null | undefined): string {
  return liste.find((v) => v.id === id)?.label ?? '';
}

/** Le nom de la pièce, tiré des seules valeurs de la fiche : « Jupe noire », « Baskets blanches ». */
export function nomDeLaPiece(type: string, couleurId: string | null | undefined): string {
  const k = TYPE.get(type);
  if (!k) return 'Pièce';
  const base = k.nom ?? k.label;
  const c = couleurId ? COULEUR.get(couleurId) : undefined;
  if (!c) return base;
  const forme = c.formes[(k.pluriel ? 2 : 0) + (k.genre === 'f' ? 1 : 0)];
  return `${base} ${forme}`;
}

/** L'ancienne saison unique (colonne `season`, lue par Kodi et l'app) déduite des saisons. */
export function saisonResumee(saisons: readonly string[]): 'toute_annee' | 'mi_saison' | 'hiver' | 'ete' {
  const s = new Set(saisons);
  if (s.size === 0 || s.size >= 3 || (s.has('hiver') && s.has('ete'))) return 'toute_annee';
  if (s.has('hiver')) return 'hiver';
  if (s.has('ete')) return 'ete';
  return 'mi_saison';
}

/** L'inverse, pour une pièce qui n'a que l'ancienne saison. */
export function saisonsDe(season: string | null | undefined): string[] {
  if (season === 'hiver') return ['hiver'];
  if (season === 'ete') return ['ete'];
  if (season === 'mi_saison') return ['printemps', 'automne'];
  return [...IDS.saisons];
}

// ---------------------------------------------------------------- étiquetage

/** Ce que le modèle d'étiquetage rend, et rien d'autre. */
export type Etiquettes = {
  piece_unique: boolean;
  categorie: string;
  type: string;
  couleur: string;
  couleur_2: string | null;
  matiere: string;
  motif: string;
  coupe: string;
  saisons: string[];
  habillage: number;
  confiance: number;
};

const CHAMPS = ['piece_unique', 'categorie', 'type', 'couleur', 'couleur_2', 'matiere', 'motif', 'coupe', 'saisons', 'habillage', 'confiance'] as const;

/**
 * Le schéma JSON de la réponse : chaque valeur est un `enum` de la taxonomie,
 * aucun texte libre. Sans borne numérique (`confiance` est vérifiée par
 * `validerEtiquettes`) : certains fournisseurs les refusent.
 */
export function schemaEtiquetage() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [...CHAMPS],
    properties: {
      piece_unique: { type: 'boolean', description: 'true si la photo montre UNE seule pièce (une paire compte pour une).' },
      categorie: { type: 'string', enum: IDS.categories },
      type: { type: 'string', enum: IDS.types },
      couleur: { type: 'string', enum: IDS.couleurs },
      couleur_2: { type: ['string', 'null'], enum: [...IDS.couleurs, null] },
      matiere: { type: 'string', enum: IDS.matieres },
      motif: { type: 'string', enum: IDS.motifs },
      coupe: { type: 'string', enum: IDS.coupes },
      saisons: { type: 'array', items: { type: 'string', enum: IDS.saisons } },
      habillage: { type: 'integer', enum: IDS.habillages },
      confiance: { type: 'number', description: 'De 0 à 1.' },
    },
  } as const;
}

export type Validation = { ok: true; etiquettes: Etiquettes } | { ok: false; erreurs: string[] };

const dans = (liste: readonly (string | number)[], v: unknown) => liste.includes(v as never);

/**
 * La réponse du modèle passée au crible : un champ manquant, en trop ou hors
 * liste, un type qui n'est pas de sa catégorie, et la réponse est rejetée.
 * Le serveur n'écrit que ce qui sort d'ici avec `ok: true`.
 */
export function validerEtiquettes(brut: unknown): Validation {
  const erreurs: string[] = [];
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { ok: false, erreurs: ['pas un objet'] };
  const o = brut as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!dans(CHAMPS, k)) erreurs.push(`champ inconnu : ${k}`);
  for (const k of CHAMPS) if (!(k in o)) erreurs.push(`champ manquant : ${k}`);
  if (typeof o.piece_unique !== 'boolean') erreurs.push('piece_unique : booléen attendu');
  if (!dans(IDS.categories, o.categorie)) erreurs.push(`categorie hors liste : ${String(o.categorie)}`);
  if (!dans(IDS.types, o.type)) erreurs.push(`type hors liste : ${String(o.type)}`);
  else if (dans(IDS.categories, o.categorie) && categorieDuType(o.type as string) !== o.categorie) {
    erreurs.push(`type ${String(o.type)} hors de la catégorie ${String(o.categorie)}`);
  }
  if (!dans(IDS.couleurs, o.couleur)) erreurs.push(`couleur hors liste : ${String(o.couleur)}`);
  if (o.couleur_2 !== null && !dans(IDS.couleurs, o.couleur_2)) erreurs.push(`couleur_2 hors liste : ${String(o.couleur_2)}`);
  if (!dans(IDS.matieres, o.matiere)) erreurs.push(`matiere hors liste : ${String(o.matiere)}`);
  if (!dans(IDS.motifs, o.motif)) erreurs.push(`motif hors liste : ${String(o.motif)}`);
  if (!dans(IDS.coupes, o.coupe)) erreurs.push(`coupe hors liste : ${String(o.coupe)}`);
  if (!Array.isArray(o.saisons) || o.saisons.length === 0 || o.saisons.some((s) => !dans(IDS.saisons, s)) || new Set(o.saisons).size !== o.saisons.length) {
    erreurs.push(`saisons invalides : ${JSON.stringify(o.saisons)}`);
  }
  if (!dans(IDS.habillages, o.habillage)) erreurs.push(`habillage hors liste : ${String(o.habillage)}`);
  if (typeof o.confiance !== 'number' || !Number.isFinite(o.confiance) || o.confiance < 0 || o.confiance > 1) {
    erreurs.push(`confiance hors de 0 à 1 : ${String(o.confiance)}`);
  }
  if (erreurs.length) return { ok: false, erreurs };
  const e = o as unknown as Etiquettes;
  return {
    ok: true,
    etiquettes: {
      ...e,
      // Une seconde couleur égale à la première n'apporte rien.
      couleur_2: e.couleur_2 === e.couleur ? null : e.couleur_2,
      // Toujours dans l'ordre de la taxonomie : la base compare des tableaux.
      saisons: IDS.saisons.filter((s) => e.saisons.includes(s)),
    },
  };
}

// ---------------------------------------------------------------- base

const q = (s: string | number) => (typeof s === 'number' ? String(s) : `'${s.replace(/'/g, "''")}'`);
const liste = (xs: readonly (string | number)[]) => xs.map(q).join(', ');

/**
 * Les contraintes SQL tirées de la taxonomie : des fonctions immuables que
 * les `check` de `garments` appellent. Recopié tel quel dans une migration
 * par `node tools/taxonomie.mjs --sql` ; un test vérifie que la dernière copie
 * en migration est à jour.
 */
export function sqlTaxonomie(): string {
  const paires = CATEGORIES.flatMap((c) => c.types.map((k) => `(${q(c.id)}, ${q(k.id)})`)).join(',\n    ');
  return `-- taxonomie:debut (version ${TAXONOMIE_VERSION}, générée depuis supabase/functions/_shared/taxonomy.ts : ne pas modifier à la main)
create or replace function public.taxo_type_valide(cat text, kind text)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select (cat, kind) in (
    ${paires}
  ) $$;

create or replace function public.taxo_couleurs_valides(v text[])
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v <@ array[${liste(IDS.couleurs)}]::text[] $$;

create or replace function public.taxo_matiere_valide(v text)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v in (${liste(IDS.matieres)}) $$;

create or replace function public.taxo_motif_valide(v text)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v in (${liste(IDS.motifs)}) $$;

create or replace function public.taxo_coupe_valide(v text)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v in (${liste(IDS.coupes)}) $$;

create or replace function public.taxo_saisons_valides(v text[])
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select cardinality(v) between 1 and ${IDS.saisons.length} and v <@ array[${liste(IDS.saisons)}]::text[] $$;

create or replace function public.taxo_habillage_valide(v smallint)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v in (${liste(IDS.habillages)}) $$;
-- taxonomie:fin`;
}
