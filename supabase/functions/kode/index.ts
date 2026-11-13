/**
 * Kodi, le styliste de Dresskode.
 *
 * Reçoit une question de la personne connectée, relit son dressing, son
 * profil et son agenda, et fait répondre Claude, avec, quand la question
 * s'y prête, une tenue composée uniquement de pièces qu'elle possède.
 *
 *   POST { question }  →  { question_id, reply_id }
 *
 * Prévoit aussi plusieurs jours d'un coup (07/10) : une tenue par jour, qui
 * tient compte des rendez-vous de chaque jour (heure, type, importance,
 * impression voulue, lieu, contraintes), de la météo et, en voyage, de la
 * destination. Compte pour une question.
 *
 *   POST { action: 'planifier', jours, voyage?, consigne? }
 *     →  { message, jours: [{ date, titre, pourquoi, pieces (id des pièces) }] }
 *
 * Déployée AVEC vérification JWT : l'appel porte le jeton de la personne,
 * et toutes les lectures passent par la RLS avec ce jeton. La clé service ne
 * sert qu'à ce que le navigateur ne doit pas pouvoir faire : compter la
 * question dans le quota et écrire la réponse de Kodi.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ANSWER_SCHEMA, PLAN_SCHEMA, eventText, type AgendaLine, type Answer, type Corps, type EcartRow, type EventRow, type Profile } from './prompt.ts';
import { pickPieces, pickPlan, MIN_PIECES, type Garment, type Turn } from './wardrobe.ts';
import { conditionsDuJour, type Conditions } from './meteo.ts';
import { askClaude, readJson, servedBy, KodeError, MODEL, EFFORT, type Reponse } from './claude.ts';
import { demandeReponse, demandePlan, type Coeurs, type MeteoJours, type Trip } from './demande.ts';
import { parisDay, shift, weekday, dayLabel } from './dates.ts';
import { lireCle } from '../_shared/fournisseurs.ts';
import { vectoriser, versPgvector, LOT_MAX } from '../_shared/embeddings.ts';
import { cachePostgres } from '../_shared/donnees/cache.ts';
import { contexteDuJour, type Contexte } from '../_shared/donnees/contexte.ts';
import { contexteTexte } from '../_shared/donnees/texte.ts';
import { meteoVoyage } from '../_shared/donnees/voyage.ts';

const HISTORY = 12; // bulles relues pour suivre la conversation
const MAX_QUESTION = 600;
const MAX_DAYS = 31; // jours prévus d'un coup, un mois ou un long voyage
const SOUVENIRS = 6; // souvenirs retrouvés par question
const SIMILARITE_MIN = 0.4; // en dessous, le souvenir n'a pas de rapport avec la question
const ATTENTE_MONDE = 9000; // ms : météo, fériés, tendances (cache partagé)
const ATTENTE_SOUVENIRS = 8000; // ms : la recherche des souvenirs

// ---------------------------------------------------------------- clés

function envKey(single: string, bundle: string): string {
  const one = Deno.env.get(single);
  if (one) return one;
  const many = Deno.env.get(bundle);
  if (many) {
    const parsed = JSON.parse(many) as Record<string, string>;
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error(`Clé ${single} introuvable dans l’environnement de la fonction.`);
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const PUBLIC_KEY = envKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
const admin = createClient(SUPABASE_URL, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------- contexte

type Named = { garments: { name: string } | null };
type OutfitEmbed = { name: string | null; outfit_items: Named[] } | null;

const pieceNames = (o: OutfitEmbed) =>
  (o?.outfit_items ?? []).map((i) => i.garments?.name).filter(Boolean).join(', ');

/** Un cœur tel que la table `likes` le rend : une pièce, ou une tenue avec ses pièces. */
type Coeur = {
  garment_id: string | null;
  outfit_id: string | null;
  outfits: { name: string | null; outfit_items: { garment_id: string }[] } | null;
};

function coeursDe(rows: Coeur[]): Coeurs {
  return {
    pieces: rows.flatMap((r) => (r.garment_id ? [r.garment_id] : [])),
    tenues: rows.flatMap((r) => (r.outfit_id && r.outfits
      ? [{ titre: r.outfits.name ?? '', garmentIds: r.outfits.outfit_items.map((i) => i.garment_id) }]
      : [])),
  };
}

/** Le dressing, le profil, et l'agenda de `from` à `to` (par défaut, les deux semaines à venir). */
async function loadContext(db: SupabaseClient, spaceId: string, window?: { from: string; to: string }) {
  const today = parisDay(0);
  const from = window?.from ?? today;
  const horizon = window?.to ?? parisDay(14);

  const [settings, style, categories, garments, stats, planned, events, history, ecarts, silhouette, accord, gouts, likes] = await Promise.all([
    db.from('settings').select('city').eq('space_id', spaceId).maybeSingle(),
    db.from('style_profile').select('*').eq('space_id', spaceId).maybeSingle(),
    db.from('categories').select('id, label').order('sort'),
    db.from('garments')
      .select('id, name, category_id, kind, season, colors, material')
      .eq('space_id', spaceId)
      .eq('status', 'active')
      .order('created_at')
      .order('id'),
    db.from('garment_stats').select('garment_id, wear_count, last_worn_on').eq('space_id', spaceId),
    db.from('planned_days')
      .select('day, worn, outfits(name, outfit_items(garments(name)))')
      .eq('space_id', spaceId)
      .gte('day', from)
      .lte('day', horizon),
    db.from('events')
      .select('day, starts_at, title, slot, kind, dress_code, stake, impressions, place, setting, flags, note')
      .eq('space_id', spaceId)
      .gte('day', from)
      .lte('day', horizon),
    db.from('kode_messages')
      .select('author, body, meta, outfits(name, outfit_items(garments(name)))')
      .eq('space_id', spaceId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(HISTORY),
    // Les tenues écartées des trois derniers mois, vingt au plus.
    db.from('outfit_feedback')
      .select('garment_ids, reason, target_ids, created_at')
      .eq('space_id', spaceId)
      .gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
    // La silhouette et la taille (jamais le poids ni les mesures), seulement avec l'accord en vigueur (RGPD art. 9).
    db.from('silhouettes').select('shape, height_cm, usual_sizes').eq('space_id', spaceId).maybeSingle(),
    db.rpc('has_consent', { target: spaceId, what: 'silhouette' }),
    // Mes choix : Kodi n'en tire quelque chose qu'avec l'accord « gouts ».
    db.rpc('has_consent', { target: spaceId, what: 'gouts' }),
    db.from('likes')
      .select('garment_id, outfit_id, outfits(name, outfit_items(garment_id))')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  for (const r of [categories, garments, stats, planned, events, history]) {
    if (r.error) throw new Error(`lecture du contexte : ${r.error.message}`);
  }

  const byGarment = new Map((stats.data ?? []).map((s) => [s.garment_id as string, s]));
  const wardrobe: Garment[] = (garments.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    category_id: g.category_id,
    kind: g.kind ?? null,
    season: g.season ?? null,
    colors: g.colors ?? [],
    material: g.material,
    wear_count: byGarment.get(g.id)?.wear_count ?? 0,
    last_worn_on: byGarment.get(g.id)?.last_worn_on ?? null,
  }));

  const agenda: AgendaLine[] = [];
  const plannedNames = new Map<string, string>();
  for (const p of (planned.data ?? []) as unknown as { day: string; worn: boolean; outfits: OutfitEmbed }[]) {
    const names = pieceNames(p.outfits);
    if (!names) continue;
    plannedNames.set(p.day, names);
    agenda.push({ day: `${p.day} (${weekday(p.day)})`, text: `tenue déjà prévue : ${names}${p.worn ? ' (portée)' : ''}` });
  }
  const eventRows = (events.data ?? []) as EventRow[];
  for (const e of eventRows) agenda.push({ day: `${e.day} (${weekday(e.day)})`, text: `rendez-vous ${eventText(e)}` });

  const turns: Turn[] = ((history.data ?? []) as unknown as {
    author: string; body: string; meta: { titre?: string } | null; outfits: OutfitEmbed;
  }[])
    .reverse()
    .map((m): Turn => {
      if (m.author === 'user') return { role: 'user', content: m.body };
      const names = pieceNames(m.outfits);
      const card = names ? `\n[Tenue proposée : « ${m.meta?.titre ?? m.outfits?.name ?? ''} » : ${names}]` : '';
      return { role: 'assistant', content: m.body + card };
    });

  return {
    today,
    // Une table absente ou illisible ne prive pas Kodi de répondre.
    ecarts: ecarts.error ? [] : ((ecarts.data ?? []) as EcartRow[]),
    corps: accord.data === true && silhouette.data ? (silhouette.data as Corps) : null,
    city: (settings.data?.city as string | null | undefined) ?? null,
    style: (style.data ?? null) as Profile | null,
    labels: new Map((categories.data ?? []).map((c) => [c.id as string, c.label as string])),
    wardrobe,
    agenda,
    events: eventRows,
    plannedNames,
    turns,
    coeurs: gouts.data === true ? coeursDe((likes.data ?? []) as unknown as Coeur[]) : null,
  };
}

/** Une promesse qui ne bloque jamais Kodi : sans réponse à temps, ou en erreur, elle rend `null`. */
function within<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), ms))])
    .catch((e) => (console.warn(`${label} :`, e instanceof Error ? e.message : e), null));
}

// ---------------------------------------------------------------- Claude

function readAnswer(res: Reponse): Answer {
  const raw = readJson<Answer>(res);
  return {
    reponse: String(raw.reponse ?? '').trim(),
    tenue: {
      titre: String(raw.tenue?.titre ?? '').trim().slice(0, 80),
      pourquoi: String(raw.tenue?.pourquoi ?? '').trim().slice(0, 400),
      pieces: Array.isArray(raw.tenue?.pieces) ? raw.tenue!.pieces.map(String) : [],
    },
  };
}

// ---------------------------------------------------------------- réponse

/** La personne derrière le jeton et son espace ; toutes les lectures passent par la RLS. */
async function openSession(token: string) {
  const db = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user } } = await db.auth.getUser(token);
  if (!user) throw new KodeError('Session expirée. Reconnecte-toi.', 401);

  const { data: space } = await db.from('spaces').select('id').limit(1).maybeSingle();
  if (!space) throw new KodeError('Espace introuvable.', 404);
  return { db, user, space: space as { id: string } };
}

/** Compte la question dans le quota du mois et l'écrit dans la conversation ; rend son id. */
async function countQuestion(spaceId: string, question: string): Promise<string> {
  const asked = await admin.rpc('kode_ask', { target: spaceId, question });
  if (asked.error) {
    if (asked.error.hint === 'quota') throw new KodeError(asked.error.message, 429, 'quota');
    throw new Error(`enregistrement de la question : ${asked.error.message}`);
  }
  return asked.data as string;
}

/** La météo d'aujourd'hui, en conditions (rien si elle manque ou n'est pas disponible). */
function meteoDuJour(c: Contexte): Conditions | null {
  const m = c.meteo.valeur;
  if (!m || c.meteo.etat === 'indisponible' || !m.jours.length) return null;
  const j = m.jours.find((x) => x.date === c.jour) ?? m.jours[0];
  return conditionsDuJour({ ...j, vent: m.maintenant.vent });
}

/** Les souvenirs qui n'ont pas encore de vecteur : une poignée à la fois, sans bloquer la réponse. */
async function completerSouvenirs(spaceId: string): Promise<void> {
  const { data, error } = await admin.from('kodi_faits').select('id, texte').eq('space_id', spaceId).is('embedding', null).limit(LOT_MAX);
  if (error || !data?.length) return;
  const vecteurs = await vectoriser(data.map((f) => f.texte), 'RETRIEVAL_DOCUMENT');
  if (!vecteurs) return;
  await Promise.all(data.map((f, i) => admin.from('kodi_faits').update({ embedding: versPgvector(vecteurs[i]) }).eq('id', f.id)));
}

/** Les souvenirs les plus proches de la question, par ressemblance de sens. Vide sans réponse à temps. */
async function souvenirsPour(db: SupabaseClient, spaceId: string, question: string): Promise<{ texte: string }[]> {
  await completerSouvenirs(spaceId);
  const q = await vectoriser([question], 'RETRIEVAL_QUERY');
  if (!q) return [];
  const { data, error } = await db.rpc('match_kodi_faits', { target: spaceId, query: versPgvector(q[0]), n: SOUVENIRS });
  if (error) {
    console.warn('souvenirs :', error.message);
    return [];
  }
  return ((data ?? []) as { texte: string; similarite: number }[]).filter((f) => f.similarite >= SIMILARITE_MIN);
}

/** Les durées d'une réponse, en ms, pour savoir où part le temps (K5, 13/11). */
type Durees = Record<string, number>;
const chrono = () => {
  const t0 = Date.now();
  const d: Durees = {};
  return { d, note: (k: string, depuis = t0) => (d[k] = Date.now() - depuis), t0 };
};

async function reply(token: string, question: string) {
  const ch = chrono();
  const { db, space } = await openSession(token);
  const ctx = await loadContext(db, space.id);
  ch.note('lecture');
  // Vérifié avant le quota : une question sans pièces à combiner ne doit
  // pas coûter une des questions du mois.
  if (ctx.wardrobe.length < MIN_PIECES) {
    throw new KodeError('Kodi a besoin d’au moins deux pièces dans ton dressing pour composer une tenue.', 409, 'wardrobe');
  }

  // Météo, fériés, vacances, tendances : lus en même temps que le quota, par
  // le cache partagé. Jamais bloquant : sans réponse à temps, Kodi répond sans.
  const t1 = Date.now();
  const monde = within(contexteDuJour(cachePostgres(admin), ctx.city), ATTENTE_MONDE, 'contexte du jour').finally(() => ch.note('monde', t1));
  // Les souvenirs : même règle, sans eux Kodi répond comme avant.
  const souvenirs = within(souvenirsPour(db, space.id, question), ATTENTE_SOUVENIRS, 'souvenirs').finally(() => ch.note('souvenirs', t1));

  const questionId = await countQuestion(space.id, question);

  try {
    const c = await monde;
    const souv = (await souvenirs) ?? [];
    const meteo = c ? meteoDuJour(c) : null;
    const demande = demandeReponse(ctx, question, { texte: c ? contexteTexte(c) : '', meteo }, souv);

    const t2 = Date.now();
    const res = await askClaude(demande.system, demande.context, demande.turns, ANSWER_SCHEMA, { effort: EFFORT.reponse });
    ch.note('modele', t2);
    const answer = readAnswer(res);
    const pieces = pickPieces(answer.tenue.pieces, demande.refs, demande.interdit);

    let outfitId: string | null = null;
    if (pieces.length) {
      const { data: outfit, error } = await db.from('outfits')
        .insert({ space_id: space.id, name: answer.tenue.titre || null, source: 'kode' })
        .select('id')
        .single();
      if (error) throw new Error(`enregistrement de la tenue : ${error.message}`);
      outfitId = outfit.id;
      const items = await db.from('outfit_items')
        .insert(pieces.map((p) => ({ outfit_id: outfit.id, garment_id: p.garment.id, slot: p.slot })));
      if (items.error) throw new Error(`pièces de la tenue : ${items.error.message}`);
    }

    const servi = servedBy(res);
    const body = answer.reponse || (pieces.length ? 'Voilà ce que je ferais avec ce que tu as.' : 'Je n’ai pas de proposition cette fois. Reformule ta demande ?');
    const { data: saved, error } = await admin.from('kode_messages').insert({
      space_id: space.id,
      author: 'kode',
      body,
      outfit_id: outfitId,
      meta: {
        titre: pieces.length ? answer.tenue.titre : null,
        pourquoi: pieces.length ? answer.tenue.pourquoi : null,
        model: servi,
        usage: res.usage,
        ms: ch.d,
      },
    }).select('id').single();
    if (error) throw new Error(`enregistrement de la réponse : ${error.message}`);

    ch.note('total');
    const u = res.usage;
    console.log(`[${space.id.slice(0, 8)}] ${servi}${servi !== MODEL ? ` (demandé ${MODEL})` : ''} · ${u.input_tokens} + ${u.cache_read_input_tokens ?? 0} lus en cache + ${u.cache_creation_input_tokens ?? 0} mis en cache → ${u.output_tokens} · ${pieces.length} pièce(s) · ${souv.length} souvenir(s) · ${demande.interdit.size} écartée(s) par la météo · ${Object.entries(ch.d).map(([k, v]) => `${k} ${v} ms`).join(', ')}`);
    return { question_id: questionId, reply_id: saved.id as string };
  } catch (err) {
    // Sans réponse, la question ne doit pas compter dans le quota du mois.
    await admin.from('kode_messages').delete().eq('id', questionId);
    throw err;
  }
}

// ---------------------------------------------------------------- plusieurs jours

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MOTIFS = ['Plaisir', 'Travail', 'Les deux'];

type PlanInput = { jours?: unknown; voyage?: unknown; consigne?: unknown };

/** La demande telle qu'elle arrive du téléphone, relue et bornée. */
function readPlanInput(input: PlanInput, today: string) {
  const text = (x: unknown, n: number) => (typeof x === 'string' ? x.trim().slice(0, n) : '') || null;
  const num = (x: unknown, lim: number) => (typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= lim ? x : null);
  const days = [...new Set((Array.isArray(input.jours) ? input.jours : []).map(String))]
    .filter((d) => DAY.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && d >= shift(today, -1) && d <= shift(today, 400))
    .sort();
  if (!days.length) throw new KodeError('Choisis au moins un jour à venir.');
  if (days.length > MAX_DAYS) throw new KodeError(`Kodi prépare ${MAX_DAYS} jours au plus d’un coup.`);

  const v = input.voyage && typeof input.voyage === 'object' ? (input.voyage as Record<string, unknown>) : null;
  const destination = text(v?.destination, 80);
  const trip: Trip | null = v && destination
    ? {
      destination,
      pays: text(v.pays, 80),
      motif: MOTIFS.includes(String(v.motif)) ? String(v.motif) : null,
      activites: (Array.isArray(v.activites) ? v.activites : []).map((a) => text(a, 40)).filter((a): a is string => !!a).slice(0, 10),
      lat: num(v.lat, 90),
      lon: num(v.lon, 180),
    }
    : null;
  return { days, trip, consigne: text(input.consigne, 300) };
}

const deg = (n: number) => `${Math.round(n)}°`;

/** La météo de chez soi, jour par jour, et le reste du contexte (fériés, vacances, tendances). */
function homeWeather(c: Contexte): MeteoJours {
  const byDay = new Map<string, string>();
  const conditions = new Map<string, Conditions>();
  for (const j of c.meteo.valeur?.jours ?? []) {
    byDay.set(j.date, `${deg(j.min)} à ${deg(j.max)}, ${j.libelle}${j.pluie ? `, ${String(j.pluie).replace('.', ',')} mm de pluie` : ''}`);
    conditions.set(j.date, conditionsDuJour(j));
  }
  // La météo passe jour par jour ; celle de maintenant, l'air et le soleil ne parlent que d'aujourd'hui.
  const off = { valeur: null, etat: 'indisponible' as const };
  const extra = contexteTexte({ ...c, meteo: { ...c.meteo, ...off }, air: { ...c.air, ...off }, soleil: { ...c.soleil, ...off } });
  return { byDay, extra, conditions };
}

/** La météo du lieu de voyage : la prévision, ou l'an dernier quand elle n'existe pas encore. */
function tripWeather(m: Awaited<ReturnType<typeof meteoVoyage>>): MeteoJours {
  const byDay = new Map<string, string>();
  const conditions = new Map<string, Conditions>();
  for (const b of [m.prevision, m.saison]) {
    for (const j of b?.valeur ?? []) {
      byDay.set(j.date, `${deg(j.min)} à ${deg(j.max)}, ${j.libelle}${j.nature === 'saison' ? ' (l’an dernier à la même date, pas encore de prévision)' : ''}`);
      if (!conditions.has(j.date)) conditions.set(j.date, conditionsDuJour({ min: j.min, max: j.max, ciel: j.ciel, pluie: null, uv: null }));
    }
  }
  return { byDay, extra: '', conditions };
}

async function plan(token: string, input: PlanInput) {
  const ch = chrono();
  const { db, space } = await openSession(token);
  const today = parisDay(0);
  const { days, trip, consigne } = readPlanInput(input, today);
  const from = days[0];
  const to = days.at(-1)!;

  // Les jours voisins aussi, pour ne pas remettre la tenue de la veille.
  const ctx = await loadContext(db, space.id, { from: shift(from, -3), to: shift(to, 3) });
  ch.note('lecture');
  if (ctx.wardrobe.length < MIN_PIECES) {
    throw new KodeError('Kodi a besoin d’au moins deux pièces dans ton dressing pour composer une tenue.', 409, 'wardrobe');
  }

  const cache = cachePostgres(admin);
  const t1 = Date.now();
  const weather = (trip?.lat != null && trip.lon != null
    ? within(meteoVoyage(cache, trip.lat, trip.lon, from, to, today).then(tripWeather), 9000, 'météo du voyage')
    : within(contexteDuJour(cache, ctx.city).then(homeWeather), 9000, 'contexte du jour')).finally(() => ch.note('monde', t1));

  const asked = trip
    ? `Prévois mes tenues pour ${trip.destination}, du ${dayLabel(from)} au ${dayLabel(to)}.`
    : `Prévois mes tenues : ${days.map(dayLabel).join(', ')}.`;
  const demandeTexte = `${asked}${consigne ? ` ${consigne}` : ''}`;
  const souvenirs = within(souvenirsPour(db, space.id, demandeTexte), ATTENTE_SOUVENIRS, 'souvenirs').finally(() => ch.note('souvenirs', t1));
  const questionId = await countQuestion(space.id, demandeTexte);

  try {
    const w = await weather;
    const souv = (await souvenirs) ?? [];
    const demande = demandePlan(ctx, days, { trip, consigne, meteo: w, souvenirs: souv });

    // Plusieurs jours demandent plus de réflexion : un seul essai, mais plus long.
    const t2 = Date.now();
    const res = await askClaude(demande.system, demande.context, demande.turns, PLAN_SCHEMA, { timeout: 110_000, retries: 0, effort: EFFORT.planifier });
    ch.note('modele', t2);
    const raw = readJson<{ message: string; jours: unknown }>(res);
    const planned = pickPlan(raw.jours, demande.refs, days, demande.interditsParJour);
    const dressed = planned.filter((p) => p.pieces.length);

    const servi = servedBy(res);
    const body = String(raw.message ?? '').trim() ||
      (dressed.length
        ? `C’est prévu : ${dressed.length} tenue${dressed.length > 1 ? 's' : ''} dans ton planning.`
        : 'Je n’ai pas pu habiller ces jours avec ton dressing.');
    const { error } = await admin.from('kode_messages').insert({
      space_id: space.id,
      author: 'kode',
      body,
      meta: { planifie: dressed.map((p) => p.date), model: servi, usage: res.usage, ms: ch.d },
    });
    if (error) throw new Error(`enregistrement de la réponse : ${error.message}`);

    ch.note('total');
    console.log(`[${space.id.slice(0, 8)}] planifier ${servi} · ${days.length} jour(s) → ${dressed.length} tenue(s) · ${res.usage.input_tokens} + ${res.usage.cache_read_input_tokens ?? 0} en cache → ${res.usage.output_tokens} · ${souv.length} souvenir(s) · ${Object.entries(ch.d).map(([k, v]) => `${k} ${v} ms`).join(', ')}`);
    return {
      message: body,
      jours: planned.map((p) => ({ date: p.date, titre: p.titre, pourquoi: p.pourquoi, pieces: p.pieces.map((x) => x.garment.id) })),
    };
  } catch (err) {
    await admin.from('kode_messages').delete().eq('id', questionId);
    throw err;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return Response.json({ kode: MODEL, cle: Boolean(lireCle('ANTHROPIC_API_KEY')) });
  }
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Connexion nécessaire.' }, { status: 401 });

  try {
    const input = await req.json().catch(() => ({}));
    if (input?.action === 'planifier') return Response.json(await plan(token, input));
    const question = String(input?.question ?? '').trim().slice(0, MAX_QUESTION);
    if (!question) throw new KodeError('Écris ta question à Kodi.');
    return Response.json(await reply(token, question));
  } catch (err) {
    if (err instanceof KodeError) {
      return Response.json({ error: err.message, code: err.code ?? null }, { status: err.status });
    }
    console.error('kode :', err instanceof Error ? err.message : err);
    return Response.json({ error: 'Kodi n’a pas pu répondre. Réessaie dans un instant.', code: null }, { status: 500 });
  }
});
