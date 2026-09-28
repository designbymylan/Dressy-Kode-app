/** Les pièces que l'agent central prépare, telles que le dressing les affiche. */

export const MAX_ATTEMPTS = 3; // même valeur que supabase/functions/dressy-agent/decide.ts

export const ACTIVE_STATUSES = [
  'queued', 'prompting', 'generating', 'verifying', 'selecting', 'cutout', 'uploading',
] as const;

export type JobRow = {
  id: string;
  status: string;
  attempts: number;
  error: string | null;
  retries: number;
  user_input: string;
  source_paths: string[];
};

/**
 * `attempts` compte les essais déjà jugés par Claude : pendant l'essai n,
 * il vaut n − 1.
 */
export function jobLabel(j: Pick<JobRow, 'status' | 'attempts'>): string {
  const n = Math.min(j.attempts + 1, MAX_ATTEMPTS);
  const essai = `essai ${n}/${MAX_ATTEMPTS}`;
  switch (j.status) {
    case 'queued':
      if (j.attempts >= MAX_ATTEMPTS) return 'Claude va choisir la meilleure image';
      return j.attempts > 0 ? `Nouvel essai en attente — ${essai}` : 'En file';
    case 'prompting':
      return j.attempts > 0 ? `Claude corrige la consigne — ${essai}` : 'Claude décrit la pièce';
    case 'generating':
      return `Nano Banana la dessine — ${essai}`;
    case 'verifying':
      return `Claude vérifie la ressemblance — ${essai}`;
    case 'selecting':
      return 'Claude choisit la meilleure image';
    case 'cutout':
      return 'Détourage';
    case 'uploading':
      return 'Rangement dans le dressing';
    case 'failed':
      return 'Échec';
    default:
      return j.status;
  }
}
