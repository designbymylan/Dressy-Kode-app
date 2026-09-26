/**
 * Les clés que Supabase injecte dans chaque Edge Function. Selon l'âge du
 * projet, elles arrivent seules (SUPABASE_ANON_KEY…) ou en paquet JSON
 * (SUPABASE_PUBLISHABLE_KEYS…) : on accepte les deux.
 */
export function envKey(single: string, bundle: string): string {
  const one = Deno.env.get(single);
  if (one) return one;
  const many = Deno.env.get(bundle);
  if (many) {
    const parsed = JSON.parse(many) as Record<string, string>;
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error(`Clé ${single} introuvable dans l’environnement de la fonction.`);
}

/** Un secret tel que collé, sans les espaces ni guillemets qu'un copier-coller ajoute souvent. */
export function secret(name: string): string | undefined {
  return Deno.env.get(name)?.trim().replace(/^["']+|["']+$/g, '').trim() || undefined;
}

/** L'adresse publique de l'application, pour les retours depuis Stripe. */
export function appUrl(): string {
  return (secret('APP_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
}
