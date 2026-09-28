/**
 * Le pont entre l'app et Supabase : lire le compte, enregistrer chaque
 * action, et traduire entre le vocabulaire de l'app (libellés, portants)
 * et celui de la base (identifiants, contraintes de
 * supabase/migrations/*_app_mobile.sql). Toutes les lectures et écritures
 * passent par la RLS avec le jeton de la personne connectée.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { COLOR_CHOICES, type CategoryId, type Piece, type Season } from '../data/wardrobe';
import { GARMENT_KINDS, type GarmentKind } from '../ui/Garment';
import { AGES, EMPTY_PROFILE, OCCASIONS, STYLE_CARDS, type MeasureId, type Profile, type Rayon, type Silhouette } from './profile';
import type { KodeLink, KodeMessage } from './kode';

export type PlanId = 'decouverte' | 'capsule' | 'atelier' | 'couture';
export type Period = 'mois' | 'an';
export type Planned = { title: string; pieces: string[] };
export type Session = { userId: string; email: string; spaceId: string };

export type Account = {
  session: Session;
  /** Le questionnaire a été rempli (sur ce téléphone ou un autre). */
  onboarded: boolean;
  profile: Profile;
  pieces: Piece[];
  planned: Record<number, Planned>;
  messages: KodeMessage[];
  kodeUsed: number;
  plan: PlanId;
  period: Period;
};

export type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

export const online = supabase !== null;

function db() {
  if (!supabase) throw new Error('Supabase n’est pas configuré (EXPO_PUBLIC_SUPABASE_URL).');
  return supabase;
}

/* ---- Traductions ---- */

/** « Chic parisien » → « chic_parisien » : les identifiants que la base garde. */
export const slug = (label: string) =>
  label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Les identifiants relus, rendus avec les libellés de l'app ; un identifiant venu du site garde un libellé lisible. */
function labels(ids: string[] | null | undefined, known: string[]): string[] {
  const bySlug = new Map(known.map((l) => [slug(l), l]));
  return (ids ?? []).map((id) => bySlug.get(id) ?? id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' '));
}

const AGE_IDS = ['15-17', '18-24', '25-34', '35-44', '45+'];
const SHAPES: Record<Exclude<Silhouette, 'inconnue'>, string> = { A: 'triangle', V: 'triangle_inverse', H: 'rectangle', X: 'sablier', O: 'ronde' };
const SHAPE_OF = Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [v, k])) as Record<string, Silhouette>;

const CATEGORY_OF: Record<string, CategoryId> = { vestes: 'manteaux', hauts: 'hauts', bas: 'bas', robes: 'robes', chaussures: 'chaussures', sacs: 'accessoires', accessoires: 'accessoires', bijoux: 'accessoires' };
const categoryId = (p: Pick<Piece, 'category' | 'kind'>) =>
  p.category === 'manteaux' ? 'vestes' : p.category === 'accessoires' ? (p.kind === 'sac' ? 'sacs' : 'accessoires') : p.category;

/** L'emplacement d'une pièce dans une tenue (contrainte outfit_items.slot). */
const slotOf = (p: Pick<Piece, 'category' | 'kind'>) =>
  ({ manteaux: 'veste', hauts: 'haut', bas: 'bas', robes: 'robe', chaussures: 'chaussures', accessoires: p.kind === 'sac' ? 'sac' : 'accessoire' })[p.category];

const SEASON_ID: Record<Season, string> = { 'toute l’année': 'toute_annee', 'mi-saison': 'mi_saison', hiver: 'hiver', été: 'ete' };
const SEASON_OF = Object.fromEntries(Object.entries(SEASON_ID).map(([k, v]) => [v, k])) as Record<string, Season>;
const DEFAULT_KIND: Record<CategoryId, GarmentKind> = { manteaux: 'veste', hauts: 'tshirt', bas: 'pantalon', robes: 'robe', chaussures: 'baskets', accessoires: 'sac' };

const HEX = /^#[0-9A-Fa-f]{6}$/;
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Jour local au format AAAA-MM-JJ, décalé de `offset` jours. */
export function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Écart en jours locaux entre aujourd'hui et une date (AAAA-MM-JJ ou horodatage) : positif dans le futur. */
function dayOffset(date: string) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((then - today) / 86_400_000);
}

const daysSince = (date: string) => Math.max(0, -dayOffset(date));

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const since = (createdAt: string) => (daysSince(createdAt) === 0 ? 'aujourd’hui' : MONTHS[Number(createdAt.slice(5, 7)) - 1]);

type GarmentRow = {
  id: string; name: string; category_id: string; kind: string | null; tint: string | null; season: string | null;
  colors: string[] | null; material: string | null; purchase_price_cents: number | null; created_at: string;
};
type StatRow = { garment_id: string; wear_count: number | null; last_worn_on: string | null };

function toPiece(g: GarmentRow, st: StatRow | undefined): Piece {
  const category = CATEGORY_OF[g.category_id] ?? 'accessoires';
  const kind = (GARMENT_KINDS as string[]).includes(g.kind ?? '') ? (g.kind as GarmentKind) : DEFAULT_KIND[category];
  const tint = g.tint && HEX.test(g.tint) ? g.tint : undefined;
  return {
    id: g.id,
    name: g.name,
    kind,
    tint,
    category,
    color: g.colors?.[0] ?? '',
    swatch: tint ?? '#A7A29A',
    material: g.material ?? '',
    season: SEASON_OF[g.season ?? ''] ?? 'toute l’année',
    wears: st?.wear_count ?? 0,
    lastWorn: st?.last_worn_on ? daysSince(st.last_worn_on) : null,
    addedDaysAgo: daysSince(g.created_at),
    price: g.purchase_price_cents != null ? g.purchase_price_cents / 100 : undefined,
  };
}

function garmentRow(p: Piece, spaceId: string) {
  return {
    space_id: spaceId,
    category_id: categoryId(p),
    name: p.name.slice(0, 120),
    kind: /^[a-z]{2,20}$/.test(p.kind) ? p.kind : null,
    tint: p.tint && HEX.test(p.tint) ? p.tint : null,
    season: SEASON_ID[p.season] ?? null,
    colors: p.color ? [p.color] : [],
    material: p.material || null,
    source: 'photo',
    purchase_price_cents: p.price != null ? Math.round(p.price * 100) : null,
  };
}

type OutfitEmbed = { name: string | null; outfit_items: { garment_id: string }[] } | null;
type MessageRow = { id: string; author: string; body: string; meta: { titre?: string | null; pourquoi?: string | null } | null; outfits: OutfitEmbed };

function toMessage(m: MessageRow): KodeMessage {
  const pieces = (m.outfits?.outfit_items ?? []).map((i) => i.garment_id);
  return {
    id: m.id,
    from: m.author === 'user' ? 'me' : 'kode',
    text: m.body,
    outfit: m.author === 'kode' && pieces.length >= 2
      ? { title: m.meta?.titre || m.outfits?.name || 'Proposée par Kode', pieces, why: m.meta?.pourquoi ?? '' }
      : undefined,
  };
}

/* ---- Compte ---- */

/** Les messages d'erreur d'Auth, dits simplement. */
function authMessage(error: { code?: string; message: string; status?: number }): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-mail ou mot de passe incorrect.';
    case 'email_not_confirmed':
      return 'Confirme d’abord ton e-mail : le lien est dans ta boîte de réception.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.';
    case 'weak_password':
      return 'Mot de passe trop simple : 8 caractères au moins, avec des lettres et des chiffres.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Trop de tentatives d’un coup. Réessaie dans quelques minutes.';
    case 'email_address_invalid':
      return 'Cette adresse e-mail n’est pas acceptée.';
  }
  if (!error.status) return 'Pas de connexion. Réessaie quand tu as du réseau.';
  return error.message;
}

export async function signIn(email: string, password: string): Promise<Result> {
  const { error } = await db().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return error ? { ok: false, message: authMessage(error) } : { ok: true };
}

/**
 * Crée le compte. Si le projet demande de confirmer l'e-mail (c'est le cas
 * aujourd'hui), aucune session n'est ouverte : `confirm` vaut true.
 */
export async function signUp(email: string, password: string, name: string): Promise<Result<{ confirm: boolean }>> {
  const { data, error } = await db().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { display_name: name.trim() || undefined } },
  });
  if (error) return { ok: false, message: authMessage(error) };
  // E-mail déjà inscrit : par discrétion, Auth répond comme si de rien n'était, mais sans identité.
  if (data.user && data.user.identities?.length === 0) return { ok: false, message: authMessage({ code: 'user_already_exists', message: '' }) };
  return { ok: true, confirm: !data.session };
}

export async function signOut() {
  await db().auth.signOut().catch(() => undefined);
}

/** Le compte connecté, tout entier ; null sans session. */
export async function loadAccount(): Promise<Account | null> {
  const sb = db();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const user = session.user;

  const space = await sb.from('spaces').select('id').limit(1).single();
  if (space.error) throw new Error(`espace : ${space.error.message}`);
  const spaceId = space.data.id as string;

  const [profile, style, silhouette, settings, garments, stats, subs, usage, planned, messages] = await Promise.all([
    sb.from('profiles').select('display_name, age_range, onboarded_at, created_at').eq('id', user.id).single(),
    sb.from('style_profile').select('gender, styles, colours, avoid_colours, occasions').eq('space_id', spaceId).single(),
    sb.from('silhouettes').select('shape, shape_source, height_cm, weight_kg, measurements, usual_sizes').eq('space_id', spaceId).single(),
    sb.from('settings').select('city, agenda_linked').eq('space_id', spaceId).single(),
    sb.from('garments')
      .select('id, name, category_id, kind, tint, season, colors, material, purchase_price_cents, created_at')
      .eq('space_id', spaceId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false }),
    sb.from('garment_stats').select('garment_id, wear_count, last_worn_on').eq('space_id', spaceId),
    sb.from('subscriptions').select('plan, period, status').eq('space_id', spaceId).in('status', ['active', 'trialing', 'past_due']),
    sb.rpc('kode_usage', { target: spaceId }),
    sb.from('planned_days')
      .select('day, outfits(name, outfit_items(garment_id))')
      .eq('space_id', spaceId)
      .gte('day', isoDay(0))
      .lte('day', isoDay(14)),
    sb.from('kode_messages')
      .select('id, author, body, meta, outfits(name, outfit_items(garment_id))')
      .eq('space_id', spaceId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);
  for (const [what, r] of Object.entries({ profile, style, silhouette, settings, garments, stats, subs, usage, planned, messages })) {
    if (r.error) throw new Error(`${what} : ${r.error.message}`);
  }

  const byGarment = new Map(((stats.data ?? []) as StatRow[]).map((st) => [st.garment_id, st]));
  const pieces = ((garments.data ?? []) as GarmentRow[]).map((g) => toPiece(g, byGarment.get(g.id)));

  const p = profile.data!;
  const st = style.data!;
  const si = silhouette.data!;
  const se = settings.data!;
  const measures = (si.measurements ?? {}) as Partial<Record<MeasureId, number>>;
  const sizes = (si.usual_sizes ?? {}) as Profile['sizes'];
  const ageIndex = AGE_IDS.indexOf(p.age_range ?? '');

  const rank = { couture: 3, atelier: 2, capsule: 1 } as Record<string, number>;
  const best = ((subs.data ?? []) as { plan: PlanId; period: Period }[]).sort((a, b) => (rank[b.plan] ?? 0) - (rank[a.plan] ?? 0))[0];

  const plannedDays: Record<number, Planned> = {};
  for (const d of (planned.data ?? []) as unknown as { day: string; outfits: OutfitEmbed }[]) {
    const ids = (d.outfits?.outfit_items ?? []).map((i) => i.garment_id);
    if (ids.length) plannedDays[dayOffset(d.day)] = { title: d.outfits?.name || 'Ma tenue', pieces: ids };
  }

  return {
    session: { userId: user.id, email: user.email ?? '', spaceId },
    onboarded: !!p.onboarded_at,
    profile: {
      ...EMPTY_PROFILE,
      name: p.display_name ?? '',
      rayon: (['femme', 'homme', 'mixte'] as Rayon[]).includes(st.gender as Rayon) ? (st.gender as Rayon) : null,
      age: ageIndex >= 0 ? AGES[ageIndex] : null,
      height: si.height_cm ?? null,
      weight: si.weight_kg ?? null,
      silhouette: si.shape ? (SHAPE_OF[si.shape] ?? null) : null,
      silhouetteSource: si.shape_source ?? null,
      measures,
      sizes,
      styles: labels(st.styles, STYLE_CARDS.map((c) => c.name)),
      love: labels(st.colours, COLOR_CHOICES.map((c) => c.name)),
      avoid: labels(st.avoid_colours, COLOR_CHOICES.map((c) => c.name)),
      occasions: labels(st.occasions, OCCASIONS.map((o) => o.label)),
      city: se.city ?? null,
      agenda: !!se.agenda_linked,
      email: user.email ?? null,
      since: since(p.created_at),
    },
    pieces,
    planned: plannedDays,
    messages: ((messages.data ?? []) as unknown as MessageRow[]).reverse().map(toMessage),
    kodeUsed: ((usage.data ?? []) as { used: number }[])[0]?.used ?? 0,
    plan: best?.plan ?? 'decouverte',
    period: best?.period ?? 'mois',
  };
}

/** L'offre et le compteur de Kode seulement : relus au retour du paiement. */
export async function loadPlan(spaceId: string): Promise<Pick<Account, 'plan' | 'period' | 'kodeUsed'>> {
  const sb = db();
  const [subs, usage] = await Promise.all([
    sb.from('subscriptions').select('plan, period').eq('space_id', spaceId).in('status', ['active', 'trialing', 'past_due']),
    sb.rpc('kode_usage', { target: spaceId }),
  ]);
  const rank = { couture: 3, atelier: 2, capsule: 1 } as Record<string, number>;
  const best = ((subs.data ?? []) as { plan: PlanId; period: Period }[]).sort((a, b) => (rank[b.plan] ?? 0) - (rank[a.plan] ?? 0))[0];
  return { plan: best?.plan ?? 'decouverte', period: best?.period ?? 'mois', kodeUsed: ((usage.data ?? []) as { used: number }[])[0]?.used ?? 0 };
}

/* ---- Écritures ---- */

function check(r: { error: { message: string } | null }, what: string) {
  if (r.error) throw new Error(`${what} : ${r.error.message}`);
}

/** Le profil entier : quatre tables, chacune ne reçoit que ce qui la concerne. */
export async function saveProfile(session: Session, p: Profile, finished = false) {
  const sb = db();
  const shape = p.silhouette && p.silhouette !== 'inconnue' ? SHAPES[p.silhouette] : null;
  const ageIndex = p.age ? AGES.indexOf(p.age) : -1;
  const results = await Promise.all([
    sb.from('profiles').update({
      display_name: p.name.trim() || null,
      age_range: ageIndex >= 0 ? AGE_IDS[ageIndex] : null,
      ...(finished ? { onboarded_at: new Date().toISOString() } : {}),
    }).eq('id', session.userId),
    sb.from('style_profile').update({
      gender: p.rayon,
      styles: p.styles.map(slug),
      colours: p.love.map(slug),
      avoid_colours: p.avoid.map(slug),
      occasions: p.occasions.map(slug),
      updated_at: new Date().toISOString(),
    }).eq('space_id', session.spaceId),
    sb.from('silhouettes').update({
      shape,
      shape_source: shape ? p.silhouetteSource : null,
      height_cm: p.height,
      weight_kg: p.weight,
      measurements: p.measures,
      usual_sizes: p.sizes,
      updated_at: new Date().toISOString(),
    }).eq('space_id', session.spaceId),
    sb.from('settings').update({ city: p.city?.trim() || null, agenda_linked: p.agenda }).eq('space_id', session.spaceId),
  ]);
  results.forEach((r, i) => check(r, ['profil', 'style', 'silhouette', 'réglages'][i]));
}

/** Ajoute des pièces ; rend, dans l'ordre, les identifiants donnés par la base. */
export async function addPieces(session: Session, pieces: Piece[]): Promise<string[]> {
  if (!pieces.length) return [];
  const r = await db().from('garments').insert(pieces.map((p) => garmentRow(p, session.spaceId))).select('id');
  check(r, 'pièces');
  return (r.data ?? []).map((g) => g.id as string);
}

export async function setPieceStatus(id: string, status: 'active' | 'archived') {
  if (!isUuid(id)) return;
  check(await db().from('garments').update({ status }).eq('id', id), 'pièce');
}

/** Note les pièces portées aujourd'hui ; déjà notée aujourd'hui, une pièce ne compte qu'une fois. */
export async function wear(ids: string[]) {
  const rows = ids.filter(isUuid).map((garment_id) => ({ garment_id, worn_on: isoDay(0) }));
  if (!rows.length) return;
  check(await db().from('wears').upsert(rows, { onConflict: 'garment_id,worn_on', ignoreDuplicates: true }), 'port');
}

export async function unwear(ids: string[]) {
  const list = ids.filter(isUuid);
  if (!list.length) return;
  check(await db().from('wears').delete().in('garment_id', list).eq('worn_on', isoDay(0)), 'port');
}

/** Une tenue prévue pour un jour : la tenue, ses pièces, puis le jour. */
export async function plan(session: Session, day: number, outfit: Planned, pieces: Piece[], source: 'user' | 'kode' = 'user') {
  const sb = db();
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const chosen = outfit.pieces.map((id) => byId.get(id)).filter((p): p is Piece => !!p && isUuid(p.id));
  if (!chosen.length) return;
  const created = await sb.from('outfits').insert({ space_id: session.spaceId, name: outfit.title.slice(0, 80) || null, source }).select('id').single();
  check(created, 'tenue');
  const outfitId = created.data!.id as string;
  check(await sb.from('outfit_items').insert(chosen.map((p) => ({ outfit_id: outfitId, garment_id: p.id, slot: slotOf(p) }))), 'pièces de la tenue');
  check(await sb.from('planned_days').upsert({ space_id: session.spaceId, day: isoDay(day), outfit_id: outfitId, worn: false }, { onConflict: 'space_id,day' }), 'agenda');
}

export async function unplan(session: Session, day: number) {
  check(await db().from('planned_days').delete().eq('space_id', session.spaceId).eq('day', isoDay(day)), 'agenda');
}

/* ---- Kode et paiement : les Edge Functions ---- */

/** Le message d'erreur qu'une fonction renvoie (elles écrivent pour la personne), ou un message par défaut. */
async function functionError(error: unknown, fallback: string): Promise<{ message: string; code: string | null }> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    return { message: body?.error ?? fallback, code: body?.code ?? null };
  }
  return { message: 'Pas de connexion. Réessaie quand tu as du réseau.', code: null };
}

/**
 * Pose la question à la fonction `kode`, puis relit la réponse enregistrée.
 * `counted` : la question compte dans le quota (faux si Kode n'a pas pu répondre).
 */
export async function askKode(question: string): Promise<{ reply: Omit<KodeMessage, 'id' | 'from'> & { id?: string }; counted: boolean }> {
  const sb = db();
  const { data, error } = await sb.functions.invoke<{ question_id: string; reply_id: string }>('kode', { body: { question } });
  if (error || !data) {
    const { message, code } = await functionError(error, 'Kode n’a pas pu répondre. Réessaie dans un instant.');
    const link: KodeLink | undefined =
      code === 'wardrobe' ? { label: 'Ajouter une pièce', route: 'AddPiece' } : code === 'quota' ? { label: 'Voir les offres', route: 'Offers' } : undefined;
    return { reply: { text: message, link }, counted: false };
  }
  const row = await sb.from('kode_messages').select('id, author, body, meta, outfits(name, outfit_items(garment_id))').eq('id', data.reply_id).single();
  if (row.error) return { reply: { text: 'Kode a répondu, mais la réponse n’a pas pu être relue. Rouvre la conversation dans un instant.' }, counted: true };
  const m = toMessage(row.data as unknown as MessageRow);
  return { reply: { id: m.id, text: m.text, outfit: m.outfit }, counted: true };
}

/** Ouvre le paiement Stripe (ou le portail pour changer d'offre) : rend l'adresse à ouvrir. */
export async function billing(plan: PlanId, period: Period): Promise<Result<{ url: string }>> {
  const body = plan === 'decouverte' ? { action: 'portal' } : { action: 'checkout', plan, period };
  const { data, error } = await db().functions.invoke<{ url: string }>('billing', { body });
  if (error || !data?.url) return { ok: false, ...(await functionError(error, 'Le paiement n’a pas pu s’ouvrir. Réessaie dans un instant.')) };
  return { ok: true, url: data.url };
}
