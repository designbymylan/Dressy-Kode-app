/**
 * Le cache partagé des données. Une ligne par clé (« meteo:45.76,4.84 »),
 * avec la valeur, la source, sa date et la date d'expiration. La même
 * ligne sert à tout le monde : la météo de Lyon n'est demandée qu'une fois
 * par heure, quel que soit le nombre de personnes qui ouvrent l'app.
 *
 * En base : table public.data_cache, RLS active sans aucune politique,
 * lisible et modifiable uniquement par la clé service (Edge Functions).
 */

export type Entree = {
  valeur: unknown;
  source: string;
  mention: string;
  /** Quand la valeur a été récupérée. */
  maj: string;
  /** Au-delà, on redemande aux sources. */
  expire: string;
  /** Les sources ont échoué : on ne les réinterroge pas avant cette heure. */
  reessai: string | null;
};

export type Cache = {
  lire(cle: string): Promise<Entree | null>;
  ecrire(cle: string, e: Entree): Promise<void>;
};

/** Le cache en mémoire : pour les tests, ou en secours si la base ne répond pas. */
export function cacheMemoire(): Cache & { lignes: Map<string, Entree> } {
  const lignes = new Map<string, Entree>();
  return {
    lignes,
    lire: async (cle) => lignes.get(cle) ?? null,
    ecrire: async (cle, e) => void lignes.set(cle, e),
  };
}

/** Le strict nécessaire d'un client supabase-js, pour ne pas en dépendre ici. */
type Requete = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Db = {
  from(table: string): {
    select(cols: string): { eq(col: string, val: string): { maybeSingle(): Requete } };
    upsert(row: Record<string, unknown>): Requete;
  };
};

/** Le cache en base, avec le client « service » de l'Edge Function. */
export function cachePostgres(admin: Db): Cache {
  return {
    async lire(cle) {
      const { data, error } = await admin.from('data_cache').select('valeur, source, mention, maj, expire, reessai').eq('cle', cle).maybeSingle();
      if (error) throw new Error(`cache illisible : ${error.message}`);
      return (data as Entree | null) ?? null;
    },
    async ecrire(cle, e) {
      const { error } = await admin.from('data_cache').upsert({ cle, ...e });
      if (error) throw new Error(`cache non écrit : ${error.message}`);
    },
  };
}
