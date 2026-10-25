/**
 * La découpe d'une pièce à partir du masque de segmentation de Gemini.
 * Logique pure (pas de réseau, pas de décodeur) : l'appel est dans steps.ts,
 * le décodage du PNG du masque dans index.ts.
 *
 * Gemini rend une liste JSON : un cadre `box_2d` [y0, x0, y1, x1] en
 * millièmes de l'image, un `mask` (PNG en base64, carte de probabilité en
 * niveaux de gris, de la taille qu'il veut) et un `label`. On étire la carte
 * sur le cadre et on lit la probabilité comme une opacité douce : le bord de
 * la pièce est anticrénelé sans autre traitement.
 */
import type { Raster } from './cutout.ts';
import { CUTOUT } from './config.ts';

export type Segment = {
  /** Cadre en fractions de la photo : [x, y, largeur, hauteur]. */
  box: [number, number, number, number];
  /** PNG de la carte de probabilité, en base64 (sans préfixe), ou null. */
  mask: string | null;
  label: string;
};

/** Lit la réponse de Gemini, avec ou sans balises ```json, cadres et masques abîmés ignorés. */
export function parseSegments(text: string): Segment[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const out: Segment[] = [];
  for (const e of raw as Record<string, unknown>[]) {
    const b = Array.isArray(e?.box_2d) ? e.box_2d.map(Number) : [];
    if (b.length !== 4 || b.some((v) => !Number.isFinite(v))) continue;
    const [y0, x0, y1, x1] = b.map((v) => Math.min(1, Math.max(0, v / 1000)));
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) continue;
    const mask = typeof e.mask === 'string' ? e.mask.replace(/^data:image\/\w+;base64,/, '').trim() : '';
    out.push({ box: [x0, y0, x1 - x0, y1 - y0], mask: mask || null, label: String(e.label ?? '') });
  }
  return out;
}

/** Part de recouvrement de deux cadres [x, y, w, h] sur le plus petit des deux. */
export function overlap(a: readonly number[], b: readonly number[]): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a[2] * a[3], b[2] * b[3]);
}

/** Le segment qui correspond à la pièce : le mieux placé par rapport au cadre de Kodi, sinon le plus grand. */
export function pickSegment(segments: Segment[], hint: readonly number[] | null | undefined): Segment | null {
  const usable = segments.filter((s) => s.mask);
  if (!usable.length) return null;
  if (hint) {
    return [...usable].sort((a, b) => overlap(b.box, hint) - overlap(a.box, hint) || b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
  }
  return [...usable].sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
}

/** Le cadre du segment en pixels, un peu élargi, borné à la photo. */
export function pixelBox(box: readonly number[], w: number, h: number, pad = CUTOUT.boxPad) {
  const px = box[2] * w * pad, py = box[3] * h * pad;
  const e = 1e-6; // 0,2 × 500 = 100,00000000000001 : sans cela, le plafond ajoute un pixel
  const x0 = Math.max(0, Math.floor(box[0] * w - px + e));
  const y0 = Math.max(0, Math.floor(box[1] * h - py + e));
  const x1 = Math.min(w, Math.ceil((box[0] + box[2]) * w + px - e));
  const y1 = Math.min(h, Math.ceil((box[1] + box[3]) * h + py - e));
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/**
 * La pièce découpée dans la photo : les pixels sont ceux de la photo, seule
 * l'opacité vient du masque. `mask` est la carte décodée (le canal rouge fait
 * la probabilité) ; `segBox` le cadre exact du segment, en fractions, sur
 * lequel elle s'étire ; `region` la zone de la photo découpée.
 */
export function cutFromMask(
  photo: Raster,
  mask: Raster,
  segBox: readonly number[],
  region: { x: number; y: number; w: number; h: number },
): Raster {
  const { width: W, height: H } = photo;
  const bx = segBox[0] * W, by = segBox[1] * H, bw = segBox[2] * W, bh = segBox[3] * H;
  const { low, high } = CUTOUT.mask;
  const out = new Uint8Array(region.w * region.h * 4);

  const p = (x: number, y: number) => mask.data[(Math.min(mask.height - 1, Math.max(0, y)) * mask.width + Math.min(mask.width - 1, Math.max(0, x))) * 4];

  for (let y = 0; y < region.h; y++) {
    const py = region.y + y;
    // Position dans le masque, étiré sur le cadre ; hors du cadre : transparent.
    const v = ((py + 0.5 - by) / bh) * mask.height - 0.5;
    for (let x = 0; x < region.w; x++) {
      const px = region.x + x;
      const u = ((px + 0.5 - bx) / bw) * mask.width - 0.5;
      const o = (y * region.w + x) * 4;
      let prob = 0;
      if (px + 0.5 >= bx && px + 0.5 <= bx + bw && py + 0.5 >= by && py + 0.5 <= by + bh) {
        const x0 = Math.floor(u), y0 = Math.floor(v), tx = u - x0, ty = v - y0;
        prob = (p(x0, y0) * (1 - tx) + p(x0 + 1, y0) * tx) * (1 - ty) + (p(x0, y0 + 1) * (1 - tx) + p(x0 + 1, y0 + 1) * tx) * ty;
      }
      const i = (py * W + px) * 4;
      out[o] = photo.data[i]; out[o + 1] = photo.data[i + 1]; out[o + 2] = photo.data[i + 2];
      out[o + 3] = Math.round(Math.min(1, Math.max(0, (prob - low) / (high - low))) * 255);
    }
  }
  return { width: region.w, height: region.h, data: out };
}

// ---------------------------------------------------------------- morceaux

/** Étiquette les morceaux connexes (4 voisins) des pixels pour lesquels `on` est vrai. */
function components(w: number, h: number, on: (i: number) => boolean) {
  const label = new Int32Array(w * h);
  const sizes: number[] = [0];
  const stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (label[s] || !on(s)) continue;
    const id = sizes.length;
    let top = 0, n = 0;
    stack[top++] = s;
    label[s] = id;
    while (top) {
      const i = stack[--top];
      n++;
      const x = i % w;
      if (x > 0 && !label[i - 1] && on(i - 1)) { label[i - 1] = id; stack[top++] = i - 1; }
      if (x < w - 1 && !label[i + 1] && on(i + 1)) { label[i + 1] = id; stack[top++] = i + 1; }
      if (i >= w && !label[i - w] && on(i - w)) { label[i - w] = id; stack[top++] = i - w; }
      if (i < w * (h - 1) && !label[i + w] && on(i + w)) { label[i + w] = id; stack[top++] = i + w; }
    }
    sizes.push(n);
  }
  return { label, sizes };
}

/**
 * Retire la poussière (morceaux de moins de 5 % du plus grand : une paire de
 * chaussures garde ses deux pièces) et rebouche les petits trous enfermés
 * (reflet, pli), mais pas une anse ou un col. `oneShare` : la part de la
 * surface tenue par les morceaux gardés, avant ce nettoyage.
 */
export function cleanSpecks(cut: Raster): { cut: Raster; oneShare: number } {
  const { width: w, height: h } = cut;
  const data = new Uint8Array(cut.data);
  const solid = (i: number) => data[i * 4 + 3] >= 128;

  const fg = components(w, h, solid);
  const biggest = Math.max(0, ...fg.sizes);
  const total = fg.sizes.reduce((a, b) => a + b, 0);
  if (!biggest) return { cut: { width: w, height: h, data }, oneShare: 0 };

  const keep = fg.sizes.map((n) => n >= biggest * CUTOUT.speck);
  let kept = 0;
  for (let id = 1; id < fg.sizes.length; id++) if (keep[id]) kept += fg.sizes[id];
  for (let i = 0; i < w * h; i++) {
    if (fg.label[i] && !keep[fg.label[i]]) data[i * 4 + 3] = 0;
  }

  // Trous : morceaux transparents qui ne touchent pas le bord de l'image.
  const bg = components(w, h, (i) => data[i * 4 + 3] < 128);
  const edge = new Set<number>();
  for (let x = 0; x < w; x++) { edge.add(bg.label[x]); edge.add(bg.label[(h - 1) * w + x]); }
  for (let y = 0; y < h; y++) { edge.add(bg.label[y * w]); edge.add(bg.label[y * w + w - 1]); }
  const limit = kept * CUTOUT.hole;
  for (let i = 0; i < w * h; i++) {
    const id = bg.label[i];
    if (id && !edge.has(id) && bg.sizes[id] <= limit) data[i * 4 + 3] = 255;
  }

  return { cut: { width: w, height: h, data }, oneShare: kept / total };
}
