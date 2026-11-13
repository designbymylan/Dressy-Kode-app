/**
 * Les adresses des fournisseurs d'IA (Claude, Gemini).
 *
 * Par défaut ce sont les leurs. Deux secrets facultatifs les remplacent, sans
 * toucher au code, pour passer par un intermédiaire ou faire un essai :
 *
 *   ANTHROPIC_BASE_URL   https://exemple.com   (sans /v1 : le SDK l'ajoute)
 *   GEMINI_BASE_URL      https://exemple.com   (sans /v1beta ; le dessin)
 *
 * Une adresse collée avec /v1, /v1beta ou /v1/messages est ramenée à sa base.
 * Seul https est accepté : une photo ne part jamais en clair.
 *
 * Passer par un intermédiaire, c'est lui confier les photos et les questions
 * des personnes : à inscrire au registre (`docs/rgpd/`) avant de l'activer.
 *
 * La découpe des pièces et les vecteurs de Kodi peuvent rester chez Google
 * quand le dessin passe par un intermédiaire : c'est le rôle de
 * `GOOGLE_API_KEY` (voir `accesGoogle`).
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

/** L'adresse d'un appel à un modèle Gemini (`generateContent` et la base du dessin par défaut). */
export const geminiUrl = (modele: string, methode = 'generateContent', base: string = geminiBase()): string =>
  `${base}/v1beta/models/${modele}:${methode}`;

/** Une clé telle que collée, sans les espaces ni guillemets qu'un copier-coller ajoute souvent. */
export const lireCle = (nom: string): string | undefined =>
  Deno.env.get(nom)?.trim().replace(/^["']+|["']+$/g, '').trim() || undefined;

/**
 * La clé et l'adresse des appels Gemini qui ne sont pas le dessin : la découpe
 * des pièces et les vecteurs de Kodi. Avec `GOOGLE_API_KEY`, ils vont chez
 * Google directement (essais du 04/11 : un intermédiaire n'est pas fiable pour
 * la découpe et n'offre pas les vecteurs). Sans elle, ils suivent le dessin :
 * même clé, même adresse, pour qu'une clé ne parte jamais chez un autre
 * fournisseur que le sien.
 */
export function accesGoogle(): { nomCle: 'GOOGLE_API_KEY' | 'GEMINI_API_KEY'; cle: string | undefined; base: string } {
  const directe = lireCle('GOOGLE_API_KEY');
  return directe
    ? { nomCle: 'GOOGLE_API_KEY', cle: directe, base: GEMINI_OFFICIEL }
    : { nomCle: 'GEMINI_API_KEY', cle: lireCle('GEMINI_API_KEY'), base: geminiBase() };
}

export const anthropicViaIntermediaire = (): boolean => anthropicBase() !== ANTHROPIC_OFFICIEL;
export const geminiViaIntermediaire = (): boolean => geminiBase() !== GEMINI_OFFICIEL;
