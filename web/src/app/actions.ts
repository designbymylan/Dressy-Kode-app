'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getViewer, type Theme } from '@/lib/space';
import { enabledProviders, safeNext, siteOrigin, type Provider } from '@/lib/auth';
import { parisDay } from '@/lib/dates';
import { loadMessages, loadUsage, type KodeMessage, type KodeUsage, type OutfitView } from '@/lib/kode';
import { loadSavedOutfits } from '@/lib/agenda';
import { isPeriod, isPlacePack, isPlan } from '@/lib/plans';
import {
  GENDERS, GOALS, STYLES, ITEMS, JEWELRY, METALS, ACCESSORIES, COLOURS, AVOID, OCCASIONS,
  MORNING_TIME, TIME_INTENT, ASSISTANCE, NO_JEWELRY, type Answers,
} from '@/lib/onboarding';
import { categoryMeta, isKnownKind, slotFor } from '@/lib/wardrobe';

// code : ce que l'écran peut proposer en plus du message (« pieces » → voir les offres).
export type FormResult = { error: string; code?: string } | undefined;

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Adresse e-mail ou mot de passe incorrect.',
  email_not_confirmed: "Confirme d'abord ton adresse : le lien t'attend dans tes e-mails.",
  user_already_exists: 'Un compte existe déjà avec cette adresse. Connecte-toi.',
  email_address_invalid: "Cette adresse e-mail n'est pas valide.",
  weak_password: 'Mot de passe trop court : il en faut au moins 8.',
  same_password: "C'est déjà ton mot de passe actuel : choisis-en un autre.",
  over_email_send_rate_limit: 'Trop de tentatives. Réessaie dans quelques minutes.',
  over_request_rate_limit: 'Trop de tentatives. Réessaie dans quelques minutes.',
};

function readable(code: string | undefined, fallback: string) {
  return (code && AUTH_ERRORS[code]) ?? fallback;
}

/**
 * Création de compte : e-mail et mot de passe seulement. Le prénom se donne
 * ensuite, dans le questionnaire. Si le projet confirme les e-mails, le lien
 * reçu ramène directement au questionnaire (/auth/callback), sans repasser
 * par la connexion.
 */
export async function signUp(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (formData.get('adult') !== '1') return { error: 'Dresskode est ouverte à partir de 15 ans : coche la case pour continuer.' };
  if (!email || !password) return { error: 'Adresse e-mail et mot de passe sont nécessaires.' };
  if (password.length < 8) return { error: 'Mot de passe trop court : il en faut au moins 8.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/demarrage` },
  });

  if (error) return { error: readable(error.code, "L'inscription n'a pas abouti. Réessaie.") };
  // Adresse déjà inscrite et confirmée : Supabase répond sans erreur, mais
  // sans identité, pour ne pas révéler l'existence du compte.
  if (data.user && !data.user.identities?.length) return { error: AUTH_ERRORS.user_already_exists };

  redirect(data.session ? '/demarrage' : `/inscription/verifier?email=${encodeURIComponent(email)}`);
}

export async function signIn(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Adresse e-mail et mot de passe sont nécessaires.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: readable(error.code, 'Connexion impossible.') };

  // Un compte dont le questionnaire n'est pas fait y est renvoyé par le
  // layout de l'application. Sinon, la page qui avait demandé la connexion.
  redirect(safeNext(String(formData.get('suite') ?? ''), '/accueil'));
}

const PROVIDER_NAME: Record<Provider, string> = { google: 'Google', apple: 'Apple' };

/** « Continuer avec Google / Apple » : première fois, questionnaire ; ensuite, accueil. */
export async function signInWithProvider(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const provider = formData.get('provider');
  if (provider !== 'google' && provider !== 'apple') return { error: 'Choisis Google ou Apple.' };

  const enabled = await enabledProviders();
  if (!enabled[provider]) {
    return { error: `La connexion avec ${PROVIDER_NAME[provider]} arrive bientôt. En attendant, utilise ton e-mail.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await siteOrigin()}/auth/callback?next=/demarrage` },
  });
  if (error || !data.url) return { error: `La connexion avec ${PROVIDER_NAME[provider]} n'a pas pu s'ouvrir. Réessaie.` };
  redirect(data.url);
}

/** Renvoie l'e-mail de confirmation, depuis l'écran « Regarde tes e-mails ». */
export async function resendConfirmation(_prev: FormResult | { sent: true }, formData: FormData): Promise<FormResult | { sent: true }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Adresse e-mail manquante.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/demarrage` },
  });
  if (error) return { error: readable(error.code, "L'e-mail n'est pas reparti. Réessaie dans un instant.") };
  return { sent: true };
}

/**
 * « Mot de passe oublié » : même réponse que le compte existe ou non, pour
 * ne pas révéler qui est inscrit.
 */
export async function requestPasswordReset(_prev: FormResult | { sent: true }, formData: FormData): Promise<FormResult | { sent: true }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Indique ton adresse e-mail.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/mot-de-passe/nouveau`,
  });
  if (error && error.code?.startsWith('over_')) return { error: readable(error.code, '') };
  return { sent: true };
}

export async function updatePassword(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) return { error: 'Mot de passe trop court : il en faut au moins 8.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Ce lien a expiré. Demande-en un nouveau.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: readable(error.code, "Le mot de passe n'a pas pu être changé. Réessaie.") };
  redirect('/accueil');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/connexion');
}

const YEAR = 365 * 24 * 3600;

export async function setTheme(theme: Theme) {
  if (!['light', 'dark', 'auto'].includes(theme)) return;
  const viewer = await getViewer();

  if (viewer) {
    const supabase = await createClient();
    await supabase.from('settings').update({ theme }).eq('space_id', viewer.spaceId);
  } else {
    // Un visiteur (bienvenue, connexion) garde son choix sur l'appareil.
    (await cookies()).set('dk_theme', theme, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  }

  // layout.tsx relit le thème : on invalide tout l'arbre pour que le
  // changement porte sur l'application entière, pas sur l'écran courant.
  revalidatePath('/', 'layout');
}

/** Montre ou masque l'encoche clair / sombre (réglage propre à l'appareil). */
export async function setThemeShortcut(on: boolean) {
  const jar = await cookies();
  if (on) jar.delete('dk_theme_tab');
  else jar.set('dk_theme_tab', '0', { path: '/', maxAge: YEAR, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

/**
 * « Je l'ai portée aujourd'hui », depuis la fiche d'une pièce : un premier
 * toucher note le port, un second l'annule. C'est ce qui fait avancer la
 * barre de progression du dressing.
 */
export async function togglePieceWear(garmentId: string): Promise<{ error: string } | { worn: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const supabase = await createClient();
  const day = parisDay(0);
  const { data: existing } = await supabase
    .from('wears')
    .select('garment_id')
    .eq('garment_id', garmentId)
    .eq('worn_on', day)
    .limit(1);

  const res = existing?.length
    ? await supabase.from('wears').delete().eq('garment_id', garmentId).eq('worn_on', day)
    : await supabase.from('wears').insert({ garment_id: garmentId, worn_on: day });
  if (res.error) return { error: "Le port n'a pas pu être noté." };

  revalidatePath('/dressing');
  revalidatePath('/accueil');
  return { worn: !existing?.length };
}

export async function addGarment(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const name = String(formData.get('name') ?? '').trim();
  const categoryId = String(formData.get('category_id') ?? '');
  const kindRaw = String(formData.get('kind') ?? '');
  const colour = String(formData.get('colour') ?? '');
  const material = String(formData.get('material') ?? '').trim();
  const priceRaw = String(formData.get('price') ?? '').trim().replace(',', '.');

  if (!name) return { error: 'Donne un nom à la pièce.' };
  if (!categoryMeta(categoryId)) return { error: 'Choisis une catégorie.' };
  const kind = kindRaw && isKnownKind(categoryId, kindRaw) ? kindRaw : null;
  const colors = COLOURS.some((c) => c.id === colour) ? [colour] : [];

  const price = priceRaw ? Math.round(Number(priceRaw) * 100) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return { error: 'Le prix ne se lit pas. Exemple : 49,90' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('garments').insert({
    space_id: viewer.spaceId,
    category_id: categoryId,
    kind,
    colors,
    name,
    material: material || null,
    purchase_price_cents: price,
    source: 'photo',
  });

  if (error) {
    return error.hint === 'pieces'
      ? { error: error.message, code: 'pieces' }
      : { error: "La pièce n'a pas pu être ajoutée. Réessaie." };
  }

  revalidatePath('/dressing');
  redirect('/dressing');
}

export type PieceDetails = { brand?: string; size?: string; fit?: string; material?: string; note?: string };

function cleanDetails(raw: PieceDetails | undefined): PieceDetails | null {
  const out: PieceDetails = {};
  for (const k of ['brand', 'size', 'fit', 'material', 'note'] as const) {
    const v = String(raw?.[k] ?? '').trim();
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

const DAILY_QUOTA = 20; // même limite que le trigger ai_jobs_before_insert (photos par jour)
const MAX_PHOTOS_PER_BATCH = 10;

/**
 * Confie à l'agent central les photos déjà déposées dans `uploads` par le
 * navigateur : une tâche par photo. L'agent y repère ensuite TOUTES les
 * pièces (ou celles que la précision nomme) et crée une tâche par pièce.
 */
export async function requestAiGarments(input: { paths: string[]; hint: string; details?: PieceDetails }): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const paths = Array.isArray(input?.paths) ? input.paths.map(String) : [];
  if (!paths.length) return { error: 'Ajoute au moins une photo.' };
  if (paths.length > MAX_PHOTOS_PER_BATCH) return { error: `${MAX_PHOTOS_PER_BATCH} photos au plus à la fois.` };
  // La base refait ce contrôle ; ici il évite d'envoyer une demande perdue d'avance.
  if (paths.some((p) => !p.startsWith(`${viewer.spaceId}/`))) return { error: 'Photo hors de ton espace.' };

  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from('ai_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', viewer.spaceId)
    .is('parent_id', null)
    .gte('created_at', since);

  const left = DAILY_QUOTA - (count ?? 0);
  if (paths.length > left) {
    return {
      error: left > 0
        ? `Il te reste ${left} photo${left > 1 ? 's' : ''} à confier à Kodi aujourd'hui : retire-en ${paths.length - left}.`
        : `Tu as confié ${DAILY_QUOTA} photos à Kodi aujourd'hui, c'est la limite du jour. Reviens demain.`,
    };
  }

  const hint = String(input?.hint ?? '').trim().slice(0, 280);
  // Les précisions valent pour une photo d'une seule pièce ; la base borne chaque champ.
  const details = paths.length === 1 ? cleanDetails(input?.details) : null;
  const { error } = await supabase.from('ai_jobs').insert(
    paths.map((p) => ({
      space_id: viewer.spaceId,
      requested_by: viewer.userId,
      source_paths: [p],
      user_input: hint,
      details,
    })),
  );

  if (error) {
    // Les messages des triggers (quota, photo hors espace, dressing plein) sont écrits pour être lus.
    return ['quota', 'photos', 'pieces'].includes(error.hint)
      ? { error: error.message, code: error.hint }
      : { error: "La demande n'est pas partie. Réessaie." };
  }

  revalidatePath('/dressing');
  return undefined;
}

/**
 * « Rendu incorrect » : la découpe de la pièce reprend à partir de sa photo
 * (la base compte les reprises et refuse au-delà de deux).
 */
export async function reportGarment(garmentId: string): Promise<FormResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('report_garment', { target: garmentId });
  if (error) return { error: error.message };
  revalidatePath('/dressing');
  return undefined;
}

/**
 * « Image propre » : Kodi redessine la pièce à partir de sa photo (une
 * génération). La base refuse, sans rien appeler, quand il n'en reste plus.
 */
export async function requestCleanImage(garmentId: string): Promise<FormResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_clean_image', { target: garmentId });
  if (error) {
    return error.hint === 'quota'
      ? { error: 'Tu as utilisé tes générations.', code: 'quota' }
      : { error: error.message || "Kodi n'a pas pu démarrer. Réessaie dans un instant." };
  }
  revalidatePath('/dressing');
  return undefined;
}

export async function retryAiJob(jobId: string): Promise<FormResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('retry_ai_job', { target: jobId });
  if (error) return { error: error.message };
  revalidatePath('/dressing');
  return undefined;
}

/**
 * Retire une pièce en échec de la liste. Ses photos d'origine ne partent que
 * si aucune autre pièce repérée sur la même photo ne s'en sert encore.
 */
export async function dismissAiJob(jobId: string): Promise<FormResult> {
  const supabase = await createClient();
  const { data: job } = await supabase.from('ai_jobs').select('source_paths, status').eq('id', jobId).maybeSingle();
  if (!job) return { error: 'Demande introuvable.' };
  if (job.status !== 'failed') return { error: 'Cette pièce est encore en cours.' };

  const { error } = await supabase.from('ai_jobs').delete().eq('id', jobId);
  if (error) return { error: error.message };
  if (job.source_paths?.length) {
    const { count } = await supabase
      .from('ai_jobs')
      .select('id', { count: 'exact', head: true })
      .overlaps('source_paths', job.source_paths)
      .neq('status', 'done');
    if (!count) await supabase.storage.from('uploads').remove(job.source_paths);
  }

  revalidatePath('/dressing');
  return undefined;
}

export type KodeResult =
  | { error: string; code: string | null }
  | { messages: KodeMessage[]; usage: KodeUsage };

/**
 * Pose une question à Kodi. L'Edge Function `kode` compte le quota, fait
 * répondre le modèle et enregistre les deux bulles ; on les relit ensuite par
 * la RLS, avec les vignettes signées, pour les afficher telles quelles.
 */
export async function askKode(question: string): Promise<KodeResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.', code: null };

  const q = String(question ?? '').trim().slice(0, 600);
  if (!q) return { error: 'Écris ta question à Kodi.', code: null };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ question_id: string; reply_id: string }>('kode', {
    body: { question: q },
  });

  if (error || !data) {
    // Les messages de la fonction sont écrits pour être lus (quota, dressing trop petit…).
    const body = error instanceof FunctionsHttpError
      ? await (error.context as Response).json().catch(() => null)
      : null;
    return {
      error: body?.error ?? "Kodi n'a pas pu répondre. Réessaie dans un instant.",
      code: body?.code ?? null,
    };
  }

  const [messages, usage] = await Promise.all([
    loadMessages(supabase, viewer.spaceId, [data.question_id, data.reply_id]),
    loadUsage(supabase, viewer.spaceId),
  ]);
  return { messages, usage };
}

/** « Nouvelle conversation » : la précédente est archivée, pas effacée. */
export async function resetKode(): Promise<FormResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('kode_reset');
  if (error) return { error: "La conversation n'a pas pu être remise à zéro." };
  revalidatePath('/kodi');
  return undefined;
}

/**
 * Prévoit une tenue pour demain, ou la retire si c'était déjà elle. Une
 * autre tenue déjà prévue pour demain est remplacée : un jour, une tenue.
 */
export async function planTomorrow(outfitId: string): Promise<{ error: string } | { planned: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const supabase = await createClient();
  const day = parisDay(1);
  const { data: current } = await supabase
    .from('planned_days')
    .select('outfit_id')
    .eq('space_id', viewer.spaceId)
    .eq('day', day)
    .maybeSingle();

  const { error } = current?.outfit_id === outfitId
    ? await supabase.from('planned_days').delete().eq('space_id', viewer.spaceId).eq('day', day)
    : await supabase.from('planned_days').upsert({ space_id: viewer.spaceId, day, outfit_id: outfitId, worn: false });
  if (error) return { error: "Le calendrier n'a pas pu être mis à jour." };

  revalidatePath('/accueil');
  return { planned: current?.outfit_id !== outfitId };
}

/**
 * « Je la porte » : un port par pièce pour aujourd'hui (ce qui alimente le
 * nombre de ports et le coût par port), et la journée marquée portée.
 */
export async function wearToday(outfitId: string): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const supabase = await createClient();
  const day = parisDay(0);
  const { data: items } = await supabase.from('outfit_items').select('garment_id').eq('outfit_id', outfitId);
  if (!items?.length) return { error: 'Cette tenue est introuvable.' };

  const wears = await supabase
    .from('wears')
    .upsert(items.map((i) => ({ garment_id: i.garment_id, worn_on: day })), {
      onConflict: 'garment_id,worn_on',
      ignoreDuplicates: true,
    });
  if (wears.error) return { error: "Le port n'a pas pu être noté." };

  const plan = await supabase
    .from('planned_days')
    .upsert({ space_id: viewer.spaceId, day, outfit_id: outfitId, worn: true });
  if (plan.error) return { error: "Le calendrier n'a pas pu être mis à jour." };

  revalidatePath('/accueil');
  return undefined;
}

/**
 * Demande une page Stripe à l'Edge Function `billing`. Rien n'est accordé
 * ici : l'offre ne s'active qu'une fois le paiement confirmé par le webhook.
 */
async function billingPage(body: Record<string, string>): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ url: string }>('billing', { body });
  if (error || !data?.url) {
    const detail = error instanceof FunctionsHttpError
      ? await (error.context as Response).json().catch(() => null)
      : null;
    return { error: detail?.error ?? "Le paiement n'a pas pu s'ouvrir. Réessaie dans un instant." };
  }
  return { url: data.url };
}

/** « Continuer avec Sapologue » : ouvre le paiement Stripe (ou le portail si déjà abonné). */
export async function startCheckout(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const plan = formData.get('plan');
  const period = formData.get('period');
  if (!isPlan(plan) || !isPeriod(period)) return { error: 'Choisis une offre.' };

  const res = await billingPage({ action: 'checkout', plan, period });
  if ('error' in res) return res;
  redirect(res.url);
}

/** Un pack de places (+10 ou +30) : paiement unique chez Stripe. Des places, jamais des générations. */
export async function buyPlaces(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const pack = formData.get('pack');
  if (!isPlacePack(pack)) return { error: 'Choisis un pack.' };

  const res = await billingPage({ action: 'places', pack });
  if ('error' in res) return res;
  redirect(res.url);
}

/** « Gérer mon abonnement » : changer d'offre, de carte, résilier, factures. */
export async function openPortal(_prev: FormResult, _formData: FormData): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const res = await billingPage({ action: 'portal' });
  if ('error' in res) return res;
  redirect(res.url);
}

/**
 * Enregistre le questionnaire de démarrage et marque le profil comme fait.
 *
 * Les identifiants sont filtrés contre les listes de référence : une valeur
 * inventée côté client serait de toute façon rejetée par les contraintes
 * CHECK de la table, mais autant ne pas transformer ça en erreur 500.
 */
export async function saveStyleProfile(answers: Answers): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const keep = (allowed: readonly { id: string }[], values: string[]) => {
    const ok = new Set(allowed.map((o) => o.id));
    return [...new Set(values.filter((v) => ok.has(v)))];
  };
  const one = (allowed: readonly { id: string }[], value: string | null) =>
    value && allowed.some((o) => o.id === value) ? value : null;
  // Un choix exclusif (« Un peu de tout », « Je ne porte pas de bijoux ») reste seul.
  const alone = (values: string[], id: string) => (values.includes(id) ? [id] : values);

  const name = answers.display_name.trim().slice(0, 60);
  const supabase = await createClient();

  const jewelry = alone(keep(JEWELRY, answers.jewelry ?? []), NO_JEWELRY.id);
  const accessories = keep(ACCESSORIES, answers.accessories ?? []);
  const profile = await supabase
    .from('style_profile')
    .update({
      gender: answers.gender === 'non_precise' ? 'non_precise' : one(GENDERS, answers.gender),
      goals: alone(keep(GOALS, answers.goals), 'tout'),
      styles: keep(STYLES, answers.styles),
      favourite_items: keep(ITEMS, answers.favourite_items),
      jewelry,
      // Ce qu'on porte déjà n'est pas aussi ce qu'on aimerait porter.
      jewelry_wish: keep(JEWELRY, answers.jewelry_wish ?? []).filter((id) => id !== NO_JEWELRY.id && !jewelry.includes(id)),
      metals: alone(keep(METALS, answers.metals ?? []), 'mixte'),
      accessories,
      accessories_wish: keep(ACCESSORIES, answers.accessories_wish ?? []).filter((id) => !accessories.includes(id)),
      colours: keep(COLOURS, answers.colours),
      avoid: keep(AVOID, answers.avoid),
      occasions: keep(OCCASIONS, answers.occasions),
      morning_time: one(MORNING_TIME, answers.morning_time),
      time_intent: one(TIME_INTENT, answers.time_intent),
      assistance: one(ASSISTANCE, answers.assistance),
    })
    .eq('space_id', viewer.spaceId);

  if (profile.error) return { error: profile.error.message };

  // onboarded_at est ce qui ouvre l'application : il se pose en dernier,
  // pour qu'un échec plus haut laisse la personne reprendre le parcours.
  const done = await supabase
    .from('profiles')
    .update({ display_name: name || viewer.displayName, onboarded_at: new Date().toISOString() })
    .eq('id', viewer.userId);

  if (done.error) return { error: done.error.message };

  revalidatePath('/', 'layout');
  redirect('/accueil');
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Enregistre une tenue composée dans l'atelier. L'emplacement de chaque pièce
 * se déduit de sa catégorie, relue en base : le navigateur ne choisit que
 * les pièces, et seulement parmi celles que la RLS lui laisse voir.
 */
export async function createOutfit(input: { garmentIds: string[]; name?: string }): Promise<{ error: string } | { id: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const ids = [...new Set((Array.isArray(input?.garmentIds) ? input.garmentIds : []).map(String))].slice(0, 16);
  if (ids.length < 2) return { error: 'Une tenue, c’est au moins deux pièces.' };

  const supabase = await createClient();
  const { data: garments, error: readError } = await supabase
    .from('garments')
    .select('id, category_id')
    .in('id', ids);
  if (readError) return { error: readError.message };
  if (!garments || garments.length !== ids.length) return { error: 'Une des pièces n’est plus dans ton dressing.' };

  const byId = new Map(garments.map((g) => [g.id, g.category_id as string]));
  const today = new Date();
  const name = String(input?.name ?? '').trim().slice(0, 60) || `Tenue du ${today.getDate()} ${MOIS[today.getMonth()]}`;

  const { data: outfit, error } = await supabase
    .from('outfits')
    .insert({ space_id: viewer.spaceId, name, source: 'user' })
    .select('id')
    .single();
  if (error || !outfit) return { error: error?.message ?? 'La tenue n’a pas pu être créée.' };

  const { error: itemsError } = await supabase.from('outfit_items').insert(
    ids.map((id, position) => ({ outfit_id: outfit.id, garment_id: id, slot: slotFor(byId.get(id)!), position })),
  );
  if (itemsError) {
    await supabase.from('outfits').delete().eq('id', outfit.id);
    return { error: itemsError.message };
  }

  revalidatePath('/tenues');
  return { id: outfit.id };
}

export async function deleteOutfit(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('outfits').delete().eq('id', id);
  revalidatePath('/tenues');
}

/* ------------------------------------------------------------------
   Accueil et calendrier : porter une tenue, l'écarter, prévoir un jour,
   faire préparer plusieurs jours par Kodi, noter un rendez-vous.
   ------------------------------------------------------------------ */

export type ActionResult<T extends object = object> = { error: string; code?: string | null } | ({ ok: true } & T);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v: unknown, max: number) => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};
const uuids = (list: unknown, max: number): string[] =>
  [...new Set((Array.isArray(list) ? list : []).map(String).filter((x) => UUID.test(x)))].slice(0, max);

/**
 * Crée une tenue à partir de pièces. L'emplacement de chacune se déduit de
 * sa catégorie, relue en base : le navigateur ne choisit que les pièces, et
 * seulement parmi celles que la RLS lui laisse voir.
 */
async function insertOutfit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spaceId: string,
  ids: string[],
  name: string | null,
  source: 'user' | 'kode',
): Promise<{ error: string } | { id: string }> {
  const { data: garments, error: readError } = await supabase.from('garments').select('id, category_id').in('id', ids);
  if (readError) return { error: 'Les pièces n’ont pas pu être lues. Réessaie dans un instant.' };
  if (!garments || garments.length !== ids.length) return { error: 'Une des pièces n’est plus dans ton dressing.' };
  const byId = new Map(garments.map((g) => [g.id, g.category_id as string]));

  const { data: outfit, error } = await supabase.from('outfits').insert({ space_id: spaceId, name, source }).select('id').single();
  if (error || !outfit) return { error: 'La tenue n’a pas pu être créée. Réessaie dans un instant.' };

  const items = await supabase.from('outfit_items').insert(
    ids.map((id, position) => ({ outfit_id: outfit.id, garment_id: id, slot: slotFor(byId.get(id)!), position })),
  );
  if (items.error) {
    await supabase.from('outfits').delete().eq('id', outfit.id);
    return { error: 'Les pièces de la tenue n’ont pas pu être rangées. Réessaie dans un instant.' };
  }
  return { id: outfit.id };
}

/** Le message d'une fonction serveur qui répond une erreur, écrit pour être lu (quota, dressing trop petit…). */
async function functionMessage(error: unknown, fallback: string): Promise<{ error: string; code: string | null }> {
  const body = error instanceof FunctionsHttpError ? await (error.context as Response).json().catch(() => null) : null;
  return { error: body?.error ?? fallback, code: body?.code ?? null };
}

/**
 * « Je la porte » depuis l'accueil : un port par pièce pour aujourd'hui. La
 * tenue montrée a pu être ajustée (une pièce prise à sa voisine) : seules les
 * pièces comptent. Une pièce déjà notée aujourd'hui ne compte qu'une fois.
 * La tenue reste sur la journée, marquée portée : c'est elle que l'accueil et
 * le calendrier montrent ensuite. Une tenue déjà enregistrée (prévue pour
 * aujourd'hui) est reprise telle quelle ; sinon, celle qu'on porte est créée.
 */
export async function wearPieces(input: { garmentIds: string[]; outfitId?: string | null; title?: string }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };
  const ids = uuids(input?.garmentIds, 16);
  if (!ids.length) return { error: 'Cette tenue est vide.' };

  const supabase = await createClient();
  const day = parisDay(0);
  const wears = await supabase
    .from('wears')
    .upsert(ids.map((garment_id) => ({ garment_id, worn_on: day })), { onConflict: 'garment_id,worn_on', ignoreDuplicates: true });
  if (wears.error) return { error: 'Le port n’a pas pu être noté. Réessaie dans un instant.' };

  let outfitId = input?.outfitId && UUID.test(input.outfitId) ? input.outfitId : null;
  if (!outfitId && ids.length >= 2) {
    // Si la tenue ne peut pas être gardée, le port reste noté : on ne le défait pas pour autant.
    const made = await insertOutfit(supabase, viewer.spaceId, ids, clean(input?.title, 80), 'kode');
    if ('id' in made) outfitId = made.id;
  }
  if (outfitId) {
    const plan = await supabase.from('planned_days').upsert({ space_id: viewer.spaceId, day, outfit_id: outfitId, worn: true });
    if (plan.error) return { error: 'Le calendrier n’a pas pu être mis à jour.' };
  }

  revalidatePath('/accueil');
  revalidatePath('/calendrier');
  revalidatePath('/dressing');
  return { ok: true };
}

const RAISONS = ['style', 'couleurs', 'confort', 'meteo', 'journee', 'piece', 'sans'] as const;

/**
 * « Pas pour moi » : la tenue écartée et sa raison, facultative. Elle ne
 * revient plus ; une pièce visée passe en dernier deux semaines ; Kodi lit
 * ces lignes (trois derniers mois) avec ses prochaines tenues. Effacées
 * après six mois par `menage`.
 */
export async function skipOutfit(input: { garmentIds: string[]; reason: string; targetIds?: string[] }): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };
  const ids = uuids(input?.garmentIds, 12);
  if (!ids.length) return { error: 'Cette tenue est vide.' };
  const reason = (RAISONS as readonly string[]).includes(input?.reason) ? input.reason : 'sans';
  const targets = reason === 'piece' ? uuids(input?.targetIds, 12).filter((t) => ids.includes(t)) : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from('outfit_feedback')
    .insert({ space_id: viewer.spaceId, garment_ids: ids, reason, target_ids: targets });
  if (error) return { error: 'Ta réponse n’a pas pu être gardée. Réessaie dans un instant.' };

  revalidatePath('/accueil');
  return { ok: true };
}

/**
 * Prévoit une tenue pour un jour : une tenue déjà enregistrée, ou une
 * nouvelle faite de ces pièces. Un jour, une tenue : la précédente est
 * remplacée. Un jour passé ou déjà porté ne se réécrit pas.
 */
export async function planDay(input: { day: string; outfitId?: string | null; garmentIds?: string[]; name?: string }): Promise<ActionResult<{ outfitId: string }>> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };
  const day = String(input?.day ?? '');
  if (!DAY.test(day) || day < parisDay(0) || day > parisDay(400)) return { error: 'Ce jour ne peut pas recevoir de tenue.' };

  const supabase = await createClient();
  const { data: current } = await supabase.from('planned_days').select('worn').eq('space_id', viewer.spaceId).eq('day', day).maybeSingle();
  if (current?.worn) return { error: 'Cette journée est déjà portée.' };

  let outfitId = input?.outfitId && UUID.test(input.outfitId) ? input.outfitId : null;
  if (outfitId) {
    const { data: found } = await supabase.from('outfits').select('id').eq('id', outfitId).maybeSingle();
    if (!found) return { error: 'Cette tenue est introuvable.' };
  } else {
    const ids = uuids(input?.garmentIds, 16);
    if (ids.length < 2) return { error: 'Une tenue, c’est au moins deux pièces.' };
    const name = String(input?.name ?? '').trim().slice(0, 80) || null;
    const made = await insertOutfit(supabase, viewer.spaceId, ids, name, 'user');
    if ('error' in made) return made;
    outfitId = made.id;
  }

  const { error } = await supabase.from('planned_days').upsert({ space_id: viewer.spaceId, day, outfit_id: outfitId, worn: false });
  if (error) return { error: 'Le calendrier n’a pas pu être mis à jour. Réessaie dans un instant.' };

  revalidatePath('/accueil');
  revalidatePath('/calendrier');
  return { ok: true, outfitId };
}

/** Retire la tenue d'un jour à venir (pas une journée déjà portée). */
export async function unplanDay(day: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };
  if (!DAY.test(day)) return { error: 'Ce jour est inconnu.' };

  const supabase = await createClient();
  const { error } = await supabase.from('planned_days').delete().eq('space_id', viewer.spaceId).eq('day', day).eq('worn', false);
  if (error) return { error: 'Le calendrier n’a pas pu être mis à jour. Réessaie dans un instant.' };

  revalidatePath('/accueil');
  revalidatePath('/calendrier');
  return { ok: true };
}

/**
 * Kodi prépare plusieurs jours d'un coup (fonction `kode`, action
 * `planifier`) : une tenue par jour, avec les rendez-vous, la météo et les
 * jours voisins. Compte pour une question. Un jour déjà porté n'est jamais
 * réécrit.
 */
export async function planWithKodi(input: { days: string[]; note?: string }): Promise<ActionResult<{ planned: number }>> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };
  const today = parisDay(0);
  const days = [...new Set((Array.isArray(input?.days) ? input.days : []).map(String).filter((d) => DAY.test(d) && d >= today && d <= parisDay(31)))]
    .sort()
    .slice(0, 31);
  if (!days.length) return { error: 'Choisis au moins un jour.' };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ jours: { date: string; titre: string; pourquoi: string; pieces: string[] }[] }>('kode', {
    body: { action: 'planifier', jours: days, voyage: null, consigne: String(input?.note ?? '').trim().slice(0, 400) },
  });
  if (error || !data?.jours) return functionMessage(error, 'Kodi n’a pas pu préparer ces jours. Réessaie dans un instant.');

  const { data: wornRows } = await supabase.from('planned_days').select('day').eq('space_id', viewer.spaceId).eq('worn', true).in('day', days);
  const worn = new Set((wornRows ?? []).map((r) => String(r.day).slice(0, 10)));

  let planned = 0;
  for (const j of data.jours) {
    const ids = uuids(j.pieces, 16);
    if (ids.length < 2 || !days.includes(j.date) || worn.has(j.date)) continue;
    const made = await insertOutfit(supabase, viewer.spaceId, ids, String(j.titre || 'Par Kodi').slice(0, 80), 'kode');
    if ('error' in made) continue;
    const up = await supabase.from('planned_days').upsert({ space_id: viewer.spaceId, day: j.date, outfit_id: made.id, worn: false });
    if (!up.error) planned++;
  }

  revalidatePath('/accueil');
  revalidatePath('/calendrier');
  if (!planned) return { error: 'Kodi n’a pas pu habiller ces jours avec ton dressing.' };
  return { ok: true, planned };
}

/** Le moment de la journée d'après l'heure (colonne `slot`). */
const momentOf = (time: string | null) => {
  if (!time) return null;
  const h = Number(time.slice(0, 2));
  return h < 12 ? 'Matin' : h < 18 ? 'Après-midi' : 'Soir';
};

const STAKES = ['Tranquille', 'Important', 'Décisif'] as const;

const SETTINGS = ['Intérieur', 'Extérieur', 'Les deux'] as const;
/** Une liste de mots courts (impressions, contraintes) : dédoublonnée, bornée. */
const words = (list: unknown, max: number): string[] =>
  [...new Set((Array.isArray(list) ? list : []).map((x) => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, max);

export type EventInput = {
  id?: string;
  day: string;
  title: string;
  time?: string | null;
  kind?: string | null;
  dressCode?: string | null;
  stake?: string | null;
  impressions?: string[];
  place?: string | null;
  setting?: string | null;
  constraints?: string[];
  note?: string | null;
};

/** Note un rendez-vous, ou met à jour celui dont on donne l'identifiant. Tout part chez Kodi pour habiller ce jour-là. */
export async function saveEvent(input: EventInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };
  const day = String(input?.day ?? '');
  const title = clean(input?.title, 120);
  if (!DAY.test(day)) return { error: 'Choisis un jour.' };
  if (!title) return { error: 'Donne un nom à ce rendez-vous.' };
  const time = /^\d{2}:\d{2}$/.test(String(input?.time ?? '')) ? String(input.time) : null;
  const stake = (STAKES as readonly string[]).includes(String(input?.stake)) ? String(input.stake) : null;

  const row = {
    space_id: viewer.spaceId,
    day,
    title,
    starts_at: time,
    slot: momentOf(time),
    kind: clean(input?.kind, 60),
    dress_code: clean(input?.dressCode, 40),
    stake,
    impressions: words(input?.impressions, 10),
    place: clean(input?.place, 120),
    setting: (SETTINGS as readonly string[]).includes(String(input?.setting)) ? String(input.setting) : null,
    flags: words(input?.constraints, 11),
    note: clean(input?.note, 400),
  };

  const supabase = await createClient();
  const id = input?.id && UUID.test(input.id) ? input.id : null;
  const res = id
    ? await supabase.from('events').update(row).eq('id', id).select('id').single()
    : await supabase.from('events').insert(row).select('id').single();
  if (res.error || !res.data) return { error: 'Le rendez-vous n’a pas pu être gardé. Réessaie dans un instant.' };

  revalidatePath('/calendrier');
  revalidatePath('/accueil');
  return { ok: true, id: res.data.id as string };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };
  if (!UUID.test(String(id))) return { error: 'Ce rendez-vous est inconnu.' };

  const supabase = await createClient();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return { error: 'Le rendez-vous n’a pas pu être retiré. Réessaie dans un instant.' };

  revalidatePath('/calendrier');
  revalidatePath('/accueil');
  return { ok: true };
}

/** Les tenues déjà enregistrées, pour en poser une sur un jour (feuille « Changer la tenue »). */
export async function listSavedOutfits(): Promise<ActionResult<{ outfits: OutfitView[] }>> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };
  const supabase = await createClient();
  return { ok: true, outfits: await loadSavedOutfits(supabase, viewer) };
}
