'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer, type Theme } from '@/lib/space';
import { getUsage, signAll, todayParis, daysAgo, WINDOW_DAYS, type GarmentRow } from '@/lib/wardrobe';
import type { KodiMood } from '@/components/Kodi';
import {
  GENDERS, GOALS, STYLES, ITEMS, COLOURS, AVOID, OCCASIONS,
  MORNING_TIME, TIME_INTENT, ASSISTANCE, type Answers,
} from '@/lib/onboarding';

export type FormResult = { error: string } | undefined;

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Adresse e-mail ou mot de passe incorrect.',
  user_already_exists: 'Un compte existe déjà avec cette adresse.',
  email_address_invalid: "Cette adresse e-mail n'est pas valide.",
  weak_password: 'Mot de passe trop court : il en faut au moins 8.',
  over_email_send_rate_limit: 'Trop de tentatives. Réessaie dans quelques minutes.',
};

function readable(code: string | undefined, fallback: string) {
  return (code && AUTH_ERRORS[code]) ?? fallback;
}

export async function signUp(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim();

  if (!email || !password) return { error: 'Adresse e-mail et mot de passe sont nécessaires.' };
  if (password.length < 8) return { error: 'Mot de passe trop court : il en faut au moins 8.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // Le déclencheur handle_new_user lit display_name pour nommer le profil.
    options: { data: { display_name: displayName || null } },
  });

  if (error) return { error: readable(error.code, error.message) };

  // Si la confirmation par e-mail est active, il n'y a pas encore de session :
  // on renvoie vers la connexion plutôt que vers un espace inaccessible.
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? '/accueil' : '/connexion?verifier=1');
}

export async function signIn(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Adresse e-mail et mot de passe sont nécessaires.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: readable(error.code, 'Connexion impossible.') };

  redirect('/accueil');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/bienvenue');
}

const YEAR = 365 * 24 * 3600;

export async function setTheme(theme: Theme) {
  if (!['light', 'dark', 'auto'].includes(theme)) return;
  const viewer = await getViewer();

  if (viewer) {
    const supabase = await createClient();
    await supabase.from('settings').update({ theme }).eq('space_id', viewer.spaceId);
  } else {
    // Un visiteur (accueil, connexion) garde son choix sur l'appareil.
    (await cookies()).set('dk_theme', theme, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  }

  // layout.tsx relit le thème : on invalide tout l'arbre pour que le
  // changement porte sur l'application entière, pas sur l'écran courant.
  revalidatePath('/', 'layout');
}

/** Affiche ou masque l'encoche clair / sombre (réglage propre à l'appareil). */
export async function setThemeShortcut(on: boolean) {
  const jar = await cookies();
  if (on) jar.delete('dk_theme_tab');
  else jar.set('dk_theme_tab', '0', { path: '/', maxAge: YEAR, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

/**
 * « Porté aujourd'hui » : un premier toucher note le port, un second
 * l'annule. C'est ce qui nourrit la barre de progression du dressing.
 */
export async function toggleWear(garmentId: string): Promise<{ worn: boolean } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const supabase = await createClient();
  const today = todayParis();
  const { data: existing } = await supabase
    .from('wears')
    .select('id')
    .eq('garment_id', garmentId)
    .eq('worn_on', today)
    .limit(1);

  const res = existing?.length
    ? await supabase.from('wears').delete().eq('id', existing[0].id)
    : await supabase.from('wears').insert({ garment_id: garmentId, worn_on: today });
  if (res.error) return { error: "Ça n'a pas été noté. Réessaie." };

  revalidatePath('/dressing');
  revalidatePath('/accueil');
  return { worn: !existing?.length };
}

export type KodiAnswer = {
  text: string;
  mood: KodiMood;
  pieces?: { id: string; name: string; url: string | null }[];
  link?: { href: string; label: string };
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Kodi répond à partir de ce qui est réellement dans le dressing.
 * Pas de modèle de langage ici : quatre demandes qu'il sait traiter
 * sérieusement (tenue, pièces oubliées, bilan, ajout), et une réponse
 * franche pour le reste plutôt qu'une invention.
 */
export async function askKodi(question: string): Promise<KodiAnswer> {
  const viewer = await getViewer();
  if (!viewer) return { text: 'Ta session a expiré. Reconnecte-toi et je reprends où on en était.', mood: 'sad' };

  const q = norm(String(question ?? '').slice(0, 400));
  const supabase = await createClient();
  const [{ data: garments }, { data: categories }] = await Promise.all([
    supabase.from('garments').select('id, name, category_id, image_path, thumb_path'),
    supabase.from('categories').select('id, label').order('sort'),
  ]);
  const items = (garments ?? []) as GarmentRow[];
  const usage = await getUsage(supabase, items, categories ?? []);
  const since = daysAgo(WINDOW_DAYS);
  const lastOf = (id: string) => usage.wear[id]?.last ?? '';
  // Les pièces les moins portées d'abord : c'est tout l'intérêt.
  const byRest = [...items].sort((a, b) => lastOf(a.id).localeCompare(lastOf(b.id)));

  const show = async (list: GarmentRow[]) => {
    const urls = await signAll(supabase, 'garments', list.map((g) => (g.thumb_path ?? g.image_path) as string).filter(Boolean));
    return list.map((g) => ({ id: g.id, name: g.name, url: urls.get((g.thumb_path ?? g.image_path) as string) ?? null }));
  };

  if (!items.length && !/bonjour|salut|hello|coucou|merci/.test(q)) {
    return {
      text: 'Ton dressing est encore vide. Ajoute deux ou trois pièces que tu portes souvent, et je compose ta première tenue.',
      mood: 'wave',
      link: { href: '/dressing/ajouter', label: 'Ajouter une pièce' },
    };
  }

  if (/oubli|dort|jamais|pas porte|delaiss|neglige|reveill/.test(q)) {
    const asleep = byRest.filter((g) => !usage.wear[g.id]?.last || usage.wear[g.id]!.last! < since);
    if (!asleep.length) return { text: 'Aucune pièce oubliée : tout ton dressing a servi ces trois derniers mois. Chapeau.', mood: 'celebrate' };
    return {
      text: `${asleep.length} pièce${asleep.length > 1 ? 's' : ''} n’${asleep.length > 1 ? 'ont' : 'a'} pas été portée${asleep.length > 1 ? 's' : ''} depuis ${WINDOW_DAYS} jours. Voilà par où je commencerais :`,
      mood: 'sleepy',
      pieces: await show(asleep.slice(0, 6)),
    };
  }

  if (/combien|bilan|stat|exploit|progress|usage|garde-robe/.test(q)) {
    const pct = Math.round(usage.pct);
    const best = [...usage.categories].sort((a, b) => b.pct - a.pct)[0];
    const low = [...usage.categories].sort((a, b) => a.pct - b.pct)[0];
    return {
      text: `Tu as ${usage.total} pièce${usage.total > 1 ? 's' : ''} et tu en as porté ${usage.worn} ces ${WINDOW_DAYS} derniers jours : ${pct} % de ton dressing travaille.`
        + (best && low && best.id !== low.id ? ` Tes ${best.label.toLowerCase()} tournent bien, tes ${low.label.toLowerCase()} beaucoup moins.` : ''),
      mood: pct >= 50 ? 'happy' : 'thinking',
      link: { href: '/dressing', label: 'Voir ma progression' },
    };
  }

  if (/ajout|photo|scan|import|range/.test(q)) {
    return {
      text: 'Prends la pièce en photo, même posée sur le lit. Je la redessine seule et sans fond, je vérifie qu’elle te ressemble, puis je la range.',
      mood: 'happy',
      link: { href: '/dressing/ajouter', label: 'Ajouter une pièce' },
    };
  }

  if (/tenue|porter|mets|look|demain|aujourd|habille|soir|rendez|travail|ce matin/.test(q)) {
    const first = (cats: string[]) => byRest.find((g) => cats.includes(g.category_id));
    const dress = first(['robes']);
    const top = first(['hauts']);
    const bottom = first(['bas']);
    const pick: GarmentRow[] = [];
    if (top && bottom) pick.push(top, bottom);
    else if (dress) pick.push(dress);
    else if (top || bottom) pick.push((top ?? bottom)!);
    const layer = first(['vestes']);
    const shoes = first(['chaussures']);
    const extra = first(['sacs', 'bijoux', 'accessoires']);
    for (const g of [layer, shoes, extra]) if (g) pick.push(g);

    if (pick.length < 2) {
      return {
        text: 'Il me manque encore des pièces pour une tenue complète : ajoute au moins un haut et un bas, ou une robe.',
        mood: 'thinking',
        link: { href: '/dressing/ajouter', label: 'Ajouter une pièce' },
      };
    }
    const names = pick.map((g) => g.name.toLowerCase());
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : names[0];
    return {
      text: `Je partirais sur ${list}. J’ai choisi des pièces que tu n’as pas mises depuis un moment : c’est l’occasion de les ressortir.`,
      mood: 'love',
      pieces: await show(pick),
    };
  }

  if (/bonjour|salut|hello|coucou|hey/.test(q)) {
    const hello = viewer.displayName ? `Salut ${viewer.displayName} !` : 'Salut !';
    return { text: `${hello} Demande-moi une tenue, tes pièces oubliées ou ton bilan.`, mood: 'wave' };
  }
  if (/merci/.test(q)) return { text: 'Avec plaisir. Je suis là dès que tu ouvres ton dressing.', mood: 'love' };

  return {
    text: 'Je ne sais pas encore répondre à tout. Aujourd’hui je compose une tenue avec tes pièces, je te montre celles qui dorment et je fais le bilan de ton dressing.',
    mood: 'thinking',
  };
}

export async function addGarment(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'Session expirée.' };

  const name = String(formData.get('name') ?? '').trim();
  const categoryId = String(formData.get('category_id') ?? '');
  const material = String(formData.get('material') ?? '').trim();
  const priceRaw = String(formData.get('price') ?? '').trim().replace(',', '.');

  if (!name) return { error: 'Donne un nom à la pièce.' };
  if (!categoryId) return { error: 'Choisis une catégorie.' };

  const price = priceRaw ? Math.round(Number(priceRaw) * 100) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return { error: 'Le prix ne se lit pas. Exemple : 49,90' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('garments').insert({
    space_id: viewer.spaceId,
    category_id: categoryId,
    name,
    material: material || null,
    purchase_price_cents: price,
    source: 'photo',
  });

  if (error) return { error: error.message };

  revalidatePath('/dressing');
  redirect('/dressing');
}

const DAILY_QUOTA = 20; // même limite que le trigger ai_jobs_before_insert
const MAX_PHOTOS_PER_BATCH = 10;

/**
 * Confie à l'agent central les photos déjà déposées dans `uploads` par le
 * navigateur : une tâche par photo, donc une pièce par photo.
 */
export async function requestAiGarments(input: { paths: string[]; hint: string }): Promise<FormResult> {
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
    .gte('created_at', since);

  const left = DAILY_QUOTA - (count ?? 0);
  if (paths.length > left) {
    return {
      error: left > 0
        ? `Il te reste ${left} pièce${left > 1 ? 's' : ''} à confier à Kodi aujourd'hui : retire ${paths.length - left} photo${paths.length - left > 1 ? 's' : ''}.`
        : `Tu as confié ${DAILY_QUOTA} pièces à Kodi aujourd'hui, c'est la limite du jour. Reviens demain.`,
    };
  }

  const hint = String(input?.hint ?? '').trim().slice(0, 280);
  const { error } = await supabase.from('ai_jobs').insert(
    paths.map((p) => ({
      space_id: viewer.spaceId,
      requested_by: viewer.userId,
      source_paths: [p],
      user_input: hint,
    })),
  );

  if (error) {
    // Les messages du trigger (quota, photo hors espace) sont écrits pour être lus.
    return { error: error.hint === 'quota' || error.hint === 'photos' ? error.message : "La demande n'est pas partie. Réessaie." };
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

/** Retire une pièce en échec de la liste, avec ses photos d'origine. */
export async function dismissAiJob(jobId: string): Promise<FormResult> {
  const supabase = await createClient();
  const { data: job } = await supabase.from('ai_jobs').select('source_paths, status').eq('id', jobId).maybeSingle();
  if (!job) return { error: 'Demande introuvable.' };
  if (job.status !== 'failed') return { error: 'Cette pièce est encore en cours.' };

  const { error } = await supabase.from('ai_jobs').delete().eq('id', jobId);
  if (error) return { error: error.message };
  if (job.source_paths?.length) await supabase.storage.from('uploads').remove(job.source_paths);

  revalidatePath('/dressing');
  return undefined;
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
    return values.filter((v) => ok.has(v));
  };
  const one = (allowed: readonly { id: string }[], value: string | null) =>
    value && allowed.some((o) => o.id === value) ? value : null;

  const name = answers.display_name.trim().slice(0, 60);
  const supabase = await createClient();

  const profile = await supabase
    .from('style_profile')
    .update({
      gender: answers.gender === 'non_precise' ? 'non_precise' : one(GENDERS, answers.gender),
      goals: keep(GOALS, answers.goals),
      styles: keep(STYLES, answers.styles),
      favourite_items: keep(ITEMS, answers.favourite_items),
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
