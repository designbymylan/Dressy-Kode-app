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
};

const SAISON: Record<string, string> = { mi_saison: 'mi-saison', hiver: 'hiver', ete: 'été' };

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
export const MAX_PIECES = 6;

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

/** Une ligne par pièce, regroupées par catégorie dans l'ordre des portants. */
export function wardrobeText(refs: Map<string, Garment>, labels: Map<string, string>, today: string): string {
  const byCategory = new Map<string, string[]>();
  for (const [ref, g] of refs) {
    const parts = [ref, g.name];
    if (g.kind) parts.push(g.kind);
    if (g.colors.length) parts.push(g.colors.join('/'));
    if (g.material) parts.push(g.material);
    if (g.season && SAISON[g.season]) parts.push(SAISON[g.season]);
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
