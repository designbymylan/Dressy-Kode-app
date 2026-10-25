/**
 * L'agent central de Dresskode.
 *
 * Réveillé par la base (trigger sur ai_jobs, filet pg_cron), il prend la
 * tâche la plus ancienne en file et la traite d'UN passage :
 *
 *   photo confiée → Sonnet 5 repère TOUTES les pièces (ou celles que la
 *     personne a nommées) ; la tâche garde la première et crée une tâche fille
 *     par pièce en plus, que d'autres passages traitent en parallèle ;
 *   pièce → Gemini segmente la pièce (un masque, pas une image) et elle est
 *     DÉCOUPÉE dans la photo : ses pixels, ses couleurs, ses marquages sont
 *     ceux de la personne, rien n'est redessiné ;
 *     → contrôles automatiques (couverture, une seule pièce, bord net, taille,
 *       couleur dominante) ; sinon repli sur un détourage par contraste ;
 *     → mise au format fixe (canevas carré, marges, pièce centrée), vignette,
 *       rangement dans le dressing.
 *
 * « Rendu incorrect » (fiche pièce) remet la tâche en file : 1re fois, la
 * découpe reprend avec le modèle le plus fort ; 2e fois seulement, Nano Banana
 * redessine la pièce. C'est le seul cas de génération d'image.
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
import { backdropClause, colourClause, garmentRgbs, isMetal, isolationClause, stripClauses, type Target } from './prompts.ts';
import { survey, segment, generate, checkSetup, AgentError, SAY, MODELS, EFFORT, KEYS, type Img } from './steps.ts';
import { cutoutBackground, crop, downscale, type Raster } from './cutout.ts';
import { decode, encodePng, sniffMime } from './codec.ts';
import { CUTOUT } from './config.ts';
import { dominantColour } from './color.ts';
import { exifOrientation, fitOnCanvas, orient } from './normalize.ts';
import { cleanSpecks, cutFromMask, pickSegment, pixelBox } from './segment.ts';
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
    log(`repérage (${MODELS.survey}) → ${found.pieces.length} pièce(s) en ${Date.now() - t0} ms : ${found.pieces.map((p) => p.name).join(', ') || found.note}`);
    if (!found.pieces.length) throw new AgentError(SAY.nothing, found.note || 'aucune pièce repérée');

    // La photo compte déjà pour une pièce dans la limite de l'offre ; les
    // pièces en plus ne sont créées que s'il reste de la place.
    const { data: left } = await db.rpc('pieces_left', { target: job.space_id });
    const room = left === null || left === undefined ? Infinity : Math.max(0, Number(left));
    const extra = Math.min(found.pieces.length - 1, room);
    inv = { pieces: found.pieces.slice(0, 1 + extra), note: found.note, skipped: found.pieces.length - 1 - extra };
    await setJob(job, { analysis: { inventory: inv }, prompt_model: MODELS.survey, cutout: { reperage: { ms: Date.now() - t0, usage: found.usage } } });
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

type Cand = { method: 'masque' | 'contraste'; cut: Raster; checks: Checks };

type Journal = {
  version: string;
  niveau: number;
  methode?: string;
  modele?: string;
  controles?: Checks;
  essais?: { methode: string; echecs: string[] }[];
  ms: Record<string, number>;
  usage: Record<string, unknown>;
};

const bytesOf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const fatal = (err: unknown) => err instanceof AgentError && (err.message === SAY.busy || err.message === SAY.notReady);

/**
 * La photo, décodée, remise debout (jpeg-js ne lit pas l'orientation EXIF) et
 * ramenée à 1 800 px au plus : la pièce finit sur un canevas de 1 024 px, et
 * le temps de calcul d'une Edge Function est compté (un iPhone envoie 12 Mpx).
 */
function open(photo: Img): Raster {
  if (photo.mime !== 'image/jpeg' && photo.mime !== 'image/png') throw new AgentError(SAY.photo, `format non géré : ${photo.mime}`);
  const raster = decode(photo.bytes, photo.mime);
  const upright = photo.mime === 'image/jpeg' ? orient(raster, exifOrientation(photo.bytes)) : raster;
  return Math.max(upright.width, upright.height) > 2000 ? downscale(upright, 1800) : upright;
}

/**
 * Découpe la pièce dans la photo : masque de Gemini d'abord ; si les contrôles
 * automatiques le refusent, un détourage par contraste du cadre repéré ; le
 * meilleur des deux est gardé. Une image sans couverture ou trop petite n'est
 * jamais gardée.
 */
async function cutOut(job: Job, target: Target, sources: Img[], log: (m: string) => void) {
  await setJob(job, { status: 'cutout', image_model: MODELS.segment });
  const j: Journal = { version: CUTOUT.version, niveau: job.redo, ms: {}, usage: {} };
  const photo = sources[0];

  let t = Date.now();
  const raster = open(photo);
  j.ms.decodage = Date.now() - t;
  const expected = target.hex?.[0] ?? null;
  const cands: Cand[] = [];

  try {
    t = Date.now();
    const seg = await segment(photo, target, { strong: job.redo >= 1 });
    j.ms.segmentation = Date.now() - t;
    j.usage.segmentation = seg.usage;
    j.modele = seg.model;
    const chosen = pickSegment(seg.segments, job.redo >= 1 ? null : target.box);
    if (!chosen?.mask) {
      log(`segmentation (${seg.model}) : aucun masque`);
    } else {
      t = Date.now();
      const maskBytes = bytesOf(chosen.mask);
      const mask = decode(maskBytes, sniffMime(maskBytes) ?? 'image/png');
      const region = pixelBox(chosen.box, raster.width, raster.height);
      const { cut, oneShare } = cleanSpecks(cutFromMask(raster, mask, chosen.box, region));
      cands.push({ method: 'masque', cut, checks: runChecks(cut, oneShare, expected) });
      j.ms.masque = Date.now() - t;
      log(`segmentation (${seg.model}) : ${j.ms.segmentation} ms, contrôles ${cands[0].checks.ok ? 'ok' : cands[0].checks.failed.join(', ')}`);
    }
  } catch (err) {
    if (fatal(err)) throw err;
    log(`segmentation impossible (${err instanceof AgentError ? err.detail ?? err.message : err instanceof Error ? err.message : err}) : repli sur le contraste`);
  }

  if (!cands.some((c) => c.checks.ok)) {
    t = Date.now();
    const region = target.box ? pixelBox(target.box, raster.width, raster.height, 0.08) : { x: 0, y: 0, w: raster.width, h: raster.height };
    const lit = cutoutBackground(crop(raster, region), { garment: garmentRgbs(target.colors, target.hex) });
    const { cut, oneShare } = cleanSpecks(lit);
    cands.push({ method: 'contraste', cut, checks: runChecks(cut, oneShare, expected) });
    j.ms.contraste = Date.now() - t;
    log(`détourage par contraste : contrôles ${cands.at(-1)!.checks.ok ? 'ok' : cands.at(-1)!.checks.failed.join(', ')}`);
  }

  j.essais = cands.map((c) => ({ methode: c.method, echecs: c.checks.failed }));
  const usable = cands.filter((c) => !c.checks.failed.some((f) => BLOCKING.includes(f)));
  const best = usable.find((c) => c.checks.ok) ?? [...usable].sort((a, b) => a.checks.failed.length - b.checks.failed.length)[0];
  if (!best) throw new AgentError(SAY.failed, `aucun détourage exploitable (${j.essais.map((e) => `${e.methode}: ${e.echecs.join('+') || 'ok'}`).join(' ; ')})`);

  j.methode = best.method;
  j.controles = best.checks;
  await store(job, target, best.cut, 'photo', j, log);
}

/**
 * Dernier recours, après deux « rendu incorrect » : Nano Banana redessine la
 * pièce à partir de la photo, sur un fond uni retiré ensuite. C'est le seul
 * endroit où une image est générée.
 */
async function redraw(job: Job, target: Target, sources: Img[], log: (m: string) => void) {
  const j: Journal = { version: CUTOUT.version, niveau: job.redo, ms: {}, usage: {} };
  const prompt = [
    stripClauses(target.prompt),
    colourClause(target),
    isolationClause(target),
    backdropClause(target.colors, target.hex, isMetal(target)),
  ].filter(Boolean).join('\n\n');

  await setJob(job, { status: 'generating', refined_prompt: prompt, image_model: MODELS.gemini });
  let t = Date.now();
  const img = await generate(prompt, sources);
  j.ms.generation = Date.now() - t;
  j.usage.generation = img.usage;
  j.modele = MODELS.gemini;
  log(`Nano Banana → ${Math.round(img.bytes.length / 1024)} Ko en ${j.ms.generation} ms`);

  await setJob(job, { status: 'cutout' });
  t = Date.now();
  const lit = cutoutBackground(decode(img.bytes, img.mime), { garment: garmentRgbs(target.colors, target.hex) });
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
  const suffix = job.redo ? `-r${job.redo}` : '';
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

  await setJob(job, { status: 'done', garment_id: garmentId, error: null, cutout: j });
  log(`rangée dans le dressing : ${t.name} (${j.methode}, ${Object.entries(j.ms).map(([k, v]) => `${k} ${v} ms`).join(', ')})`);
}

// ---------------------------------------------------------------- passage

async function runOnce() {
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

    if (job.garment_id && !job.redo) {
      await setJob(job, { status: 'done', error: null });
      return;
    }
    if (job.runs > MAX_RUNS) throw new AgentError(SAY.failed, 'trop de passages');

    const sources = await loadSources(job);
    const target = job.target ?? await surveyPhoto(job, sources, log);
    if (job.redo >= 2) await redraw(job, targetOf(job), sources, log);
    else await cutOut(job, target, sources, log);
  } catch (err) {
    // La personne lit `error` dans son dressing : jamais de détail technique
    // ni de nom de modèle. Le détail part dans les journaux de la fonction.
    const message = err instanceof AgentError ? err.message : SAY.failed;
    const detail = err instanceof AgentError ? err.detail ?? err.message : err instanceof Error ? err.message : String(err);
    log(`échec : ${detail}`);
    // Une reprise ratée laisse la pièce telle qu'elle était : seule la tâche garde la trace.
    await db.from('ai_jobs').update({ status: job.garment_id ? 'done' : 'failed', error: message }).eq('id', job.id);
  }
}

Deno.serve(async (req) => {
  // GET : état de la configuration, sans jamais révéler une clé.
  // GET ?verifier : interroge chaque fournisseur sur la fiche du modèle (gratuit).
  if (req.method === 'GET' && new URL(req.url).searchParams.has('verifier')) {
    return Response.json(await checkSetup());
  }
  if (req.method === 'GET') {
    const keys = Object.fromEntries(KEYS.map((k) => [k, Boolean(Deno.env.get(k))]));
    return Response.json({ agent: 'dressy-agent', gabarit: CUTOUT.version, models: MODELS, effort: EFFORT, keys });
  }
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  EdgeRuntime.waitUntil(
    runOnce().catch((err) => console.error('passage :', err instanceof Error ? err.message : err)),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
