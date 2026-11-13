/**
 * Le banc d'essai de l'IA (13/11) : sondes du fournisseur, essais de
 * découpe, scénarios de Kodi. Il réutilise le vrai code de l'agent photo et
 * de Kodi, côté serveur, avec les clés des secrets : aucune clé ne sort.
 *
 * Un essai est une ligne de `banc_ia` (table fermée au client), écrite par
 * l'éditeur avec l'empreinte sha256 d'un jeton à usage unique. L'appel
 *
 *   POST { id, jeton, fichiers?: [{ nom, b64 }] }
 *
 * ne lance que cette ligne, une fois, si le jeton correspond : sans accès à la
 * base, on ne peut rien lancer ni rien lire. Les fichiers (images de test,
 * jamais une photo d'utilisateur) vont dans le bucket privé `banc`. Le
 * résultat est écrit dans la ligne ; les images produites y sont données par
 * des liens signés valables un jour.
 *
 * Déployée SANS vérification JWT (le jeton tient lieu de clé).
 */
import { createClient } from '@supabase/supabase-js';
import { envKey } from '../_shared/env.ts';
import { sondes } from './sondes.ts';
import { essaiDecoupe } from './decoupe.ts';
import { essaiKodi, essaiJuge } from './kodi.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const db = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Ligne = { id: string; mode: string; libelle: string; params: Record<string, unknown>; jeton_sha256: string; status: string; created_at: string };

/** Ce qu'un essai rend : son résultat et son coût estimé (tarifs publics). */
export type Rendu = { result: unknown; cost: number };

export type Banc = {
  db: typeof db;
  /** Une image de test du bucket `banc`. */
  lire(nom: string): Promise<{ bytes: Uint8Array; mime: string }>;
  /** Range une image produite et rend un lien signé (un jour). */
  ranger(chemin: string, bytes: Uint8Array, mime: string): Promise<string | null>;
  log(m: string): void;
};

async function sha256(texte: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

const NOM = /^[a-z0-9][a-z0-9._-]{0,90}$/i;

function banc(ligne: Ligne): Banc {
  return {
    db,
    async lire(nom) {
      if (!NOM.test(nom)) throw new Error(`nom de fichier refusé : ${nom}`);
      const { data, error } = await db.storage.from('banc').download(`fichiers/${nom}`);
      if (error || !data) throw new Error(`image de test introuvable : ${nom}`);
      const bytes = new Uint8Array(await data.arrayBuffer());
      const mime = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : data.type;
      return { bytes, mime };
    },
    async ranger(chemin, bytes, mime) {
      const path = `sorties/${ligne.id}/${chemin}`;
      const up = await db.storage.from('banc').upload(path, bytes, { contentType: mime, upsert: true });
      if (up.error) return null;
      const { data } = await db.storage.from('banc').createSignedUrl(path, 86_400);
      return data?.signedUrl ?? null;
    },
    log: (m) => console.log(`[banc ${ligne.id.slice(0, 8)}] ${m}`),
  };
}

async function executer(ligne: Ligne) {
  const b = banc(ligne);
  const t0 = Date.now();
  try {
    let r: Rendu;
    if (ligne.mode === 'sonde') r = await sondes(b, ligne.params);
    else if (ligne.mode === 'decoupe') r = await essaiDecoupe(b, ligne.params);
    else if (ligne.mode === 'kodi') r = await essaiKodi(b, ligne.params);
    else if (ligne.mode === 'juge') r = await essaiJuge(b, ligne.params);
    else throw new Error(`mode inconnu : ${ligne.mode}`);
    await db.from('banc_ia').update({
      status: 'done', finished_at: new Date().toISOString(), result: r.result, cost_usd: Math.round(r.cost * 1e5) / 1e5,
    }).eq('id', ligne.id);
    b.log(`terminé en ${Date.now() - t0} ms, environ ${r.cost.toFixed(4)} $`);
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    b.log(`échec : ${message}`);
    await db.from('banc_ia').update({ status: 'failed', finished_at: new Date().toISOString(), error: message.slice(0, 2000) }).eq('id', ligne.id);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });
  const input = await req.json().catch(() => ({})) as { id?: unknown; jeton?: unknown; fichiers?: unknown };
  const id = String(input.id ?? '');
  const jeton = String(input.jeton ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id) || jeton.length < 32) return Response.json({ error: 'refusé' }, { status: 403 });

  const { data } = await db.from('banc_ia').select('id, mode, libelle, params, jeton_sha256, status, created_at').eq('id', id).maybeSingle();
  const ligne = data as Ligne | null;
  // Même réponse dans tous les cas de refus : rien ne se devine de l'extérieur.
  if (!ligne || ligne.status !== 'queued' || Date.now() - Date.parse(ligne.created_at) > 86_400_000 || (await sha256(jeton)) !== ligne.jeton_sha256) {
    return Response.json({ error: 'refusé' }, { status: 403 });
  }

  // Prise de la ligne : un seul appel la lance.
  const { data: pris } = await db.from('banc_ia').update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'queued').select('id');
  if (!pris?.length) return Response.json({ error: 'refusé' }, { status: 403 });

  const fichiers = Array.isArray(input.fichiers) ? input.fichiers as { nom?: unknown; b64?: unknown }[] : [];
  for (const f of fichiers.slice(0, 40)) {
    const nom = String(f.nom ?? '');
    if (!NOM.test(nom) || typeof f.b64 !== 'string') continue;
    const bytes = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
    const mime = bytes[0] === 0x89 ? 'image/png' : 'image/jpeg';
    await db.storage.from('banc').upload(`fichiers/${nom}`, bytes, { contentType: mime, upsert: true });
  }

  EdgeRuntime.waitUntil(executer(ligne));
  return Response.json({ accepted: true }, { status: 202 });
});
