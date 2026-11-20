/**
 * L'ajout de pièces (spec « Pipeline d'ajout de vêtements », 20/11), côté
 * téléphone : une photo = une pièce.
 *
 *   1. la photo est préparée sur le téléphone (orientation, 1024 px, JPEG 85,
 *      sans métadonnées) ; sous 600 px de petit côté, elle est refusée sans
 *      rien créer (« Photo trop petite ») ;
 *   2. elle part dans garments/<espace>/<pièce>/original.jpg, la ligne
 *      « processing » est créée, la fonction process-garment est appelée ;
 *   3. la pièce change d'état en direct (Realtime) : ready, needs_retake ou
 *      failed. Elle ne rejoint le dressing qu'avec « Tout ajouter ».
 *
 * Aucun modèle génératif : le détourage est la vraie pièce. La fiche ne se
 * corrige qu'avec les valeurs de la taxonomie (data/taxonomy.ts).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { libelle, MATIERES, nomDeLaPiece, saisonResumee, SAISONS } from '../data/taxonomy';
import type { Session } from './remote';

/** L'interrupteur de la bascule : vrai quand le banc est validé (spec, Plan d'implémentation). */
export const PIPELINE_AJOUT = false;

export const MAX_PHOTOS = 20;
export const COTE = 1024;
export const QUALITE = 0.85;
export const COTE_MIN = 600;
/** Au-delà, une pièce restée « Traitement… » propose « Réessayer » (la fonction a pu être coupée). */
export const PERIME_MS = 45_000;
export const CONFIANCE_FAIBLE = 0.6;
const URL_TTL = 3600;

export type Statut = 'envoi' | 'processing' | 'ready' | 'needs_retake' | 'failed';
export type Raison = 'trop_petite' | 'mask_too_small' | 'mask_too_large' | 'multiple_items' | 'provider_error' | 'unexpected' | 'envoi';

/** Les messages précis de la spec (section Erreurs). */
export const MESSAGES: Record<Raison, string> = {
  trop_petite: 'Photo trop petite',
  mask_too_small: 'Rapproche-toi de la pièce',
  mask_too_large: 'Éloigne-toi, la pièce doit être entière',
  multiple_items: 'Une seule pièce par photo',
  provider_error: 'Le traitement n’a pas abouti.',
  unexpected: 'Le traitement n’a pas abouti.',
  envoi: 'La photo n’est pas partie. Vérifie ta connexion.',
};

/** La fiche, en valeurs de la taxonomie seulement. */
export type Fiche = {
  categorie: string | null;
  type: string | null;
  couleur: string | null;
  couleur_2: string | null;
  matiere: string | null;
  motif: string | null;
  coupe: string | null;
  saisons: string[];
  habillage: number | null;
};

export const FICHE_VIDE: Fiche = { categorie: null, type: null, couleur: null, couleur_2: null, matiere: null, motif: null, coupe: null, saisons: [], habillage: null };

export type PieceAjout = {
  id: string;
  /** La photo sur le téléphone, montrée tout de suite. */
  locale: string | null;
  statut: Statut;
  raison: Raison | null;
  /** Le détourage (URL signée, une heure). */
  cutout: string | null;
  nom: string;
  fiche: Fiche;
  /** Vide si l'étiquetage a échoué (la fiche est alors à remplir). */
  confiance: number | null;
  depuis: number;
};

/** Une fiche assez remplie pour rejoindre le dressing : au moins la catégorie et le type. */
export const ficheComplete = (f: Fiche) => Boolean(f.categorie && f.type);

/** Les champs à confirmer : tous quand la confiance est faible, les vides sinon. */
export const aConfirmer = (p: PieceAjout) => p.confiance === null || p.confiance < CONFIANCE_FAIBLE;

function db() {
  if (!supabase) throw new Error('Supabase n’est pas configuré.');
  return supabase;
}

function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * La photo préparée comme le veut la spec : orientation corrigée (le rendu
 * l'applique), 1024 px au plus sur le grand côté, JPEG 85, sans métadonnées.
 * `null` si elle est trop petite (côté le plus court sous 600 px).
 */
export async function preparer(uri: string): Promise<{ uri: string; largeur: number; hauteur: number } | null> {
  const brute = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.min(brute.width, brute.height) < COTE_MIN) return null;
  const large = brute.width >= brute.height;
  const img = Math.max(brute.width, brute.height) > COTE
    ? await ImageManipulator.manipulate(uri).resize(large ? { width: COTE } : { height: COTE }).renderAsync()
    : brute;
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: QUALITE });
  return { uri: out.uri, largeur: out.width, hauteur: out.height };
}

/** L'appel de la fonction serveur ; la réponse arrive ensuite par Realtime. */
async function lancer(id: string, envoiMs?: number) {
  const { error } = await db().functions.invoke('process-garment', { body: { garment_id: id, ...(envoiMs !== undefined ? { envoi_ms: envoiMs } : {}) } });
  // 409 : déjà en cours ; le suivi en direct dira la suite.
  if (error && !/409/.test(String((error as { context?: { status?: number } }).context?.status ?? error.message))) throw error;
}

/**
 * Envoie une photo déjà préparée : photo d'origine, ligne « processing »,
 * appel du traitement. La pièce est créée avec un nom et une catégorie
 * provisoires que le serveur remplace (la base les exige).
 */
export async function envoyer(session: Session, preparee: { uri: string }, debut: number): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const sb = db();
  const id = uuid();
  const chemin = `${session.spaceId}/${id}/original.jpg`;
  try {
    const corps = await (await fetch(preparee.uri)).arrayBuffer();
    const up = await sb.storage.from('garments').upload(chemin, corps, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw up.error;
    const { error } = await sb.from('garments').insert({ id, space_id: session.spaceId, category_id: 'hauts', name: 'Pièce', original_path: chemin });
    if (error) {
      await sb.storage.from('garments').remove([chemin]).catch(() => undefined);
      // Le message du déclencheur (dressing plein) est écrit pour être lu.
      return { ok: false, message: error.hint === 'pieces' ? error.message : MESSAGES.envoi };
    }
    await lancer(id, Date.now() - debut).catch(() => undefined);
    return { ok: true, id };
  } catch {
    return { ok: false, message: MESSAGES.envoi };
  }
}

/** « Réessayer » : le traitement repart de la photo d'origine, sans la redemander. */
export const reessayer = (id: string) => lancer(id);

/** « Reprendre la photo » : la nouvelle photo remplace l'originale, puis le traitement repart. */
export async function reprendre(session: Session, id: string, preparee: { uri: string }) {
  const corps = await (await fetch(preparee.uri)).arrayBuffer();
  const up = await db().storage.from('garments').upload(`${session.spaceId}/${id}/original.jpg`, corps, { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  await lancer(id);
}

type Ligne = {
  id: string; name: string; category_id: string; kind: string | null; colors: string[] | null; matiere: string | null;
  saisons: string[] | null; fiche: { motif?: string; coupe?: string; habillage?: number } | null; tags_confidence: number | null;
  pipeline_status: Statut; fail_reason: Raison | null; image_path: string | null; pipeline_version: number | null; updated_at: string;
};
const COLONNES = 'id, name, category_id, kind, colors, matiere, saisons, fiche, tags_confidence, pipeline_status, fail_reason, image_path, pipeline_version, updated_at';

function ficheDe(l: Ligne): Fiche {
  // Étiquetage en échec : la fiche reste vide (la catégorie provisoire n'en est pas une).
  if (l.pipeline_status === 'ready' && l.tags_confidence === null && !l.kind) return FICHE_VIDE;
  return {
    categorie: l.kind ? l.category_id : null,
    type: l.kind,
    couleur: l.colors?.[0] ?? null,
    couleur_2: l.colors?.[1] ?? null,
    matiere: l.matiere,
    motif: l.fiche?.motif ?? null,
    coupe: l.fiche?.coupe ?? null,
    saisons: l.saisons ?? [],
    habillage: l.fiche?.habillage ?? null,
  };
}

/** Les pièces en cours ou à valider de l'espace (pas encore dans le dressing), avec leur détourage. */
export async function lirePieces(session: Session, ids?: string[]): Promise<Omit<PieceAjout, 'locale'>[]> {
  let q = db().from('garments').select(COLONNES).eq('space_id', session.spaceId).is('added_at', null).order('created_at');
  if (ids?.length) q = q.in('id', ids);
  const { data, error } = await q;
  if (error) throw new Error(`pièces : ${error.message}`);
  const lignes = (data ?? []) as unknown as Ligne[];
  const chemins = lignes.filter((l) => l.pipeline_status === 'ready' && l.image_path).map((l) => l.image_path!);
  const signees = chemins.length ? (await db().storage.from('garments').createSignedUrls(chemins, URL_TTL)).data ?? [] : [];
  const url = new Map(signees.map((s) => [s.path, s.signedUrl]));
  return lignes.map((l) => ({
    id: l.id,
    statut: l.pipeline_status,
    raison: l.fail_reason,
    cutout: l.image_path ? url.get(l.image_path) ?? null : null,
    nom: l.name,
    fiche: ficheDe(l),
    confiance: l.tags_confidence,
    depuis: Date.parse(l.updated_at),
  }));
}

/**
 * Le suivi en direct des pièces de l'espace (RLS appliquée par Realtime).
 * Chaque changement relit la pièce (pour signer son détourage).
 */
export function suivre(session: Session, quandChange: (id: string) => void): () => void {
  const canal: RealtimeChannel = db()
    .channel(`ajout-${session.spaceId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'garments', filter: `space_id=eq.${session.spaceId}` }, (p) => {
      const id = (p.new as { id?: string })?.id;
      if (id) quandChange(id);
    })
    .subscribe();
  return () => { db().removeChannel(canal); };
}

/** La fiche corrigée, écrite en valeurs de la taxonomie (et dans les anciennes colonnes, lues par Kodi). */
export async function enregistrerFiche(id: string, f: Fiche, nomActuel: string) {
  const ligne: Record<string, unknown> = {
    colors: [f.couleur, f.couleur_2].filter(Boolean),
    matiere: f.matiere,
    material: f.matiere ? libelle(MATIERES, f.matiere) : null,
    fiche: { ...(f.motif ? { motif: f.motif } : {}), ...(f.coupe ? { coupe: f.coupe } : {}), ...(f.habillage ? { habillage: f.habillage } : {}) },
  };
  if (f.categorie && f.type) {
    ligne.category_id = f.categorie;
    ligne.kind = f.type;
    if (nomActuel === 'Pièce' || !nomActuel.trim()) ligne.name = nomDeLaPiece(f.type, f.couleur);
  }
  if (f.saisons.length) {
    ligne.saisons = SAISONS.map((s) => s.id).filter((s) => f.saisons.includes(s));
    ligne.season = saisonResumee(f.saisons);
  }
  const { error } = await db().from('garments').update(ligne).eq('id', id);
  if (error) throw new Error(`fiche : ${error.message}`);
}

/** « Tout ajouter » : les pièces prêtes et nommées rejoignent le dressing (date posée par la base). */
export async function toutAjouter(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { data, error } = await db().from('garments').update({ added_at: new Date().toISOString() })
    .in('id', ids).eq('pipeline_status', 'ready').is('added_at', null).select('id');
  if (error) throw new Error(`ajout : ${error.message}`);
  return data?.length ?? 0;
}

/** Retire une pièce en revue (et ses images). */
export async function retirer(session: Session, id: string) {
  const sb = db();
  await sb.storage.from('garments').remove(['original.jpg', 'cutout.webp', 'thumb.webp'].map((f) => `${session.spaceId}/${id}/${f}`)).catch(() => undefined);
  const { error } = await sb.from('garments').delete().eq('id', id);
  if (error) throw new Error(`retrait : ${error.message}`);
}
