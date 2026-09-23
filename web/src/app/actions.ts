'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer, type Theme } from '@/lib/space';
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

export async function setTheme(theme: Theme) {
  const viewer = await getViewer();
  if (!viewer) return;

  const supabase = await createClient();
  await supabase.from('settings').update({ theme }).eq('space_id', viewer.spaceId);

  // layout.tsx relit le thème : on invalide tout l'arbre pour que le
  // changement porte sur l'application entière, pas sur l'écran courant.
  revalidatePath('/', 'layout');
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
        ? `Il te reste ${left} pièce${left > 1 ? 's' : ''} à confier à Kode aujourd'hui : retire ${paths.length - left} photo${paths.length - left > 1 ? 's' : ''}.`
        : `Tu as confié ${DAILY_QUOTA} pièces à Kode aujourd'hui, c'est la limite du jour. Reviens demain.`,
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
