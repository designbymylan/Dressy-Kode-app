/**
 * Détourage et mise au format, sans aucune dépendance : ce fichier tourne
 * tel quel dans l'Edge Function (Deno) et dans les tests (Node).
 */

export type Raster = { width: number; height: number; data: Uint8Array };

type Rgb = [number, number, number];

/**
 * Teinte du fond : la médiane de TOUT le pourtour de l'image, canal par
 * canal. Plus robuste que les quatre coins, qu'un pli de la pièce ou un
 * reste d'ombre suffit à fausser.
 */
export function borderColour(r: Raster): Rgb {
  const { width: w, height: h, data } = r;
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let n = 0;
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    hist[0][data[i]]++; hist[1][data[i + 1]]++; hist[2][data[i + 2]]++;
    n++;
  };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
  const median = (hc: Uint32Array) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) { acc += hc[v]; if (acc * 2 >= n) return v; }
    return 255;
  };
  return [median(hist[0]), median(hist[1]), median(hist[2])];
}

/**
 * Rend transparent le fond uni autour d'une pièce, en quatre temps.
 *
 * 1. Remplissage depuis les BORDS : seuls les pixels proches du fond ET
 *    reliés au bord deviennent transparents. C'est ce qui sauve une chemise
 *    ivoire : son clair n'est pas relié au bord, il est entouré par le
 *    vêtement, donc il est conservé. Un seuil global effacerait au contraire
 *    l'intérieur des pièces claires.
 * 2. Les trous : le fond enfermé dans la pièce (anse d'un sac, intérieur
 *    d'un collier, d'une ceinture bouclée) n'est pas relié au bord. On le
 *    vide s'il est parfaitement uni et de la teinte exacte du fond ; un
 *    imprimé clair, lui, a toujours un grain qui le trahit.
 * 3. Les poussières : les petits îlots détachés de la pièce disparaissent
 *    (8-connexité, pour ne pas casser une chaîne fine en diagonale).
 * 4. Les bords : une bande de deux pixels reçoit une transparence
 *    progressive et perd la teinte du fond qui s'y mêlait, pour éviter le
 *    liseré blanc ou gris autour de la pièce.
 */
export function cutoutBackground(r: Raster, tolerance = 26): Raster {
  const { width: w, height: h, data } = r;
  const size = w * h;
  const out = new Uint8Array(data);
  const bg = borderColour(r);
  const tol = tolerance * 3;

  const dist = new Uint16Array(size);
  for (let p = 0; p < size; p++) {
    const i = p * 4;
    dist[p] = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
  }

  const clear = new Uint8Array(size); // 1 = fond, rendu transparent
  const stack = new Int32Array(size);

  // 1. remplissage depuis les bords
  let top = 0;
  const seed = (p: number) => {
    if (clear[p] || dist[p] > tol) return;
    clear[p] = 1;
    stack[top++] = p;
  };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (top) {
    const p = stack[--top];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < size - w) seed(p + w);
  }

  // 2. trous de fond enfermés dans la pièce
  const seen = new Uint8Array(size);
  const minHole = Math.max(48, Math.round(size * 0.0003));
  const members: number[] = [];
  for (let s = 0; s < size; s++) {
    if (clear[s] || seen[s] || dist[s] > tol) continue;
    members.length = 0;
    seen[s] = 1;
    stack[0] = s;
    top = 1;
    let sumD = 0, sumL = 0, sumL2 = 0;
    while (top) {
      const p = stack[--top];
      members.push(p);
      const i = p * 4;
      const l = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      sumD += dist[p]; sumL += l; sumL2 += l * l;
      const x = p % w;
      const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < size - w ? p + w : -1];
      for (const q of next) {
        if (q < 0 || seen[q] || clear[q] || dist[q] > tol) continue;
        seen[q] = 1;
        stack[top++] = q;
      }
    }
    const n = members.length;
    const meanD = sumD / n;
    const sd = Math.sqrt(Math.max(0, sumL2 / n - (sumL / n) ** 2));
    if (n >= minHole && meanD <= 24 && sd <= 4) for (const p of members) clear[p] = 1;
  }

  // 3. îlots de poussière
  const label = new Int32Array(size).fill(-1);
  const areas: number[] = [];
  for (let s = 0; s < size; s++) {
    if (clear[s] || label[s] >= 0) continue;
    const id = areas.length;
    let area = 0;
    label[s] = id;
    stack[0] = s;
    top = 1;
    while (top) {
      const p = stack[--top];
      area++;
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || (!dx && !dy)) continue;
          const q = yy * w + xx;
          if (clear[q] || label[q] >= 0) continue;
          label[q] = id;
          stack[top++] = q;
        }
      }
    }
    areas.push(area);
  }
  if (areas.length > 1) {
    const largest = Math.max(...areas);
    const minIsland = Math.max(24, Math.round(largest * 0.004));
    for (let p = 0; p < size; p++) if (label[p] >= 0 && areas[label[p]] < minIsland) clear[p] = 1;
  }

  for (let p = 0; p < size; p++) if (clear[p]) out[p * 4 + 3] = 0;

  // 4. bords doux, sur deux pixels. Seuls les pixels « entre deux » (ni
  // fond, ni franchement pièce) sont touchés : l'intérieur clair d'une pièce,
  // même au ras de son contour, garde son opacité.
  const soft = new Uint8Array(size);
  const touches = (p: number, mark: (q: number) => boolean) => {
    const x = p % w;
    return (x > 0 && mark(p - 1)) || (x < w - 1 && mark(p + 1)) || (p >= w && mark(p - w)) || (p < size - w && mark(p + w));
  };
  const blend = (p: number) => dist[p] > tol && dist[p] < tol * 2;
  const soften = (p: number) => {
    const a = (dist[p] - tol) / tol;
    const i = p * 4;
    out[i + 3] = Math.round(255 * a);
    for (let k = 0; k < 3; k++) {
      const v = (data[i + k] - (1 - a) * bg[k]) / a;
      out[i + k] = Math.max(0, Math.min(255, Math.round(v)));
    }
  };
  for (let p = 0; p < size; p++) {
    if (!clear[p] && blend(p) && touches(p, (q) => clear[q] === 1)) soft[p] = 1;
  }
  for (let p = 0; p < size; p++) {
    if (!clear[p] && !soft[p] && blend(p) && touches(p, (q) => soft[q] === 1)) soft[p] = 2;
  }
  for (let p = 0; p < size; p++) if (soft[p]) soften(p);

  return { width: w, height: h, data: out };
}

/** Part des pixels rendus transparents : sert à repérer un détourage raté. */
export function alphaRatio(r: Raster): number {
  let clear = 0;
  for (let i = 3; i < r.data.length; i += 4) if (r.data[i] === 0) clear++;
  return clear / (r.width * r.height);
}

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Le cadre de la pièce dans l'image, avec une petite marge : là où l'on
 * recadre. Gardé avec la pièce pour que l'écran puisse superposer exactement
 * l'image générée (avec son fond) et la pièce détourée.
 */
export function contentBox(r: Raster, padRatio = 0.06): Box | null {
  const { width: w, height: h, data } = r;
  let minX = w, minY = h, maxX = -1, maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;

  const pad = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * padRatio);
  const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
  const x1 = Math.min(w - 1, maxX + pad), y1 = Math.min(h - 1, maxY + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function crop(r: Raster, b: Box): Raster {
  const out = new Uint8Array(b.w * b.h * 4);
  for (let y = 0; y < b.h; y++) {
    const from = ((b.y + y) * r.width + b.x) * 4;
    out.set(r.data.subarray(from, from + b.w * 4), y * b.w * 4);
  }
  return { width: b.w, height: b.h, data: out };
}

/**
 * Recadre sur la pièce, avec une petite marge. Les générateurs laissent des
 * marges très variables : sans ce recadrage, une écharpe et un manteau
 * n'occuperaient pas du tout la même place dans les vignettes du dressing.
 */
export function cropToContent(r: Raster, padRatio = 0.06): Raster {
  const b = contentBox(r, padRatio);
  return b ? crop(r, b) : r;
}

/**
 * Réduction par moyenne de boîte, pondérée par l'alpha : sans cette
 * pondération, les pixels transparents (souvent blancs) éclairciraient le
 * contour de la pièce dans la vignette.
 */
export function downscale(r: Raster, maxSide: number): Raster {
  const { width: w, height: h, data } = r;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  if (scale === 1) return { width: w, height: h, data: new Uint8Array(data) };

  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const out = new Uint8Array(tw * th * 4);

  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * h) / th);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * h) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * w) / tw);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * w) / tw));
      let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          const a = data[i + 3];
          sr += data[i] * a; sg += data[i + 1] * a; sb += data[i + 2] * a; sa += a; n++;
        }
      }
      const o = (ty * tw + tx) * 4;
      if (sa > 0) {
        out[o] = Math.round(sr / sa);
        out[o + 1] = Math.round(sg / sa);
        out[o + 2] = Math.round(sb / sa);
      }
      out[o + 3] = Math.round(sa / n);
    }
  }
  return { width: tw, height: th, data: out };
}
