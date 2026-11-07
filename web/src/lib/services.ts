/**
 * L'état des services de Kodi (07/11), pour le seul compte créateur : le
 * diagnostic de l'agent photo (`dressy-agent?verifier`) dit si les clés
 * d'IA sont acceptées. Le 07/11, les deux clés étaient refusées depuis des
 * jours (Kodi muet, aucune pièce dessinée) sans que rien ne le signale.
 * Seuls des noms de secrets sortent d'ici, jamais une valeur.
 */
type Sonde = { cle?: 'valide' | 'refusée' | 'absente' | 'inconnue'; modele?: string; modele_trouve?: boolean | null };
type Verif = { pret?: boolean; decoupe?: Sonde; decoupeFort?: Sonde; dessin?: Sonde; reperage?: Sonde };

const SECRET: Record<string, string> = { decoupe: 'GEMINI_API_KEY', decoupeFort: 'GEMINI_API_KEY', dessin: 'GEMINI_API_KEY', reperage: 'ANTHROPIC_API_KEY' };

export type EtatServices = { pret: boolean; problemes: string[] };

export async function etatDesServices(): Promise<EtatServices | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dressy-agent?verifier`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 600 },
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
