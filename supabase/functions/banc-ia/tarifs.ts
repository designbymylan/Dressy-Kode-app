/**
 * Tarifs publics en dollars par million de jetons (13/11), pour estimer le
 * coût d'un essai. Ceux d'un intermédiaire peuvent différer : ce sont des
 * ordres de grandeur, pas des factures.
 */
const PAR_MILLION: Record<string, { in: number; out: number; lu?: number }> = {
  'claude-opus-5-5': { in: 4, out: 20, lu: 0.2 },
  'claude-opus-5': { in: 5, out: 25, lu: 0.5 },
  'claude-sonnet-5-5': { in: 2, out: 10, lu: 0.1 },
  'claude-sonnet-5': { in: 2, out: 10, lu: 0.2 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, lu: 0.01 },
  // Gemini : ordres de grandeur des modèles « flash » (texte et vision).
  'gemini': { in: 0.3, out: 2.5 },
};

/** Coût d'un appel Claude d'après son `usage`. */
export function coutClaude(model: string, usage: unknown): number {
  const u = (usage ?? {}) as Record<string, number | undefined>;
  const p = PAR_MILLION[model] ?? PAR_MILLION['claude-opus-5'];
  const ecrit = (u.cache_creation_input_tokens ?? 0) * p.in * 1.25;
  const lu = (u.cache_read_input_tokens ?? 0) * (p.lu ?? p.in * 0.1);
  return ((u.input_tokens ?? 0) * p.in + (u.output_tokens ?? 0) * p.out + ecrit + lu) / 1e6;
}

/** Coût d'un appel Gemini de texte ou de vision d'après `usageMetadata`. */
export function coutGemini(usage: unknown): number {
  const u = (usage ?? {}) as Record<string, number | undefined>;
  const p = PAR_MILLION.gemini;
  return ((u.promptTokenCount ?? 0) * p.in + ((u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0)) * p.out) / 1e6;
}

/** Une image Nano Banana : 2.1 en 1K 0,034 $, 2 en 1K 0,067 $. */
export const coutImage = (model: string) => (/2\.1/.test(model) ? 0.034 : 0.067);
