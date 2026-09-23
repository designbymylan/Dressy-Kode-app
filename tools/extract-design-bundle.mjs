#!/usr/bin/env node
/**
 * Décode un export HTML auto-contenu de Claude Design.
 *
 * L'export embarque un manifest JSON (base64, souvent gzippé) dont chaque
 * entrée est soit un asset (JS, fonte, image), soit une planche — et une
 * planche est elle-même un bundle complet. On descend donc récursivement.
 * Le nom lisible de chaque planche se lit dans le template parent, sur les
 * <iframe src="about:blank#<uuid>" title="...">.
 *
 * Usage : node tools/extract-design-bundle.mjs <export.html> <dossier-sortie>
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const EXT = { html: '.html', javascript: '.js', css: '.css', json: '.json',
              png: '.png', jpeg: '.jpg', jpg: '.jpg', svg: '.svg',
              woff2: '.woff2', woff: '.woff' };

function section(html, type) {
  const open = `<script type="__bundler/${type}">`;
  const i = html.indexOf(open);
  if (i < 0) return null;
  const start = i + open.length;
  return html.slice(start, html.indexOf('</script>', start));
}

const isBundle = (h) => h.includes('<script type="__bundler/manifest">');

function inflate(buf) {
  for (const fn of [zlib.gunzipSync, zlib.inflateSync, zlib.brotliDecompressSync]) {
    try { return fn(buf); } catch { /* format suivant */ }
  }
  return buf;
}

const safe = (s) => s.replace(/[\/:*?"<>|]/g, '_').trim() || 'sans-nom';

function extFor(mime = '') {
  const sub = mime.split('/')[1] || '';
  for (const [k, v] of Object.entries(EXT)) if (sub.includes(k)) return v;
  return '.bin';
}

let files = 0, boards = 0;

function walk(html, outDir) {
  fs.mkdirSync(outDir, { recursive: true });

  const raw = section(html, 'manifest');
  if (!raw) { fs.writeFileSync(path.join(outDir, 'page.html'), html); files++; return; }

  const manifest = JSON.parse(raw);
  const order = JSON.parse(section(html, 'page_order') || '[]');
  const template = JSON.parse(section(html, 'template') || '""');
  fs.writeFileSync(path.join(outDir, '_template.html'), template);

  const titles = {};
  for (const m of template.matchAll(/about:blank#([0-9a-f-]+)"\s+title="([^"]*)"/g)) titles[m[1]] = m[2];

  const entries = Array.isArray(manifest)
    ? manifest
    : Object.entries(manifest).map(([uuid, v]) => ({ uuid, ...v }));

  for (const e of entries) {
    let bytes = Buffer.from(e.data, 'base64');
    if (e.compressed) bytes = inflate(bytes);
    const name = safe(titles[e.uuid] || e.name || e.uuid);
    const text = bytes.toString('utf8');

    if (order.includes(e.uuid) && isBundle(text)) { boards++; walk(text, path.join(outDir, name)); }
    else { fs.writeFileSync(path.join(outDir, name + extFor(e.mime)), bytes); files++; }
  }
}

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('Usage : node tools/extract-design-bundle.mjs <export.html> <dossier-sortie>');
  process.exit(1);
}
walk(fs.readFileSync(src, 'utf8'), out);
console.log(`${boards} planche(s), ${files} fichier(s) → ${out}`);
