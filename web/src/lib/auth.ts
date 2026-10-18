import { headers } from 'next/headers';

export type Provider = 'google' | 'apple';

/**
 * L'adresse du site telle que le navigateur la voit : c'est là que les liens
 * des e-mails (confirmation, mot de passe) et les retours Google / Apple
 * doivent revenir. Elle doit figurer dans Supabase > Authentication > URL
 * Configuration > Redirect URLs, sinon Supabase renvoie vers la Site URL.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get('origin');
  if (origin) return origin;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Retour après un lien ou une connexion externe : jamais vers un autre site. */
export function safeNext(next: string | null | undefined, fallback = '/demarrage'): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

/**
 * Les fournisseurs activés dans Supabase > Authentication > Providers. Lu sur
 * la route publique /auth/v1/settings (clé publique seulement), gardé cinq
 * minutes : activer Google dans le tableau de bord suffit, sans redéployer.
 */
export async function enabledProviders(): Promise<Record<Provider, boolean>> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 300 },
    });
    const body = (await res.json()) as { external?: Record<string, boolean> };
    return { google: Boolean(body.external?.google), apple: Boolean(body.external?.apple) };
  } catch {
    return { google: false, apple: false };
  }
}
