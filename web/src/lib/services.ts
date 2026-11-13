/**
 * L'état des services de Kodi (07/11), pour le seul compte créateur : le
 * diagnostic de l'agent photo (`dressy-agent?verifier`) dit si les clés
 * d'IA sont acceptées. Le 07/11, les deux clés étaient refusées depuis des
 * jours (Kodi muet, aucune pièce dessinée) sans que rien ne le signale.
 * Seuls des noms de secrets sortent d'ici, jamais une valeur.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type Sonde = { cle?: 'valide' | 'refusée' | 'absente' | 'inconnue'; modele?: string; modele_trouve?: boolean | null };
type Verif = { pret?: boolean; decoupe?: Sonde; decoupeFort?: Sonde; dessin?: Sonde; reperage?: Sonde };

const SECRET: Record<string, string> = { decoupe: 'GEMINI_API_KEY', decoupeFort: 'GEMINI_API_KEY', dessin: 'GEMINI_API_KEY', reperage: 'ANTHROPIC_API_KEY' };

export type EtatServices = { pret: boolean; problemes: string[] };

export async function etatDesServices(supabase: SupabaseClient): Promise<EtatServices | null> {
  try {
    // Réservé au compte créateur depuis le 13/11 : la fonction revalide ce
    // jeton (getUser) et vérifie la table `admins`.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dressy-agent?verifier`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const v = (await res.json()) as Verif;
    const problemes = new Set<string>();
    for (const [etape, secret] of Object.entries(SECRET)) {
      const s = v[etape as keyof Verif] as Sonde | undefined;
      if (!s) continue;
      if (s.cle === 'refusée') problemes.add(`${secret} est refusée`);
      else if (s.cle === 'absente') problemes.add(`${secret} manque`);
      else if (s.cle === 'valide' && s.modele_trouve === false) problemes.add(`le modèle ${s.modele} n’est pas disponible avec ${secret}`);
    }
    return { pret: Boolean(v.pret), problemes: [...problemes] };
  } catch {
    return null;
  }
}
