/**
 * Les adresses des fournisseurs d'IA (Claude, Gemini).
 *
 * Par défaut ce sont les leurs. Deux secrets facultatifs les remplacent, sans
 * toucher au code, pour passer par un intermédiaire ou faire un essai :
 *
 *   ANTHROPIC_BASE_URL   https://exemple.com   (sans /v1 : le SDK l'ajoute)
 *   GEMINI_BASE_URL      https://exemple.com   (sans /v1beta)
 *
 * Une adresse collée avec /v1, /v1beta ou /v1/messages est ramenée à sa base.
 * Seul https est accepté : une photo ne part jamais en clair.
 *
 * Passer par un intermédiaire, c'est lui confier les photos et les questions
 * des personnes : à inscrire au registre (`docs/rgpd/`) avant de l'activer.
 */

export const ANTHROPIC_OFFICIEL = 'https://api.anthropic.com';
export const GEMINI_OFFICIEL = 'https://generativelanguage.googleapis.com';

/**
 * Une adresse telle que collée (guillemets, barre finale, /v1, /v1beta,
 * /v1/messages…) ramenée à sa base ; `undefined` si elle est vide ou si ce
 * n'est pas une adresse https.
 */
export function normaliserBase(brut: string | null | undefined): string | undefined {
  const v = brut?.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!v) return undefined;
  const base = v.replace(/\/+$/, '').replace(/\/v1(beta)?(\/.*)?$/, '').replace(/\/+$/, '');
  return /^https:\/\/[^/\s]+(\/[^\s]*)?$/.test(base) ? base : undefined;
}

function lire(nom: string): string | undefined {
  const brut = Deno.env.get(nom);
  const base = normaliserBase(brut);
  if (brut?.trim() && !base) console.warn(`${nom} ignorée : une adresse en https:// est attendue`);
  return base;
}

/** La base de l'API Claude, sans /v1. */
export const anthropicBase = (): string => lire('ANTHROPIC_BASE_URL') ?? ANTHROPIC_OFFICIEL;

/** La base de l'API Gemini, sans /v1beta. */
export const geminiBase = (): string => lire('GEMINI_BASE_URL') ?? GEMINI_OFFICIEL;

/** L'adresse d'un appel à un modèle Gemini (`generateContent` par défaut). */
export const geminiUrl = (modele: string, methode = 'generateContent'): string =>
  `${geminiBase()}/v1beta/models/${modele}:${methode}`;

export const anthropicViaIntermediaire = (): boolean => anthropicBase() !== ANTHROPIC_OFFICIEL;
export const geminiViaIntermediaire = (): boolean => geminiBase() !== GEMINI_OFFICIEL;
