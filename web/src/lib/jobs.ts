/** Les pièces que l'agent central prépare, telles que le dressing les affiche. */

export const MAX_ATTEMPTS = 2; // même valeur que supabase/functions/dressy-agent/decide.ts

export const ACTIVE_STATUSES = [
  'queued', 'prompting', 'generating', 'verifying', 'selecting', 'cutout', 'uploading',
] as const;

export const JOB_SELECT = 'id, status, attempts, error, retries, user_input, source_paths, target, parent_id, analysis, garment_id, updated_at';

/** Une photo reste affichée ce temps après que toutes ses pièces sont rangées. */
export const RECENT_MS = 10 * 60 * 1000;

/**
 * Filtre PostgREST des tâches à montrer : en cours, en échec, ou rangées
 * depuis peu (pour que la photo garde ses pièces cochées).
 */
export function jobsFilter(now = Date.now()): string {
  const since = new Date(now - RECENT_MS).toISOString();
  return `status.in.(${[...ACTIVE_STATUSES, 'failed'].join(',')}),updated_at.gt."${since}"`;
}

/** Cadre d'une pièce sur la photo, en fractions : [x, y, largeur, hauteur]. */
export type Box = [number, number, number, number];

export type JobRow = {
  id: string;
  status: string;
  attempts: number;
  error: string | null;
  retries: number;
  user_input: string;
  source_paths: string[];
  /** La fiche de la pièce, une fois repérée sur la photo. */
  target: { name: string; category?: string; kind?: string | null; box?: Box | null } | null;
  /** La tâche de la photo d'où la pièce a été repérée. */
  parent_id: string | null;
  analysis: {
    name?: string;
    inventory?: { pieces: { name: string; box?: Box | null }[]; skipped?: number };
    /** L'image générée avec son fond, et où la pièce y a été découpée (pixels). */
    reveal?: { raw: string; size: [number, number]; box: [number, number, number, number] };
  } | null;
  garment_id: string | null;
  updated_at: string;
};

export function jobTitle(j: Pick<JobRow, 'target' | 'analysis'>): string {
  return j.target?.name ?? j.analysis?.name ?? 'Ta photo';
}

/**
 * Ce que Kode dit pendant qu'il travaille, étape par étape. Les phrases
 * tournent à l'écran ; aucune ne nomme un modèle ni un service.
 */
export function jobPhrases(j: Pick<JobRow, 'status' | 'attempts' | 'target'>): string[] {
  switch (j.status) {
    case 'queued':
      if (j.attempts >= MAX_ATTEMPTS) return ['Kode choisit le meilleur rendu'];
      if (!j.target) return ['Kode regarde ta photo', 'Kode s’installe'];
      return j.attempts > 0 ? ['Kode prépare un nouvel essai'] : ['Kode sort ses crayons'];
    case 'prompting':
      return j.target
        ? ['Kode affine son dessin', 'Kode corrige les détails']
        : ['Kode repère chaque pièce', 'Kode regarde les couleurs', 'Kode note chaque détail'];
    case 'generating':
      return ['Kode dessine ta pièce', 'Kode soigne les couleurs', 'Kode ajuste la coupe', 'Kode peaufine les détails'];
    case 'verifying':
      return ['Kode compare avec ta photo', 'Kode vérifie chaque détail'];
    case 'selecting':
      return ['Kode choisit le meilleur rendu'];
    case 'cutout':
      return ['Kode enlève le fond', 'Kode détoure ta pièce'];
    case 'uploading':
      return ['Kode la range sur ton portant'];
    default:
      return ['Kode travaille'];
  }
}

/** Sous la photo d'origine : combien de pièces Kode y a trouvées. */
export function jobNote(j: Pick<JobRow, 'analysis' | 'parent_id'>): string | null {
  const inv = j.analysis?.inventory;
  if (j.parent_id || !inv) return null;
  const n = inv.pieces.length;
  const found = n > 1 ? `Kode a repéré ${n} pièces sur cette photo.` : n === 1 ? 'Kode a repéré 1 pièce sur cette photo.' : null;
  const skipped = inv.skipped
    ? `${inv.skipped} autre${inv.skipped > 1 ? 's' : ''} n’${inv.skipped > 1 ? 'ont' : 'a'} pas pu être ajoutée${inv.skipped > 1 ? 's' : ''} : ton dressing est plein.`
    : null;
  return [found, skipped].filter(Boolean).join(' ') || null;
}

export type ScanPiece = { key: string; name: string; box: Box | null; state: 'working' | 'done' | 'failed' };

/** Les tâches d'une même photo, dans l'ordre où la photo a été confiée. */
export function groupByPhoto<T extends JobRow>(jobs: T[]): { key: string; jobs: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const j of jobs) {
    const key = j.source_paths[0] ?? j.id;
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }
  return [...groups].map(([key, list]) => ({ key, jobs: list }));
}
