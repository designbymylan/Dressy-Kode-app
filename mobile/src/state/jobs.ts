/**
 * Les photos confiées à Kode et les pièces qu'il en tire, telles que l'écran
 * d'ajout les suit. Même vocabulaire que web/src/lib/jobs.ts : une tâche
 * « mère » par photo (le repérage), une tâche « fille » par pièce repérée.
 */

export const MAX_ATTEMPTS = 2; // même valeur que supabase/functions/dressy-agent/decide.ts

export const ACTIVE_STATUSES = ['queued', 'prompting', 'generating', 'verifying', 'selecting', 'cutout', 'uploading'] as const;
const ACTIVE = new Set<string>(ACTIVE_STATUSES);

export const JOB_SELECT = 'id, status, attempts, error, retries, user_input, source_paths, target, parent_id, analysis, garment_id, updated_at';

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
  target: { name: string; category?: string; kind?: string | null; box?: Box | null } | null;
  parent_id: string | null;
  analysis: {
    name?: string;
    inventory?: { pieces: { name: string; box?: Box | null }[]; skipped?: number };
    reveal?: { raw: string; size: [number, number]; box: [number, number, number, number] };
  } | null;
  garment_id: string | null;
  updated_at: string;
};

/** Ce qu'il faut pour jouer le détourage révélé d'une pièce. */
export type Reveal = {
  /** L'image dessinée, avec son fond uni. */
  raw: string;
  /** La pièce détourée, fond transparent. */
  cut: string;
  /** Taille de l'image dessinée, en pixels. */
  size: [number, number];
  /** Où la pièce détourée a été découpée dans l'image dessinée : [x, y, largeur, hauteur]. */
  box: [number, number, number, number];
};

export type ScanPiece = { key: string; name: string; box: Box | null; state: 'working' | 'done' | 'failed' };

export const isActive = (j: Pick<JobRow, 'status'>) => ACTIVE.has(j.status);

/** Une ligne de pièce : une tâche fille, ou la tâche d'une photo à une seule pièce. */
export const isPiece = (j: JobRow) => Boolean(j.target || j.analysis?.name);

export function jobTitle(j: Pick<JobRow, 'target' | 'analysis'>): string {
  return j.target?.name ?? j.analysis?.name ?? 'Ta photo';
}

/**
 * L'étape de Kode, pour la couleur de son orbe : lavande quand il repère,
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

/** Ce que Kode dit pendant qu'il travaille. Aucune phrase ne nomme un modèle ni un service. */
export function jobPhrases(j: Pick<JobRow, 'status' | 'attempts' | 'target'>): string[] {
  switch (j.status) {
    case 'queued':
      if (j.attempts >= MAX_ATTEMPTS) return ['Kode choisit le meilleur rendu'];
      if (!j.target) return ['Kode regarde ta photo', 'Kode s’installe'];
      return j.attempts > 0 ? ['Kode prépare un nouvel essai'] : ['Kode sort ses crayons'];
    case 'prompting':
      return j.target ? ['Kode affine son dessin', 'Kode corrige les détails'] : ['Kode repère chaque pièce', 'Kode regarde les couleurs', 'Kode note chaque détail'];
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

/** Sous la photo : combien de pièces Kode y a trouvées. */
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

/** Les tâches d'une même photo, dans l'ordre où les photos ont été confiées. */
export function groupByPhoto(jobs: JobRow[]): { key: string; jobs: JobRow[] }[] {
  const groups = new Map<string, JobRow[]>();
  for (const j of jobs) {
    const key = j.source_paths[0] ?? j.id;
    groups.set(key, [...(groups.get(key) ?? []), j]);
  }
  return [...groups].map(([key, list]) => ({ key, jobs: list }));
}

/**
 * Les cadres à tracer sur une photo : une pièce par tâche fille, plus celles
 * de l'inventaire qui n'ont pas (ou plus) de tâche à suivre.
 */
export function scanPieces(jobs: JobRow[], playing: Record<string, unknown> = {}): ScanPiece[] {
  const parent = jobs.find((j) => !j.parent_id) ?? null;
  const pieces: ScanPiece[] = jobs.filter(isPiece).map((j) => ({
    key: j.id,
    name: jobTitle(j),
    box: j.target?.box ?? null,
    state: playing[j.id] ? 'working' : j.status === 'done' ? 'done' : j.status === 'failed' ? 'failed' : 'working',
  }));
  parent?.analysis?.inventory?.pieces.forEach((p, i) => {
    if (!pieces.some((q) => q.name === p.name)) pieces.push({ key: `inv${i}`, name: p.name, box: p.box ?? null, state: 'done' });
  });
  return pieces;
}
