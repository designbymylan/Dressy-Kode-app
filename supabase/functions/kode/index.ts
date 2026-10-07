/**
 * Kode, le styliste de Dresskode.
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
 * question dans le quota et écrire la réponse de Kode.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  RULES, ANSWER_RULES, PLAN_RULES, ANSWER_SCHEMA, PLAN_SCHEMA, profileText, agendaText, eventText, planDaysText, voyageText,
  type Answer, type AgendaLine, type EventRow, type Profile, type Voyage,
} from './prompt.ts';
import { withRefs, wardrobeText, pickPieces, pickPlan, normaliseHistory, MIN_PIECES, type Garment, type Turn } from './wardrobe.ts';
import { cachePostgres } from '../_shared/donnees/cache.ts';
import { contexteDuJour, type Contexte } from '../_shared/donnees/contexte.ts';
import { contexteTexte } from '../_shared/donnees/texte.ts';
import { meteoVoyage } from '../_shared/donnees/voyage.ts';

const MODEL = Deno.env.get('KODE_MODEL') ?? 'claude-opus-5';
const HISTORY = 12; // bulles relues pour suivre la conversation
const MAX_QUESTION = 600;
const MAX_DAYS = 31; // jours prévus d'un coup, un mois ou un long voyage

/** Erreur dont le message peut être montré tel quel dans la conversation. */
class KodeError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
  }
}

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

/** La clé telle que collée, sans les espaces ni guillemets qu'un copier-coller ajoute souvent. */
function anthropicKey(): string | undefined {
  const raw = Deno.env.get('ANTHROPIC_API_KEY');
  return raw?.trim().replace(/^["']+|["']+$/g, '').trim() || undefined;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const PUBLIC_KEY = envKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS');
const admin = createClient(SUPABASE_URL, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------- dates

const PARIS = 'Europe/Paris';

/** Jour au format AAAA-MM-JJ à Paris, décalé de `offset` jours. */
function parisDay(offset = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Le jour `day` décalé de `n` jours. */
function shift(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const weekday = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${day}T12:00:00Z`));

/** « jeudi 9 octobre », « samedi 1er novembre ». */
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace(/ 1 /, ' 1er ');

const todayLabel = () =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date());

// ---------------------------------------------------------------- contexte

type Named = { garments: { name: string } | null };
type OutfitEmbed = { name: string | null; outfit_items: Named[] } | null;

const pieceNames = (o: OutfitEmbed) =>
  (o?.outfit_items ?? []).map((i) => i.garments?.name).filter(Boolean).join(', ');

/** Le dressing, le profil, et l'agenda de `from` à `to` (par défaut, les deux semaines à venir). */
async function loadContext(db: SupabaseClient, userId: string, spaceId: string, window?: { from: string; to: string }) {
  const today = parisDay(0);
  const from = window?.from ?? today;
  const horizon = window?.to ?? parisDay(14);

  const [profile, settings, style, categories, garments, stats, planned, events, history] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    db.from('settings').select('city').eq('space_id', spaceId).maybeSingle(),
    db.from('style_profile').select('*').eq('space_id', spaceId).maybeSingle(),
    db.from('categories').select('id, label').order('sort'),
    db.from('garments')
      .select('id, name, category_id, colors, material')
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
  ]);

  for (const r of [categories, garments, stats, planned, events, history]) {
    if (r.error) throw new Error(`lecture du contexte : ${r.error.message}`);
  }

  const byGarment = new Map((stats.data ?? []).map((s) => [s.garment_id as string, s]));
  const wardrobe: Garment[] = (garments.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    category_id: g.category_id,
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
    name: profile.data?.display_name ?? null,
    city: (settings.data?.city as string | null | undefined) ?? null,
    style: (style.data ?? null) as Profile | null,
    labels: new Map((categories.data ?? []).map((c) => [c.id as string, c.label as string])),
    wardrobe,
    agenda,
    events: eventRows,
    plannedNames,
    turns,
  };
}

/** Une promesse qui ne bloque jamais Kode : sans réponse à temps, ou en erreur, elle rend `null`. */
function within<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), ms))])
    .catch((e) => (console.warn(`${label} :`, e instanceof Error ? e.message : e), null));
}

// ---------------------------------------------------------------- Claude

type Schema = typeof ANSWER_SCHEMA | typeof PLAN_SCHEMA;

async function askClaude(system: string, context: string, turns: Turn[], schema: Schema, opts = { timeout: 60_000, retries: 1 }) {
  const apiKey = anthropicKey();
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY absent des secrets Supabase');
    throw new KodeError('Kode n’est pas encore disponible. Réessaie un peu plus tard.', 503);
  }

  const client = new Anthropic({ apiKey, timeout: opts.timeout, maxRetries: opts.retries });
  try {
    return await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Les règles puis le dressing : les deux bougent peu d'une question à
      // l'autre, le cache évite de repayer le dressing à chaque bulle.
      system: [
        { type: 'text', text: system },
        { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
      ],
      messages: turns,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      // Si les filtres de Claude Opus 5 refusent la question, l'API la
      // rejoue sur le modèle de repli recommandé au lieu de la perdre.
      ...(MODEL === 'claude-opus-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('Claude refuse la clé :', err.message);
      throw new KodeError('Kode n’est pas disponible pour le moment. Réessaie un peu plus tard.', 503);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new KodeError('Kode est très demandé en ce moment. Réessaie dans une minute.', 503);
    }
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      throw new KodeError('Kode a mis trop de temps à répondre. Réessaie.', 504);
    }
    if (err instanceof Anthropic.APIError) {
      // Un crédit épuisé arrive ici (400) : le détail part dans les journaux.
      console.error(`Claude ${err.status} :`, err.message);
      throw new KodeError('Kode n’a pas pu répondre. Réessaie dans un moment.', 502);
    }
    throw err;
  }
}

function readJson<T>(res: Anthropic.Beta.BetaMessage): Partial<T> {
  if (res.stop_reason === 'refusal') {
    throw new KodeError('Kode ne peut pas répondre à cette question. Reformule-la autour de tes vêtements.', 422);
  }
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  try {
    return JSON.parse(text);
  } catch {
    console.error(`réponse illisible (${res.stop_reason}) :`, text.slice(0, 300));
    throw new KodeError('La réponse de Kode est arrivée incomplète. Réessaie.', 502);
  }
}

function readAnswer(res: Anthropic.Beta.BetaMessage): Answer {
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

async function reply(token: string, question: string) {
  const { db, user, space } = await openSession(token);
  const ctx = await loadContext(db, user.id, space.id);
  // Vérifié avant le quota : une question sans pièces à combiner ne doit
  // pas coûter une des questions du mois.
  if (ctx.wardrobe.length < MIN_PIECES) {
    throw new KodeError('Kode a besoin d’au moins deux pièces dans ton dressing pour composer une tenue.', 409, 'wardrobe');
  }

  // Météo, fériés, vacances, tendances : lus en même temps que le quota, par
  // le cache partagé. Jamais bloquant : sans réponse en 9 s, Kode répond sans.
  const monde = within(contexteDuJour(cachePostgres(admin), ctx.city).then(contexteTexte), 9000, 'contexte du jour');

  const questionId = await countQuestion(space.id, question);

  try {
    const refs = withRefs(ctx.wardrobe);
    const context = [
      profileText(ctx.name, ctx.style),
      `Agenda Dresskode des deux prochaines semaines :\n${agendaText(ctx.agenda)}`,
      `Dressing : ${refs.size} pièce${refs.size > 1 ? 's' : ''} disponible${refs.size > 1 ? 's' : ''} :\n${wardrobeText(refs, ctx.labels, ctx.today)}`,
    ].join('\n\n');

    // La date et le contexte du jour n'entrent que dans la dernière bulle :
    // placés dans le contexte, ils invalideraient le cache à chaque heure.
    const jour = await monde;
    const turns = normaliseHistory([
      ...ctx.turns,
      { role: 'user', content: `Nous sommes le ${todayLabel()}.\n\n${jour ? `${jour}\n\n` : ''}${question}` },
    ]);

    const res = await askClaude(`${RULES}\n\n${ANSWER_RULES}`, context, turns, ANSWER_SCHEMA);
    const answer = readAnswer(res);
    const pieces = pickPieces(answer.tenue.pieces, refs);

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

    const body = answer.reponse || (pieces.length ? 'Voilà ce que je ferais avec ce que tu as.' : 'Je n’ai pas de proposition cette fois. Reformule ta demande ?');
    const { data: saved, error } = await admin.from('kode_messages').insert({
      space_id: space.id,
      author: 'kode',
      body,
      outfit_id: outfitId,
      meta: {
        titre: pieces.length ? answer.tenue.titre : null,
        pourquoi: pieces.length ? answer.tenue.pourquoi : null,
        model: res.model,
        usage: res.usage,
      },
    }).select('id').single();
    if (error) throw new Error(`enregistrement de la réponse : ${error.message}`);

    console.log(`[${space.id.slice(0, 8)}] ${res.model} · ${res.usage.input_tokens} + ${res.usage.cache_read_input_tokens ?? 0} en cache → ${res.usage.output_tokens} · ${pieces.length} pièce(s)`);
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
type Trip = Voyage & { lat: number | null; lon: number | null };

/** La demande telle qu'elle arrive du téléphone, relue et bornée. */
function readPlanInput(input: PlanInput, today: string) {
  const text = (x: unknown, n: number) => (typeof x === 'string' ? x.trim().slice(0, n) : '') || null;
  const num = (x: unknown, lim: number) => (typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= lim ? x : null);
  const days = [...new Set((Array.isArray(input.jours) ? input.jours : []).map(String))]
    .filter((d) => DAY.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && d >= shift(today, -1) && d <= shift(today, 400))
    .sort();
  if (!days.length) throw new KodeError('Choisis au moins un jour à venir.');
  if (days.length > MAX_DAYS) throw new KodeError(`Kode prépare ${MAX_DAYS} jours au plus d’un coup.`);

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
function homeWeather(c: Contexte) {
  const byDay = new Map<string, string>();
  for (const j of c.meteo.valeur?.jours ?? []) {
    byDay.set(j.date, `${deg(j.min)} à ${deg(j.max)}, ${j.libelle}${j.pluie ? `, ${String(j.pluie).replace('.', ',')} mm de pluie` : ''}`);
  }
  // La météo passe jour par jour ; celle de maintenant, l'air et le soleil ne parlent que d'aujourd'hui.
  const off = { valeur: null, etat: 'indisponible' as const };
  const extra = contexteTexte({ ...c, meteo: { ...c.meteo, ...off }, air: { ...c.air, ...off }, soleil: { ...c.soleil, ...off } });
  return { byDay, extra };
}

/** La météo du lieu de voyage : la prévision, ou l'an dernier quand elle n'existe pas encore. */
function tripWeather(m: Awaited<ReturnType<typeof meteoVoyage>>) {
  const byDay = new Map<string, string>();
  for (const b of [m.prevision, m.saison]) {
    for (const j of b?.valeur ?? []) {
      byDay.set(j.date, `${deg(j.min)} à ${deg(j.max)}, ${j.libelle}${j.nature === 'saison' ? ' (l’an dernier à la même date, pas encore de prévision)' : ''}`);
    }
  }
  return { byDay, extra: '' };
}

async function plan(token: string, input: PlanInput) {
  const { db, user, space } = await openSession(token);
  const today = parisDay(0);
  const { days, trip, consigne } = readPlanInput(input, today);
  const from = days[0];
  const to = days.at(-1)!;

  // Les jours voisins aussi, pour ne pas remettre la tenue de la veille.
  const ctx = await loadContext(db, user.id, space.id, { from: shift(from, -3), to: shift(to, 3) });
  if (ctx.wardrobe.length < MIN_PIECES) {
    throw new KodeError('Kode a besoin d’au moins deux pièces dans ton dressing pour composer une tenue.', 409, 'wardrobe');
  }

  const cache = cachePostgres(admin);
  const weather = trip?.lat != null && trip.lon != null
    ? within(meteoVoyage(cache, trip.lat, trip.lon, from, to, today).then(tripWeather), 9000, 'météo du voyage')
    : within(contexteDuJour(cache, ctx.city).then(homeWeather), 9000, 'contexte du jour');

  const asked = trip
    ? `Prévois mes tenues pour ${trip.destination}, du ${dayLabel(from)} au ${dayLabel(to)}.`
    : `Prévois mes tenues : ${days.map(dayLabel).join(', ')}.`;
  const questionId = await countQuestion(space.id, `${asked}${consigne ? ` ${consigne}` : ''}`);

  try {
    const refs = withRefs(ctx.wardrobe);
    const context = [
      profileText(ctx.name, ctx.style),
      `Dressing : ${refs.size} pièce${refs.size > 1 ? 's' : ''} disponible${refs.size > 1 ? 's' : ''} :\n${wardrobeText(refs, ctx.labels, ctx.today)}`,
    ].join('\n\n');

    const w = await weather;
    const wanted = new Set(days);
    const neighbours = [...ctx.plannedNames]
      .filter(([d]) => !wanted.has(d))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, names]) => `- ${d} (${dayLabel(d)}) : ${names}`);
    const message = [
      `Nous sommes le ${todayLabel()}.`,
      w?.extra || null,
      trip ? voyageText(trip, dayLabel(from), dayLabel(to)) : null,
      `Jours à prévoir (${days.length}) :\n${planDaysText(days.map((d) => ({
        date: d,
        label: dayLabel(d),
        meteo: w?.byDay.get(d) ?? null,
        events: ctx.events.filter((e) => e.day === d),
        before: ctx.plannedNames.get(d) ?? null,
      })))}`,
      neighbours.length ? `Tenues déjà prévues les jours voisins :\n${neighbours.join('\n')}` : null,
      consigne ? `Ce que la personne demande en plus : « ${consigne} »` : null,
    ].filter(Boolean).join('\n\n');

    // Plusieurs jours demandent plus de réflexion : un seul essai, mais plus long.
    const res = await askClaude(`${RULES}\n\n${PLAN_RULES}`, context, [{ role: 'user', content: message }], PLAN_SCHEMA, { timeout: 110_000, retries: 0 });
    const raw = readJson<{ message: string; jours: unknown }>(res);
    const planned = pickPlan(raw.jours, refs, days);
    const dressed = planned.filter((p) => p.pieces.length);

    const body = String(raw.message ?? '').trim() ||
      (dressed.length
        ? `C’est prévu : ${dressed.length} tenue${dressed.length > 1 ? 's' : ''} dans ton planning.`
        : 'Je n’ai pas pu habiller ces jours avec ton dressing.');
    const { error } = await admin.from('kode_messages').insert({
      space_id: space.id,
      author: 'kode',
      body,
      meta: { planifie: dressed.map((p) => p.date), model: res.model, usage: res.usage },
    });
    if (error) throw new Error(`enregistrement de la réponse : ${error.message}`);

    console.log(`[${space.id.slice(0, 8)}] planifier ${res.model} · ${days.length} jour(s) → ${dressed.length} tenue(s) · ${res.usage.input_tokens} + ${res.usage.cache_read_input_tokens ?? 0} en cache → ${res.usage.output_tokens}`);
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
    return Response.json({ kode: MODEL, cle: Boolean(anthropicKey()) });
  }
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Connexion nécessaire.' }, { status: 401 });

  try {
    const input = await req.json().catch(() => ({}));
    if (input?.action === 'planifier') return Response.json(await plan(token, input));
    const question = String(input?.question ?? '').trim().slice(0, MAX_QUESTION);
    if (!question) throw new KodeError('Écris ta question à Kode.');
    return Response.json(await reply(token, question));
  } catch (err) {
    if (err instanceof KodeError) {
      return Response.json({ error: err.message, code: err.code ?? null }, { status: err.status });
    }
    console.error('kode :', err instanceof Error ? err.message : err);
    return Response.json({ error: 'Kode n’a pas pu répondre. Réessaie dans un instant.', code: null }, { status: 500 });
  }
});
