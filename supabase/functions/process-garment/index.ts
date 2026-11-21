/**
 * process-garment : la fonction serveur du pipeline d'ajout (spec du 20/11).
 *
 *   POST { garment_id, envoi_ms? }   avec le jeton de la personne (JWT vérifié)
 *
 * L'app a déjà réduit la photo (1024 px, JPEG 85, orientation corrigée),
 * l'a envoyée dans garments/<espace>/<pièce>/original.jpg et a créé la ligne
 * « processing » (la base le vérifie). La fonction prend la pièce (un seul
 * traitement à la fois), répond 202 tout de suite, et termine en arrière-plan :
 * détourage et étiquetage en parallèle, contrôle qualité, cutout.webp et
 * thumb.webp, puis la ligne passe ready, needs_retake ou failed. L'app suit le
 * changement en direct (Realtime). Le traitement repart toujours de
 * l'original : « Réessayer » et « Reprendre la photo » rappellent la même
 * fonction.
 *
 *   POST { banc: { id, jeton, fichiers? } }   essai du banc (table banc_ia, mode « pipeline »)
 *
 * Aucun modèle génératif n'est appelé ici. Interrupteur : AI_ENABLED=false.
 */
import { createClient } from '@supabase/supabase-js';
import { decode, encodeJpeg, sniffMime } from '../dressy-agent/codec.ts';
import { downscale } from '../dressy-agent/cutout.ts';
import { lireCle } from '../_shared/fournisseurs.ts';
import { lancerBanc, type Banc, type Rendu } from '../_shared/banc.ts';
import { libelle, MATIERES, nomDeLaPiece, saisonResumee, type Etiquettes } from '../_shared/taxonomy.ts';
import { DETOUREURS, detourer, estDetoureur, type IdDetoureur } from './detoureurs.ts';
import { octetsDuMasque, SAM_PRIX, segmenterSam } from '../dressy-agent/fal.ts';
import { etiqueter } from './etiquetage.ts';
import { appelPour, etiqueteur } from './modeles.ts';
import { traiter, type Ports, type Sortie } from './pipeline.ts';
import { PERIME_MS, PIPELINE_VERSION, TENTATIVES_MAX } from './reglages.ts';
import { price } from '../dressy-agent/quota.ts';
import { encoderWebp } from './webp.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error('Clé service Supabase introuvable dans l’environnement de la fonction.');
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const repondre = (corps: unknown, status = 200) => Response.json(corps, { status, headers: CORS });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Le détoureur retenu après le banc (secret DETOUREUR), BiRefNet par défaut. */
const detoureurParDefaut = (): IdDetoureur => {
  const v = Deno.env.get('DETOUREUR')?.trim();
  return estDetoureur(v) ? v : 'birefnet';
};
/** La clé fal.ai (déjà utilisée par SAM 3). */
const cleFal = (): string | undefined => lireCle('FAL_KEY');

const prixDetourage = (id: IdDetoureur) => price(Deno.env.get(`COST_${id.toUpperCase()}_USD`), DETOUREURS[id].prix);

/** L'épuration par SAM 3 (21/11) : active par défaut, EPURATION=0 (secret) la coupe. */
const epurationActive = () => Deno.env.get('EPURATION')?.trim() !== '0';
const prixSam = () => price(Deno.env.get('COST_SAM_USD'), SAM_PRIX);

/** Les ports réels du pipeline : décodeurs, encodeur WebP, fal.ai, modèle d'étiquetage. */
function ports(original: Uint8Array, id: IdDetoureur, qui: 'claude' | 'gemini', epuration = epurationActive()): Ports {
  return {
    ...(epuration ? {
      segmenter: async (jpeg: Uint8Array, prompt: string) => {
        const cle = cleFal();
        if (!cle) throw new Error('FAL_KEY absente des secrets');
        // SAM ne fait que délimiter la zone de la pièce (le bord fin vient du détourage) : 512 px
        // suffisent, et ses masques pèsent quatre fois moins à décoder (mémoire et temps de calcul).
        const petite = encodeJpeg(downscale(decode(jpeg, 'image/jpeg'), 512), 85);
        const r = await segmenterSam({ bytes: petite, mime: 'image/jpeg' }, prompt, { cle, delaiMs: 10_000, maxMasques: 3 });
        return await Promise.all(r.masques.map(async (m) => ({ png: await octetsDuMasque(m.source), score: m.score })));
      },
    } : {}),
    decoderJpeg: (b) => decode(b, 'image/jpeg'),
    decoderPng: (b) => decode(b, sniffMime(b) ?? 'image/png'),
    encoderWebp,
    detourer: (jpeg) => {
      const cle = cleFal();
      if (!cle) return Promise.reject(Object.assign(new Error('FAL_KEY absente des secrets'), { essais: 1 }));
      return detourer(id, jpeg, { cle });
    },
    etiqueter: () => etiqueter(appelPour(qui, original)),
    maintenant: () => Date.now(),
  };
}

/** Les colonnes de la fiche tirées de l'étiquetage (rien si l'étiquetage a échoué). */
function colonnesDeLaFiche(e: Etiquettes | null, nomActuel: string, ficheActuelle: Record<string, unknown> | null) {
  if (!e) return {};
  return {
    category_id: e.categorie,
    kind: e.type,
    colors: e.couleur_2 ? [e.couleur, e.couleur_2] : [e.couleur],
    matiere: e.matiere,
    // L'ancienne colonne en texte, lue par l'app actuelle et par Kodi.
    material: libelle(MATIERES, e.matiere),
    saisons: e.saisons,
    season: saisonResumee(e.saisons),
    fiche: { ...(ficheActuelle ?? {}), motif: e.motif, coupe: e.coupe, habillage: e.habillage },
    // Le nom vient de la fiche, sauf si la personne en a déjà donné un.
    ...(nomActuel === 'Pièce' || !nomActuel.trim() ? { name: nomDeLaPiece(e.type, e.couleur) } : {}),
  };
}

type Piece = { id: string; space_id: string; original_path: string; name: string; fiche: Record<string, unknown> | null; attempts: number };

async function journal(ligne: Record<string, unknown>) {
  const { error } = await db.from('garment_runs').insert(ligne);
  if (error) console.error(`journal : ${error.message}`);
}

function ligneDuJournal(s: Sortie, base: Record<string, unknown>) {
  const m = s.mesures;
  const analyse = s.statut === 'failed' ? null : s.analyse;
  return {
    ...base,
    statut: s.statut,
    fail_reason: s.statut === 'ready' ? null : s.raison,
    etiquetage_ok: s.statut === 'failed' ? null : Boolean(s.etiquettes),
    detourage_ms: m.detourage_ms,
    etiquetage_ms: m.etiquetage_ms,
    controle_ms: m.controle_ms,
    couverture: analyse?.couverture ?? null,
    plus_gros_morceau: analyse?.plusGros ?? null,
    confiance: s.statut === 'failed' ? null : s.etiquettes?.confiance ?? null,
    detail: {
      essais_detourage: m.essais_detourage,
      essais_etiquetage: m.essais_etiquetage,
      modele_etiquetage: m.modele_etiquetage,
      morceaux: analyse?.morceaux ?? null,
      deux_plus_gros: analyse?.deuxPlusGros ?? null,
      bord: analyse ? Math.round(analyse.bord * 1000) / 1000 : null,
      epuration: m.epuration,
      epuration_ms: m.epuration_ms,
      epuration_appels: m.epuration_appels,
      erreurs: m.erreurs.slice(0, 6).map((e) => e.slice(0, 200)),
    },
  };
}

/** Le traitement d'une pièce prise, en arrière-plan. Toute issue finit en ready, needs_retake ou failed. */
async function traiterPiece(p: Piece, envoiMs: number | null, tentative: number) {
  const t0 = Date.now();
  const id = detoureurParDefaut();
  const qui = etiqueteur();
  const base = {
    garment_id: p.id, space_id: p.space_id, mode: 'app', pipeline_version: PIPELINE_VERSION, tentative,
    detoureur: id, etiqueteur: qui, envoi_ms: envoiMs,
  };
  let telechargementMs: number | null = null;
  try {
    const { data, error } = await db.storage.from('garments').download(p.original_path);
    if (error || !data) throw new Error(`original introuvable : ${error?.message ?? 'vide'}`);
    const original = new Uint8Array(await data.arrayBuffer());
    telechargementMs = Date.now() - t0;

    const s = await traiter(original, ports(original, id, qui));
    const te = Date.now();
    const dossier = `${p.space_id}/${p.id}`;
    if (s.statut === 'ready') {
      const envoyer = (nom: string, octets: Uint8Array) =>
        db.storage.from('garments').upload(`${dossier}/${nom}`, octets, { contentType: 'image/webp', upsert: true, cacheControl: '300' });
      const [a, b] = await Promise.all([envoyer('cutout.webp', s.cutout), envoyer('thumb.webp', s.thumb)]);
      if (a.error || b.error) throw new Error(`envoi des images : ${(a.error ?? b.error)!.message}`);
      const { error: e } = await db.from('garments').update({
        pipeline_status: 'ready', fail_reason: null, pipeline_version: PIPELINE_VERSION,
        image_path: `${dossier}/cutout.webp`, thumb_path: `${dossier}/thumb.webp`,
        width: s.largeur, height: s.hauteur, tint: s.couleurHex,
        tags_confidence: s.etiquettes?.confiance ?? null, source: 'photo',
        ...colonnesDeLaFiche(s.etiquettes, p.name, p.fiche),
      }).eq('id', p.id);
      if (e) throw new Error(`écriture de la pièce : ${e.message}`);
    } else {
      const { error: e } = await db.from('garments').update({
        pipeline_status: s.statut, fail_reason: s.raison, pipeline_version: PIPELINE_VERSION,
        tags_confidence: s.statut === 'needs_retake' ? s.etiquettes?.confiance ?? null : null,
      }).eq('id', p.id);
      if (e) throw new Error(`écriture de l'état : ${e.message}`);
    }
    const cout = (s.mesures.essais_detourage ? prixDetourage(id) * s.mesures.essais_detourage : 0) + s.mesures.cout_etiquetage_usd
      + prixSam() * s.mesures.epuration_appels;
    await journal({
      ...ligneDuJournal(s, base), telechargement_ms: telechargementMs, ecriture_ms: Date.now() - te,
      total_ms: Date.now() - t0, cout_usd: Math.round(cout * 1e6) / 1e6,
    });
    console.log(`pièce ${p.id.slice(0, 8)} : ${s.statut}${s.statut === 'ready' ? '' : ` (${s.raison})`} en ${Date.now() - t0} ms`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`pièce ${p.id.slice(0, 8)} : échec inattendu : ${message}`);
    await db.from('garments').update({ pipeline_status: 'failed', fail_reason: 'unexpected', pipeline_version: PIPELINE_VERSION }).eq('id', p.id);
    await journal({ ...base, statut: 'failed', fail_reason: 'unexpected', telechargement_ms: telechargementMs, total_ms: Date.now() - t0, detail: { erreurs: [message.slice(0, 300)] } });
  }
}

// ---------------------------------------------------------------- banc

/**
 * Le banc (spec, étape 3) : une photo de test (jamais une photo
 * d'utilisatrice), passée par chaque détoureur demandé, sans rien écrire dans
 * les dressings. Une photo par essai : le temps de calcul de la fonction est compté.
 *   params : { photo: "nom.jpg", detoureurs?: ["birefnet", "bria"], etiqueteur?: "gemini" | "claude" }
 */
/**
 * Une photo de test publique (Unsplash, licence libre), préparée comme l'app
 * prépare la sienne : 1024 px au plus, JPEG 85 (le service d'images d'Unsplash
 * fait la réduction). Seul ce domaine est accepté.
 */
async function photoDeTest(url: string): Promise<Uint8Array> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.hostname !== 'images.unsplash.com') throw new Error('photo de test : seul images.unsplash.com est accepté');
  u.searchParams.set('fm', 'jpg');
  u.searchParams.set('q', '85');
  u.searchParams.set('w', '1024');
  u.searchParams.set('h', '1024');
  u.searchParams.set('fit', 'max');
  const r = await fetch(u, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`photo de test : ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function modePipeline(b: Banc, params: Record<string, unknown>): Promise<Rendu> {
  const nom = String(params.photo ?? '');
  const bytes = typeof params.url === 'string' ? await photoDeTest(params.url) : (await b.lire(nom)).bytes;
  // L'entrée telle que traitée, pour la planche de contrôle.
  const entree = await b.ranger(`${nom}-entree.jpg`, bytes, 'image/jpeg');
  const ids = (Array.isArray(params.detoureurs) ? params.detoureurs : ['birefnet']).filter(estDetoureur);
  const qui = params.etiqueteur === 'claude' || params.etiqueteur === 'gemini' ? params.etiqueteur : etiqueteur();
  const resultats: Record<string, unknown>[] = [];
  let cout = 0;
  for (const id of ids) {
    const t0 = Date.now();
    const s = await traiter(bytes, ports(bytes, id, qui, params.epuration === false ? false : epurationActive()));
    const total = Date.now() - t0;
    const c = (s.mesures.essais_detourage ? prixDetourage(id) * s.mesures.essais_detourage : 0) + s.mesures.cout_etiquetage_usd
      + prixSam() * s.mesures.epuration_appels;
    cout += c;
    const liens = s.statut === 'ready'
      ? { cutout: await b.ranger(`${nom}-${id}.webp`, s.cutout, 'image/webp'), thumb: await b.ranger(`${nom}-${id}-thumb.webp`, s.thumb, 'image/webp') }
      : {};
    await journal({ ...ligneDuJournal(s, { mode: 'banc', pipeline_version: PIPELINE_VERSION, detoureur: id, etiqueteur: qui }), total_ms: total, cout_usd: Math.round(c * 1e6) / 1e6 });
    resultats.push({
      detoureur: id, statut: s.statut, raison: s.statut === 'ready' ? null : s.raison, total_ms: total,
      mesures: s.mesures, analyse: s.statut === 'failed' ? null : s.analyse,
      etiquettes: s.statut === 'failed' ? null : s.etiquettes,
      couleur: s.statut === 'ready' ? s.couleurHex : null, dimensions: s.statut === 'ready' ? [s.largeur, s.hauteur] : null,
      octets: s.statut === 'ready' ? [s.cutout.length, s.thumb.length] : null, ...liens,
    });
    b.log(`${nom} / ${id} : ${s.statut} en ${total} ms`);
  }
  return { result: { photo: nom, etiqueteur: qui, entree, resultats }, cost: cout };
}

// ---------------------------------------------------------------- appel

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return repondre({ error: 'méthode' }, 405);
  if (Deno.env.get('AI_ENABLED')?.trim() === 'false') return repondre({ error: 'Kodi fait une pause' }, 503);

  const corps = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (corps.banc) {
    return lancerBanc(db, corps.banc as Record<string, unknown>, { pipeline: modePipeline }, (p) => EdgeRuntime.waitUntil(p));
  }

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: qui } = await db.auth.getUser(jwt);
  if (!qui?.user) return repondre({ error: 'connexion requise' }, 401);

  const id = String(corps.garment_id ?? '');
  if (!UUID.test(id)) return repondre({ error: 'pièce inconnue' }, 400);
  const { data: g } = await db.from('garments')
    .select('id, space_id, original_path, name, fiche, attempts, pipeline_status, updated_at').eq('id', id).maybeSingle();
  if (!g) return repondre({ error: 'pièce inconnue' }, 404);
  const { data: membre } = await db.from('space_members').select('space_id').eq('space_id', g.space_id).eq('profile_id', qui.user.id).maybeSingle();
  if (!membre) return repondre({ error: 'pièce inconnue' }, 404);
  if (!g.original_path) return repondre({ error: 'pas de photo d’origine' }, 400);
  if (g.attempts >= TENTATIVES_MAX) return repondre({ error: 'trop de tentatives', code: 'tentatives' }, 429);

  // Un seul traitement à la fois : une pièce déjà prise et encore fraîche n'est pas reprise.
  const perimee = Date.now() - Date.parse(g.updated_at) > PERIME_MS;
  const libre = g.pipeline_status === 'failed' || g.pipeline_status === 'needs_retake'
    || (g.pipeline_status === 'processing' && (g.attempts === 0 || perimee));
  if (!libre) return repondre({ error: 'déjà en cours', etat: g.pipeline_status }, 409);
  const { data: prise } = await db.from('garments')
    .update({ pipeline_status: 'processing', fail_reason: null, attempts: g.attempts + 1 })
    .eq('id', id).eq('attempts', g.attempts).select('id');
  if (!prise?.length) return repondre({ error: 'déjà en cours' }, 409);

  const envoi = Number(corps.envoi_ms);
  EdgeRuntime.waitUntil(traiterPiece(g as Piece, Number.isFinite(envoi) && envoi >= 0 && envoi < 600_000 ? Math.round(envoi) : null, g.attempts + 1));
  return repondre({ accepted: true, tentative: g.attempts + 1 }, 202);
});
