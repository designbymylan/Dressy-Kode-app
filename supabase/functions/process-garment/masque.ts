/**
 * Le masque d'une pièce : son opacité, pixel par pixel, à la taille de la
 * photo. Logique pure (ni réseau ni décodeur) : ce que rend le service de
 * détourage est décodé ailleurs, puis lu ici.
 */
import type { Raster } from '../dressy-agent/cutout.ts';
import { SEUILS } from './reglages.ts';

export type Masque = { largeur: number; hauteur: number; alpha: Uint8Array };

export type Boite = { x: number; y: number; w: number; h: number };

export type Analyse = {
  /** Part de l'image occupée par la pièce (pixels opaques, poussières comprises). */
  couverture: number;
  /** Part du masque (sans les poussières) tenue par le plus gros morceau. */
  plusGros: number;
  /** Même chose pour les deux plus gros morceaux réunis : une paire de chaussures. */
  deuxPlusGros: number;
  /** Morceaux qui ne sont pas des poussières. */
  morceaux: number;
  /** Le cadre des morceaux gardés, ou null si le masque est vide. */
  boite: Boite | null;
};

/**
 * L'opacité lue dans l'image rendue par le détoureur : son canal alpha s'il
 * en a un vrai (Bria rend la pièce détourée), sinon le canal rouge d'un
 * masque en niveaux de gris (BiRefNet en « masque seul »).
 */
export function opaciteDe(r: Raster): Uint8Array {
  const n = r.width * r.height;
  const out = new Uint8Array(n);
  let alphaUtile = false;
  for (let i = 0; i < n; i++) if (r.data[i * 4 + 3] < 255) { alphaUtile = true; break; }
  const canal = alphaUtile ? 3 : 0;
  for (let i = 0; i < n; i++) out[i] = r.data[i * 4 + canal];
  return out;
}

/** Le masque étiré (bilinéaire) à la taille de la photo, quand le détoureur en rend une autre. */
export function etirer(alpha: Uint8Array, w0: number, h0: number, w: number, h: number): Uint8Array {
  if (w0 === w && h0 === h) return alpha;
  const out = new Uint8Array(w * h);
  const sx = w0 / w, sy = h0 / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(h0 - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(h0 - 1, y0 + 1), dy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(w0 - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(w0 - 1, x0 + 1), dx = fx - x0;
      const a = alpha[y0 * w0 + x0] * (1 - dx) + alpha[y0 * w0 + x1] * dx;
      const b = alpha[y1 * w0 + x0] * (1 - dx) + alpha[y1 * w0 + x1] * dx;
      out[y * w + x] = Math.round(a * (1 - dy) + b * dy);
    }
  }
  return out;
}

/**
 * Les morceaux du masque (pixels opaques reliés, 8 voisins), par union de
 * classes en deux passes. Rend l'étiquette de chaque pixel (0 : transparent)
 * et la taille de chaque morceau.
 */
function morceaux(m: Masque, seuil: number): { etiquettes: Int32Array; tailles: number[] } {
  const { largeur: w, hauteur: h, alpha } = m;
  const etiquettes = new Int32Array(w * h);
  const parent: number[] = [0];
  const racine = (a: number) => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  const unir = (a: number, b: number) => {
    const ra = racine(a), rb = racine(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  let e = 0;
  const voir = (v: number) => {
    const ev = etiquettes[v];
    if (!ev) return;
    if (!e) e = ev;
    else if (ev !== e) unir(e, ev);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (alpha[i] < seuil) continue;
      e = 0;
      // Voisins déjà vus : gauche, haut-gauche, haut, haut-droite.
      if (x > 0) voir(i - 1);
      if (y > 0) {
        if (x > 0) voir(i - w - 1);
        voir(i - w);
        if (x < w - 1) voir(i - w + 1);
      }
      if (!e) { e = parent.length; parent.push(e); }
      etiquettes[i] = e;
    }
  }
  const tailles = new Array(parent.length).fill(0);
  for (let i = 0; i < etiquettes.length; i++) {
    if (!etiquettes[i]) continue;
    const r = racine(etiquettes[i]);
    etiquettes[i] = r;
    tailles[r]++;
  }
  return { etiquettes, tailles };
}

/**
 * Ce que dit le masque, et le masque nettoyé de ses poussières (petits
 * morceaux isolés, souvent un reflet ou un grain du fond) pour l'image finale.
 */
export function analyser(m: Masque, seuils: { opaque: number; poussiere: number } = SEUILS): { analyse: Analyse; propre: Masque } {
  const { largeur: w, hauteur: h } = m;
  const n = w * h;
  const { etiquettes, tailles } = morceaux(m, seuils.opaque);
  const minPoussiere = Math.max(1, Math.round(n * seuils.poussiere));
  let opaques = 0;
  for (const t of tailles) opaques += t;
  const gardes = tailles.map((t, e) => ({ e, t })).filter((x) => x.t >= minPoussiere).sort((a, b) => b.t - a.t);
  const totalGarde = gardes.reduce((s, x) => s + x.t, 0);
  const garde = new Uint8Array(tailles.length);
  for (const g of gardes) garde[g.e] = 1;

  const alpha = new Uint8Array(m.alpha);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < n; i++) {
    const e = etiquettes[i];
    if (e && !garde[e]) { alpha[i] = 0; continue; }
    if (!e) {
      // Bord adouci (sous le seuil) : gardé seulement à côté d'un morceau gardé.
      if (alpha[i] && !voisinGarde(etiquettes, garde, i, w, h)) alpha[i] = 0;
      continue;
    }
    const x = i % w, y = (i - x) / w;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }

  return {
    analyse: {
      couverture: opaques / n,
      plusGros: totalGarde ? gardes[0].t / totalGarde : 0,
      deuxPlusGros: totalGarde ? (gardes[0].t + (gardes[1]?.t ?? 0)) / totalGarde : 0,
      morceaux: gardes.length,
      boite: x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    },
    propre: { largeur: w, hauteur: h, alpha },
  };
}

function voisinGarde(etiquettes: Int32Array, garde: Uint8Array, i: number, w: number, h: number): boolean {
  const x = i % w, y = (i - x) / w;
  for (let dy = -2; dy <= 2; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= w) continue;
      const e = etiquettes[yy * w + xx];
      if (e && garde[e]) return true;
    }
  }
  return false;
}
