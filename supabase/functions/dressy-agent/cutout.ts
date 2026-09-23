/**
 * Détourage et mise au format, sans aucune dépendance : ce fichier tourne
 * tel quel dans l'Edge Function (Deno) et dans les tests (Node).
 */

export type Raster = { width: number; height: number; data: Uint8Array };

/**
 * Rend transparent le fond uni autour d'un vêtement.
 *
 * Le remplissage part des BORDS et progresse vers l'intérieur : seuls les
 * pixels proches du fond ET reliés au bord deviennent transparents. C'est ce
 * qui sauve une chemise ivoire ou un pantalon écru — leur clair n'est pas
 * relié au bord, il est entouré par le vêtement, donc il est conservé.
 *
 * Un seuil global (« tout ce qui est clair devient transparent ») effacerait
 * au contraire l'intérieur de ces pièces, qui sont justement au cœur du
 * dressing visé par le brief.
 */
export function cutoutBackground(r: Raster, tolerance = 26): Raster {
  const { width: w, height: h, data } = r;
  const out = new Uint8Array(data);
  const seen = new Uint8Array(w * h);

  // Teinte du fond : moyenne des quatre coins, plus robuste qu'un seul pixel.
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, (h * w - 1) * 4];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2]; }
  br /= 4; bg /= 4; bb /= 4;

  const near = (i: number) => {
    const d = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb);
    return d <= tolerance * 3;
  };

  // File explicite plutôt que récursion : une image 1024² déborderait la pile.
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (near(p * 4)) queue.push(p);
  };

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (queue.length) {
    const p = queue.pop()!;
    out[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  return { width: w, height: h, data: out };
}

/** Part des pixels rendus transparents — sert à repérer un détourage raté. */
export function alphaRatio(r: Raster): number {
  let clear = 0;
  for (let i = 3; i < r.data.length; i += 4) if (r.data[i] === 0) clear++;
  return clear / (r.width * r.height);
}

/**
 * Recadre sur la pièce, avec une petite marge. Les générateurs laissent des
 * marges très variables : sans ce recadrage, une écharpe et un manteau
 * n'occuperaient pas du tout la même place dans les vignettes du dressing.
 */
export function cropToContent(r: Raster, padRatio = 0.06): Raster {
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
  if (maxX < 0) return r;

  const pad = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * padRatio);
  const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
  const x1 = Math.min(w - 1, maxX + pad), y1 = Math.min(h - 1, maxY + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

  const out = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const from = ((y0 + y) * w + x0) * 4;
    out.set(data.subarray(from, from + cw * 4), y * cw * 4);
  }
  return { width: cw, height: ch, data: out };
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
