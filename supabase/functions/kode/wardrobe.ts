/**
 * Ce que Kodi voit du dressing, et ce qu'on garde de sa réponse. Logique
 * pure, sans réseau ni base : c'est ici que se joue la règle « Kodi ne
 * propose que des pièces du dressing », elle est donc testée à part.
 */

export type Garment = {
  id: string;
  name: string;
  category_id: string;
  /** Le type précis (« pull », « baskets »…), rempli à la photo. */
  kind: string | null;
  /** La saison de la pièce : `toute_annee`, `mi_saison`, `hiver` ou `ete`. */
  season: string | null;
  colors: string[];
  material: string | null;
  wear_count: number;
  last_worn_on: string | null;
  /** L'allure relevée à la photo (F5, 13/11) : motif, coupe, habillage de 1 à 5, détails. */
  fiche?: { motif?: string | null; coupe?: string | null; habillage?: number | null; details?: string | null } | null;
  /** Ce que la personne a saisi : coupe (« slim »), taille, note. */
  fit?: string | null;
  size?: string | null;
  notes?: string | null;
};

const SAISON: Record<string, string> = { mi_saison: 'mi-saison', hiver: 'hiver', ete: 'été' };
const MOTIF: Record<string, string> = {
  uni: 'uni', rayures: 'rayures', carreaux: 'carreaux', imprime: 'imprimé', fleuri: 'fleuri', pois: 'à pois', logo: 'logo', graphique: 'graphique', texture: 'matière texturée',
};
const COUPE: Record<string, string> = { ajustee: 'coupe ajustée', droite: 'coupe droite', ample: 'coupe ample', oversize: 'coupe oversize', evasee: 'coupe évasée' };

export type Slot = 'haut' | 'bas' | 'robe' | 'veste' | 'chaussures' | 'sac' | 'accessoire' | 'bijou';

// Les catégories de la base (table categories) vers les emplacements d'une
// tenue (contrainte outfit_items.slot).
export const SLOT_BY_CATEGORY: Record<string, Slot> = {
  hauts: 'haut',
  bas: 'bas',
  robes: 'robe',
  vestes: 'veste',
  chaussures: 'chaussures',
  sacs: 'sac',
  accessoires: 'accessoire',
  bijoux: 'bijou',
};

export const MIN_PIECES = 2;
// Sept depuis le 13/11 : une superposition, une veste, des chaussures, un sac
// et un bijou doivent tenir sur la carte.
export const MAX_PIECES = 7;

/**
 * Chaque pièce reçoit une référence courte (p1, p2…) plutôt que son UUID :
 * moins de jetons, et une référence inventée se repère tout de suite.
 */
export function withRefs(garments: Garment[]): Map<string, Garment> {
  return new Map(garments.map((g, i) => [`p${i + 1}`, g]));
}

function wornLabel(g: Garment, today: string): string {
  if (!g.wear_count || !g.last_worn_on) return 'jamais portée ici';
  const days = Math.round((Date.parse(today) - Date.parse(g.last_worn_on)) / 86_400_000);
  const when = days <= 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`;
  return `portée ${g.wear_count} fois, la dernière ${when}`;
}

const joursDepuis = (day: string, today: string) => Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);

/**
 * Ce que le dressing dit de la personne (17/11), calculé avec ce que Kodi
 * reçoit déjà (pièces, ports, couleurs aimées) : aucune donnée en plus. Sans
 * elle, Kodi devait relire une à une les lignes du dressing pour repérer ce
 * qui dort, ce qui revient et ce qui manque ; avec elle, sa réponse peut
 * s'ancrer dans un fait propre à la personne (essai du 17/11 : la
 * personnalisation était la note la plus basse, 3,72 sur 5).
 * Vide quand le dressing est trop petit pour dire quelque chose.
 */
export function syntheseTexte(refs: Map<string, Garment>, couleursAimees: string[], today: string): string {
  if (refs.size < 4) return '';
  const lignes: string[] = [];
  const pieces = [...refs];

  // La palette : la couleur dominante de chaque pièce.
  const palette = new Map<string, number>();
  for (const [, g] of pieces) if (g.colors[0]) palette.set(g.colors[0], (palette.get(g.colors[0]) ?? 0) + 1);
  const haut = [...palette].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c} (${n})`);
  if (haut.length) lignes.push(`Palette du dressing : ${haut.join(', ')}.`);

  // Ses couleurs aimées, présentes ou non.
  const aimees = couleursAimees.filter(Boolean);
  if (aimees.length) {
    const vues = new Set(pieces.flatMap(([, g]) => g.colors));
    const presentes = aimees.filter((c) => vues.has(c));
    const absentes = aimees.filter((c) => !vues.has(c));
    if (presentes.length) lignes.push(`Couleurs aimées déjà dans le dressing : ${presentes.join(', ')}.`);
    if (absentes.length) lignes.push(`Couleurs aimées sans aucune pièce : ${absentes.join(', ')} (une piste pour « manque »).`);
  }

  // Ce qu'elle porte le plus, ce qui dort.
  const phares = pieces.filter(([, g]) => g.wear_count >= 3).sort((a, b) => b[1].wear_count - a[1].wear_count).slice(0, 4);
  if (phares.length) lignes.push(`Ses pièces-phares : ${phares.map(([r, g]) => `${r} (${g.wear_count} fois)`).join(', ')}.`);
  const dorment = pieces
    .filter(([, g]) => !g.wear_count || !g.last_worn_on || joursDepuis(g.last_worn_on, today) > 45)
    .sort((a, b) => (a[1].wear_count - b[1].wear_count) || a[0].localeCompare(b[0], 'fr', { numeric: true }))
    .slice(0, 6);
  if (dorment.length) lignes.push(`Pièces qui dorment (jamais portées ici, ou pas depuis plus de six semaines) : ${dorment.map(([r]) => r).join(', ')}.`);

  // Son niveau d'habillage habituel : la moyenne de ce qu'elle possède, pondérée par ce qu'elle porte.
  const notees = pieces.filter(([, g]) => g.fiche?.habillage);
  if (notees.length >= 4) {
    const poids = (g: Garment) => 1 + Math.min(g.wear_count, 10);
    const total = notees.reduce((t, [, g]) => t + poids(g), 0);
    const moy = notees.reduce((t, [, g]) => t + poids(g) * (g.fiche!.habillage as number), 0) / total;
    lignes.push(`Niveau d'habillage du dressing, pesé par ce qui est porté : ${moy.toFixed(1)}/5 (${moy < 2.4 ? 'décontracté' : moy > 3.4 ? 'habillé' : 'entre les deux'}).`);
  }

  // Ce qui est léger : une catégorie utile avec une seule pièce ou aucune.
  const nb = new Map<string, number>();
  for (const [, g] of pieces) nb.set(g.category_id, (nb.get(g.category_id) ?? 0) + 1);
  const legeres = [['vestes', 'vestes'], ['chaussures', 'chaussures'], ['bas', 'bas']]
    .filter(([id]) => (nb.get(id) ?? 0) <= 1)
    .map(([id, mot]) => `${mot} (${nb.get(id) ?? 0})`);
  if (legeres.length) lignes.push(`Catégories très légères : ${legeres.join(', ')}.`);

  return lignes.length
    ? `Ce que le dressing dit de la personne (mesuré sur ses pièces et leurs ports, à utiliser sans le réciter) :\n${lignes.map((l) => `- ${l}`).join('\n')}`
    : '';
}

/** Une ligne par pièce, regroupées par catégorie dans l'ordre des portants. */
export function wardrobeText(refs: Map<string, Garment>, labels: Map<string, string>, today: string): string {
  const byCategory = new Map<string, string[]>();
  for (const [ref, g] of refs) {
    const parts = [ref, g.name];
    if (g.kind) parts.push(g.kind);
    if (g.colors.length) parts.push(g.colors.join('/'));
    if (g.material) parts.push(g.material);
    // L'allure de la pièce (K1, 13/11) : sans elle, Kodi devinait d'après le nom.
    const f = g.fiche;
    if (f?.motif && MOTIF[f.motif]) parts.push(MOTIF[f.motif]);
    if (f?.coupe && COUPE[f.coupe]) parts.push(COUPE[f.coupe]);
    if (f?.habillage) parts.push(`habillage ${f.habillage}/5`);
    if (g.season && SAISON[g.season]) parts.push(SAISON[g.season]);
    if (f?.details) parts.push(f.details);
    if (g.fit) parts.push(`coupe notée par la personne : ${g.fit}`);
    if (g.size) parts.push(`taille ${g.size}`);
    if (g.notes) parts.push(`sa note : « ${g.notes.replace(/\s+/g, ' ').slice(0, 120)} »`);
    parts.push(wornLabel(g, today));
    const list = byCategory.get(g.category_id) ?? [];
    list.push(`- ${parts.join(' · ')}`);
    byCategory.set(g.category_id, list);
  }
  const blocks: string[] = [];
  for (const [id, label] of labels) {
    const lines = byCategory.get(id);
    if (lines) blocks.push(`${label} :\n${lines.join('\n')}`);
  }
  return blocks.join('\n\n');
}

export type Picked = { garment: Garment; slot: Slot };

/**
 * Ne garde de la tenue proposée que des pièces qui existent : références
 * inconnues écartées, doublons retirés, six pièces au plus, et les pièces
 * que la météo du jour interdit (`interdites`, 23/10). En dessous de deux
 * pièces, ce n'est plus une tenue et aucune carte n'est montrée.
 */
export function pickPieces(proposed: unknown, refs: Map<string, Garment>, interdites: Map<string, string> = new Map()): Picked[] {
  const list = Array.isArray(proposed) ? proposed : [];
  const seen = new Set<string>();
  const out: Picked[] = [];
  for (const raw of list) {
    const ref = String(raw).trim().toLowerCase();
    const g = refs.get(ref);
    if (!g || seen.has(g.id) || interdites.has(g.id)) continue;
    seen.add(g.id);
    out.push({ garment: g, slot: SLOT_BY_CATEGORY[g.category_id] ?? 'accessoire' });
    if (out.length === MAX_PIECES) break;
  }
  return out.length >= MIN_PIECES ? out : [];
}

export type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * L'historique tel que l'API l'attend : il commence par la personne, et deux
 * bulles consécutives du même auteur (une question restée sans réponse) sont
 * fusionnées.
 */
export function normaliseHistory(turns: Turn[]): Turn[] {
  const out: Turn[] = [];
  for (const t of turns) {
    const text = t.content.trim();
    if (!text) continue;
    if (!out.length && t.role !== 'user') continue;
    const last = out.at(-1);
    if (last && last.role === t.role) last.content = `${last.content}\n\n${text}`;
    else out.push({ role: t.role, content: text });
  }
  return out;
}

export type PlannedDay = { date: string; titre: string; pourquoi: string; pieces: Picked[] };

/**
 * Ce qu'on garde d'une planification : seulement les jours demandés, une
 * fois chacun, chacun avec des pièces qui existent (même règle que
 * `pickPieces`). Un jour sans tenue valable revient avec une liste vide.
 */
export function pickPlan(
  proposed: unknown,
  refs: Map<string, Garment>,
  days: string[],
  interditsParJour: Map<string, Map<string, string>> = new Map(),
): PlannedDay[] {
  const list = Array.isArray(proposed) ? proposed : [];
  const wanted = new Set(days);
  const out: PlannedDay[] = [];
  for (const raw of list) {
    const j = (raw ?? {}) as { date?: unknown; titre?: unknown; pourquoi?: unknown; pieces?: unknown };
    const date = String(j.date ?? '').trim();
    if (!wanted.has(date)) continue;
    wanted.delete(date);
    out.push({
      date,
      titre: String(j.titre ?? '').trim().slice(0, 80),
      pourquoi: String(j.pourquoi ?? '').trim().slice(0, 400),
      pieces: pickPieces(j.pieces, refs, interditsParJour.get(date)),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
