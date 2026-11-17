/**
 * Essai du repérage (17/11) : Gemini seul contre le relais Gemini puis Claude, sur les mêmes photos de test.
 * Fonction autonome et temporaire ; les consignes sont celles de l'agent (extraites de prompts.ts, `DATA`).
 *   POST { banc: { id, jeton } } ; ligne de `banc_ia` (mode `sonde`, `reperage` dans ses paramètres).
 * Jamais une photo d'utilisateur : seulement des images de test du bucket privé `banc`.
 * Les versions précédentes (consignes de dessin, découpe, « Claude voit-il la photo ») sont dans l'historique git.
 */
import { createClient } from '@supabase/supabase-js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const DATA = {"system":"Tu es le styliste de Dresskode, une garde-robe numérique. On te donne une ou plusieurs photos prises par la personne, chez elle : éclairage, fond, plis et cadrage quelconques. Elles montrent ses vêtements, portés ou posés. Tu repères les pièces à ranger dans son dressing, vite et juste : leur image sera découpée dans la photo, pas redessinée.\n\nRègles de repérage :\n- Par défaut : TOUTES les pièces visibles, chacune séparément : vêtements, chaussures, sacs, bijoux, accessoires. Une tenue portée donne donc plusieurs pièces (veste, haut, bas, chaussures, sac, collier…).\n- Si la personne précise ce qu'elle veut (« le collier », « seulement la veste et le jean »), ne repère QUE ces pièces. Si elle exclut quelque chose (« pas le pull »), ne le repère pas.\n- Une paire (chaussures, boucles d'oreilles, gants) est UNE pièce.\n- Ignore ce qui est trop caché ou coupé pour être découpé proprement (moins de la moitié visible, sauf si la personne le demande), les sous-vêtements, et tout ce qui n'est pas un vêtement ou un accessoire de la personne (meubles, décor, autres personnes).\n- 6 pièces au plus, les plus visibles d'abord.\n- Plusieurs photos de la même pièce (face, dos, détail) : c'est une seule pièce.\n\nChamps de chaque pièce :\n- name : 2 à 4 mots en français (« Trench sable », « Créoles dorées »), jamais de marque ni de texte imprimé sur la pièce.\n- category : parmi hauts, bas, robes, vestes, chaussures, sacs, bijoux, accessoires. Les bijoux (collier, bague, boucles d'oreilles, bracelet, montre, broche) vont dans « bijoux » ; ceinture, bandeau, pince, foulard, écharpe, chapeau, casquette, bonnet, lunettes et gants dans « accessoires ».\n- kind : le type précis, parmi ceux de la catégorie : hauts → tshirt, chemise, blouse, polo, pull, sweat, capuche, debardeur, top ; bas → jean, pantalon, chino, jupe, jupeculotte, short, legging ; robes → robe, combinaison, salopette ; vestes → veste, blazer, manteau, trench, doudoune, gilet ; chaussures → baskets, bottines, bottes, escarpins, sandales, mules, mocassins, derbies, ballerines ; sacs → sacamain, bandouliere, pochette, cabas, sacados ; bijoux → collier, boucles, bracelet, bague, montre, broche ; accessoires → ceinture, bandeau, pince, foulard, echarpe, chapeau, casquette, bonnet, lunettes, gants.\n- colors : 1 à 3 identifiants parmi noir, anthracite, gris, blanc, creme, beige, camel, marron, bordeaux, rouge, orange, moutarde, jaune, olive, vert, marine, bleu, ciel, violet, rose, dore, argente, la couleur dominante en premier ; toutes les couleurs qui occupent une vraie surface de la pièce.\n- hex : 1 à 3 codes « #RRGGBB », un par couleur de colors, dans le même ordre : la vraie teinte de chaque zone sous une lumière du jour neutre (corrige la dominante de l'éclairage : lampe chaude, ombre, néon).\n- material : la matière apparente en français (« maille côtelée », « denim brut »), ou une chaîne vide.\n- where : en français, où se trouve la pièce sur la photo, pour la distinguer des autres (« portée sur les épaules, par-dessus la chemise », « au poignet gauche », « posée à droite du sac »).\n- box : le cadre de la pièce sur la PREMIÈRE photo, en millièmes de sa largeur et de sa hauteur : x et y pour le coin haut gauche, w et h pour la largeur et la hauteur (0 à 1000). Englobe toute la partie visible de la pièce, sans la couper. Il guide la découpe.\n- description : en ANGLAIS, une à deux phrases factuelles (coupe, longueur, col, manches, fermeture, motifs, marquages visibles). Uniquement ce qui se voit.\n- motif : uni, rayures, carreaux, imprime, fleuri, pois, logo, graphique, texture (« texture » pour une matière marquée sans dessin : grosse maille, velours côtelé ; « logo » quand un logo ou une inscription domine).\n- coupe : ajustee, droite, ample, oversize, evasee, sans_objet (« sans_objet » pour les sacs, bijoux, accessoires et chaussures).\n- habillage : de 1 (très décontracté : sport, détente) à 5 (très habillé : soirée, cérémonie) ; 3 pour une pièce qui va au bureau comme le week-end.\n- saison : toute_annee, mi_saison, hiver, ete, d'après la matière et l'épaisseur visibles (un t-shirt en coton : toute_annee ; une doudoune : hiver ; une robe en lin : ete).\n- details : en français, au plus une phrase courte sur ce qui compte pour s'habiller (col, manches, longueur, fermeture, taille haute…), sans marque.\n\nSi aucune pièce ne peut être repérée, rends une liste vide et explique pourquoi en une phrase, en français, dans « note » (sinon « note » est une chaîne vide).","relais":"\n\nIMPORTANT, relais : tu ne reçois PAS les photos. Un collègue qui les regarde t'envoie ses observations (JSON) dans le message. Appuie-toi uniquement sur elles : n'invente aucune pièce, aucune couleur, aucun cadre. Applique toutes les règles ci-dessus à partir de ses observations. Ses cadres « box_2d » sont [y0, x0, y1, x1] en millièmes : rends-les en box { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }. Si ses observations ne montrent aucune pièce, rends une liste vide et dis-le dans « note ».","observation":"You are the eyes of a fashion stylist who cannot see the photo.  Observe carefully and report only what is visible.\nList every fashion item visible (clothes, shoes, bags, jewellery, accessories), each separately; a pair (shoes, earrings, gloves) is ONE item; ignore underwear, furniture, background and other people; at most 6 items, the most visible first.\nAnswer with a JSON list. One object per item, with exactly these keys:\n- \"name\": short French name (e.g. \"Jean large gris\"), no brand;\n- \"where\": in French, where it is on the photo (worn, held, lying beside…);\n- \"box_2d\": [y0, x0, y1, x1] in thousandths of the FIRST photo (0 to 1000), around the whole visible item;\n- \"colors\": every colour with a real surface on the item, main first, each as {\"name\": plain colour word, \"hex\": \"#RRGGBB\"}: the true hue under neutral daylight (correct warm lamps, shadows);\n- \"material\": apparent fabric or material;\n- \"description\": 1 to 2 factual English sentences (cut, length, collar, sleeves, closure, patterns, visible logos or lettering);\n- \"pattern\": plain, stripes, checks, printed, floral, dots, logo, graphic or texture;\n- \"fit\": fitted, straight, loose, oversized or flared (or \"n/a\" for bags, jewellery, accessories, shoes);\n- \"formality\": 1 (sport, lounge) to 5 (ceremony);\n- \"season_hint\": from the fabric thickness (summer, winter, mid-season, all year);\n- \"details\": one short sentence on what matters to wear it (collar, sleeves, length, closure, high waist…).\nIf you see no item, answer [].","user":"Aucune précision : repère toutes ses pièces visibles.","schema":{"type":"object","additionalProperties":false,"required":["pieces","note"],"properties":{"pieces":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["name","category","kind","colors","hex","material","where","box","description","motif","coupe","habillage","saison","details"],"properties":{"name":{"type":"string"},"category":{"type":"string","enum":["hauts","bas","robes","vestes","chaussures","sacs","bijoux","accessoires"]},"kind":{"type":"string","enum":["tshirt","chemise","blouse","polo","pull","sweat","capuche","debardeur","top","jean","pantalon","chino","jupe","jupeculotte","short","legging","robe","combinaison","salopette","veste","blazer","manteau","trench","doudoune","gilet","baskets","bottines","bottes","escarpins","sandales","mules","mocassins","derbies","ballerines","sacamain","bandouliere","pochette","cabas","sacados","collier","boucles","bracelet","bague","montre","broche","ceinture","bandeau","pince","foulard","echarpe","chapeau","casquette","bonnet","lunettes","gants"]},"colors":{"type":"array","items":{"type":"string","enum":["noir","anthracite","gris","blanc","creme","beige","camel","marron","bordeaux","rouge","orange","moutarde","jaune","olive","vert","marine","bleu","ciel","violet","rose","dore","argente"]}},"hex":{"type":"array","items":{"type":"string"}},"material":{"type":"string"},"where":{"type":"string"},"box":{"type":"object","additionalProperties":false,"required":["x","y","w","h"],"properties":{"x":{"type":"integer"},"y":{"type":"integer"},"w":{"type":"integer"},"h":{"type":"integer"}}},"description":{"type":"string"},"motif":{"type":"string","enum":["uni","rayures","carreaux","imprime","fleuri","pois","logo","graphique","texture"]},"coupe":{"type":"string","enum":["ajustee","droite","ample","oversize","evasee","sans_objet"]},"habillage":{"type":"integer"},"saison":{"type":"string","enum":["toute_annee","mi_saison","hiver","ete"]},"details":{"type":"string"}}}},"note":{"type":"string"}}}} as { system: string; relais: string; observation: string; user: string; schema: unknown };

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
const db = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), { auth: { persistSession: false, autoRefreshToken: false } });

const NOM = /^[a-z0-9][a-z0-9._-]{0,90}$/i;
const sk = (s: string) => s.replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').replace(/\s+/g, ' ');
const FORMAT = `\n\nFORMAT DE RÉPONSE : réponds UNIQUEMENT par un objet JSON valide, sans phrase avant ni après et sans bloc de code, qui respecte ce schéma JSON :\n${JSON.stringify(DATA.schema)}`;

function baseGemini(): string {
  const v = lire('GEMINI_BASE_URL')?.replace(/\/+$/, '').replace(/\/v1(beta)?(\/.*)?$/, '').replace(/\/+$/, '');
  return v && /^https:\/\//.test(v) ? v : 'https://generativelanguage.googleapis.com';
}
async function sha256(texte: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
const mime = (b: Uint8Array) => (b[0] === 0x89 ? 'image/png' : b[0] === 0xff ? 'image/jpeg' : 'image/jpeg');
const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const lireJson = (t: string): unknown => {
  const d = t.search(/[[{]/);
  const f = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  try { return JSON.parse(t.slice(d, f + 1)); } catch { return undefined; }
};

/** Un appel Gemini avec la photo : texte rendu, jetons, durée. */
async function gemini(spec: string, photo: { bytes: Uint8Array; mime: string }, texte: string, systeme?: string) {
  const [modele, niveau] = spec.split(':');
  const key = lire('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY absente');
  const appel = (reflexion: boolean) => fetch(`${baseGemini()}/v1beta/models/${modele}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(100_000),
    body: JSON.stringify({
      ...(systeme ? { systemInstruction: { parts: [{ text: systeme }] } } : {}),
      contents: [{ parts: [{ inline_data: { mime_type: photo.mime, data: b64(photo.bytes) } }, { text: texte }] }],
      generationConfig: { responseMimeType: 'application/json', ...(reflexion && niveau ? { thinkingConfig: { thinkingLevel: niveau } } : {}) },
    }),
  });
  const t = Date.now();
  let res = await appel(true);
  if (res.status === 400 && /think/i.test(await res.clone().text())) res = await appel(false);
  if (!res.ok) throw new Error(`Gemini ${res.status} : ${sk(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const texteRendu = ((body?.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[]).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  return { texte: texteRendu, ms: Date.now() - t, entree: body?.usageMetadata?.promptTokenCount ?? 0, sortie: (body?.usageMetadata?.candidatesTokenCount ?? 0) + (body?.usageMetadata?.thoughtsTokenCount ?? 0) };
}

/** Claude, texte seul, par l'intermédiaire : comme le mode « texte » de l'agent (effort bas). */
async function claude(systeme: string, texte: string) {
  const key = lire('ANTHROPIC_API_KEY');
  const base = (lire('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com').replace(/\/+$/, '').replace(/\/v1(\/.*)?$/, '');
  if (!key) throw new Error('ANTHROPIC_API_KEY absente');
  const t = Date.now();
  const corps = (effort: boolean) => JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 12_000, system: systeme, messages: [{ role: 'user', content: texte }], ...(effort ? { output_config: { effort: 'low' } } : {}) });
  const appel = (effort: boolean) => fetch(`${base}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(110_000), body: corps(effort) });
  let res = await appel(true);
  if (res.status === 400) res = await appel(false);
  const brut = await res.text();
  if (!res.ok) throw new Error(`Claude ${res.status} : ${sk(brut).slice(0, 200)}`);
  const b = JSON.parse(brut);
  return { texte: (b.content ?? []).map((c: { text?: string }) => c.text ?? '').join(''), ms: Date.now() - t, entree: b.usage?.input_tokens ?? 0, sortie: b.usage?.output_tokens ?? 0 };
}

type Piece = Record<string, unknown>;
const resume = (data: unknown) => {
  const o = (Array.isArray(data) ? { pieces: data } : data ?? {}) as { pieces?: Piece[]; note?: string };
  return { note: o.note ?? '', pieces: (o.pieces ?? []).map((p) => ({ name: p.name, category: p.category, kind: p.kind, colors: p.colors, hex: p.hex, material: p.material, saison: p.saison, habillage: p.habillage, coupe: p.coupe, motif: p.motif, box: p.box, where: p.where })) };
};

async function essai(nom: string, f: () => Promise<{ data: unknown; cout: number; detail: Record<string, unknown> }>) {
  try {
    const r = await f();
    const s = resume(r.data);
    return { nom, ok: s.pieces.length > 0, ...r.detail, cout: Math.round(r.cout * 1e5) / 1e5, ...s };
  } catch (e) {
    return { nom, ok: false, erreur: sk(e instanceof Error ? e.message : String(e)).slice(0, 300) };
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
  if (!data || data.mode !== 'sonde' || !(data.params as { reperage?: unknown })?.reperage || data.status !== 'queued' || Date.now() - Date.parse(data.created_at) > 86_400_000 || (await sha256(jeton)) !== data.jeton_sha256) return refus();
  const { data: pris } = await db.from('banc_ia').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', id).eq('status', 'queued').select('id');
  if (!pris?.length) return refus();

  const p = data.params as { photo?: string; reperage?: { gemini: string[]; relais?: string } };
  EdgeRuntime.waitUntil((async () => {
    try {
      if (!p.photo || !NOM.test(p.photo)) throw new Error('photo refusée');
      const dl = await db.storage.from('banc').download(`fichiers/${p.photo}`);
      if (dl.error || !dl.data) throw new Error(`image de test introuvable : ${p.photo}`);
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const photo = { bytes, mime: mime(bytes) };
      const gem = (spec: string) => essai(`gemini-seul ${spec}`, async () => {
        const r = await gemini(spec, photo, DATA.user, DATA.system + FORMAT);
        return { data: lireJson(r.texte), cout: (r.entree * 0.3 + r.sortie * 2.5) / 1e6, detail: { ms: r.ms, jetons: [r.entree, r.sortie] } };
      });
      const relais = (spec: string) => essai(`relais ${spec} + claude`, async () => {
        const o = await gemini(spec, photo, DATA.observation);
        const c = await claude(DATA.system + DATA.relais + FORMAT, `Observations de ton collègue sur la photo :\n${o.texte}\n\n${DATA.user}`);
        return { data: lireJson(c.texte), cout: (o.entree * 0.3 + o.sortie * 2.5) / 1e6 + (c.entree * 2 + c.sortie * 10) / 1e6, detail: { ms: o.ms + c.ms, ms_observation: o.ms, ms_claude: c.ms, jetons_claude: [c.entree, c.sortie], observation: o.texte.slice(0, 1500) } };
      });
      const lignes = await Promise.all([...(p.reperage?.gemini ?? []).map(gem), ...(p.reperage?.relais ? [relais(p.reperage.relais)] : [])]);
      const cout = lignes.reduce((s, l) => s + (('cout' in l ? l.cout : 0) as number), 0);
      await db.from('banc_ia').update({ status: 'done', finished_at: new Date().toISOString(), result: { photo: p.photo, lignes }, cost_usd: cout }).eq('id', id);
    } catch (e) {
      await db.from('banc_ia').update({ status: 'failed', finished_at: new Date().toISOString(), error: String(e instanceof Error ? e.message : e).slice(0, 2000) }).eq('id', id);
    }
  })());
  return Response.json({ accepted: true }, { status: 202 });
});
