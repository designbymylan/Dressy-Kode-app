/**
 * L'agent central de Dresskode.
 *
 * Réveillé par la base (trigger sur ai_jobs, filet pg_cron), il prend la
 * tâche la plus ancienne en file et la fait avancer d'UN pas :
 *
 *   photo confiée → Opus 5 repère TOUTES les pièces (ou celles que la
 *     personne a nommées) et écrit la consigne de chacune ; la tâche garde
 *     la première pièce et crée une tâche fille par pièce en plus, que
 *     d'autres passages traitent en parallèle ;
 *   pièce → Nano Banana la redessine, seule, sur fond uni
 *     → Sonnet 5 compare à la photo et note sur 100
 *     → validée (≥ 88) : détourage, vignette, rangement dans le dressing
 *     → sinon : Opus 5 corrige la consigne pour un second essai, puis le
 *       contrôle garde la meilleure des deux images.
 *
 * L'état complet est en base : un passage tué en route reprend sans repayer
 * ce qui a déjà été fait (repérage, images générées).
 *
 * L'appel HTTP ne porte aucune donnée de confiance, c'est un simple réveil
 * (déployé sans vérification JWT) : l'agent ne traite que ce qui est déjà
 * en file, donc déjà passé par la RLS et le quota à l'insertion.
 */
import { createClient } from '@supabase/supabase-js';
import { planRun, isValidated, bestByScore, type Candidate } from './decide.ts';
import { backdropClause, isolationClause, type Target } from './prompts.ts';
import { inventory, refine, generate, judge, pickBest, checkSetup, AgentError, SAY, MODELS, EFFORT, KEYS, type Img, type Usage } from './steps.ts';
import { cutoutBackground, alphaRatio, contentBox, crop, downscale } from './cutout.ts';
import { decode, encodePng, sniffMime } from './codec.ts';

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
};

// Un passage qui a déjà consommé ce temps remet la pièce en file plutôt que
// d'enchaîner le jugement : la limite d'une Edge Function est de 150 s.
const BUDGET_MS = 85_000;

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

type ImageRow = {
  id: string;
  attempt: number | null;
  storage_path: string;
  mime: string | null;
  prompt: string | null;
  score: number | null;
  validated: boolean;
  chosen: boolean;
  critique: { ecarts?: string[]; usage?: Record<string, Usage> } | null;
};

const toCandidate = (r: ImageRow): Candidate => ({
  id: r.id,
  attempt: r.attempt ?? 0,
  storage_path: r.storage_path,
  mime: r.mime,
  prompt: r.prompt,
  score: r.score,
  validated: r.validated,
  chosen: r.chosen,
  ecarts: r.critique?.ecarts ?? [],
});

async function loadCandidates(job: Job): Promise<{ rows: ImageRow[]; candidates: Candidate[] }> {
  const { data, error } = await db
    .from('ai_images')
    .select('id, attempt, storage_path, mime, prompt, score, validated, chosen, critique')
    .eq('job_id', job.id)
    .order('attempt');
  if (error) throw new Error(`lecture des essais : ${error.message}`);
  const rows = (data ?? []) as ImageRow[];
  return { rows, candidates: rows.map(toCandidate) };
}

/** La fiche de la pièce ; les tâches d'avant le repérage gardaient la leur dans `analysis`. */
function targetOf(job: Job): Target {
  const t = job.target ?? (job.analysis?.name ? job.analysis as Target : null);
  if (!t) throw new AgentError(SAY.failed, 'fiche de la pièce perdue');
  return { ...t, where: t.where ?? '', prompt: t.prompt ?? '' };
}

// ---------------------------------------------------------------- repérage

/**
 * Opus 5 repère les pièces de la photo. La tâche garde la première ; les
 * suivantes deviennent des tâches filles, réveillées aussitôt par le
 * déclencheur d'insertion : elles se dessinent en même temps.
 *
 * Le résultat du repérage est écrit AVANT la création des filles : un
 * passage tué entre les deux reprend sans rappeler Opus ni créer de
 * doublons.
 */
async function survey(job: Job, sources: Img[], log: (m: string) => void): Promise<Target> {
  let inv = job.analysis?.inventory;

  if (!inv) {
    const { data: profile } = await db.from('style_profile').select('gender').eq('space_id', job.space_id).maybeSingle();
    const found = await inventory({ sources, hint: job.user_input, gender: profile?.gender ?? null });
    log(`Opus (repérage) → ${found.pieces.length} pièce(s) : ${found.pieces.map((p) => p.name).join(', ') || found.note}`);
    if (!found.pieces.length) throw new AgentError(SAY.nothing, found.note || 'aucune pièce repérée');

    // La photo compte déjà pour une pièce dans la limite de l'offre ; les
    // pièces en plus ne sont créées que s'il reste de la place.
    const { data: left } = await db.rpc('pieces_left', { target: job.space_id });
    const room = left === null || left === undefined ? Infinity : Math.max(0, Number(left));
    const extra = Math.min(found.pieces.length - 1, room);
    inv = { pieces: found.pieces.slice(0, 1 + extra), note: found.note, skipped: found.pieces.length - 1 - extra };
    await setJob(job, { analysis: { inventory: inv }, prompt_model: MODELS.prompts });
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

// ---------------------------------------------------------------- étapes

async function attempt(job: Job, n: number, previous: Candidate | null, started: number, log: (m: string) => void) {
  const sources = await loadSources(job);
  const target = job.target ?? await survey(job, sources, log);

  let base = target.prompt;
  const usage: Record<string, Usage> = {};
  if (previous) {
    await setJob(job, { status: 'prompting' });
    const r = await refine({
      sources,
      target,
      previous: { attempt: previous.attempt, score: previous.score, ecarts: previous.ecarts, prompt: previous.prompt },
    });
    base = r.prompt;
    usage.consigne = r.usage;
    log(`Opus (nouvelle consigne) → essai ${n}`);
  }

  const prompt = `${base.trim()}\n\n${isolationClause(target)}\n\n${backdropClause(target.colors)}`;
  const { prompt: _p, where: _w, ...fiche } = target;
  await setJob(job, {
    status: 'generating',
    analysis: { ...fiche, where: target.where, inventory: job.analysis?.inventory },
    refined_prompt: prompt,
    prompt_model: MODELS.prompts,
    image_model: MODELS.gemini,
  });

  const img = await generate(prompt, sources);
  log(`Nano Banana → ${Math.round(img.bytes.length / 1024)} Ko (${img.mime})`);

  const ext = img.mime === 'image/jpeg' ? 'jpg' : img.mime === 'image/webp' ? 'webp' : 'png';
  const path = `${job.space_id}/${job.id}/essai-${n}.${ext}`;
  await upload('ai-generated', path, img);

  const { data: row, error } = await db.from('ai_images').insert({
    job_id: job.id, space_id: job.space_id, storage_path: path, attempt: n,
    prompt, mime: img.mime, bytes: img.bytes.length,
    critique: { usage: { ...usage, image: img.usage } },
  }).select('id, attempt, storage_path, mime, prompt, score, validated, chosen, critique').single();
  if (error) throw new Error(`enregistrement de l'essai : ${error.message}`);

  if (Date.now() - started > BUDGET_MS) {
    // Le jugement se fera au passage suivant (plan « judge »), sans regénérer.
    log('temps écoulé : jugement reporté au passage suivant');
    await setJob(job, { status: 'queued' });
    return;
  }
  await verify(job, row as ImageRow, img, sources, log);
}

async function verify(job: Job, row: ImageRow, img: Img, sources: Img[], log: (m: string) => void) {
  await setJob(job, { status: 'verifying' });

  const v = await judge({ sources, generated: img, target: targetOf(job), prompt: row.prompt ?? '' });
  const ok = isValidated(v);
  const n = row.attempt ?? 0;

  const { usage, ...verdict } = v;
  const { error } = await db.from('ai_images').update({
    score: v.score,
    validated: ok,
    critique: {
      ...verdict,
      model: MODELS.judge,
      usage: { ...(row.critique?.usage ?? {}), controle: usage },
    },
  }).eq('id', row.id);
  if (error) throw new Error(`enregistrement du verdict : ${error.message}`);

  await setJob(job, { attempts: n });
  log(`Sonnet (contrôle) → ${v.score}/100${ok ? ', validée' : `, ${v.ecarts[0] ?? 'sous le seuil'}`}`);

  if (ok) {
    await finalize(job, { ...toCandidate(row), score: v.score, validated: true }, img, log);
    return;
  }
  // Pas validée : le passage suivant refait un essai corrigé, ou fait
  // choisir le contrôle si c'était le dernier.
  await setJob(job, { status: 'queued' });
}

async function choose(job: Job, candidates: Candidate[], log: (m: string) => void): Promise<Candidate> {
  await setJob(job, { status: 'selecting' });

  let chosen = bestByScore(candidates);
  try {
    const [sources, imgs] = await Promise.all([
      loadSources(job),
      Promise.all(candidates.map((c) => download('ai-generated', c.storage_path))),
    ]);
    const pick = await pickBest(sources, targetOf(job), candidates.map((c, i) => ({ img: imgs[i], score: c.score })));
    chosen = candidates[pick.index];
    log(`le contrôle choisit l'essai ${chosen.attempt} : ${pick.raison}`);
  } catch (err) {
    // Faute de choix, on garde la meilleure note plutôt que de perdre des
    // générations déjà payées.
    log(`choix impossible (${err instanceof AgentError ? err.detail : err instanceof Error ? err.message : err}) : meilleure note retenue`);
  }

  await db.from('ai_images').update({ chosen: true }).eq('id', chosen.id);
  return { ...chosen, chosen: true };
}

async function finalize(job: Job, c: Candidate, img: Img | null, log: (m: string) => void) {
  const t = targetOf(job);

  await setJob(job, { status: 'cutout' });
  const source = img ?? await download('ai-generated', c.storage_path);

  const t0 = Date.now();
  const cut = cutoutBackground(decode(source.bytes, source.mime));
  const ratio = alphaRatio(cut);
  const box = contentBox(cut) ?? { x: 0, y: 0, w: cut.width, h: cut.height };
  const framed = crop(cut, box);
  const [full, thumb] = [encodePng(framed), encodePng(downscale(framed, 320))];
  log(`détourage : ${(ratio * 100).toFixed(1)} % transparent, ${framed.width}×${framed.height}, ${Date.now() - t0} ms`);

  await setJob(job, { status: 'uploading' });
  const imagePath = `${job.space_id}/${job.id}.png`;
  const thumbPath = `${job.space_id}/${job.id}-vignette.png`;
  await Promise.all([
    upload('garments', imagePath, { bytes: full, mime: 'image/png' }),
    upload('garments', thumbPath, { bytes: thumb, mime: 'image/png' }),
  ]);

  // Un passage tué entre la création de la pièce et la fin de la tâche ne
  // doit pas la créer deux fois.
  const { data: existing } = await db.from('garments').select('id').eq('image_path', imagePath).maybeSingle();
  let garmentId = existing?.id as string | undefined;
  if (!garmentId) {
    const { data: garment, error } = await db.from('garments').insert({
      space_id: job.space_id,
      category_id: t.category,
      kind: t.kind ?? null,
      name: t.name,
      colors: t.colors,
      material: t.material || null,
      image_path: imagePath,
      thumb_path: thumbPath,
      source: 'ai',
    }).select('id').single();
    if (error) throw new Error(`création de la pièce : ${error.message}`);
    garmentId = garment.id;
  }

  // Un détourage qui n'enlève presque rien, ou presque tout, est suspect : on
  // garde la pièce mais on le note.
  await db.from('ai_images').update({
    chosen: true,
    has_alpha: ratio > 0.05 && ratio < 0.95,
    width: framed.width,
    height: framed.height,
  }).eq('id', c.id);

  // Pour le « détourage révélé » : l'image générée, avec son fond, et
  // l'endroit où la pièce y a été découpée. L'écran les superpose.
  const reveal = { raw: c.storage_path, size: [cut.width, cut.height], box: [box.x, box.y, box.w, box.h] };
  await setJob(job, { status: 'done', garment_id: garmentId, error: null, analysis: { ...(job.analysis ?? {}), reveal } });
  log(`rangée dans le dressing : ${t.name}`);
}

// ---------------------------------------------------------------- passage

async function runOnce() {
  const started = Date.now();
  const { data, error } = await db.rpc('claim_ai_job');
  if (error) throw new Error(`prise de tâche : ${error.message}`);
  const job = (data as Job[] | null)?.[0];
  if (!job) return; // file vide : un autre passage l'a déjà prise

  const log = (m: string) => console.log(`[${job.id.slice(0, 8)}] ${m} (+${Date.now() - started} ms)`);
  log(`passage ${job.runs}, ${job.attempts} essai(s) déjà jugé(s)${job.parent_id ? `, pièce repérée sur ${job.parent_id.slice(0, 8)}` : ''}`);

  try {
    const missing = KEYS.filter((k) => !Deno.env.get(k));
    if (missing.length) throw new AgentError(SAY.notReady, `${missing.join(', ')} absente(s) des secrets Supabase`);

    if (job.garment_id) {
      await setJob(job, { status: 'done', error: null });
      return;
    }

    const { candidates, rows } = await loadCandidates(job);
    const plan = planRun(job.runs, candidates);

    switch (plan.kind) {
      case 'fail':
        throw new AgentError(plan.reason);
      case 'finalize':
        await finalize(job, plan.candidate, null, log);
        break;
      case 'judge': {
        const row = rows.find((r) => r.id === plan.candidate.id)!;
        const [sources, img] = await Promise.all([
          loadSources(job),
          download('ai-generated', plan.candidate.storage_path),
        ]);
        await verify(job, row, img, sources, log);
        break;
      }
      case 'attempt':
        await attempt(job, plan.attempt, plan.previous, started, log);
        break;
      case 'select': {
        const chosen = await choose(job, plan.candidates, log);
        await finalize(job, chosen, null, log);
        break;
      }
    }
  } catch (err) {
    // La personne lit `error` dans son dressing : jamais de détail technique
    // ni de nom de modèle. Le détail part dans les journaux de la fonction.
    const message = err instanceof AgentError ? err.message : SAY.failed;
    const detail = err instanceof AgentError ? err.detail ?? err.message : err instanceof Error ? err.message : String(err);
    log(`échec : ${detail}`);
    await db.from('ai_jobs').update({ status: 'failed', error: message }).eq('id', job.id);
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
    return Response.json({ agent: 'dressy-agent', models: MODELS, effort: EFFORT, keys });
  }
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  EdgeRuntime.waitUntil(
    runOnce().catch((err) => console.error('passage :', err instanceof Error ? err.message : err)),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
