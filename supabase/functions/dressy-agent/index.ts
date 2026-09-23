/**
 * L'agent central de Dressy.
 *
 * Réveillé par la base (trigger sur ai_jobs, filet pg_cron), il prend la
 * pièce la plus ancienne en file et fait UN pas :
 *
 *   ChatGPT décrit la photo et écrit la consigne
 *   → Nano Banana redessine la pièce, seule, sur fond uni
 *   → Claude compare à la photo et note sur 100
 *   → validée (≥ 95) : détourage, vignette, rangement dans le dressing
 *   → sinon : remise en file pour un nouvel essai corrigé (3 au plus),
 *     puis Claude choisit la meilleure des trois.
 *
 * Un passage = un essai, pour tenir sous la limite de durée d'une Edge
 * Function. L'état complet est en base : un passage tué en route reprend
 * sans repayer ce qui a déjà été généré.
 *
 * L'appel HTTP ne porte aucune donnée de confiance, c'est un simple réveil
 * (déployé sans vérification JWT) : l'agent ne traite que ce qui est déjà
 * en file, donc déjà passé par la RLS et le quota à l'insertion.
 */
import { createClient } from '@supabase/supabase-js';
import { planRun, isValidated, bestByScore, type Candidate } from './decide.ts';
import { backdropClause } from './prompts.ts';
import { describe, generate, judge, pickBest, checkSetup, AgentError, MODELS, KEYS, type Img, type Usage } from './steps.ts';
import { cutoutBackground, alphaRatio, cropToContent, downscale } from './cutout.ts';
import { decode, encodePng, sniffMime } from './codec.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

type Analysis = {
  name: string;
  category: string;
  colors: string[];
  material: string;
  description: string;
};

type Job = {
  id: string;
  space_id: string;
  user_input: string;
  source_paths: string[];
  analysis: Analysis | null;
  attempts: number;
  runs: number;
  garment_id: string | null;
};

// Un passage qui a déjà consommé ce temps remet la pièce en file plutôt que
// d'enchaîner le jugement : la limite d'une Edge Function est de 150 s.
const BUDGET_MS = 75_000;

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
  if (error || !data) throw new AgentError(`Image introuvable (${bucket}/${path}).`);
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
    if (!p.startsWith(`${job.space_id}/`)) throw new AgentError('Photo hors de ton espace.');
  }
  if (!job.source_paths.length) throw new AgentError('Aucune photo à traiter.');
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

// ---------------------------------------------------------------- étapes

async function attempt(job: Job, n: number, previous: Candidate | null, started: number, log: (m: string) => void) {
  const sources = await loadSources(job);
  const { data: profile } = await db.from('style_profile').select('gender').eq('space_id', job.space_id).maybeSingle();

  const d = await describe({
    sources,
    hint: job.user_input,
    gender: profile?.gender ?? null,
    previous: previous && { attempt: previous.attempt, score: previous.score, ecarts: previous.ecarts, prompt: previous.prompt },
  });
  log(`ChatGPT → ${d.name} (${d.category}, ${d.colors.join('/') || 'couleur ?'})`);

  const prompt = `${d.prompt.trim()}\n\n${backdropClause(d.colors)}`;
  const analysis: Analysis = {
    name: d.name, category: d.category, colors: d.colors, material: d.material, description: d.description,
  };
  await setJob(job, {
    status: 'generating', analysis, refined_prompt: prompt,
    prompt_model: MODELS.openai, image_model: MODELS.gemini,
  });

  const img = await generate(prompt, sources);
  log(`Nano Banana → ${Math.round(img.bytes.length / 1024)} Ko (${img.mime})`);

  const ext = img.mime === 'image/jpeg' ? 'jpg' : img.mime === 'image/webp' ? 'webp' : 'png';
  const path = `${job.space_id}/${job.id}/essai-${n}.${ext}`;
  await upload('ai-generated', path, img);

  const { data: row, error } = await db.from('ai_images').insert({
    job_id: job.id, space_id: job.space_id, storage_path: path, attempt: n,
    prompt, mime: img.mime, bytes: img.bytes.length,
    critique: { usage: { openai: d.usage, gemini: img.usage } },
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

  const v = await judge({
    sources,
    generated: img,
    description: job.analysis?.description ?? '',
    prompt: row.prompt ?? '',
  });
  const ok = isValidated(v);
  const n = row.attempt ?? 0;

  const { usage, ...verdict } = v;
  const { error } = await db.from('ai_images').update({
    score: v.score,
    validated: ok,
    critique: {
      ...verdict,
      model: MODELS.claude,
      usage: { ...(row.critique?.usage ?? {}), claude: usage },
    },
  }).eq('id', row.id);
  if (error) throw new Error(`enregistrement du verdict : ${error.message}`);

  await setJob(job, { attempts: n });
  log(`Claude → ${v.score}/100${ok ? ', validée' : ` — ${v.ecarts[0] ?? 'sous le seuil'}`}`);

  if (ok) {
    await finalize(job, { ...toCandidate(row), score: v.score, validated: true }, img, log);
    return;
  }
  // Pas validée : le passage suivant refait un essai corrigé, ou fait
  // choisir Claude si c'était le troisième.
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
    const pick = await pickBest(sources, candidates.map((c, i) => ({ img: imgs[i], score: c.score })));
    chosen = candidates[pick.index];
    log(`Claude choisit l'essai ${chosen.attempt} : ${pick.raison}`);
  } catch (err) {
    // Faute de choix de Claude, on garde la meilleure note plutôt que de
    // perdre trois générations déjà payées.
    log(`choix de Claude impossible (${err instanceof Error ? err.message : err}) : meilleure note retenue`);
  }

  await db.from('ai_images').update({ chosen: true }).eq('id', chosen.id);
  return { ...chosen, chosen: true };
}

async function finalize(job: Job, c: Candidate, img: Img | null, log: (m: string) => void) {
  const a = job.analysis;
  if (!a) throw new AgentError('Description de la pièce perdue : relance-la.');

  await setJob(job, { status: 'cutout' });
  const source = img ?? await download('ai-generated', c.storage_path);

  const t0 = Date.now();
  const cut = cutoutBackground(decode(source.bytes, source.mime));
  const ratio = alphaRatio(cut);
  const framed = cropToContent(cut);
  const full = encodePng(framed);
  const thumb = encodePng(downscale(framed, 320));
  log(`détourage : ${(ratio * 100).toFixed(1)} % transparent, ${framed.width}×${framed.height}, ${Date.now() - t0} ms`);

  await setJob(job, { status: 'uploading' });
  const imagePath = `${job.space_id}/${job.id}.png`;
  const thumbPath = `${job.space_id}/${job.id}-vignette.png`;
  await upload('garments', imagePath, { bytes: full, mime: 'image/png' });
  await upload('garments', thumbPath, { bytes: thumb, mime: 'image/png' });

  // Un passage tué entre la création de la pièce et la fin de la tâche ne
  // doit pas la créer deux fois.
  const { data: existing } = await db.from('garments').select('id').eq('image_path', imagePath).maybeSingle();
  let garmentId = existing?.id as string | undefined;
  if (!garmentId) {
    const { data: garment, error } = await db.from('garments').insert({
      space_id: job.space_id,
      category_id: a.category,
      name: a.name,
      colors: a.colors,
      material: a.material || null,
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

  await setJob(job, { status: 'done', garment_id: garmentId, error: null });
  log(`rangée dans le dressing : ${a.name}`);
}

// ---------------------------------------------------------------- passage

async function runOnce() {
  const started = Date.now();
  const { data, error } = await db.rpc('claim_ai_job');
  if (error) throw new Error(`prise de tâche : ${error.message}`);
  const job = (data as Job[] | null)?.[0];
  if (!job) return; // file vide : un autre passage l'a déjà prise

  const log = (m: string) => console.log(`[${job.id.slice(0, 8)}] ${m} (+${Date.now() - started} ms)`);
  log(`passage ${job.runs}, ${job.attempts} essai(s) déjà jugé(s)`);

  try {
    const missing = KEYS.filter((k) => !Deno.env.get(k));
    if (missing.length) {
      throw new AgentError(`Clé${missing.length > 1 ? 's' : ''} ${missing.join(', ')} absente${missing.length > 1 ? 's' : ''} des secrets Supabase (Edge Functions → Secrets).`);
    }

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
    const message = err instanceof AgentError
      ? err.message
      : `Erreur inattendue : ${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`;
    log(`échec : ${message}`);
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
    return Response.json({ agent: 'dressy-agent', models: MODELS, keys });
  }
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  EdgeRuntime.waitUntil(
    runOnce().catch((err) => console.error('passage :', err instanceof Error ? err.message : err)),
  );
  return Response.json({ accepted: true }, { status: 202 });
});
