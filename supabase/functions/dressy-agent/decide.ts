/**
 * Ce que l'agent fait à chaque passage. Logique pure, sans réseau ni base :
 * c'est la partie qui décide où va l'argent, elle est donc testée à part.
 */

// Mesuré sur les premières pièces réelles : aucune n'atteignait 95 (les
// écarts restants tenaient à l'épaisseur d'une police, à l'angle d'une
// poche), et le troisième essai faisait toujours moins bien que les deux
// premiers. 88 garde les pièces reconnaissables et divise l'attente par trois.
export const MAX_ATTEMPTS = 2; // 1 essai + 1 reprise
export const MAX_RUNS = 6; // passages, plantages compris
export const THRESHOLD = 88;

export const CRITERIA = ['type_coupe', 'couleurs', 'motifs', 'matiere', 'details', 'proportions'] as const;

export type Verdict = {
  score: number;
  criteres: Record<string, number>;
  fond_uni: boolean;
  piece_entiere: boolean;
  ecarts: string[];
};

export type Candidate = {
  id: string;
  attempt: number;
  storage_path: string;
  mime: string | null;
  prompt: string | null;
  score: number | null; // null tant que Claude n'a pas jugé
  validated: boolean;
  chosen: boolean;
  ecarts: string[];
};

export type Plan =
  | { kind: 'fail'; reason: string }
  | { kind: 'finalize'; candidate: Candidate }
  | { kind: 'judge'; candidate: Candidate }
  | { kind: 'attempt'; attempt: number; previous: Candidate | null }
  | { kind: 'select'; candidates: Candidate[] };

const clamp = (n: unknown) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
};

/**
 * Remet la réponse de Claude d'aplomb. Le score global ne peut pas dépasser
 * le critère le plus faible de plus de 5 points : une pièce parfaite partout
 * sauf la couleur n'est pas « fidèle à 95 % ».
 */
export function normaliseVerdict(raw: unknown): Verdict {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rawCriteria = (o.criteres ?? {}) as Record<string, unknown>;
  const criteres: Record<string, number> = {};
  for (const k of CRITERIA) criteres[k] = clamp(rawCriteria[k]);

  const weakest = Math.min(...Object.values(criteres));
  const score = Math.min(clamp(o.score), weakest + 5);

  return {
    score,
    criteres,
    fond_uni: o.fond_uni === true,
    piece_entiere: o.piece_entiere === true,
    ecarts: Array.isArray(o.ecarts) ? o.ecarts.map(String).filter(Boolean).slice(0, 8) : [],
  };
}

export function isValidated(v: Verdict): boolean {
  return v.score >= THRESHOLD && v.fond_uni && v.piece_entiere;
}

/** Choix de repli quand Claude ne peut pas trancher : la meilleure note, puis le plus récent. */
export function bestByScore(candidates: Candidate[]): Candidate {
  return [...candidates].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.attempt - a.attempt)[0];
}

/**
 * Où en est la pièce, d'après ce qui est déjà en base. Un passage interrompu
 * reprend sans repayer ce qui a déjà été fait : une image générée mais pas
 * encore jugée est jugée, pas régénérée.
 */
export function planRun(runs: number, candidates: Candidate[]): Plan {
  if (runs > MAX_RUNS) {
    return { kind: 'fail', reason: "Kode n'a pas réussi à terminer cette pièce. Réessaie dans un moment." };
  }

  const sorted = [...candidates].sort((a, b) => a.attempt - b.attempt);

  const settled = sorted.find((c) => c.chosen) ?? sorted.find((c) => c.validated);
  if (settled) return { kind: 'finalize', candidate: settled };

  const unjudged = sorted.find((c) => c.score === null);
  if (unjudged) return { kind: 'judge', candidate: unjudged };

  if (sorted.length < MAX_ATTEMPTS) {
    return { kind: 'attempt', attempt: sorted.length + 1, previous: sorted.at(-1) ?? null };
  }

  return { kind: 'select', candidates: sorted };
}
