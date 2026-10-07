/**
 * Détoure les photos de pièces envoyées le 07/10 : le fond (damier imprimé ou
 * gris studio) est rempli depuis les bords, tant qu'il reste neutre et clair.
 * Les pièces d'une photo à plat sont séparées en composantes connexes.
 *
 *   node tools/detour-photos.cjs photo.jpg mobile/assets/pieces/nom.png [clarté min = 185] [écart max = 9] [rognage = 1]
 *
 * Utilise sharp, déjà présent dans web/node_modules (Next.js).
 */
const sharp = require(require('node:path').join(__dirname, '..', 'web', 'node_modules', 'sharp'));
const [, , src, out, minV = '185', maxC = '9', erode = '1'] = process.argv;

(async () => {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;
  const bgLike = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    bgLike[i] = mx - mn <= +maxC && mn >= +minV ? 1 : 0;
  }
  // Remplissage depuis les bords.
  const bg = new Uint8Array(N);
  const q = new Int32Array(N);
  let h = 0, t = 0;
  const push = (i) => { if (!bg[i] && bgLike[i]) { bg[i] = 1; q[t++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (h < t) {
    const i = q[h++], x = i % W, y = (i / W) | 0;
    if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W);
  }
  // Rogner d'un ou deux pixels le bord de la pièce (liseré du fond).
  let fg = new Uint8Array(N);
  for (let i = 0; i < N; i++) fg[i] = bg[i] ? 0 : 1;
  for (let k = 0; k < +erode; k++) {
    const nx = new Uint8Array(fg);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (fg[i] && (!fg[i - 1] || !fg[i + 1] || !fg[i - W] || !fg[i + W])) nx[i] = 0;
    }
    fg = nx;
  }
  // Composantes connexes de la pièce (les petites miettes partent).
  const lab = new Int32Array(N);
  const comps = [];
  for (let s = 0; s < N; s++) {
    if (!fg[s] || lab[s]) continue;
    const id = comps.length + 1;
    let hh = 0, tt = 0; q[tt++] = s; lab[s] = id;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
    while (hh < tt) {
      const i = q[hh++], x = i % W, y = (i / W) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && fg[j] && !lab[j]) { lab[j] = id; q[tt++] = j; }
      }
    }
    comps.push({ id, n, x0, y0, x1, y1 });
  }
  const big = comps.filter((c) => c.n > N * 0.01).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  console.log(src, W, H, 'pièces :', big.map((c) => `${c.n}px [${c.x0},${c.y0}]-[${c.x1},${c.y1}]`).join(' · '));
  const rgba = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2];
  }
  let k = 0;
  for (const c of big) {
    const alpha = Buffer.alloc(N * 4);
    rgba.copy(alpha);
    for (let i = 0; i < N; i++) alpha[i * 4 + 3] = lab[i] === c.id ? 255 : 0;
    const pad = 8;
    const left = Math.max(0, c.x0 - pad), top = Math.max(0, c.y0 - pad);
    const w = Math.min(W - left, c.x1 - c.x0 + 1 + pad * 2), hgt = Math.min(H - top, c.y1 - c.y0 + 1 + pad * 2);
    // Un léger flou du seul canal alpha adoucit le bord sans baver.
    const piece = sharp(alpha, { raw: { width: W, height: H, channels: 4 } }).extract({ left, top, width: w, height: hgt });
    const buf = await piece.raw().toBuffer();
    const a = await sharp(buf, { raw: { width: w, height: hgt, channels: 4 } }).extractChannel(3).blur(0.6).raw().toBuffer();
    for (let i = 0; i < w * hgt; i++) buf[i * 4 + 3] = a[i];
    const name = big.length > 1 ? out.replace('.png', `-${++k}.png`) : out;
    await sharp(buf, { raw: { width: w, height: hgt, channels: 4 } })
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
      .toFile(name);
    console.log(' →', name);
  }
})();
