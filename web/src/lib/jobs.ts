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
 * L'étape de Kodi, pour la couleur de son orbe : lavande quand il repère,
 * pêche quand il dessine, ciel quand il compare, menthe quand il range.
 */
export type OrbStep = 'look' | 'draw' | 'check' | 'store';

export function jobStep(j: Pick<JobRow, 'status' | 'target'>): OrbStep {
  switch (j.status) {
    case 'queued':
    case 'prompting':
      return j.target ? 'draw' : 'look';
    case 'generating':
      return 'draw';
    case 'verifying':
    case 'selecting':
      return 'check';
    default:
      return 'store';
  }
}

/**
 * Ce que Kodi dit pendant qu'il travaille, étape par étape. Les phrases
 * tournent à l'écran ; aucune ne nomme un modèle ni un service.
 */
export function jobPhrases(j: Pick<JobRow, 'status' | 'attempts' | 'target'>): string[] {
  switch (j.status) {
    case 'queued':
      if (j.attempts >= MAX_ATTEMPTS) return ['Kodi choisit le meilleur rendu'];
      if (!j.target) return ['Kodi regarde ta photo', 'Kodi s’installe'];
      return j.attempts > 0 ? ['Kodi prépare un nouvel essai'] : ['Kodi sort ses crayons'];
    case 'prompting':
      return j.target
        ? ['Kodi affine son dessin', 'Kodi corrige les détails']
        : ['Kodi repère chaque pièce', 'Kodi regarde les couleurs', 'Kodi note chaque détail'];
    case 'generating':
      return ['Kodi dessine ta pièce', 'Kodi soigne les couleurs', 'Kodi ajuste la coupe', 'Kodi peaufine les détails'];
    case 'verifying':
      return ['Kodi compare avec ta photo', 'Kodi vérifie chaque détail'];
    case 'selecting':
      return ['Kodi choisit le meilleur rendu'];
    case 'cutout':
      return ['Kodi enlève le fond', 'Kodi détoure ta pièce'];
    case 'uploading':
      return ['Kodi la range sur ton portant'];
    default:
      return ['Kodi travaille'];
  }
}

/** Sous la photo d'origine : combien de pièces Kodi y a trouvées. */
export function jobNote(j: Pick<JobRow, 'analysis' | 'parent_id'>): string | null {
  const inv = j.analysis?.inventory;
  if (j.parent_id || !inv) return null;
  const n = inv.pieces.length;
  const found = n > 1 ? `Kodi a repéré ${n} pièces sur cette photo.` : n === 1 ? 'Kodi a repéré 1 pièce sur cette photo.' : null;
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
