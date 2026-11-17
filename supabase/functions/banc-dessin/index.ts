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
 * Paramètres : { photo, modele?, variantes?: [{ nom, prompt }], segmentation?: { label, modeles: ['modele:niveau'] } }.
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

/** Un essai de découpe : même consigne que l'agent (steps.ts, `segment`), un modèle et un niveau de réflexion. */
async function segmenter(spec: string, photo: { bytes: Uint8Array; mime: string }, label: string, id: string) {
  const [modele, niveau] = spec.split(':');
  const t = Date.now();
  try {
    const key = lire('GEMINI_API_KEY');
    if (!key) throw new Error('GEMINI_API_KEY absente');
    const texte = `Give the segmentation mask of ONE single item in this photo: "${label}". Include the whole visible item. Leave out the person (skin, hair, face, hands), the background, every other item even where it touches or overlaps this one, and cast shadows. Output a JSON list with exactly one entry: the 2D bounding box in "box_2d" as [y0, x0, y1, x1] normalised to 0-1000, the segmentation mask in "mask", and the text label in "label".`;
    const res = await fetch(`${baseGemini()}/v1beta/models/${modele}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: photo.mime, data: b64(photo.bytes) } }, { text: texte }] }],
        generationConfig: { responseMimeType: 'application/json', ...(niveau ? { thinkingConfig: { thinkingLevel: niveau } } : {}) },
      }),
    });
    if (!res.ok) return { modele: spec, ok: false, http: res.status, ms: Date.now() - t, erreur: (await res.text()).replace(/\s+/g, ' ').slice(0, 200) };
    const body = await res.json();
    const reponse = ((body?.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[]).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
    const debut = reponse.indexOf('['), fin = reponse.lastIndexOf(']');
    let liste: Record<string, unknown>[] = [];
    try { liste = debut >= 0 ? JSON.parse(reponse.slice(debut, fin + 1)) : []; } catch { /* illisible */ }
    const masques = liste.filter((e) => typeof e.mask === 'string' && (e.mask as string).length > 100);
    let url: string | null = null;
    if (masques[0]) {
      const png = Uint8Array.from(atob((masques[0].mask as string).replace(/^data:image\/\w+;base64,/, '').trim()), (c) => c.charCodeAt(0));
      const chemin = `sorties/${id}/masque-${modele}.png`;
      const up = await db.storage.from('banc').upload(chemin, png, { contentType: 'image/png', upsert: true });
      url = up.error ? null : (await db.storage.from('banc').createSignedUrl(chemin, 86_400)).data?.signedUrl ?? null;
    }
    return { modele: spec, ok: masques.length > 0, http: 200, ms: Date.now() - t, segments: liste.length, masques: masques.length, box: liste[0]?.box_2d ?? null, jetons: body?.usageMetadata?.totalTokenCount ?? null, url };
  } catch (e) {
    return { modele: spec, ok: false, ms: Date.now() - t, erreur: e instanceof Error ? e.message : String(e) };
  }
}

/** Claude voit-il la photo ? Plusieurs façons de la lui envoyer, par l'adresse et la clé de l'intermédiaire (jamais montrées). */
async function claudeVoit(format: string, modele: string, photo: { bytes: Uint8Array; mime: string }, nom: string) {
  const t = Date.now();
  const cle = (s: string) => s.replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').replace(/\s+/g, ' ');
  try {
    const key = lire('ANTHROPIC_API_KEY');
    const base = (lire('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com').replace(/\/+$/, '').replace(/\/v1(\/.*)?$/, '');
    if (!key) throw new Error('ANTHROPIC_API_KEY absente');
    const question = 'List every clothing item you can see in this photo, in one short line. If you cannot see any photo, say exactly: NO PHOTO.';
    const signee = (await db.storage.from('banc').createSignedUrl(`fichiers/${nom}`, 600)).data?.signedUrl ?? '';
    const dataUri = `data:${photo.mime};base64,${b64(photo.bytes)}`;
    let url = `${base}/v1/messages`;
    let headers: Record<string, string> = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    let corps: Record<string, unknown>;
    if (format === 'anthropic-url') {
      corps = { model: modele, max_tokens: 200, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: signee } }, { type: 'text', text: question }] }] };
    } else if (format === 'anthropic-bearer') {
      headers = { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'anthropic-version': '2023-06-01' };
      corps = { model: modele, max_tokens: 200, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: photo.mime, data: b64(photo.bytes) } }, { type: 'text', text: question }] }] };
    } else if (format === 'openai-chat' || format === 'openai-chat-url') {
      url = `${base}/v1/chat/completions`;
      headers = { 'content-type': 'application/json', authorization: `Bearer ${key}` };
      corps = { model: modele, max_tokens: 200, messages: [{ role: 'user', content: [{ type: 'text', text: question }, { type: 'image_url', image_url: { url: format === 'openai-chat' ? dataUri : signee } }] }] };
    } else throw new Error(`format inconnu : ${format}`);
    const res = await fetch(url, { method: 'POST', headers, signal: AbortSignal.timeout(60_000), body: JSON.stringify(corps) });
    const texte = await res.text();
    if (!res.ok) return { format, ok: false, http: res.status, ms: Date.now() - t, erreur: cle(texte).slice(0, 220) };
    const body = JSON.parse(texte);
    const reponse = body?.choices?.[0]?.message?.content ?? (body?.content ?? []).map((b: { text?: string }) => b.text ?? '').join('');
    const lus = body?.usage?.input_tokens ?? body?.usage?.prompt_tokens ?? null;
    return { format, ok: !/NO PHOTO/i.test(String(reponse)) && Number(lus ?? 0) < 8000, http: res.status, ms: Date.now() - t, jetons_lus: lus, reponse: cle(String(reponse)).slice(0, 240) };
  } catch (e) {
    return { format, ok: false, ms: Date.now() - t, erreur: cle(e instanceof Error ? e.message : String(e)).slice(0, 220) };
  }
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
  if (!data || data.mode !== 'sonde' || !(Array.isArray((data.params as { variantes?: unknown })?.variantes) || (data.params as { segmentation?: unknown })?.segmentation || (data.params as { claude_vue?: unknown })?.claude_vue) || data.status !== 'queued' || Date.now() - Date.parse(data.created_at) > 86_400_000 || (await sha256(jeton)) !== data.jeton_sha256) return refus();
  const { data: pris } = await db.from('banc_ia').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', id).eq('status', 'queued').select('id');
  if (!pris?.length) return refus();

  const p = data.params as { photo?: string; modele?: string; variantes?: { nom: string; prompt: string }[]; segmentation?: { label: string; modeles: string[] }; claude_vue?: { modele: string; formats: string[] } };
  EdgeRuntime.waitUntil((async () => {
    try {
      if (!p.photo || !NOM.test(p.photo)) throw new Error('photo refusée');
      const dl = await db.storage.from('banc').download(`fichiers/${p.photo}`);
      if (dl.error || !dl.data) throw new Error(`image de test introuvable : ${p.photo}`);
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const photo = { bytes, mime: mime(bytes) };
      const modele = p.modele ?? 'gemini-nano-banana-2.1';
      const decoupes = p.segmentation ? await Promise.all(p.segmentation.modeles.slice(0, 8).map((m) => segmenter(m, photo, p.segmentation!.label, id))) : [];
      const vues = p.claude_vue ? await Promise.all(p.claude_vue.formats.slice(0, 5).map((f) => claudeVoit(f, p.claude_vue!.modele, photo, p.photo!))) : [];
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
      await db.from('banc_ia').update({ status: 'done', finished_at: new Date().toISOString(), result: { photo: p.photo, modele, lignes, decoupes, vues }, cost_usd: cout }).eq('id', id);
    } catch (e) {
      await db.from('banc_ia').update({ status: 'failed', finished_at: new Date().toISOString(), error: String(e instanceof Error ? e.message : e).slice(0, 2000) }).eq('id', id);
    }
  })());
  return Response.json({ accepted: true }, { status: 202 });
});
