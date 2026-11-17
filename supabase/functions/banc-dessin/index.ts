/**
 * Banc de consignes pour le dessin (17/11) : plusieurs consignes, une même
 * photo de test, le même générateur que l'agent photo (Nano Banana, mêmes
 * clés et même adresse). Fonction autonome, temporaire, à retirer une fois
 * l'essai fini : elle ne touche ni `dressy-agent` ni `kode`.
 *
 *   POST { banc: { id, jeton } }
 *
 * Une ligne de `banc_ia` (mode `sonde`, avec `variantes` dans ses paramètres) porte l'empreinte sha256 d'un jeton
 * à usage unique, comme pour les autres bancs (voir _shared/banc.ts).
 * Paramètres : { photo, modele?, variantes: [{ nom, prompt }] }.
 * Jamais une photo d'utilisateur : seulement des images de test du bucket
 * privé `banc`. Déployée SANS vérification JWT : le jeton tient lieu de clé.
 */
import { createClient } from '@supabase/supabase-js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const lire = (nom: string) => Deno.env.get(nom)?.trim().replace(/^["']+|["']+$/g, '').trim() || undefined;
const envKey = (single: string, bundle: string): string => {
  const one = Deno.env.get(single);
  if (one) return one;
  const many = Deno.env.get(bundle);
  if (many) {
    const parsed = JSON.parse(many) as Record<string, string>;
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error(`${single} introuvable`);
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NOM = /^[a-z0-9][a-z0-9._-]{0,90}$/i;
const COUT_IMAGE = 0.034;

function baseGemini(): string {
  const v = lire('GEMINI_BASE_URL')?.replace(/\/+$/, '').replace(/\/v1(beta)?(\/.*)?$/, '').replace(/\/+$/, '');
  return v && /^https:\/\//.test(v) ? v : 'https://generativelanguage.googleapis.com';
}

async function sha256(texte: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

const mime = (b: Uint8Array) => (b[0] === 0x89 ? 'image/png' : b[0] === 0xff ? 'image/jpeg' : b[8] === 0x57 ? 'image/webp' : 'image/jpeg');
const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Un dessin : la consigne d'abord, la photo ensuite, comme l'agent (`generate`, steps.ts). */
async function dessiner(prompt: string, photo: { bytes: Uint8Array; mime: string }, modele: string) {
  const key = lire('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY absente');
  const url = `${baseGemini()}/v1beta/models/${modele}:generateContent`;
  const parts = [{ text: prompt }, { inline_data: { mime_type: photo.mime, data: b64(photo.bytes) } }];
  const taille = { aspectRatio: '1:1', imageSize: '1K' };
  const appel = (legacy: boolean) => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(110_000),
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], ...(legacy ? { imageConfig: taille } : { responseFormat: { image: taille } }) },
    }),
  });
  let res = await appel(false);
  if (res.status === 400) res = await appel(true);
  if (!res.ok) throw new Error(`Gemini ${res.status} : ${(await res.text()).replace(/\s+/g, ' ').slice(0, 300)}`);
  const body = await res.json();
  const c = body?.candidates?.[0];
  type Part = { thought?: boolean; inlineData?: { data: string } };
  const last = ((c?.content?.parts ?? []) as Part[]).filter((p) => p.inlineData && !p.thought).at(-1);
  if (!last?.inlineData) throw new Error(`aucune image (${body?.promptFeedback?.blockReason ?? c?.finishReason ?? 'texte seul'})`);
  return { bytes: Uint8Array.from(atob(last.inlineData.data), (x) => x.charCodeAt(0)), usage: body.usageMetadata ?? null };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });
  const input = (await req.json().catch(() => null) as { banc?: { id?: unknown; jeton?: unknown } } | null)?.banc;
  const refus = () => Response.json({ error: 'refusé' }, { status: 403 });
  const id = String(input?.id ?? '');
  const jeton = String(input?.jeton ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id) || jeton.length < 32) return refus();

  const { data } = await db.from('banc_ia').select('id, mode, params, jeton_sha256, status, created_at').eq('id', id).maybeSingle();
  // La table n'accepte que ses modes d'origine : l'essai porte le mode `sonde`, ses paramètres disent le reste.
  if (!data || data.mode !== 'sonde' || !Array.isArray((data.params as { variantes?: unknown })?.variantes) || data.status !== 'queued' || Date.now() - Date.parse(data.created_at) > 86_400_000 || (await sha256(jeton)) !== data.jeton_sha256) return refus();
  const { data: pris } = await db.from('banc_ia').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', id).eq('status', 'queued').select('id');
  if (!pris?.length) return refus();

  const p = data.params as { photo?: string; modele?: string; variantes?: { nom: string; prompt: string }[] };
  EdgeRuntime.waitUntil((async () => {
    try {
      if (!p.photo || !NOM.test(p.photo)) throw new Error('photo refusée');
      const dl = await db.storage.from('banc').download(`fichiers/${p.photo}`);
      if (dl.error || !dl.data) throw new Error(`image de test introuvable : ${p.photo}`);
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const photo = { bytes, mime: mime(bytes) };
      const modele = p.modele ?? 'gemini-nano-banana-2.1';
      const lignes = await Promise.all((p.variantes ?? []).slice(0, 4).map(async (v) => {
        const t = Date.now();
        try {
          if (!NOM.test(v.nom)) throw new Error('nom refusé');
          const r = await dessiner(v.prompt, photo, modele);
          const ext = mime(r.bytes) === 'image/png' ? 'png' : 'jpg';
          const chemin = `sorties/${id}/${v.nom}.${ext}`;
          const up = await db.storage.from('banc').upload(chemin, r.bytes, { contentType: mime(r.bytes), upsert: true });
          const url = up.error ? null : (await db.storage.from('banc').createSignedUrl(chemin, 86_400)).data?.signedUrl ?? null;
          return { nom: v.nom, ok: true, ms: Date.now() - t, ko: Math.round(r.bytes.length / 1024), url };
        } catch (e) {
          return { nom: v.nom, ok: false, ms: Date.now() - t, erreur: e instanceof Error ? e.message : String(e) };
        }
      }));
      const cout = lignes.filter((l) => l.ok).length * COUT_IMAGE;
      await db.from('banc_ia').update({ status: 'done', finished_at: new Date().toISOString(), result: { photo: p.photo, modele, lignes }, cost_usd: cout }).eq('id', id);
    } catch (e) {
      await db.from('banc_ia').update({ status: 'failed', finished_at: new Date().toISOString(), error: String(e instanceof Error ? e.message : e).slice(0, 2000) }).eq('id', id);
    }
  })());
  return Response.json({ accepted: true }, { status: 202 });
});
