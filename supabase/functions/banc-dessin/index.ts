/**
 * Diagnostic temporaire (17/11) : ce que le serveur voit d'une photo envoyée (taille, orientation EXIF,
 * miniatures avec le cadre du repérage). Verrouillé par un jeton à usage unique (`banc_ia`, mode `sonde`,
 * paramètre `diag`). Ne renvoie que des métadonnées et deux miniatures de 320 px. À supprimer après usage.
 * Les versions précédentes (repérage, consignes, découpe) sont dans l'historique git.
 */
import { createClient } from '@supabase/supabase-js';
import jpeg from 'jpeg-js';
import { decode, tailleImage } from '../dressy-agent/codec.ts';
import { exifOrientation, orient } from '../dressy-agent/normalize.ts';
import { downscale, type Raster } from '../dressy-agent/cutout.ts';
import { decouper, ouvrir } from '../dressy-agent/decoupage.ts';
import { survey, generate } from '../dressy-agent/steps.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const envKey = (single: string, bundle: string): string => {
  const one = Deno.env.get(single);
  if (one) return one;
  const many = Deno.env.get(bundle);
  if (many) {
    const parsed = JSON.parse(many) as Record<string, string>;
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error(`${single} introuvable`);
};
const db = createClient(Deno.env.get('SUPABASE_URL')!, envKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), { auth: { persistSession: false, autoRefreshToken: false } });

async function sha256(texte: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Miniature JPEG de 320 px, avec (facultatif) un cadre rouge en fractions [x, y, w, h]. */
function miniature(r: Raster, cadre?: number[]): string {
  const m = downscale(r, 320);
  if (cadre) {
    const [x0, y0, x1, y1] = [cadre[0] * m.width, cadre[1] * m.height, (cadre[0] + cadre[2]) * m.width, (cadre[1] + cadre[3]) * m.height].map(Math.round);
    const set = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= m.width || y >= m.height) return;
      const i = (y * m.width + x) * 4;
      m.data[i] = 255; m.data[i + 1] = 0; m.data[i + 2] = 0; m.data[i + 3] = 255;
    };
    for (let x = x0; x <= x1; x++) { set(x, y0); set(x, y1); }
    for (let y = y0; y <= y1; y++) { set(x0, y); set(x1, y); }
  }
  return b64(new Uint8Array(jpeg.encode({ data: m.data, width: m.width, height: m.height }, 70).data));
}

const RAMPE = ' .:-=+*#%@';
/** Rendu texte de 90 colonnes : luminosité (ou opacité si `alpha`), cadre en fractions [x, y, w, h] tracé en « | » et « - ». */
function ascii(r: Raster, cadre?: number[], alpha = false): string {
  const cols = 90, rows = Math.round((cols * r.height) / r.width / 2);
  const lignes: string[] = [];
  for (let j = 0; j < rows; j++) {
    let l = '';
    for (let i = 0; i < cols; i++) {
      const x = Math.min(r.width - 1, Math.floor(((i + 0.5) * r.width) / cols)), y = Math.min(r.height - 1, Math.floor(((j + 0.5) * r.height) / rows));
      const k = (y * r.width + x) * 4;
      const v = alpha ? r.data[k + 3] / 255 : (0.3 * r.data[k] + 0.59 * r.data[k + 1] + 0.11 * r.data[k + 2]) / 255;
      let c = RAMPE[Math.min(RAMPE.length - 1, Math.floor((alpha ? v : 1 - v) * RAMPE.length))];
      if (cadre) {
        const fx = i / cols, fy = j / rows, ex = 1 / cols, ey = 1 / rows;
        const dedans = fx >= cadre[0] - ex && fx <= cadre[0] + cadre[2] && fy >= cadre[1] - ey && fy <= cadre[1] + cadre[3];
        if (dedans && (Math.abs(fx - cadre[0]) < ex || Math.abs(fx - (cadre[0] + cadre[2])) < ex)) c = '|';
        else if (dedans && (Math.abs(fy - cadre[1]) < ey || Math.abs(fy - (cadre[1] + cadre[3])) < ey)) c = '-';
      }
      l += c;
    }
    lignes.push(l);
  }
  return lignes.join('\n');
}

/** Rendu texte par classe de couleur : n marine, b bleu, s ciel, w clair, f beige (le parquet), . transparent. */
function classes(r: Raster): string {
  const refs: [string, number[]][] = [['n', [26, 37, 60]], ['b', [59, 82, 116]], ['s', [125, 164, 205]], ['w', [235, 238, 245]], ['f', [201, 178, 140]], ['f', [221, 203, 168]], ['f', [150, 125, 95]]];
  const cols = 90, rows = Math.round((cols * r.height) / r.width / 2);
  const n: Record<string, number> = {};
  const out: string[] = [];
  for (let j = 0; j < rows; j++) {
    let l = '';
    for (let i = 0; i < cols; i++) {
      const x0 = Math.floor((i * r.width) / cols), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * r.width) / cols)), y0 = Math.floor((j * r.height) / rows), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * r.height) / rows));
      const cnt: Record<string, number> = {};
      let opaque = 0, total = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const k = (y * r.width + x) * 4;
        total++;
        if (r.data[k + 3] < 128) continue;
        opaque++;
        let best = '?', bd = Infinity;
        for (const [c, v] of refs) { const d = Math.abs(r.data[k] - v[0]) + Math.abs(r.data[k + 1] - v[1]) + Math.abs(r.data[k + 2] - v[2]); if (d < bd) { bd = d; best = c; } }
        cnt[best] = (cnt[best] ?? 0) + 1;
      }
      if (opaque < total / 2) { l += '.'; continue; }
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
      n[top] = (n[top] ?? 0) + 1;
      l += top;
    }
    out.push(l);
  }
  return `${JSON.stringify(n)}\n${out.join('\n')}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non prise en charge', { status: 405 });
  const input = (await req.json().catch(() => null) as { banc?: { id?: unknown; jeton?: unknown } } | null)?.banc;
  const refus = () => Response.json({ error: 'refusé' }, { status: 403 });
  const id = String(input?.id ?? '');
  const jeton = String(input?.jeton ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id) || jeton.length < 32) return refus();
  const { data } = await db.from('banc_ia').select('id, mode, params, jeton_sha256, status, created_at').eq('id', id).maybeSingle();
  if (!data || data.mode !== 'sonde' || !(data.params as { diag?: unknown })?.diag || data.status !== 'queued' || Date.now() - Date.parse(data.created_at) > 86_400_000 || (await sha256(jeton)) !== data.jeton_sha256) return refus();
  const { data: pris } = await db.from('banc_ia').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', id).eq('status', 'queued').select('id');
  if (!pris?.length) return refus();

  const p = data.params as { diag: { path: string; box?: number[] } };
  EdgeRuntime.waitUntil((async () => {
    try {
      if ((p.diag as { chrono?: boolean }).chrono) {
        const piece = await db.storage.from('garments').download((p.diag as { piece: string }).piece);
        const pb = new Uint8Array(await piece.data!.arrayBuffer());
        const essai = async (nom: string, prompt: string, sources: { bytes: Uint8Array; mime: string }[]) => {
          const t = Date.now();
          try {
            const img = await generate(prompt, sources, { size: '1K' });
            return { nom, ms: Date.now() - t, ok: true, ko: Math.round(img.bytes.length / 1024) };
          } catch (e) { return { nom, ms: Date.now() - t, ok: false, erreur: String(e instanceof Error ? (e as { detail?: string }).detail ?? e.message : e).slice(0, 200) }; }
        };
        const lignes = await Promise.all([
          essai('texte seul', 'A plain red cotton t-shirt laid flat, e-commerce packshot, white background.', []),
          essai('avec la pièce découpée', 'Photorealistic e-commerce catalogue packshot of this exact item, laid flat, seen from the front, soft even light, no shadow, on a flat solid white background.', [{ bytes: pb, mime: 'image/png' }]),
        ]);
        await db.from('banc_ia').update({ status: 'done', finished_at: new Date().toISOString(), result: { lignes }, cost_usd: 0 }).eq('id', id);
        return;
      }
      const dl = await db.storage.from('uploads').download(p.diag.path);
      if (dl.error || !dl.data) throw new Error('photo introuvable');
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const taille = tailleImage(bytes);
      const o = exifOrientation(bytes);
      if (taille && taille.width * taille.height > 3_000_000) {
        await db.from('banc_ia').update({ status: 'done', finished_at: new Date().toISOString(), result: { octets: bytes.length, en_tete: taille, exif_orientation: o, premiers_octets: Array.from(bytes.subarray(0, 24)).map((x) => x.toString(16).padStart(2, '0')).join(' '), note: 'photo trop grande, non décodée' }, cost_usd: 0 }).eq('id', id);
        return;
      }
      const brut = decode(bytes, 'image/jpeg');
      const debout = orient(brut, o);
      const cible = { name: 'Sweat', kind: 'sweat', colors: ['marine', 'bleu', 'ciel'], hex: ['#1A253C', '#3B5274', '#7DA4CD'], box: p.diag.box ?? null, prompt: '', where: '' };
      const ouvert = ouvrir({ bytes, mime: 'image/jpeg' });
      const dec = await decouper({ bytes, mime: 'image/jpeg' }, ouvert, cible as never, { strong: false, sansMasque: true });
      const rep = await survey({ sources: [{ bytes, mime: 'image/jpeg' }], hint: '', gender: null });
      const result = {
        reperage: { ms: 0, pieces: rep.pieces.map((q) => ({ name: q.name, kind: q.kind, rotation: q.rotation, box: q.box, where: q.where })), note: rep.note, modele: rep.modele },
        ascii_photo: ascii(ouvert, p.diag.box),
        classes_decoupe: dec.best ? classes(dec.best.cut) : null,
        decoupe: dec.best ? { w: dec.best.cut.width, h: dec.best.cut.height, controles: dec.best.checks } : null,
        octets: bytes.length,
        en_tete: taille,
        exif_orientation: o,
        premiers_octets: Array.from(bytes.subarray(0, 24)).map((x) => x.toString(16).padStart(2, '0')).join(' '),
        brut: { w: brut.width, h: brut.height },
        debout: { w: debout.width, h: debout.height },
      };
      await db.from('banc_ia').update({ status: 'done', finished_at: new Date().toISOString(), result, cost_usd: 0 }).eq('id', id);
    } catch (e) {
      await db.from('banc_ia').update({ status: 'failed', finished_at: new Date().toISOString(), error: String(e instanceof Error ? e.message : e).slice(0, 2000) }).eq('id', id);
    }
  })());
  return Response.json({ accepted: true }, { status: 202 });
});
