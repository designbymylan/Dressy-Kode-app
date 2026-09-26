/**
 * Kode, le styliste de Dressy.
 *
 * Reçoit une question de la personne connectée, relit son dressing, son
 * profil et son agenda, et fait répondre Claude — avec, quand la question
 * s'y prête, une tenue composée uniquement de pièces qu'elle possède.
 *
 *   POST { question }  →  { question_id, reply_id }
 *
 * Déployée AVEC vérification JWT : l'appel porte le jeton de la personne,
 * et toutes les lectures passent par la RLS avec ce jeton. La clé service ne
 * sert qu'à ce que le navigateur ne doit pas pouvoir faire : compter la
 * question dans le quota et écrire la réponse de Kode.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RULES, ANSWER_SCHEMA, profileText, agendaText, type Answer, type AgendaLine, type Profile } from './prompt.ts';
import { withRefs, wardrobeText, pickPieces, normaliseHistory, MIN_PIECES, type Garment, type Turn } from './wardrobe.ts';

const MODEL = Deno.env.get('KODE_MODEL') ?? 'claude-opus-5';
const HISTORY = 12; // bulles relues pour suivre la conversation
const MAX_QUESTION = 600;

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

const weekday = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${day}T12:00:00Z`));

const todayLabel = () =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date());

// ---------------------------------------------------------------- contexte

type Named = { garments: { name: string } | null };
type OutfitEmbed = { name: string | null; outfit_items: Named[] } | null;

const pieceNames = (o: OutfitEmbed) =>
  (o?.outfit_items ?? []).map((i) => i.garments?.name).filter(Boolean).join(', ');

async function loadContext(db: SupabaseClient, userId: string, spaceId: string) {
  const today = parisDay(0);
  const horizon = parisDay(14);

  const [profile, style, categories, garments, stats, planned, events, history] = await Promise.all([
    db.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
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
      .gte('day', today)
      .lte('day', horizon),
    db.from('events')
      .select('day, title, slot, kind, dress_code, stake, note')
      .eq('space_id', spaceId)
      .gte('day', today)
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
  for (const p of (planned.data ?? []) as unknown as { day: string; worn: boolean; outfits: OutfitEmbed }[]) {
    const names = pieceNames(p.outfits);
    if (names) agenda.push({ day: `${p.day} (${weekday(p.day)})`, text: `tenue déjà prévue — ${names}${p.worn ? ' (portée)' : ''}` });
  }
  for (const e of events.data ?? []) {
    const details = [e.kind, e.dress_code && `dress code ${e.dress_code}`, e.stake && `enjeu ${e.stake.toLowerCase()}`]
      .filter(Boolean).join(', ');
    agenda.push({
      day: `${e.day} (${weekday(e.day)})${e.slot ? `, ${e.slot.toLowerCase()}` : ''}`,
      text: `${e.title}${details ? ` (${details})` : ''}${e.note ? ` — ${e.note}` : ''}`,
    });
  }

  const turns: Turn[] = ((history.data ?? []) as unknown as {
    author: string; body: string; meta: { titre?: string } | null; outfits: OutfitEmbed;
  }[])
    .reverse()
    .map((m): Turn => {
      if (m.author === 'user') return { role: 'user', content: m.body };
      const names = pieceNames(m.outfits);
      const card = names ? `\n[Tenue proposée : « ${m.meta?.titre ?? m.outfits?.name ?? ''} » — ${names}]` : '';
      return { role: 'assistant', content: m.body + card };
    });

  return {
    today,
    name: profile.data?.display_name ?? null,
    style: (style.data ?? null) as Profile | null,
    labels: new Map((categories.data ?? []).map((c) => [c.id as string, c.label as string])),
    wardrobe,
    agenda,
    turns,
  };
}

// ---------------------------------------------------------------- Claude

async function askClaude(system: string, context: string, turns: Turn[]) {
  const apiKey = anthropicKey();
  if (!apiKey) throw new KodeError('Kode n’est pas encore branché : la clé ANTHROPIC_API_KEY manque dans les secrets Supabase.', 503);

  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
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
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
      // Si les filtres de Claude Opus 5 refusent la question, l'API la
      // rejoue sur le modèle de repli recommandé au lieu de la perdre.
      ...(MODEL === 'claude-opus-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('Claude refuse la clé :', err.message);
      throw new KodeError('Kode est indisponible pour le moment : la clé Anthropic est refusée.', 503);
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
      throw new KodeError(`Kode n’a pas pu répondre (erreur ${err.status ?? 'réseau'}). Réessaie dans un moment.`, 502);
    }
    throw err;
  }
}

function readAnswer(res: Anthropic.Beta.BetaMessage): Answer {
  if (res.stop_reason === 'refusal') {
    throw new KodeError('Kode ne peut pas répondre à cette question. Reformule-la autour de tes vêtements.', 422);
  }
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let raw: Partial<Answer>;
  try {
    raw = JSON.parse(text);
  } catch {
    console.error(`réponse illisible (${res.stop_reason}) :`, text.slice(0, 300));
    throw new KodeError('La réponse de Kode est arrivée incomplète. Réessaie.', 502);
  }
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

async function reply(token: string, question: string) {
  const db = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user } } = await db.auth.getUser(token);
  if (!user) throw new KodeError('Session expirée. Reconnecte-toi.', 401);

  const { data: space } = await db.from('spaces').select('id').limit(1).maybeSingle();
  if (!space) throw new KodeError('Espace introuvable.', 404);

  const ctx = await loadContext(db, user.id, space.id);
  // Vérifié avant le quota : une question sans pièces à combiner ne doit
  // pas coûter une des questions du mois.
  if (ctx.wardrobe.length < MIN_PIECES) {
    throw new KodeError('Kode a besoin d’au moins deux pièces dans ton dressing pour composer une tenue.', 409, 'wardrobe');
  }

  const asked = await admin.rpc('kode_ask', { target: space.id, question });
  if (asked.error) {
    if (asked.error.hint === 'quota') throw new KodeError(asked.error.message, 429, 'quota');
    throw new Error(`enregistrement de la question : ${asked.error.message}`);
  }
  const questionId = asked.data as string;

  try {
    const refs = withRefs(ctx.wardrobe);
    const context = [
      profileText(ctx.name, ctx.style),
      `Agenda Dressy des deux prochaines semaines :\n${agendaText(ctx.agenda)}`,
      `Dressing — ${refs.size} pièce${refs.size > 1 ? 's' : ''} disponible${refs.size > 1 ? 's' : ''} :\n${wardrobeText(refs, ctx.labels, ctx.today)}`,
    ].join('\n\n');

    // La date n'entre que dans la dernière bulle : placée dans le contexte,
    // elle invaliderait le cache chaque jour pour toutes les questions.
    const turns = normaliseHistory([
      ...ctx.turns,
      { role: 'user', content: `Nous sommes le ${todayLabel()}.\n\n${question}` },
    ]);

    const res = await askClaude(RULES, context, turns);
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

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return Response.json({ kode: MODEL, cle: Boolean(anthropicKey()) });
  }
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Connexion nécessaire.' }, { status: 401 });

  try {
    const input = await req.json().catch(() => ({}));
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
