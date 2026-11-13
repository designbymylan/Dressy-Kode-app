/**
 * Le dépôt de déploiement (13/11). Sans la CLI Supabase, le déploiement passe
 * par un outil qui exige le contenu de chaque fichier dans un seul envoi :
 * au-delà de quelques dizaines de kilo-octets, c'est fragile. Cette fonction
 * pose donc le code d'un commit, lu tel quel dans git, dans le bucket public
 * `depot`, sous un préfixe imprévisible ; la fonction déployée n'est plus
 * qu'un point d'entrée qui l'importe, et Supabase assemble le tout. Le code
 * est retiré du bucket aussitôt après.
 *
 *   POST { banc: { id, jeton, fichiers: [{ chemin, b64 }] } }  (mode `depot`)
 *     params : { prefixe, action: 'poser' | 'retirer' }
 *
 * Même garde que le banc d'essai (_shared/banc.ts) : seule une ligne de
 * `banc_ia` écrite par l'éditeur, avec l'empreinte du jeton, autorise
 * l'appel, une fois. Déployée SANS vérification JWT.
 */
import { createClient } from '@supabase/supabase-js';
import { envKey } from '../_shared/env.ts';
import { prendreLigne, clore } from '../_shared/banc.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PREFIXE = /^[a-z0-9-]{20,80}$/;
const CHEMIN = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_.-]+)*\.(ts|json)$/;
const TYPE: Record<string, string> = { ts: 'application/typescript; charset=utf-8', json: 'application/json; charset=utf-8' };

async function tout(prefixe: string, dossier = ''): Promise<string[]> {
  const { data } = await db.storage.from('depot').list(`${prefixe}${dossier}`, { limit: 1000 });
  const out: string[] = [];
  for (const o of data ?? []) {
    const chemin = `${dossier}/${o.name}`;
    // Un dossier n'a pas d'identifiant dans la liste du stockage.
    if (o.id) out.push(`${prefixe}${chemin}`);
    else out.push(...await tout(prefixe, chemin));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });
  const input = await req.json().catch(() => null) as { banc?: { id?: unknown; jeton?: unknown; fichiers?: unknown } } | null;
  const ligne = input?.banc ? await prendreLigne(db, input.banc, ['depot']) : null;
  if (!ligne) return Response.json({ error: 'refusé' }, { status: 403 });

  const prefixe = String(ligne.params.prefixe ?? '');
  try {
    if (!PREFIXE.test(prefixe)) throw new Error('préfixe refusé');
    if (ligne.params.action === 'retirer') {
      const objets = await tout(prefixe);
      if (objets.length) {
        const { error } = await db.storage.from('depot').remove(objets);
        if (error) throw new Error(error.message);
      }
      await clore(db, ligne.id, { result: { retires: objets.length } });
      return Response.json({ retires: objets.length });
    }

    const fichiers = Array.isArray(input!.banc!.fichiers) ? input!.banc!.fichiers as { chemin?: unknown; b64?: unknown }[] : [];
    const poses: string[] = [];
    for (const f of fichiers.slice(0, 200)) {
      const chemin = String(f.chemin ?? '');
      if (!CHEMIN.test(chemin) || chemin.includes('..') || typeof f.b64 !== 'string') throw new Error(`fichier refusé : ${chemin}`);
      const bytes = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
      const { error } = await db.storage.from('depot').upload(`${prefixe}/${chemin}`, bytes, { contentType: TYPE[chemin.split('.').pop()!], upsert: true });
      if (error) throw new Error(`${chemin} : ${error.message}`);
      poses.push(chemin);
    }
    await clore(db, ligne.id, { result: { poses } });
    return Response.json({ poses: poses.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await clore(db, ligne.id, { error: message });
    return Response.json({ error: message }, { status: 400 });
  }
});
