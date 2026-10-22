/**
 * Le pont entre l'app et Supabase : lire le compte, enregistrer chaque
 * action, et traduire entre le vocabulaire de l'app (libellés, portants)
 * et celui de la base (identifiants, contraintes de
 * supabase/migrations/*_app_mobile.sql). Toutes les lectures et écritures
 * passent par la RLS avec le jeton de la personne connectée.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { COLOR_CHOICES, COLOURS, type CategoryId, type Piece, type Season } from '../data/wardrobe';
import { GARMENT_KINDS, type GarmentKind } from '../ui/Garment';
import { AGES, EMPTY_PROFILE, OCCASIONS, STYLE_CARDS, type MeasureId, type Profile, type Rayon, type Silhouette } from './profile';
import type { Bloc, Contexte, JourMeteo } from './contexte';
import type { KodeLink, KodeMessage } from './kode';
import { JOB_SELECT, type JobRow, type Reveal } from './jobs';
import { slotOf as momentOf, type Iso, type RdvEvent, type Setting, type Stake, type Trip, type TripPurpose } from './planning';
import type { Ecart, Raison } from './ecarts';

export type PlanId = 'decouverte' | 'capsule' | 'atelier' | 'couture';
export type Period = 'mois' | 'an';
export type Planned = { title: string; pieces: string[]; tripId?: string | null };
/** Ce que la personne accepte de recevoir (07/10) : tout, seulement ses tenues prévues, ou rien. */
export type NotifChoice = 'tout' | 'planning' | 'non';
export type Session = { userId: string; email: string; spaceId: string };

export type Account = {
  session: Session;
  /** Le questionnaire a été rempli (sur ce téléphone ou un autre). */
  onboarded: boolean;
  profile: Profile;
  pieces: Piece[];
  /** Les tenues prévues, par date (AAAA-MM-JJ). */
  planned: Record<Iso, Planned>;
  events: RdvEvent[];
  trips: Trip[];
  notifs: NotifChoice | null;
  /** Les tenues écartées ces six derniers mois (« Pas pour moi »). */
  ecarts: Ecart[];
  /** Ce qui a été porté ces cinq dernières semaines, jour par jour. */
  journal: Record<Iso, string[]>;
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
  thumb_path: string | null; image_path: string | null;
};
type StatRow = { garment_id: string; wear_count: number | null; last_worn_on: string | null };

const GARMENT_SELECT = 'id, name, category_id, kind, tint, season, colors, material, purchase_price_cents, created_at, thumb_path, image_path';

const KODE_COLOURS: Record<string, [string, string]> = Object.fromEntries(COLOURS.map((c) => [c.id, [c.label, c.hex]]));

/** Une vignette détourée reste lisible une semaine ; l'app la redemande à chaque lancement. */
const IMAGE_TTL = 7 * 24 * 3600;

/** Les types de pièce du site et de Kodi sans illustration à eux : la plus proche. */
const KIND_ALIAS: Record<string, GarmentKind> = {
  blouse: 'chemise', sweat: 'pull', top: 'debardeur', legging: 'pantalon', combinaison: 'robe', manteau: 'trench',
  doudoune: 'veste', gilet: 'cardigan', bottes: 'bottines', sandales: 'escarpins', ballerines: 'mocassins',
  sacamain: 'sac', bandouliere: 'sac', pochette: 'sac', cabas: 'sac', sacados: 'sac', echarpe: 'foulard', bandeau: 'foulard',
};

/** L'illustration d'une pièce venue de la base : son type, un proche, ou celui de sa catégorie. */
export function garmentKindOf(categoryId: string | undefined, kind: string | null | undefined): GarmentKind {
  if (kind && (GARMENT_KINDS as string[]).includes(kind)) return kind as GarmentKind;
  if (kind && KIND_ALIAS[kind]) return KIND_ALIAS[kind];
  return DEFAULT_KIND[CATEGORY_OF[categoryId ?? ''] ?? 'accessoires'];
}

function toPiece(g: GarmentRow, st: StatRow | undefined, image?: string): Piece {
  const category = CATEGORY_OF[g.category_id] ?? 'accessoires';
  const kind = garmentKindOf(g.category_id, g.kind);
  const kodeColour = KODE_COLOURS[g.colors?.[0] ?? ''];
  const tint = g.tint && HEX.test(g.tint) ? g.tint : kodeColour?.[1];
  return {
    id: g.id,
    name: g.name,
    kind,
    tint,
    image,
    category,
    color: kodeColour?.[0] ?? g.colors?.[0] ?? '',
    colorId: kodeColour ? g.colors?.[0] : undefined,
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
    colors: p.colorId ? [p.colorId] : p.color ? [p.color] : [],
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
      ? { title: m.meta?.titre || m.outfits?.name || 'Proposée par Kodi', pieces, why: m.meta?.pourquoi ?? '' }
      : undefined,
  };
}

/** Les pièces, avec l'URL signée de leur vignette détourée quand Kodi l'a dessinée. */
async function withImages(rows: GarmentRow[], stats: StatRow[]): Promise<Piece[]> {
  const byGarment = new Map(stats.map((st) => [st.garment_id, st]));
  const paths = rows.map((g) => g.thumb_path ?? g.image_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    // Un seul aller-retour pour tout le dressing ; sans réseau, les illustrations prennent le relais.
    const { data } = await db().storage.from('garments').createSignedUrls(paths, IMAGE_TTL);
    for (const x of data ?? []) if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl);
  }
  return rows.map((g) => toPiece(g, byGarment.get(g.id), signed.get(g.thumb_path ?? g.image_path ?? '')));
}

/** Les pièces seules, relues après l'arrivée de celles que Kodi a dessinées. */
export async function loadPieces(spaceId: string): Promise<Piece[]> {
  const sb = db();
  const [garments, stats] = await Promise.all([
    sb.from('garments').select(GARMENT_SELECT).eq('space_id', spaceId).neq('status', 'archived').order('created_at', { ascending: false }),
    sb.from('garment_stats').select('garment_id, wear_count, last_worn_on').eq('space_id', spaceId),
  ]);
  if (garments.error) throw new Error(`pièces : ${garments.error.message}`);
  return withImages((garments.data ?? []) as GarmentRow[], (stats.data ?? []) as StatRow[]);
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

  const [profile, style, silhouette, settings, garments, stats, subs, usage, planned, messages, events, trips] = await Promise.all([
    sb.from('profiles').select('display_name, last_name, username, name_display, avatar_url, age_range, onboarded_at, created_at').eq('id', user.id).single(),
    sb.from('style_profile').select('gender, styles, colours, avoid_colours, occasions').eq('space_id', spaceId).single(),
    sb.from('silhouettes').select('shape, shape_source, height_cm, weight_kg, measurements, usual_sizes').eq('space_id', spaceId).single(),
    sb.from('settings').select('city, agenda_linked, notifications').eq('space_id', spaceId).single(),
    sb.from('garments').select(GARMENT_SELECT).eq('space_id', spaceId).neq('status', 'archived').order('created_at', { ascending: false }),
    sb.from('garment_stats').select('garment_id, wear_count, last_worn_on').eq('space_id', spaceId),
    sb.from('subscriptions').select('plan, period, status').eq('space_id', spaceId).in('status', ['active', 'trialing', 'past_due']),
    sb.rpc('kode_usage', { target: spaceId }),
    // Le calendrier montre le mois passé et les mois à venir.
    sb.from('planned_days')
      .select('day, trip_id, outfits(name, outfit_items(garment_id))')
      .eq('space_id', spaceId)
      .gte('day', isoDay(-31))
      .lte('day', isoDay(400)),
    sb.from('kode_messages')
      .select('id, author, body, meta, outfits(name, outfit_items(garment_id))')
      .eq('space_id', spaceId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(40),
    sb.from('events').select(EVENT_SELECT).eq('space_id', spaceId).gte('day', isoDay(-31)).order('day'),
    sb.from('trips').select(TRIP_SELECT).eq('space_id', spaceId).gte('ends_on', isoDay(-31)).order('starts_on'),
  ]);
  for (const [what, r] of Object.entries({ profile, style, silhouette, settings, garments, stats, subs, usage, planned, messages, events, trips })) {
    if (r.error) throw new Error(`${what} : ${r.error.message}`);
  }
  // Le journal, les tenues écartées et l'accord enrichissent l'app sans la bloquer : en cas d'échec, ils restent vides.
  const [ecarts, journal, bodyConsent] = await Promise.all([loadEcarts(spaceId), loadJournal(), loadConsent(spaceId, 'silhouette')]);

  const p = profile.data!;
  const [pieces, avatar] = await Promise.all([
    withImages((garments.data ?? []) as GarmentRow[], (stats.data ?? []) as StatRow[]),
    p.avatar_url ? sb.storage.from('uploads').createSignedUrl(p.avatar_url, IMAGE_TTL).then((r) => r.data?.signedUrl ?? null) : Promise.resolve(null),
  ]);

  const st = style.data!;
  const si = silhouette.data!;
  const se = settings.data!;
  const measures = (si.measurements ?? {}) as Partial<Record<MeasureId, number>>;
  const sizes = (si.usual_sizes ?? {}) as Profile['sizes'];
  const ageIndex = AGE_IDS.indexOf(p.age_range ?? '');

  const rank = { couture: 3, atelier: 2, capsule: 1 } as Record<string, number>;
  const best = ((subs.data ?? []) as { plan: PlanId; period: Period }[]).sort((a, b) => (rank[b.plan] ?? 0) - (rank[a.plan] ?? 0))[0];

  const plannedDays: Record<Iso, Planned> = {};
  for (const d of (planned.data ?? []) as unknown as { day: string; trip_id: string | null; outfits: OutfitEmbed }[]) {
    const ids = (d.outfits?.outfit_items ?? []).map((i) => i.garment_id);
    if (ids.length) plannedDays[d.day.slice(0, 10)] = { title: d.outfits?.name || 'Ma tenue', pieces: ids, tripId: d.trip_id };
  }
  const notif = (se.notifications as { choix?: NotifChoice } | null)?.choix ?? null;

  return {
    session: { userId: user.id, email: user.email ?? '', spaceId },
    onboarded: !!p.onboarded_at,
    profile: {
      ...EMPTY_PROFILE,
      name: p.display_name ?? '',
      lastName: p.last_name ?? null,
      username: p.username ?? null,
      nameDisplay: p.name_display === 'prenom_nom' || p.name_display === 'pseudo' ? p.name_display : 'prenom',
      avatar,
      avatarPath: p.avatar_url ?? null,
      rayon: (['femme', 'homme', 'mixte'] as Rayon[]).includes(st.gender as Rayon) ? (st.gender as Rayon) : null,
      age: ageIndex >= 0 ? AGES[ageIndex] : null,
      bodyConsent,
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
    events: ((events.data ?? []) as unknown as EventRow[]).map(toEvent),
    trips: ((trips.data ?? []) as unknown as TripRow[]).map(toTrip),
    notifs: notif === 'tout' || notif === 'planning' || notif === 'non' ? notif : null,
    ecarts,
    journal,
    messages: ((messages.data ?? []) as unknown as MessageRow[]).reverse().map(toMessage),
    kodeUsed: ((usage.data ?? []) as { used: number }[])[0]?.used ?? 0,
    plan: best?.plan ?? 'decouverte',
    period: best?.period ?? 'mois',
  };
}

/** L'offre et le compteur de Kodi seulement : relus au retour du paiement. */
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
      last_name: p.lastName?.trim() || null,
      name_display: p.nameDisplay,
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

/**
 * Le profil visible (07/10) : prénom, nom, pseudonyme et ce qui s'affiche.
 * Un pseudonyme déjà pris revient avec une phrase claire, rien n'est perdu.
 */
export async function saveIdentity(session: Session, p: Profile): Promise<Result> {
  const r = await db().from('profiles').update({
    display_name: p.name.trim() || null,
    last_name: p.lastName?.trim() || null,
    username: p.username || null,
    name_display: p.nameDisplay,
  }).eq('id', session.userId);
  if (!r.error) return { ok: true };
  if (r.error.code === '23505') return { ok: false, message: 'Ce pseudo est déjà pris. Essaie une variante.' };
  console.warn('[profil]', r.error.message);
  return { ok: false, message: 'Ton profil n’a pas pu être enregistré. Réessaie dans un instant.' };
}

/** La photo de profil : envoyée dans l'espace, son chemin noté sur le profil ; rend son adresse signée. */
export async function uploadAvatar(session: Session, photo: Photo): Promise<Result<{ path: string; url: string }>> {
  const sb = db();
  const mime = photo.mime && PHOTO_TYPES[photo.mime] ? photo.mime : 'image/jpeg';
  const path = `${session.spaceId}/avatar-${Date.now().toString(36)}.${PHOTO_TYPES[mime]}`;
  try {
    const body = await (await fetch(photo.uri)).arrayBuffer();
    if (body.byteLength > MAX_PHOTO_BYTES) return { ok: false, message: 'Cette photo est trop lourde (5 Mo au plus).' };
    const up = await sb.storage.from('uploads').upload(path, body, { contentType: mime });
    if (up.error) throw new Error(up.error.message);
    const r = await sb.from('profiles').update({ avatar_url: path }).eq('id', session.userId);
    if (r.error) throw new Error(r.error.message);
    const signed = await sb.storage.from('uploads').createSignedUrl(path, IMAGE_TTL);
    return { ok: true, path, url: signed.data?.signedUrl ?? photo.uri };
  } catch (e) {
    console.warn('[profil] photo :', e instanceof Error ? e.message : e);
    return { ok: false, message: 'Ta photo n’a pas pu être envoyée. Réessaie dans un instant.' };
  }
}

export async function removeAvatar(session: Session) {
  check(await db().from('profiles').update({ avatar_url: null }).eq('id', session.userId), 'photo de profil');
}

/** Ajoute des pièces ; rend, dans l'ordre, les identifiants donnés par la base. */
export async function addPieces(session: Session, pieces: Piece[]): Promise<string[]> {
  if (!pieces.length) return [];
  const r = await db().from('garments').insert(pieces.map((p) => garmentRow(p, session.spaceId))).select('id');
  check(r, 'pièces');
  return (r.data ?? []).map((g) => g.id as string);
}

/**
 * L'étiquette corrigée à la main (nom, catégorie, couleur, matière, saison,
 * prix). Le type de pièce ne change qu'avec la catégorie : sinon on garde
 * celui, plus fin, que Kodi avait noté.
 */
export async function updatePiece(id: string, p: Piece, categoryChanged: boolean) {
  if (!isUuid(id)) return;
  const row: Record<string, unknown> = {
    name: p.name.slice(0, 120),
    category_id: categoryId(p),
    colors: p.colorId ? [p.colorId] : [],
    tint: p.tint && HEX.test(p.tint) ? p.tint : null,
    material: p.material.trim() || null,
    season: SEASON_ID[p.season] ?? null,
    purchase_price_cents: p.price != null ? Math.round(p.price * 100) : null,
    updated_at: new Date().toISOString(),
  };
  if (categoryChanged) row.kind = /^[a-z]{2,20}$/.test(p.kind) ? p.kind : null;
  check(await db().from('garments').update(row).eq('id', id), 'pièce');
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

type EcartRow = { id: string; garment_ids: string[]; reason: Raison; target_ids: string[]; created_at: string };

async function loadEcarts(spaceId: string): Promise<Ecart[]> {
  const r = await db()
    .from('outfit_feedback')
    .select('id, garment_ids, reason, target_ids, created_at')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (r.error) {
    console.warn('[supabase] tenues écartées :', r.error.message);
    return [];
  }
  return ((r.data ?? []) as EcartRow[]).map((e) => ({ id: e.id, date: e.created_at.slice(0, 10), pieces: e.garment_ids, raison: e.reason, cibles: e.target_ids ?? [] }));
}

/** Les ports des cinq dernières semaines, regroupés par jour (la RLS ne rend que ceux de l'espace). */
async function loadJournal(): Promise<Record<Iso, string[]>> {
  const r = await db().from('wears').select('garment_id, worn_on').gte('worn_on', isoDay(-35));
  if (r.error) {
    console.warn('[supabase] journal :', r.error.message);
    return {};
  }
  const out: Record<Iso, string[]> = {};
  for (const w of (r.data ?? []) as { garment_id: string; worn_on: string }[]) (out[w.worn_on] ??= []).push(w.garment_id);
  return out;
}

/* ---- Accords et droits (RGPD, 09/10) ---- */

export type ConsentKind = 'silhouette';

/** L'accord en vigueur : sa date s'il est donné, null s'il ne l'est pas ou plus. */
async function loadConsent(spaceId: string, kind: ConsentKind): Promise<string | null> {
  const r = await db().from('consents').select('granted, created_at').eq('space_id', spaceId).eq('kind', kind).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (r.error) {
    console.warn('[supabase] accord :', r.error.message);
    return null;
  }
  return r.data?.granted ? (r.data.created_at as string) : null;
}

/**
 * Un accord donné ou retiré, gardé comme preuve (date, version). Retiré, la
 * base efface aussitôt la taille, le poids, la silhouette et les mesures.
 */
export async function saveConsent(session: Session, kind: ConsentKind, granted: boolean) {
  check(await db().from('consents').insert({ space_id: session.spaceId, profile_id: session.userId, kind, granted, version: 1 }), 'accord');
}

/** Toutes tes données, préparées par la fonction `compte` : un lien valable une heure. */
export async function exportData(): Promise<Result<{ url: string }>> {
  const { data, error } = await db().functions.invoke<{ url: string }>('compte', { body: { action: 'exporter' } });
  if (error || !data?.url) return { ok: false, ...(await functionError(error, 'L’export n’a pas pu être préparé. Réessaie dans un instant.')) };
  return { ok: true, url: data.url };
}

/** Supprime le compte et tout ce qu'il contient ; l'abonnement s'arrête. */
export async function deleteAccount(): Promise<Result> {
  const { data, error } = await db().functions.invoke<{ ok: boolean }>('compte', { body: { action: 'supprimer', confirmation: 'SUPPRIMER' } });
  if (error || !data?.ok) return { ok: false, ...(await functionError(error, 'La suppression n’a pas abouti. Réessaie dans un instant.')) };
  return { ok: true };
}

/** « Pas pour moi » : la tenue écartée et sa raison, que Kodi lira avec ses prochaines questions. */
export async function saveEcart(session: Session, e: Ecart) {
  const garment_ids = e.pieces.filter(isUuid);
  if (!garment_ids.length) return;
  check(
    await db().from('outfit_feedback').insert({ id: e.id, space_id: session.spaceId, garment_ids, reason: e.raison, target_ids: e.cibles.filter(isUuid) }),
    'tenue écartée',
  );
}

export async function unwear(ids: string[]) {
  const list = ids.filter(isUuid);
  if (!list.length) return;
  check(await db().from('wears').delete().in('garment_id', list).eq('worn_on', isoDay(0)), 'port');
}

/** Une tenue prévue pour un jour : la tenue, ses pièces, puis le jour (et son voyage). */
export async function plan(session: Session, date: Iso, outfit: Planned, pieces: Piece[], source: 'user' | 'kode' = 'user') {
  const sb = db();
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const chosen = outfit.pieces.map((id) => byId.get(id)).filter((p): p is Piece => !!p && isUuid(p.id));
  if (!chosen.length) return;
  const created = await sb.from('outfits').insert({ space_id: session.spaceId, name: outfit.title.slice(0, 80) || null, source }).select('id').single();
  check(created, 'tenue');
  const outfitId = created.data!.id as string;
  check(await sb.from('outfit_items').insert(chosen.map((p) => ({ outfit_id: outfitId, garment_id: p.id, slot: slotOf(p) }))), 'pièces de la tenue');
  const trip_id = outfit.tripId && isUuid(outfit.tripId) ? outfit.tripId : null;
  check(await sb.from('planned_days').upsert({ space_id: session.spaceId, day: date, outfit_id: outfitId, worn: false, trip_id }, { onConflict: 'space_id,day' }), 'agenda');
}

export async function unplan(session: Session, date: Iso) {
  check(await db().from('planned_days').delete().eq('space_id', session.spaceId).eq('day', date), 'agenda');
}

/* ---- Rendez-vous et voyages (07/10) ---- */

const EVENT_SELECT = 'id, day, starts_at, title, kind, dress_code, stake, impressions, place, setting, flags, note';
type EventRow = {
  id: string; day: string; starts_at: string | null; title: string; kind: string | null; dress_code: string | null; stake: Stake | null;
  impressions: string[] | null; place: string | null; setting: Setting | null; flags: string[] | null; note: string | null;
};
const toEvent = (r: EventRow): RdvEvent => ({
  id: r.id,
  date: r.day.slice(0, 10),
  time: r.starts_at ? r.starts_at.slice(0, 5) : null,
  title: r.title,
  kind: r.kind,
  dressCode: r.dress_code,
  stake: r.stake,
  impressions: r.impressions ?? [],
  place: r.place,
  setting: r.setting,
  constraints: r.flags ?? [],
  note: r.note,
});

export async function saveEvent(session: Session, e: RdvEvent) {
  check(
    await db().from('events').upsert({
      id: e.id,
      space_id: session.spaceId,
      day: e.date,
      starts_at: e.time,
      slot: momentOf(e.time),
      title: e.title.slice(0, 120),
      kind: e.kind,
      dress_code: e.dressCode,
      stake: e.stake,
      impressions: e.impressions,
      place: e.place,
      setting: e.setting,
      flags: e.constraints,
      note: e.note,
    }),
    'rendez-vous',
  );
}

export async function removeEvent(id: string) {
  check(await db().from('events').delete().eq('id', id), 'rendez-vous');
}

const TRIP_SELECT = 'id, destination, country, latitude, longitude, starts_on, ends_on, purpose, activities, image';
type TripRow = {
  id: string; destination: string; country: string | null; latitude: number | null; longitude: number | null;
  starts_on: string; ends_on: string; purpose: TripPurpose | null; activities: string[] | null; image: Trip['image'];
};
const toTrip = (r: TripRow): Trip => ({
  id: r.id,
  destination: r.destination,
  country: r.country,
  lat: r.latitude,
  lon: r.longitude,
  start: r.starts_on.slice(0, 10),
  end: r.ends_on.slice(0, 10),
  purpose: r.purpose ?? 'Plaisir',
  activities: r.activities ?? [],
  image: r.image ?? null,
});

export async function saveTrip(session: Session, t: Trip) {
  check(
    await db().from('trips').upsert({
      id: t.id,
      space_id: session.spaceId,
      destination: t.destination,
      country: t.country,
      latitude: t.lat,
      longitude: t.lon,
      starts_on: t.start,
      ends_on: t.end,
      purpose: t.purpose,
      activities: t.activities,
      image: t.image,
    }),
    'voyage',
  );
}

/** Le voyage part, et ses tenues avec lui (planned_days.trip_id en cascade). */
export async function removeTrip(id: string) {
  check(await db().from('trips').delete().eq('id', id), 'voyage');
}

export async function saveNotifs(session: Session, choix: NotifChoice) {
  check(await db().from('settings').update({ notifications: { choix } }).eq('space_id', session.spaceId), 'notifications');
}

/* ---- Kodi et paiement : les Edge Functions ---- */

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
 * `counted` : la question compte dans le quota (faux si Kodi n'a pas pu répondre).
 */
export async function askKode(question: string): Promise<{ reply: Omit<KodeMessage, 'id' | 'from'> & { id?: string }; counted: boolean }> {
  const sb = db();
  const { data, error } = await sb.functions.invoke<{ question_id: string; reply_id: string }>('kode', { body: { question } });
  if (error || !data) {
    const { message, code } = await functionError(error, 'Kodi n’a pas pu répondre. Réessaie dans un instant.');
    const link: KodeLink | undefined =
      code === 'wardrobe' ? { label: 'Ajouter une pièce', route: 'AddPiece' } : code === 'quota' ? { label: 'Voir les offres', route: 'Offers' } : undefined;
    return { reply: { text: message, link }, counted: false };
  }
  const row = await sb.from('kode_messages').select('id, author, body, meta, outfits(name, outfit_items(garment_id))').eq('id', data.reply_id).single();
  if (row.error) return { reply: { text: 'Kodi a répondu, mais la réponse n’a pas pu être relue. Rouvre la conversation dans un instant.' }, counted: true };
  const m = toMessage(row.data as unknown as MessageRow);
  return { reply: { id: m.id, text: m.text, outfit: m.outfit }, counted: true };
}

/**
 * Les données du jour (météo, fériés, vacances scolaires, tendances…) pour la
 * ville du profil, depuis la fonction serveur `donnees`. Jamais d'appel direct
 * aux API depuis l'app : le serveur garde le cache et les sources de secours.
 * null si la fonction ne répond pas : l'app garde alors le dernier paquet reçu.
 */
export async function loadContexte(ville?: string | null): Promise<Contexte | null> {
  // La ville du téléphone part avec la demande : un changement de ville compte avant même d'être enregistré.
  const { data, error } = await db().functions.invoke<Contexte>('donnees', { body: ville?.trim() ? { ville: ville.trim() } : {} });
  if (error || !data?.jour) {
    console.warn('[supabase] données du jour :', (await functionError(error, 'sans réponse')).message);
    return null;
  }
  return data;
}

/* ---- Voyages : lieu, photo et météo, par la fonction `donnees` (07/10) ---- */

export type Lieu = { nom: string; pays: string | null; region: string | null; lat: number; lon: number };
export type JourVoyage = { date: string; max: number; min: number; ciel: JourMeteo['ciel']; libelle: string; nature: 'prevision' | 'saison' };
export type InfosVoyage = { photo: Bloc<{ url: string; credit: string; page: string | null }>; prevision: Bloc<JourVoyage[]> | null; saison: Bloc<JourVoyage[]> | null };

/** Les lieux du monde qui portent ce nom. */
export async function lieux(q: string): Promise<Result<{ lieux: Lieu[] }>> {
  const { data, error } = await db().functions.invoke<{ lieux: Bloc<Lieu[]> }>('donnees', { body: { action: 'lieux', q } });
  if (error || !data) return { ok: false, ...(await functionError(error, 'La recherche ne répond pas. Réessaie dans un instant.')) };
  return { ok: true, lieux: data.lieux.valeur ?? [] };
}

/** La photo du lieu et sa météo, jour par jour. */
export async function infosVoyage(nom: string, lat: number, lon: number, debut: string, fin: string): Promise<InfosVoyage | null> {
  const { data, error } = await db().functions.invoke<InfosVoyage>('donnees', { body: { action: 'voyage', nom, lat, lon, debut, fin } });
  if (error || !data) {
    console.warn('[supabase] voyage :', (await functionError(error, 'sans réponse')).message);
    return null;
  }
  return data;
}

/**
 * Kodi prévoit plusieurs jours d'un coup (fonction `kode`, action `planifier`) :
 * une tenue par jour, avec les rendez-vous, la météo et le voyage s'il y en a un.
 * Les pièces reviennent avec leurs identifiants ; une question est comptée.
 */
export async function planifier(dates: Iso[], trip: Trip | null, consigne: string): Promise<Record<Iso, Planned>> {
  type Jour = { date: string; titre: string; pourquoi: string; pieces: string[] };
  const voyage = trip ? { destination: trip.destination, pays: trip.country, motif: trip.purpose, activites: trip.activities, lat: trip.lat, lon: trip.lon } : null;
  const { data, error } = await db().functions.invoke<{ jours: Jour[] }>('kode', { body: { action: 'planifier', jours: dates, voyage, consigne } });
  if (error || !data?.jours) throw new Error((await functionError(error, 'Kodi ne répond pas')).message);
  return Object.fromEntries(data.jours.filter((j) => j.pieces.length).map((j) => [j.date, { title: j.titre || 'Par Kodi', pieces: j.pieces, tripId: trip?.id ?? null }]));
}

/** Ouvre le paiement Stripe (ou le portail pour changer d'offre) : rend l'adresse à ouvrir. */
export async function billing(plan: PlanId, period: Period): Promise<Result<{ url: string }>> {
  const body = plan === 'decouverte' ? { action: 'portal' } : { action: 'checkout', plan, period };
  const { data, error } = await db().functions.invoke<{ url: string }>('billing', { body });
  if (error || !data?.url) return { ok: false, ...(await functionError(error, 'Le paiement n’a pas pu s’ouvrir. Réessaie dans un instant.')) };
  return { ok: true, url: data.url };
}

/* ---- Photos confiées à Kodi (Edge Function dressy-agent) ---- */

/** Même limite que le bucket `uploads`. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type Photo = { uri: string; mime?: string | null };

/**
 * Envoie les photos dans l'espace, puis confie chacune à Kodi : une tâche
 * `ai_jobs` par photo. L'insertion réveille l'agent, qui repère les pièces et
 * les dessine en parallèle. Si quoi que ce soit échoue, rien n'est confié et
 * les photos déjà envoyées repartent.
 */
export async function sendPhotos(session: Session, photos: Photo[], hint: string): Promise<Result<{ jobs: JobRow[]; paths: string[] }>> {
  const sb = db();
  const stamp = Date.now().toString(36);
  const items = photos.map((ph, i) => {
    const mime = ph.mime && PHOTO_TYPES[ph.mime] ? ph.mime : 'image/jpeg';
    return { ...ph, mime, path: `${session.spaceId}/${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}.${PHOTO_TYPES[mime]}` };
  });
  const paths = items.map((x) => x.path);
  try {
    const bodies = await Promise.all(items.map(async (x) => (await fetch(x.uri)).arrayBuffer()));
    if (bodies.some((b) => b.byteLength > MAX_PHOTO_BYTES)) {
      return { ok: false, message: 'Une photo est trop lourde (5 Mo au plus). Essaie-en une autre, ou reprends-la de plus loin.' };
    }
    // Toutes en même temps : l'attente ne s'allonge pas avec leur nombre.
    const sent = await Promise.all(items.map((x, i) => sb.storage.from('uploads').upload(x.path, bodies[i], { contentType: x.mime })));
    if (sent.some((r) => r.error)) throw new Error('envoi');

    const { data, error } = await sb
      .from('ai_jobs')
      .insert(paths.map((p) => ({ space_id: session.spaceId, requested_by: session.userId, source_paths: [p], user_input: hint.trim().slice(0, 280) })))
      .select(JOB_SELECT);
    if (error) {
      await sb.storage.from('uploads').remove(paths);
      // Les messages des déclencheurs (quota du jour, dressing plein) sont écrits pour être lus.
      return { ok: false, message: ['quota', 'photos', 'pieces'].includes(error.hint ?? '') ? error.message : 'La demande n’est pas partie. Réessaie.' };
    }
    return { ok: true, jobs: (data ?? []) as unknown as JobRow[], paths };
  } catch {
    await sb.storage.from('uploads').remove(paths).catch(() => undefined);
    return { ok: false, message: 'Une photo n’a pas pu être envoyée. Vérifie ta connexion et réessaie.' };
  }
}

/** L'état des tâches de ces photos : la photo elle-même et chaque pièce repérée. */
export async function readJobs(paths: string[]): Promise<JobRow[]> {
  if (!paths.length) return [];
  const { data, error } = await db().from('ai_jobs').select(JOB_SELECT).overlaps('source_paths', paths).order('created_at');
  if (error) throw new Error(`tâches : ${error.message}`);
  return (data ?? []) as unknown as JobRow[];
}

/** Les images du détourage révélé : le dessin avec son fond, la pièce détourée. */
export async function revealsFor(jobs: JobRow[]): Promise<Record<string, Reveal>> {
  const sb = db();
  const ready = jobs.filter((j) => j.analysis?.reveal && j.garment_id);
  if (!ready.length) return {};
  const { data: garments } = await sb.from('garments').select('id, image_path').in('id', ready.map((j) => j.garment_id!));
  const imageOf = new Map(((garments ?? []) as { id: string; image_path: string | null }[]).map((g) => [g.id, g.image_path]));
  const [raws, cuts] = await Promise.all([
    sb.storage.from('ai-generated').createSignedUrls(ready.map((j) => j.analysis!.reveal!.raw), 900),
    sb.storage.from('garments').createSignedUrls(ready.map((j) => imageOf.get(j.garment_id!) ?? ''), 900),
  ]);
  const out: Record<string, Reveal> = {};
  ready.forEach((j, i) => {
    const raw = raws.data?.[i]?.signedUrl;
    const cut = cuts.data?.[i]?.signedUrl;
    const r = j.analysis!.reveal!;
    if (raw && cut) out[j.id] = { raw, cut, size: r.size, box: r.box };
  });
  return out;
}

/** Relance une pièce en échec (deux fois au plus, contrôlé par la base). */
export async function retryJob(id: string): Promise<Result> {
  const { error } = await db().rpc('retry_ai_job', { target: id });
  return error ? { ok: false, message: error.message } : { ok: true };
}

/** Retire une pièce en échec ; sa photo ne part que si plus aucune pièce ne s'en sert. */
export async function dismissJob(id: string): Promise<Result> {
  const sb = db();
  const { data: job } = await sb.from('ai_jobs').select('source_paths, status').eq('id', id).maybeSingle();
  if (!job) return { ok: true };
  const { error } = await sb.from('ai_jobs').delete().eq('id', id);
  if (error) return { ok: false, message: 'Cette pièce n’a pas pu être retirée. Réessaie.' };
  const paths = (job.source_paths ?? []) as string[];
  if (paths.length) {
    const { count } = await sb.from('ai_jobs').select('id', { count: 'exact', head: true }).overlaps('source_paths', paths).neq('status', 'done');
    if (!count) await sb.storage.from('uploads').remove(paths);
  }
  return { ok: true };
}
