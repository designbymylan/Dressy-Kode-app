/**
 * L'agent central de Dresskode.
 *
 * Réveillé par la base (trigger sur ai_jobs, filet pg_cron), il prend la
 * tâche la plus ancienne en file et la traite d'UN passage :
 *
 *   photo confiée → Sonnet 5 repère TOUTES les pièces (ou celles que la
 *     personne a nommées) ; la tâche garde la première et crée une tâche fille
 *     par pièce en plus, que d'autres passages traitent en parallèle ;
 *   pièce → SAM 3 (fal.ai, 20/11) rend le masque de la pièce (un masque, pas
 *     une image) et elle est DÉCOUPÉE dans la photo : ses pixels, ses
 *     couleurs, ses marquages sont ceux de la personne, rien n'est redessiné ;
 *     un seul appel, 0,005 $ ;
 *     → contrôles automatiques (couverture, une seule pièce, bord net, taille,
 *       couleur dominante) ; sinon repli sur un détourage par contraste ;
 *     → mise au format fixe (canevas carré, marges, pièce centrée), vignette,
 *       rangement dans le dressing.
 *
 * Puis, le même soir (20/11, rendu « catalogue » demandé par l'utilisateur) :
 * la pièce découpée est rangée TOUT DE SUITE (la personne la voit en 10 à
 * 20 s), et la tâche repart aussitôt pour un second passage (`dessin_auto`) :
 * Nano Banana la redessine en photo produit (mannequin invisible, de face),
 * la découpe servant de référence exacte, et l'image est remplacée. Offert,
 * rien au compteur ; s'il échoue, la découpe reste, sans message d'erreur.
 * Deux passages, aussi, pour le temps de calcul compté de la fonction.
 *
 * À la demande : « Image propre » (fiche pièce) ou la 2e reprise d'un « rendu
 * incorrect » redessinent la pièce ; chacun prend une génération au compteur
 * de la personne (quota.ts, migration quotas_generation) : rendue si le
 * dessin échoue, jamais prise si l'image est déjà en cache. Sans clé fal.ai,
 * l'ancien chemin du 18/11 (dessin d'arrivée offert) reste en place.
 *
 * L'état complet est en base : un passage tué en route reprend sans repayer
 * ce qui a déjà été fait (repérage).
 *
 * L'appel HTTP ne porte aucune donnée de confiance, c'est un simple réveil
 * (déployé sans vérification JWT) : l'agent ne traite que ce qui est déjà
 * en file, donc déjà passé par la RLS et le quota à l'insertion.
 */
import { createClient } from '@supabase/supabase-js';
import { MAX_RUNS } from './decide.ts';
import { backdropFor, consigneDessin, garmentRgbs, isMetal, type Target } from './prompts.ts';
import { survey, dessiner, checkSetup, passager, AgentError, SAY, MODELS, EFFORT, KEYS, FAL, type Img } from './steps.ts';
import { cleFal, decouper, fatal, ouvrir } from './decoupage.ts';
import { SAM_MODELE, SAM_PRIX } from './fal.ts';
import { MODES_AGENT } from './banc.ts';
import { lancerBanc } from '../_shared/banc.ts';
import { cacheKey, drawWithQuota, imageSettings, price, tokenCost, type Ports } from './quota.ts';
import { cutoutBackground, downscale, surFond, type Raster } from './cutout.ts';
import { decode, encodePng, sniffMime } from './codec.ts';
import { CUTOUT } from './config.ts';
import { dominantColour } from './color.ts';
import { fitOnCanvas } from './normalize.ts';
import { cleanSpecks } from './segment.ts';
import { BLOCKING, runChecks, type Checks } from './checks.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

type Inventory = { pieces: Target[]; note: string; skipped: number };

type Job = {
  id: string;
  space_id: string;
  requested_by: string;
  user_input: string;
  source_paths: string[];
  analysis: (Partial<Target> & { inventory?: Inventory }) | null;
  target: Target | null;
  parent_id: string | null;
  attempts: number;
  runs: number;
  garment_id: string | null;
  cutout: { reperage?: unknown } | null;
  /** Ce que la personne a ajouté en envoyant la photo : marque, taille, coupe, matière, note. */
  details: Details | null;
  /** 0 : première découpe ; 1 et 2 : reprises après un « rendu incorrect ». */
  redo: number;
  /** « Image propre » demandée : la pièce est redessinée (une génération). */
  clean: boolean;
  /** Second passage automatique (20/11) : le dessin catalogue après la découpe, offert. */
  dessin_auto: boolean;
};

type Details = { brand?: string; size?: string; fit?: string; material?: string; note?: string };

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

const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------- base

async function setJob(job: Job, patch: Record<string, unknown>) {
  const { error } = await db.from('ai_jobs').update(patch).eq('id', job.id);
  if (error) throw new Error(`mise à jour de la pièce : ${error.message}`);
  Object.assign(job, patch);
}

// ---------------------------------------------------------------- mesures

/**
 * Le dessin d'arrivée (18/11) ne sert plus que sans clé fal.ai (20/11) : avec
 * elle, une pièce qui arrive est découpée par SAM 3, et le dessin attend
 * qu'on le demande. Le secret DESSIN_PAR_DEFAUT force l'un (1) ou l'autre (0).
 */
const DESSIN_PAR_DEFAUT = Deno.env.get('DESSIN_PAR_DEFAUT') === '1' || (Deno.env.get('DESSIN_PAR_DEFAUT') !== '0' && !cleFal());

/**
 * Le dessin catalogue après la découpe (20/11) : actif avec la découpe par
 * SAM 3 ; le secret DESSIN_APRES_DECOUPE=0 garde la découpe seule.
 */
const DESSIN_APRES_DECOUPE = !DESSIN_PAR_DEFAUT && Deno.env.get('DESSIN_APRES_DECOUPE') !== '0';

/**
 * L'interrupteur général (20/11) : AI_ENABLED=false coupe tout appel aux
 * fournisseurs d'IA. Les photos restent en file, intactes, et repartent dès
 * qu'il est rallumé (ou retiré).
 */
const IA_ACTIVE = (Deno.env.get('AI_ENABLED') ?? '').trim().toLowerCase() !== 'false';

/** Prix estimés en dollars, réglables dans les secrets sans toucher au code. */
// Tarifs publics du 13/11 (Nano Banana 2.1, Claude Sonnet 5) : ceux d'un
// intermédiaire peuvent différer, les secrets COST_* les remplacent.
const COST = {
  image1k: price(Deno.env.get('COST_IMAGE_1K_USD'), 0.034),
  image2k: price(Deno.env.get('COST_IMAGE_2K_USD'), 0.05),
  claude: { in: price(Deno.env.get('COST_CLAUDE_IN_PER_M_USD'), 2), out: price(Deno.env.get('COST_CLAUDE_OUT_PER_M_USD'), 10) },
  gemini: { in: price(Deno.env.get('COST_GEMINI_IN_PER_M_USD'), 0.3), out: price(Deno.env.get('COST_GEMINI_OUT_PER_M_USD'), 2.5) },
  sam: price(Deno.env.get('COST_SAM_USD'), SAM_PRIX),
};

/** Note un appel qui ne prend rien au compteur (repérage, segmentation, image en cache). Jamais bloquant. */
async function note(job: Job, provider: 'google' | 'anthropic' | 'fal', kind: 'dessin' | 'segmentation' | 'reperage', model: string, status: 'succes' | 'echec', cacheHit: boolean, costUsd: number) {
  try {
    const { error } = await db.rpc('generation_note', {
      p_user: job.requested_by, p_space: job.space_id, p_job: job.id, p_provider: provider, p_kind: kind,
      p_model: model, p_status: status, p_cache_hit: cacheHit, p_cost: costUsd,
    });
    if (error) console.warn('mesure non enregistrée :', error.message);
  } catch (err) {
    console.warn('mesure non enregistrée :', err instanceof Error ? err.message : err);
  }
}

async function sha256(bytes: Uint8Array | string): Promise<string> {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function download(bucket: string, path: string): Promise<Img> {
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) throw new AgentError(SAY.photo, `image introuvable : ${bucket}/${path}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { bytes, mime: sniffMime(bytes) ?? data.type ?? 'image/jpeg' };
}

async function upload(bucket: string, path: string, img: Img) {
  const { error } = await db.storage.from(bucket).upload(path, img.bytes, {
    contentType: img.mime,
    upsert: true,
  });
  if (error) throw new Error(`envoi vers ${bucket} : ${error.message}`);
}

async function loadSources(job: Job): Promise<Img[]> {
  // space_id vient de la ligne de job, jamais de la requête : une photo hors
  // de l'espace n'est pas lue, même si la ligne a été fabriquée à la main.
  for (const p of job.source_paths) {
    if (!p.startsWith(`${job.space_id}/`)) throw new AgentError(SAY.photo, `photo hors espace : ${p}`);
  }
  if (!job.source_paths.length) throw new AgentError(SAY.photo, 'aucune photo');
  return Promise.all(job.source_paths.map((p) => download('uploads', p)));
}


// ---------------------------------------------------------------- repérage

/**
 * Sonnet 5 repère les pièces de la photo. La tâche garde la première ; les
 * suivantes deviennent des tâches filles, réveillées aussitôt par le
 * déclencheur d'insertion : elles se découpent en même temps.
 *
 * Le résultat du repérage est écrit AVANT la création des filles : un
 * passage tué entre les deux reprend sans rappeler le modèle ni créer de
 * doublons.
 */
async function surveyPhoto(job: Job, sources: Img[], log: (m: string) => void): Promise<Target> {
  let inv = job.analysis?.inventory;

  if (!inv) {
    const { data: profile } = await db.from('style_profile').select('gender').eq('space_id', job.space_id).maybeSingle();
    const t0 = Date.now();
    const found = await survey({ sources, hint: job.user_input, gender: profile?.gender ?? null });
    log(`repérage (${found.modele}) → ${found.pieces.length} pièce(s) en ${Date.now() - t0} ms : ${found.pieces.map((p) => p.name).join(', ') || found.note}`);
    const u = (found.usage ?? {}) as Record<string, unknown>;
    await note(job, found.fournisseur, 'reperage', found.modele, 'succes', false, tokenCost(u.input_tokens, u.output_tokens, found.fournisseur === 'google' ? COST.gemini : COST.claude));
    if (!found.pieces.length) throw new AgentError(SAY.nothing, found.note || 'aucune pièce repérée');

    // La photo compte déjà pour une pièce dans la limite de l'offre ; les
    // pièces en plus ne sont créées que s'il reste de la place.
    const { data: left } = await db.rpc('pieces_left', { target: job.space_id });
    const room = left === null || left === undefined ? Infinity : Math.max(0, Number(left));
    const extra = Math.min(found.pieces.length - 1, room);
    inv = { pieces: found.pieces.slice(0, 1 + extra), note: found.note, skipped: found.pieces.length - 1 - extra };
    await setJob(job, { analysis: { inventory: inv }, prompt_model: found.modele, cutout: { reperage: { ms: Date.now() - t0, usage: found.usage } } });
  }

  const extras = inv.pieces.slice(1);
  if (extras.length) {
    const { count } = await db.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('parent_id', job.id);
    if (!count) {
      const { error } = await db.from('ai_jobs').insert(extras.map((target) => ({
        space_id: job.space_id,
        requested_by: job.requested_by,
        source_paths: job.source_paths,
        user_input: job.user_input,
        parent_id: job.id,
        target,
      })));
      if (error) throw new Error(`création des pièces repérées : ${error.message}`);
      log(`${extras.length} pièce(s) confiée(s) à d'autres passages, en parallèle`);
    }
  }

  const first = inv.pieces[0];
  await setJob(job, { target: first });
  return first;
}

/** La fiche de la pièce ; les tâches d'avant le repérage gardaient la leur dans `analysis`. */
function targetOf(job: Job): Target {
  const t = job.target ?? (job.analysis?.name ? job.analysis as Target : null);
  if (!t) throw new AgentError(SAY.failed, 'fiche de la pièce perdue');
  return { ...t, where: t.where ?? '', prompt: t.prompt ?? '' };
}

// ---------------------------------------------------------------- découpe

type Journal = {
  version: string;
  niveau: number;
  methode?: string;
  modele?: string;
  reflexion?: string;
  controles?: Checks;
  essais?: { methode: string; echecs: string[] }[];
  /** L'appel à SAM 3 (consigne, masques rendus, choix), depuis le 20/11. */
  sam?: unknown;
  ms: Record<string, number>;
  usage: Record<string, unknown>;
};

/** Découpe la pièce dans la photo (decoupage.ts), puis la range. */
async function cutOut(job: Job, target: Target, sources: Img[], log: (m: string) => void) {
  await setJob(job, { status: 'cutout', image_model: cleFal() ? SAM_MODELE : MODELS.segment });
  const j: Journal = { version: CUTOUT.version, niveau: job.redo, ms: {}, usage: {} };
  const photo = sources[0];

  const t = Date.now();
  const raster = ouvrir(photo);
  j.ms.decodage = Date.now() - t;

  const d = await decouper(photo, raster, target, { strong: job.redo >= 1, relancerSiPanne: job.runs < REPRISES_PASSAGERES }, log);
  Object.assign(j.ms, d.ms);
  if (d.sam) {
    j.sam = d.sam;
    j.modele = d.sam.model;
    // Payé dès que SAM 3 a répondu, masque utilisable ou non.
    await note(job, 'fal', 'segmentation', d.sam.model, d.sam.masques ? 'succes' : 'echec', false, d.sam.zone ? COST.sam : 0);
  }
  if (d.segmentation) {
    j.usage.segmentation = d.segmentation.usage;
    j.modele = d.segmentation.model;
    j.reflexion = d.segmentation.reflexion;
    const gu = (d.segmentation.usage ?? {}) as Record<string, unknown>;
    await note(job, 'google', 'segmentation', d.segmentation.model, 'succes', false, tokenCost(gu.promptTokenCount, gu.candidatesTokenCount, COST.gemini));
  }
  j.essais = d.essais;
  if (!d.best) throw new AgentError(SAY.failed, `aucun détourage exploitable (${j.essais.map((e) => `${e.methode}: ${e.echecs.join('+') || 'ok'}`).join(' ; ')})`);

  j.methode = d.best.method;
  j.controles = d.best.checks;
  await store(job, target, d.best.cut, 'photo', j, log);
}

/** La pièce rangée (PNG transparent), posée sur le fond voulu ; `null` si elle manque. */
async function pieceDecoupee(garmentId: string, fond: string): Promise<Img | null> {
  try {
    const { data } = await db.from('garments').select('image_path').eq('id', garmentId).maybeSingle();
    if (!data?.image_path) return null;
    const png = await download('garments', data.image_path as string);
    return { bytes: encodePng(surFond(decode(png.bytes, 'image/png'), fond)), mime: 'image/png' };
  } catch {
    return null;
  }
}

/**
 * Nano Banana redessine la pièce à partir de la photo, sur un fond uni retiré
 * ensuite : après deux « rendu incorrect », ou à la demande (« Image propre »).
 * C'est le seul endroit où une image est générée, donc le seul qui prend une
 * génération au compteur.
 */
async function redraw(job: Job, target: Target, sources: Img[], log: (m: string) => void, opts: { offert?: boolean; limite?: number } = {}) {
  const j: Journal = { version: CUTOUT.version, niveau: job.redo, ms: {}, usage: {} };
  // Le journal de la découpe (SAM 3) reste lisible après le dessin qui la remplace.
  if (job.cutout && 'sam' in job.cutout) j.sam = (job.cutout as { sam?: unknown }).sam;
  // « Image propre » (F3, 13/11) : la pièce déjà découpée passe en premier, posée
  // sur le fond voulu, car elle montre exactement quoi dessiner ; la photo
  // d'origine suit pour les détails cachés. Après deux « rendu incorrect », la
  // découpe est jugée fausse : la photo seule, comme avant.
  const fond = backdropFor(target.colors, target.hex, isMetal(target));
  const decoupe = (job.clean || job.dessin_auto) && job.garment_id ? await pieceDecoupee(job.garment_id, fond) : null;
  const references = decoupe ? [decoupe, ...sources] : sources;
  const prompt = consigneDessin(target, Boolean(decoupe));

  // L'offre décide du modèle et de la taille : Lite en 1K pour le gratuit, 2K pour les abonnées.
  const { data: planData } = await db.rpc('space_plan', { target: job.space_id });
  const plan = typeof planData === 'string' ? planData : 'decouverte';
  const { model } = imageSettings(plan, { free: MODELS.geminiLite, paid: MODELS.gemini });
  // 21/11 : toujours 1K. Le canevas final fait 1 024 px, donc le 2K n'apporte rien
  // à l'écran, et fal.ai rend un vrai 2K (3,9 Mo) dont le décodage et le détourage
  // dépassaient le temps de calcul de la fonction (« CPU Time exceeded » juste
  // après le dessin) : la pièce restait en simple découpe, une fois sur deux.
  const size: '1K' | '2K' = '1K';

  const photoHash = await sha256(sources[0].bytes);
  const pieceHash = await sha256(JSON.stringify([target.name, target.kind ?? null, target.box ?? null, target.colors, Boolean(decoupe)]));
  const key = cacheKey({ photoHash, pieceHash, model });

  await setJob(job, { status: 'generating', refined_prompt: prompt, image_model: model });

  let t = Date.now();
  let usage: unknown = null;
  let dessinePar = model;
  const ports: Ports<Img> = {
    cacheGet: async (k) => {
      const { data } = await db.from('generation_cache').select('image_path').eq('space_id', job.space_id).eq('cache_key', k).maybeSingle();
      if (!data) return null;
      try {
        return await download('ai-generated', data.image_path);
      } catch {
        return null; // fichier échu : on redessine
      }
    },
    cachePut: async (k, image) => {
      const path = `${job.space_id}/cache-${photoHash.slice(0, 16)}-${pieceHash.slice(0, 16)}.png`;
      await upload('ai-generated', path, image);
      await db.from('generation_cache').upsert({ space_id: job.space_id, cache_key: k, image_path: path });
    },
    // Dessin d'arrivée (18/11) : offert, il ne prend rien au compteur de la
    // personne ; son coût est noté à part (`note`, plus bas).
    reserve: opts.offert ? async () => ({ ok: true as const, logId: '', plan }) : async () => {
      const { data, error } = await db.rpc('generation_reserve', { p_user: job.requested_by, p_space: job.space_id, p_job: job.id, p_model: model });
      if (error) throw new AgentError(SAY.failed, `réservation de la génération : ${error.message}`);
      const r = data as { ok: boolean; log_id?: string; plan: string };
      return r.ok ? { ok: true, logId: r.log_id!, plan: r.plan } : { ok: false, plan: r.plan };
    },
    settle: opts.offert ? async () => undefined : async (logId, status, cost) => {
      const { error } = await db.rpc('generation_settle', { p_log: logId, p_status: status, p_cost: cost });
      if (error) throw new Error(error.message);
    },
    noteCacheHit: () => note(job, 'google', 'dessin', model, 'succes', true, 0),
    call: async () => {
      // Chaîne de relais (19/11) : le modèle de l'offre d'abord, d'autres s'il ne répond pas.
      const img = await dessiner(prompt, references, { model, size, limite: opts.limite });
      usage = img.usage;
      dessinePar = img.model;
      return { bytes: img.bytes, mime: img.mime };
    },
    isRejection: (e) => e instanceof AgentError && e.message === SAY.refused,
    cost: () => COST.image1k,
  };

  const drawn = await drawWithQuota(key, ports, plan);
  if (drawn.kind === 'empty') {
    // Aucune API appelée. La pièce reste telle qu'elle était, et la personne lit pourquoi.
    throw new AgentError(SAY.quota, `plus de génération (offre ${drawn.plan})`);
  }
  const img = drawn.image;
  if (opts.offert && drawn.kind === 'drawn') await note(job, dessinePar.startsWith(FAL) ? 'fal' : 'google', 'dessin', dessinePar, 'succes', false, COST.image1k);
  j.ms.generation = Date.now() - t;
  j.usage.generation = usage;
  j.modele = dessinePar;
  log(`Nano Banana ${dessinePar} (${size}${drawn.kind === 'cache' ? ', depuis le cache' : ''}) → ${Math.round(img.bytes.length / 1024)} Ko en ${j.ms.generation} ms`);

  await setJob(job, { status: 'cutout' });
  t = Date.now();
  // Un dessin en 2K est ramené à la taille de travail : le canevas final fait 1 024 px.
  const raw = decode(img.bytes, img.mime);
  const sized = Math.max(raw.width, raw.height) > 1500 ? downscale(raw, 1280) : raw;
  const lit = cutoutBackground(sized, { garment: garmentRgbs(target.colors, target.hex) });
  const { cut, oneShare } = cleanSpecks(lit);
  const checks = runChecks(cut, oneShare, target.hex?.[0] ?? null);
  j.ms.detourage = Date.now() - t;
  j.methode = 'generation';
  j.controles = checks;
  if (checks.failed.some((f) => BLOCKING.includes(f))) throw new AgentError(SAY.failed, `dessin inexploitable (${checks.failed.join(', ')})`);
  await store(job, target, cut, 'ai', j, log);
}

// ---------------------------------------------------------------- rangement

const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n) || null;

/** Met la pièce au format fixe, l'envoie, puis la crée dans le dressing (ou remplace son image). */
async function store(job: Job, t: Target, cut: Raster, source: 'photo' | 'ai', j: Journal, log: (m: string) => void) {
  let t0 = Date.now();
  if (job.cutout?.reperage) j.usage.reperage = job.cutout.reperage;
  const dominant = dominantColour(cut);
  const full = fitOnCanvas(cut);
  const [png, thumb] = [encodePng(full), encodePng(downscale(full, CUTOUT.thumb))];
  j.ms.format = Date.now() - t0;

  await setJob(job, { status: 'uploading' });
  t0 = Date.now();
  // Une image remplacée (reprise, image propre, dessin après la découpe) prend
  // un nouveau nom : l'app et le site ne gardent jamais l'ancienne en cache.
  const suffix = job.garment_id ? `-${Date.now().toString(36)}` : job.redo ? `-r${job.redo}` : '';
  const imagePath = `${job.space_id}/${job.id}${suffix}.png`;
  const thumbPath = `${job.space_id}/${job.id}${suffix}-vignette.png`;
  await Promise.all([
    upload('garments', imagePath, { bytes: png, mime: 'image/png' }),
    upload('garments', thumbPath, { bytes: thumb, mime: 'image/png' }),
  ]);
  j.ms.envoi = Date.now() - t0;

  // Les infos ajoutées par la personne valent pour une photo d'UNE pièce ;
  // sur une tenue entière on ne sait pas à laquelle elles se rapportent.
  const inv = job.analysis?.inventory;
  const single = !job.parent_id && !!inv && inv.pieces.length + inv.skipped === 1;
  const d = single ? job.details ?? {} : {};
  const tint = dominant?.hex ?? t.hex?.[0] ?? null;

  let garmentId = job.garment_id ?? undefined;
  if (garmentId) {
    // Reprise : l'image est remplacée, les infos de la fiche restent.
    const { data: old } = await db.from('garments').select('image_path, thumb_path').eq('id', garmentId).maybeSingle();
    const { error } = await db.from('garments').update({ image_path: imagePath, thumb_path: thumbPath, tint, source }).eq('id', garmentId);
    if (error) throw new Error(`remplacement de l'image : ${error.message}`);
    const stale = [old?.image_path, old?.thumb_path].filter((p): p is string => !!p && p !== imagePath && p !== thumbPath);
    if (stale.length) await db.storage.from('garments').remove(stale).catch(() => undefined);
  } else {
    // Un passage tué entre la création de la pièce et la fin de la tâche ne
    // doit pas la créer deux fois.
    const { data: existing } = await db.from('garments').select('id').eq('image_path', imagePath).maybeSingle();
    garmentId = existing?.id as string | undefined;
    if (!garmentId) {
      const { data: garment, error } = await db.from('garments').insert({
        space_id: job.space_id,
        category_id: t.category,
        kind: t.kind ?? null,
        name: t.name,
        colors: t.colors,
        // La saison et la fiche de style relevées au repérage (F5, 13/11) : Kodi
        // les lit pour composer, la météo écarte d'après la saison.
        season: t.saison ?? null,
        fiche: t.fiche ? { ...t.fiche, description: t.description.slice(0, 400) } : null,
        // La teinte mesurée sur les pixels de la pièce : la pastille de couleur de la fiche.
        tint,
        material: clip(d.material, 80) ?? (t.material || null),
        brand: clip(d.brand, 60),
        size: clip(d.size, 20),
        fit: clip(d.fit, 40),
        notes: clip(d.note, 280),
        image_path: imagePath,
        thumb_path: thumbPath,
        source,
      }).select('id').single();
      if (error) throw new Error(`création de la pièce : ${error.message}`);
      garmentId = garment.id;
    }
  }

  await setJob(job, { status: 'done', garment_id: garmentId, error: null, cutout: j, clean: false, dessin_auto: false });
  log(`rangée dans le dressing : ${t.name} (${j.methode}, ${Object.entries(j.ms).map(([k, v]) => `${k} ${v} ms`).join(', ')})`);
}

// ---------------------------------------------------------------- passage

/**
 * Le temps que le dessin peut prendre depuis le début du passage (20/11). La
 * fonction est tuée vers 150 s : le 20/11, trois modèles d'image qui pendaient
 * (75 s chacun) ont fait mourir quatre passages de suite sans repli. Le reste
 * (environ 45 s) est pour la découpe de secours. `DESSIN_BUDGET_MS` le règle.
 */
const DESSIN_BUDGET_MS = Math.max(30_000, Number(Deno.env.get('DESSIN_BUDGET_MS') ?? 100_000) || 100_000);

/** Passages accordés à une pièce dont le fournisseur a eu une panne passagère. */
const REPRISES_PASSAGERES = 3;

/**
 * Attente avant le passage suivant du dessin après découpe, selon le passage
 * qui vient d'échouer (le premier passage est la découpe) : 1 min après le 2e,
 * 3 après le 3e, 6 après le 4e, 10 après le 5e ; le 6e est le dernier.
 */
const ATTENTES_DESSIN_MIN = [1, 1, 3, 6, 10];

/** Délai après lequel `ai_jobs_sweep` remet en file un passage resté en route. */
const SWEEP_MIN = 4;

async function runOnce() {
  if (!IA_ACTIVE) {
    console.log('AI_ENABLED=false : aucune tâche prise, les photos attendent en file');
    return;
  }
  const started = Date.now();
  const { data, error } = await db.rpc('claim_ai_job');
  if (error) throw new Error(`prise de tâche : ${error.message}`);
  const job = (data as Job[] | null)?.[0];
  if (!job) return; // file vide : un autre passage l'a déjà prise

  const log = (m: string) => console.log(`[${job.id.slice(0, 8)}] ${m} (+${Date.now() - started} ms)`);
  log(`passage ${job.runs}${job.redo ? `, reprise ${job.redo}` : ''}${job.parent_id ? `, pièce repérée sur ${job.parent_id.slice(0, 8)}` : ''}`);

  try {
    const missing = KEYS.filter((k) => !Deno.env.get(k));
    if (missing.length) throw new AgentError(SAY.notReady, `${missing.join(', ')} absente(s) des secrets Supabase`);

    if (job.garment_id && !job.redo && !job.clean && !job.dessin_auto) {
      await setJob(job, { status: 'done', error: null });
      return;
    }
    if (job.runs > MAX_RUNS) throw new AgentError(SAY.failed, 'trop de passages');

    const sources = await loadSources(job);
    const target = job.target ?? await surveyPhoto(job, sources, log);
    // 20/11 : le dessin a un budget de temps, pour qu'il échoue proprement (et
    // laisse la place au repli) avant que la fonction soit tuée par sa durée maximale.
    const limite = started + DESSIN_BUDGET_MS;
    const arrivee = !job.garment_id && !job.redo && !job.clean;
    if (job.dessin_auto && job.garment_id) {
      // Second passage (20/11) : le dessin catalogue remplace la découpe déjà rangée.
      await redraw(job, targetOf(job), sources, log, { offert: true, limite });
    } else if (job.redo >= 2 || job.clean) await redraw(job, targetOf(job), sources, log, { limite });
    else if (DESSIN_PAR_DEFAUT && !job.garment_id && !job.redo) {
      // Sans clé fal.ai seulement depuis le 20/11 (voir DESSIN_PAR_DEFAUT).
      // 18/11 : une pièce qui arrive est d'abord REDESSINÉE seule sur un fond uni
      // puis détourée (c'est ce qui donnait des images nettes). La découpe dans la
      // photo, qui garde la peau et le décor sans masque Google, ne sert plus que
      // de repli quand le dessin échoue.
      try {
        await redraw(job, targetOf(job), sources, log, { offert: true, limite });
      } catch (err) {
        if (fatal(err)) throw err;
        log(`dessin impossible (${err instanceof AgentError ? err.detail ?? err.message : err instanceof Error ? err.message : err}) : repli sur la découpe`);
        await cutOut(job, target, sources, log);
      }
    } else {
      await cutOut(job, target, sources, log);
      if (arrivee && DESSIN_APRES_DECOUPE) {
        // La pièce est rangée (la personne la voit déjà) ; le dessin suit dans un autre passage.
        await setJob(job, { status: 'queued', dessin_auto: true });
        log('découpe rangée, dessin catalogue remis en file');
      }
    }
  } catch (err) {
    // La personne lit `error` dans son dressing : jamais de détail technique
    // ni de nom de modèle. Le détail part dans les journaux de la fonction.
    const message = err instanceof AgentError ? err.message : SAY.failed;
    const detail = err instanceof AgentError ? err.detail ?? err.message : err instanceof Error ? err.message : String(err);
    // 19/11 : une panne passagère du fournisseur (délai, réseau, 5xx, 429) ne
    // fait plus échouer la pièce. La tâche repart en file, sans message
    // d'erreur ; le ménage de chaque minute (`ai_jobs_sweep`) la réveille une
    // à deux minutes plus tard. Trois passages au plus, puis l'échec.
    // 21/11 : le dessin d'une pièce déjà rangée attend avant de repartir (1, 3,
    // 6 puis 10 minutes) : l'intermédiaire saturé répondait 429 aux trois
    // passages immédiats, et la découpe restait. La personne voit déjà sa pièce.
    // Sans changer la base : la tâche reste « generating » (l'app dit que Kodi
    // dessine) et le ménage de chaque minute (`ai_jobs_sweep`) la remet en file
    // quatre minutes après `claimed_at`, qu'on place donc à l'heure voulue.
    if (job.dessin_auto && job.garment_id && passager(err) && job.runs < MAX_RUNS) {
      const attente = ATTENTES_DESSIN_MIN[Math.min(job.runs, ATTENTES_DESSIN_MIN.length) - 1] ?? 10;
      log(`dessin en panne passagère, nouvel essai dans ${attente} min (passage ${job.runs}/${MAX_RUNS}) : ${detail}`);
      const reprise = Date.now() + (attente - SWEEP_MIN) * 60_000;
      await db.from('ai_jobs').update({ status: 'generating', error: null, claimed_at: new Date(reprise).toISOString() }).eq('id', job.id);
      return;
    }
    if (passager(err) && job.runs < REPRISES_PASSAGERES) {
      log(`panne passagère, remise en file (passage ${job.runs}/${REPRISES_PASSAGERES}) : ${detail}`);
      await db.from('ai_jobs').update({ status: 'queued', error: null }).eq('id', job.id);
      return;
    }
    log(`échec : ${detail}`);
    if (job.dessin_auto && job.garment_id) {
      // Le dessin après la découpe a échoué : la découpe reste, sans message pour la personne.
      await db.from('ai_jobs').update({ status: 'done', error: null, dessin_auto: false }).eq('id', job.id);
      return;
    }
    // Une reprise ratée laisse la pièce telle qu'elle était : seule la tâche garde la trace.
    await db.from('ai_jobs').update({ status: job.garment_id ? 'done' : 'failed', error: message, clean: false }).eq('id', job.id);
  }
}

/** L'appel vient-il du compte créateur (table `admins`) ? Le jeton est revalidé par `getUser`. */
async function estCreateur(req: Request): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  if (!data.user) return false;
  const { data: admin } = await db.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return Boolean(admin);
}

Deno.serve(async (req) => {
  // GET : état de la configuration, sans jamais révéler une clé.
  // GET ?verifier : interroge chaque fournisseur sur la fiche du modèle
  // (gratuit). Réservé au compte créateur depuis le 13/11 (I4) : la réponse
  // dit la famille et la longueur des clés et le recours à un intermédiaire.
  if (req.method === 'GET' && new URL(req.url).searchParams.has('verifier')) {
    if (!(await estCreateur(req))) return Response.json({ error: 'réservé au compte créateur' }, { status: 403 });
    return Response.json(await checkSetup());
  }
  if (req.method === 'GET') {
    const keys = Object.fromEntries(KEYS.map((k) => [k, Boolean(Deno.env.get(k))]));
    return Response.json({
      agent: 'dressy-agent', gabarit: CUTOUT.version, models: MODELS, effort: EFFORT, keys,
      ia: IA_ACTIVE, decoupe: cleFal() ? SAM_MODELE : 'gemini ou contraste', dessin_par_defaut: DESSIN_PAR_DEFAUT, dessin_apres_decoupe: DESSIN_APRES_DECOUPE,
    });
  }
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  // Un essai du banc (13/11) : seulement avec le jeton d'une ligne de banc_ia.
  const input = await req.json().catch(() => null) as { banc?: Record<string, unknown> } | null;
  if (input?.banc) return lancerBanc(db, input.banc, MODES_AGENT, (p) => EdgeRuntime.waitUntil(p));

  EdgeRuntime.waitUntil(
    runOnce().catch((err) => console.error('passage :', err instanceof Error ? err.message : err)),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
