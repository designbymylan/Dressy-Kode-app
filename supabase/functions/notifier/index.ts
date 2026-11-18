/**
 * Les notifications push (18/11), réveillées par la base (`ai_jobs_notify`,
 * migration notifications_push) quand une tâche de dessin se termine.
 *
 * Elle relit tout elle-même (l'appel ne transporte qu'un identifiant de
 * tâche) : la photo dont elle fait partie, l'accord de la personne, ses
 * appareils. Elle ne prévient qu'une fois par photo, quand plus aucune pièce
 * n'est en cours (`ai_jobs.notified_at`, pris d'un seul coup : deux pièces qui
 * finissent ensemble n'envoient qu'un message).
 *
 * Accord : seulement « tout » ou « seulement le planning » (la personne a
 * demandé ses pièces, c'est un message de service) ; « non » ou pas de
 * réponse : rien ne part. Le jeton d'appareil n'existe de toute façon qu'après
 * un « oui » et la fenêtre de l'iPhone.
 *
 * Envoi par le service Expo Push (exp.host), qui relaie à Apple. Le texte ne
 * contient ni le prénom ni l'e-mail. Un jeton refusé par Expo
 * (DeviceNotRegistered : app désinstallée) est retiré.
 *
 * Déployée SANS vérification JWT (appelée par pg_net) : elle ne prend aucune
 * entrée de confiance et n'envoie, au plus, que le message légitime d'une photo
 * terminée, une seule fois.
 */
import { createClient } from '@supabase/supabase-js';
import { envKey, secret } from '../_shared/env.ts';
import { message, termine, type Tache } from './composer.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXPO = 'https://exp.host/--/api/v2/push/send';
const ACCORDS = new Set(['tout', 'planning']);

type Retour = { status: 'ok' | 'error'; message?: string; details?: { error?: string } };

const fin = (raison: string, extra: Record<string, unknown> = {}) => {
  console.log('[notifier]', raison, JSON.stringify(extra));
  return Response.json({ ok: true, envoye: false, raison });
};

Deno.serve(async (req) => {
  try {
    const { job_id } = (await req.json().catch(() => ({}))) as { job_id?: string };
    if (!job_id || !/^[0-9a-f-]{36}$/i.test(job_id)) return Response.json({ ok: false }, { status: 400 });

    const { data: job } = await admin.from('ai_jobs').select('id, parent_id, space_id, requested_by').eq('id', job_id).maybeSingle();
    if (!job) return fin('tâche introuvable');
    const racine = job.parent_id ?? job.id;

    // La photo entière : la tâche mère et ses filles.
    const { data: lot } = await admin
      .from('ai_jobs')
      .select('id, status, garment_id, target, analysis')
      .or(`id.eq.${racine},parent_id.eq.${racine}`);
    const taches = (lot ?? []) as Tache[];
    if (!termine(taches)) return fin('des pièces sont encore en cours');
    const notif = message(taches);
    if (!notif) return fin('rien à dire');

    const { data: reglages } = await admin.from('settings').select('notifications').eq('space_id', job.space_id).maybeSingle();
    const choix = (reglages?.notifications as { choix?: string } | null)?.choix ?? '';
    if (!ACCORDS.has(choix)) return fin('pas d’accord de la personne');

    const { data: appareils } = await admin.from('push_tokens').select('token').eq('user_id', job.requested_by);
    const jetons = (appareils ?? []).map((a) => a.token as string);
    if (!jetons.length) return fin('aucun appareil');

    // Une seule fois par photo : la première tâche qui prend `notified_at` envoie.
    const { data: pris } = await admin.from('ai_jobs').update({ notified_at: new Date().toISOString() }).eq('id', racine).is('notified_at', null).select('id');
    if (!pris?.length) return fin('déjà prévenue');

    const headers: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' };
    const acces = secret('EXPO_ACCESS_TOKEN'); // facultatif : « sécurité renforcée » du service Expo
    if (acces) headers.authorization = `Bearer ${acces}`;

    const r = await fetch(EXPO, {
      method: 'POST',
      headers,
      body: JSON.stringify(jetons.map((to) => ({ to, title: notif.title, body: notif.body, data: { type: 'piece', ecran: 'Dressing' }, ttl: 86_400, priority: 'high' }))),
    });
    if (!r.ok) {
      // L'envoi a raté : on rend le droit de réessayer (le prochain réveil, le filet de la base).
      await admin.from('ai_jobs').update({ notified_at: null }).eq('id', racine);
      console.error('[notifier] Expo', r.status, (await r.text()).slice(0, 200));
      return Response.json({ ok: false }, { status: 502 });
    }
    const reponse = ((await r.json().catch(() => ({}))) as { data?: Retour[] }).data ?? [];
    const morts = jetons.filter((_, i) => reponse[i]?.status === 'error' && reponse[i]?.details?.error === 'DeviceNotRegistered');
    if (morts.length) await admin.from('push_tokens').delete().in('token', morts);

    console.log('[notifier] envoyé', JSON.stringify({ appareils: jetons.length, retires: morts.length }));
    return Response.json({ ok: true, envoye: true, appareils: jetons.length });
  } catch (e) {
    console.error('[notifier]', e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 500 });
  }
});
