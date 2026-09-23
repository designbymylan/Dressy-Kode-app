import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Client Supabase côté serveur, lié aux cookies de la requête.
 * À créer par requête — ne jamais le mettre en variable de module, sinon
 * une session fuirait d'un visiteur à l'autre.
 */
export async function createClient() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) store.set(name, value, options);
          } catch {
            // Appelé depuis un Server Component : le rafraîchissement de session
            // est alors assuré par le middleware, on peut ignorer.
          }
        },
      },
    },
  );
}
