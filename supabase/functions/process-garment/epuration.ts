/**
 * L'épuration (demandée le 21/11) : ne garder QUE le vêtement ou la
 * chaussure, sans ce qui est posé avec (cintre, boîte, patère, tringle).
 *
 * Le détourage général (BiRefNet) donne un bord très net mais garde tout
 * objet au premier plan. SAM 3, interrogé avec le type de la pièce (« jacket »,
 * « sneaker »…), sait ce qu'est la pièce mais son bord est moins fin. On
 * garde donc les pixels de BiRefNet seulement là où SAM voit la pièce
 * (légèrement élargi pour ne rien rogner). Aucun pixel n'est inventé : on
 * n'enlève que ce qui n'est pas la pièce.
 *
 * Logique pure : l'appel à SAM 3 est fait ailleurs (dressy-agent/fal.ts).
 */
import { SEUILS } from './reglages.ts';

export const EPURATION = {
  /** Confiance minimale d'un masque de SAM 3. */
  scoreMin: 0.3,
  /** Part minimale d'un masque de SAM qui doit tomber dans le détourage (sinon il vise autre chose). */
  dedansMin: 0.6,
  /** Élargissement du masque de SAM, en pixels sur une photo de 1024 px. */
  rayon: 6,
  /**
   * Sous cette part du détourage gardée, on soupçonne SAM d'avoir vu un
   * morceau seulement (une manche) : le détourage reste tel quel.
   */
  partMin: 0.2,
} as const;

/** Un masque de SAM 3, à sa propre taille (en général 512 px : il ne fait que délimiter la zone). */
export type MasqueSam = { alpha: Uint8Array; largeur: number; hauteur: number; score: number | null };

export type Epuration =
  | { appliquee: true; alpha: Uint8Array; part: number; masques: number }
  | { appliquee: false; raison: 'aucun_masque' | 'trop_peu'; part?: number; masques: number };

/** Élargit un masque binaire d'un carré de rayon r (deux passes séparées). */
function elargir(bin: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return bin;
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let dernier = -Infinity;
    // Gauche à droite puis droite à gauche : distance au pixel allumé le plus proche sur la ligne.
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x]) dernier = x;
      if (x - dernier <= r) tmp[y * w + x] = 1;
    }
    dernier = Infinity;
    for (let x = w - 1; x >= 0; x--) {
      if (bin[y * w + x]) dernier = x;
      if (dernier - x <= r) tmp[y * w + x] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let dernier = -Infinity;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) dernier = y;
      if (y - dernier <= r) out[y * w + x] = 1;
    }
    dernier = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) dernier = y;
      if (dernier - y <= r) out[y * w + x] = 1;
    }
  }
  return out;
}

export function epurer(base: Uint8Array, sam: MasqueSam[], w: number, h: number, reglages: typeof EPURATION = EPURATION): Epuration {
  const n = w * h;
  const seuil = SEUILS.opaque;
  let aireBase = 0;
  for (let i = 0; i < n; i++) if (base[i] >= seuil) aireBase++;
  if (!aireBase) return { appliquee: false, raison: 'aucun_masque', masques: 0 };

  // La zone se calcule à la taille des masques de SAM (tous de la même taille : celle de l'image envoyée).
  const ms = sam.filter((m) => m.alpha.length === m.largeur * m.hauteur && m.largeur > 0);
  const W = ms[0]?.largeur ?? w, H = ms[0]?.hauteur ?? h, N = W * H;
  // Le détourage vu à la taille de SAM (plus proche voisin) : pour savoir si un masque vise bien la pièce.
  const baseS = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    const yy = Math.min(h - 1, Math.floor(((y + 0.5) * h) / H));
    for (let x = 0; x < W; x++) baseS[y * W + x] = base[yy * w + Math.min(w - 1, Math.floor(((x + 0.5) * w) / W))] >= seuil ? 1 : 0;
  }

  const union = new Uint8Array(N);
  let gardes = 0;
  for (const m of ms) {
    if ((m.score ?? 0.5) < reglages.scoreMin || m.largeur !== W || m.hauteur !== H) continue;
    let aire = 0, dans = 0;
    for (let i = 0; i < N; i++) {
      if (m.alpha[i] < seuil) continue;
      aire++;
      dans += baseS[i];
    }
    if (aire < N * SEUILS.poussiere || dans / aire < reglages.dedansMin) continue;
    gardes++;
    for (let i = 0; i < N; i++) if (m.alpha[i] >= seuil) union[i] = 1;
  }
  if (!gardes) return { appliquee: false, raison: 'aucun_masque', masques: 0 };

  const zone = elargir(union, W, H, Math.max(1, Math.round((reglages.rayon * Math.max(W, H)) / 1024)));
  const alpha = new Uint8Array(n);
  let garde = 0;
  for (let y = 0; y < h; y++) {
    const ligne = Math.min(H - 1, Math.floor(((y + 0.5) * H) / h)) * W;
    for (let x = 0; x < w; x++) {
      if (!zone[ligne + Math.min(W - 1, Math.floor(((x + 0.5) * W) / w))]) continue;
      const i = y * w + x;
      alpha[i] = base[i];
      if (base[i] >= seuil) garde++;
    }
  }
  const part = garde / aireBase;
  if (part < reglages.partMin) return { appliquee: false, raison: 'trop_peu', part, masques: gardes };
  return { appliquee: true, alpha, part, masques: gardes };
}
