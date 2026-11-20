/**
 * L'ajout de pièces sur le site (spec « Pipeline d'ajout de vêtements »,
 * 20/11), côté navigateur : une photo = une pièce. Même parcours que l'app
 * (mobile/src/state/ajout.ts) : photo préparée ici (orientation, 1024 px,
 * JPEG 85), envoi de l'originale, ligne « processing », traitement par
 * process-garment, suivi en direct, fiche par sélecteurs, « Tout ajouter ».
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { libelle, MATIERES, nomDeLaPiece, saisonResumee, SAISONS } from './taxonomy';

/** L'interrupteur de la bascule : vrai quand le banc est validé. */
export const PIPELINE_AJOUT = false;

export const MAX_PHOTOS = 20;
export const COTE = 1024;
export const COTE_MIN = 600;
export const PERIME_MS = 45_000;
export const CONFIANCE_FAIBLE = 0.6;
const URL_TTL = 3600;

export type Statut = 'envoi' | 'processing' | 'ready' | 'needs_retake' | 'failed';
export type Raison = 'trop_petite' | 'mask_too_small' | 'mask_too_large' | 'multiple_items' | 'provider_error' | 'unexpected' | 'envoi';

export const MESSAGES: Record<Raison, string> = {
  trop_petite: 'Photo trop petite',
  mask_too_small: 'Rapproche-toi de la pièce',
  mask_too_large: 'Éloigne-toi, la pièce doit être entière',
  multiple_items: 'Une seule pièce par photo',
  provider_error: 'Le traitement n’a pas abouti.',
  unexpected: 'Le traitement n’a pas abouti.',
  envoi: 'La photo n’est pas partie. Vérifie ta connexion.',
};

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
  locale: string | null;
  statut: Statut;
  raison: Raison | null;
  cutout: string | null;
  nom: string;
  fiche: Fiche;
  confiance: number | null;
  depuis: number;
};

export const ficheComplete = (f: Fiche) => Boolean(f.categorie && f.type);
export const aConfirmer = (p: PieceAjout) => p.confiance === null || p.confiance < CONFIANCE_FAIBLE;

/** La photo préparée dans le navigateur, ou null si elle est trop petite (côté court sous 600 px). */
export async function preparer(fichier: Blob): Promise<Blob | null> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  try {
    if (Math.min(image.width, image.height) < COTE_MIN) return null;
    const k = Math.min(1, COTE / Math.max(image.width, image.height));
    const w = Math.round(image.width * k), h = Math.round(image.height * k);
    const toile = document.createElement('canvas');
    toile.width = w;
    toile.height = h;
    const ctx = toile.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, w, h);
    return await new Promise<Blob | null>((ok) => toile.toBlob(ok, 'image/jpeg', 0.85));
  } finally {
    image.close();
  }
}

async function lancer(sb: SupabaseClient, id: string, envoiMs?: number) {
  const { error } = await sb.functions.invoke('process-garment', { body: { garment_id: id, ...(envoiMs !== undefined ? { envoi_ms: envoiMs } : {}) } });
  const statut = (error as { context?: { status?: number } } | null)?.context?.status;
  if (error && statut !== 409) throw error;
}

export async function envoyer(sb: SupabaseClient, spaceId: string, photo: Blob, debut: number): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const id = crypto.randomUUID();
  const chemin = `${spaceId}/${id}/original.jpg`;
  try {
    const up = await sb.storage.from('garments').upload(chemin, photo, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw up.error;
    const { error } = await sb.from('garments').insert({ id, space_id: spaceId, category_id: 'hauts', name: 'Pièce', original_path: chemin });
    if (error) {
      await sb.storage.from('garments').remove([chemin]).catch(() => undefined);
      return { ok: false, message: error.hint === 'pieces' ? error.message : MESSAGES.envoi };
    }
    await lancer(sb, id, Date.now() - debut).catch(() => undefined);
    return { ok: true, id };
  } catch {
    return { ok: false, message: MESSAGES.envoi };
  }
}

export const reessayer = (sb: SupabaseClient, id: string) => lancer(sb, id);

export async function reprendre(sb: SupabaseClient, spaceId: string, id: string, photo: Blob) {
  const up = await sb.storage.from('garments').upload(`${spaceId}/${id}/original.jpg`, photo, { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  await lancer(sb, id);
}

type Ligne = {
  id: string; name: string; category_id: string; kind: string | null; colors: string[] | null; matiere: string | null;
  saisons: string[] | null; fiche: { motif?: string; coupe?: string; habillage?: number } | null; tags_confidence: number | null;
  pipeline_status: Statut; fail_reason: Raison | null; image_path: string | null; updated_at: string;
};
const COLONNES = 'id, name, category_id, kind, colors, matiere, saisons, fiche, tags_confidence, pipeline_status, fail_reason, image_path, updated_at';

function ficheDe(l: Ligne): Fiche {
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

export async function lirePieces(sb: SupabaseClient, spaceId: string, ids?: string[]): Promise<Omit<PieceAjout, 'locale'>[]> {
  let q = sb.from('garments').select(COLONNES).eq('space_id', spaceId).is('added_at', null).order('created_at');
  if (ids?.length) q = q.in('id', ids);
  const { data, error } = await q;
  if (error) throw new Error(`pièces : ${error.message}`);
  const lignes = (data ?? []) as unknown as Ligne[];
  const chemins = lignes.filter((l) => l.pipeline_status === 'ready' && l.image_path).map((l) => l.image_path!);
  const signees = chemins.length ? (await sb.storage.from('garments').createSignedUrls(chemins, URL_TTL)).data ?? [] : [];
  const url = new Map(signees.map((s) => [s.path, s.signedUrl]));
  return lignes.map((l) => ({
    id: l.id, statut: l.pipeline_status, raison: l.fail_reason, cutout: l.image_path ? url.get(l.image_path) ?? null : null,
    nom: l.name, fiche: ficheDe(l), confiance: l.tags_confidence, depuis: Date.parse(l.updated_at),
  }));
}

export function suivre(sb: SupabaseClient, spaceId: string, quandChange: (id: string) => void): () => void {
  const canal = sb
    .channel(`ajout-${spaceId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'garments', filter: `space_id=eq.${spaceId}` }, (p) => {
      const id = (p.new as { id?: string })?.id;
      if (id) quandChange(id);
    })
    .subscribe();
  return () => { sb.removeChannel(canal); };
}

export async function enregistrerFiche(sb: SupabaseClient, id: string, f: Fiche, nomActuel: string) {
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
  const { error } = await sb.from('garments').update(ligne).eq('id', id);
  if (error) throw new Error(`fiche : ${error.message}`);
}

export async function toutAjouter(sb: SupabaseClient, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { data, error } = await sb.from('garments').update({ added_at: new Date().toISOString() })
    .in('id', ids).eq('pipeline_status', 'ready').is('added_at', null).select('id');
  if (error) throw new Error(`ajout : ${error.message}`);
  return data?.length ?? 0;
}

export async function retirer(sb: SupabaseClient, spaceId: string, id: string) {
  await sb.storage.from('garments').remove(['original.jpg', 'cutout.webp', 'thumb.webp'].map((f) => `${spaceId}/${id}/${f}`)).catch(() => undefined);
  const { error } = await sb.from('garments').delete().eq('id', id);
  if (error) throw new Error(`retrait : ${error.message}`);
}
