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
import { eventText, type AgendaLine, type Corps, type EcartRow, type EventRow, type Profile } from './prompt.ts';
import { MIN_PIECES, type Garment, type Turn } from './wardrobe.ts';
import { conditionsDuJour, type Conditions } from './meteo.ts';
import { servedBy, KodeError, MODEL, EFFORT } from './claude.ts';
import { type Coeurs, type MeteoJours, type Trip } from './demande.ts';
import { repondre, planifier } from './repondre.ts';
import { parisDay, shift, weekday, dayLabel } from './dates.ts';
import { lireCle } from '../_shared/fournisseurs.ts';
import { cachePostgres } from '../_shared/donnees/cache.ts';
import { contexteDuJour, type Contexte } from '../_shared/donnees/contexte.ts';
import { contexteTexte } from '../_shared/donnees/texte.ts';
import { meteoVoyage } from '../_shared/donnees/voyage.ts';

const HISTORY = 12; // bulles relues pour suivre la conversation
const MAX_QUESTION = 600;
const MAX_DAYS = 31; // jours prévus d'un coup, un mois ou un long voyage
const SOUVENIRS = 50; // souvenirs relus par question, les plus récents (K4)
const ATTENTE_MONDE = 9000; // ms : météo, fériés, tendances (cache partagé)
const ATTENTE_SOUVENIRS = 3000; // ms : la lecture des souvenirs (une requête simple depuis K4)
const RETENIR_DEPUIS = 2; // version de l'accord « goûts » qui couvre ce que la personne dit à Kodi

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

  const [settings, style, categories, garments, stats, planned, events, history, ecarts, silhouette, accord, gouts, accordGouts, likes, portees] = await Promise.all([
    db.from('settings').select('city').eq('space_id', spaceId).maybeSingle(),
    db.from('style_profile').select('*').eq('space_id', spaceId).maybeSingle(),
    db.from('categories').select('id, label').order('sort'),
    db.from('garments')
      .select('id, name, category_id, kind, season, colors, material, fiche, fit, size, notes')
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
    // Sa version : depuis la 2 (13/11), l'accord couvre aussi ce que la personne dit à Kodi.
    db.from('consents').select('granted, version').eq('space_id', spaceId).eq('kind', 'gouts')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('likes')
      .select('garment_id, outfit_id, outfits(name, outfit_items(garment_id))')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(30),
    // Les ports des sept derniers jours (K6) : ne pas reproposer la tenue d'avant-hier.
    db.from('wears').select('garment_id, worn_on').gte('worn_on', shift(today, -7)).lte('worn_on', today),
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
    fiche: (g.fiche as Garment['fiche']) ?? null,
    fit: g.fit ?? null,
    // La taille d'une pièce dit celle de la personne : seulement avec l'accord « silhouette », comme ses tailles habituelles.
    size: accord.data === true ? g.size ?? null : null,
    notes: g.notes ?? null,
  }));
  const ids = new Set(wardrobe.map((g) => g.id));
  const parJour = new Map<string, string[]>();
  for (const w of (portees.error ? [] : portees.data ?? []) as { garment_id: string; worn_on: string }[]) {
    if (ids.has(w.garment_id)) parJour.set(w.worn_on, [...(parJour.get(w.worn_on) ?? []), w.garment_id]);
  }

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

  type Bulle = { author: string; body: string; meta: { titre?: string; question?: string } | null; outfits: OutfitEmbed };
  const bulles = (history.data ?? []) as unknown as Bulle[];
  // La dernière réponse de Kodi posait-elle une question ? Alors pas de question cette fois.
  const derniereKodi = bulles.find((m) => m.author === 'kode');
  const turns: Turn[] = [...bulles]
    .reverse()
    .map((m): Turn => {
      if (m.author === 'user') return { role: 'user', content: m.body };
      const names = pieceNames(m.outfits);
      const card = names ? `\n[Tenue proposée : « ${m.meta?.titre ?? m.outfits?.name ?? ''} » : ${names}]` : '';
      const question = m.meta?.question ? `\n[Question posée : « ${m.meta.question} »]` : '';
      return { role: 'assistant', content: m.body + card + question };
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
    gouts: gouts.data === true,
    retenir: gouts.data === true && accordGouts.data?.granted === true && (accordGouts.data?.version ?? 1) >= RETENIR_DEPUIS,
    portees: [...parJour].map(([day, ids]) => ({ day, ids })),
    questionPosee: Boolean(derniereKodi?.meta?.question),
  };
}

/** Une promesse qui ne bloque jamais Kodi : sans réponse à temps, ou en erreur, elle rend `null`. */
function within<T>(p: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), ms))])
    .catch((e) => (console.warn(`${label} :`, e instanceof Error ? e.message : e), null));
}

// ---------------------------------------------------------------- Claude

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

/**
 * Compte la question dans le quota du mois et l'écrit dans la conversation ;
 * rend son id. Répondre à la question que Kodi vient de poser est gratuit
 * (la base le décide) ; une planification ne l'est jamais.
 */
async function countQuestion(spaceId: string, question: string, peutEtreGratuite = true): Promise<string> {
  const asked = await admin.rpc('kode_ask', { target: spaceId, question, peut_etre_gratuite: peutEtreGratuite });
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

/**
 * Les souvenirs de Kodi (K4, 13/11) : tant qu'un espace en a peu, tous, du
 * plus récent au plus ancien, sans passer par les vecteurs (cassés depuis le
 * changement de clé, et jusqu'à 8 s d'attente). Une centaine de jetons, au
 * plus quelques centaines. Seulement avec l'accord « goûts ».
 */
async function souvenirsPour(db: SupabaseClient, spaceId: string, gouts: boolean): Promise<{ texte: string }[]> {
  if (!gouts) return [];
  const { data, error } = await db.from('kodi_faits').select('texte').eq('space_id', spaceId).order('created_at', { ascending: false }).limit(SOUVENIRS);
  if (error) {
    console.warn('souvenirs :', error.message);
    return [];
  }
  return (data ?? []) as { texte: string }[];
}

/** Les jetons de tous les appels d'une réponse (deux avec une relance). */
function usageTotal(appels: { usage: object }[]) {
  const n = (k: string) => appels.reduce((s, a) => s + (Number((a.usage as Record<string, unknown>)[k]) || 0), 0);
  return {
    input_tokens: n('input_tokens'),
    output_tokens: n('output_tokens'),
    cache_read_input_tokens: n('cache_read_input_tokens'),
    cache_creation_input_tokens: n('cache_creation_input_tokens'),
  };
}

/** Les faits à retenir qui ne sont pas déjà dans ses souvenirs. */
function nouveauxFaits(faits: string[], souvenirs: { texte: string }[]): string[] {
  const cle = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const deja = new Set(souvenirs.map((s) => cle(s.texte)));
  return faits.filter((f) => !deja.has(cle(f)));
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
  const souvenirs = within(souvenirsPour(db, space.id, ctx.gouts), ATTENTE_SOUVENIRS, 'souvenirs').finally(() => ch.note('souvenirs', t1));

  const questionId = await countQuestion(space.id, question);

  try {
    const c = await monde;
    const souv = (await souvenirs) ?? [];
    const meteo = c ? meteoDuJour(c) : null;
    const t2 = Date.now();
    const { answer, pieces, variante, demande, appels, controles } = await repondre(ctx, question, { texte: c ? contexteTexte(c) : '', meteo }, souv, { effort: EFFORT.reponse });
    ch.note('modele', t2);
    const res = appels.at(-1)!;
    const usage = usageTotal(appels);

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
        // Kodi v2 (13/11) : ce que l'écran pourra montrer une fois validé.
        intention: answer.intention,
        question: answer.question || null,
        manque: answer.manque || null,
        // La variante reste dans la réponse (pas une tenue de plus dans « Mes tenues ») ;
        // la montrer ne coûte aucune question.
        variante: variante.length
          ? { direction: answer.variante.direction, titre: answer.variante.titre, pieces: variante.map((p) => ({ id: p.garment.id, slot: p.slot })) }
          : null,
        controles,
        appels: appels.length,
        model: servi,
        usage,
        ms: ch.d,
      },
    }).select('id').single();
    if (error) throw new Error(`enregistrement de la réponse : ${error.message}`);

    // Ce que Kodi retient de ce qu'elle lui a dit : seulement avec l'accord
    // « goûts » version 2, jamais rien de sensible (filtré par aRetenir).
    const retenus = ctx.retenir ? nouveauxFaits(answer.a_retenir, souv) : [];
    if (retenus.length) {
      const faits = await admin.from('kodi_faits')
        .insert(retenus.map((texte) => ({ space_id: space.id, origine: 'dit', origine_id: questionId, texte })));
      if (faits.error) console.warn('souvenirs dits :', faits.error.message);
    }

    ch.note('total');
    const u = usage;
    const ctl = controles.essais[0].length ? ` · contrôle : ${controles.essais.map((e) => e.length ? e.join(' ; ') : 'ok').join(' → ')}${controles.repare ? ' → réparée' : ''}${controles.abandon ? ' → sans tenue' : ''}` : '';
    console.log(`[${space.id.slice(0, 8)}] ${servi}${servi !== MODEL ? ` (demandé ${MODEL})` : ''} · ${answer.intention} · ${appels.length} appel(s) · ${u.input_tokens} + ${u.cache_read_input_tokens ?? 0} lus en cache + ${u.cache_creation_input_tokens ?? 0} mis en cache → ${u.output_tokens} · ${pieces.length} pièce(s)${variante.length ? ` + variante ${variante.length}` : ''} · ${souv.length} souvenir(s), ${retenus.length} retenu(s) · ${demande.interdit.size} écartée(s) par la météo${ctl} · ${Object.entries(ch.d).map(([k, v]) => `${k} ${v} ms`).join(', ')}`);
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
  const souvenirs = within(souvenirsPour(db, space.id, ctx.gouts), ATTENTE_SOUVENIRS, 'souvenirs').finally(() => ch.note('souvenirs', t1));
  const questionId = await countQuestion(space.id, demandeTexte, false);

  try {
    const w = await weather;
    const souv = (await souvenirs) ?? [];
    // Plusieurs jours demandent plus de réflexion : un seul essai, mais plus long.
    const t2 = Date.now();
    const p = await planifier(ctx, days, { trip, consigne, meteo: w, souvenirs: souv }, { timeout: 110_000, retries: 0, effort: EFFORT.planifier });
    ch.note('modele', t2);
    const res = p.appels.at(-1)!;
    const planned = p.jours;
    const dressed = planned.filter((x) => x.pieces.length);

    const servi = servedBy(res);
    const body = p.message ||
      (dressed.length
        ? `C’est prévu : ${dressed.length} tenue${dressed.length > 1 ? 's' : ''} dans ton planning.`
        : 'Je n’ai pas pu habiller ces jours avec ton dressing.');
    const { error } = await admin.from('kode_messages').insert({
      space_id: space.id,
      author: 'kode',
      body,
      meta: { planifie: dressed.map((p) => p.date), controles: p.controles, model: servi, usage: res.usage, ms: ch.d },
    });
    if (error) throw new Error(`enregistrement de la réponse : ${error.message}`);

    ch.note('total');
    console.log(`[${space.id.slice(0, 8)}] planifier ${servi} · ${days.length} jour(s) → ${dressed.length} tenue(s) · ${res.usage.input_tokens} + ${res.usage.cache_read_input_tokens ?? 0} en cache → ${res.usage.output_tokens} · ${souv.length} souvenir(s)${Object.keys(p.controles).length ? ` · contrôle : ${Object.entries(p.controles).map(([d, e]) => `${d} ${e.join(' ; ')}`).join(' | ')}` : ''} · ${Object.entries(ch.d).map(([k, v]) => `${k} ${v} ms`).join(', ')}`);
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
