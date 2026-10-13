#!/usr/bin/env node
/**
 * Parcours de contrôle d'une app web (le site Next.js ou l'aperçu web de
 * l'app mobile), utilisé par le skill /dressy-qa.
 *
 * Pour chaque route, en clair puis en sombre, au format iPhone (390 × 844) :
 * statut et redirection, erreurs de console et de page, requêtes en échec,
 * débordement horizontal, images sans texte de remplacement, boutons et liens
 * sans nom, cibles tactiles sous 44 px, texte sous 11 px, et une capture
 * pleine page. Écrit `rapport.json` et `rapport.md` dans le dossier de sortie.
 *
 *   node tools/qa-web.mjs --base http://localhost:3000 \
 *     --routes /bienvenue,/connexion,/accueil --out /tmp/qa
 *
 * Connexion facultative : QA_EMAIL et QA_PASSWORD dans l'environnement, le
 * script remplit /connexion avant de parcourir les routes privées.
 *
 * Aucune dépendance du projet : Playwright est pris du projet s'il y est,
 * sinon de l'installation globale (Chromium préinstallé dans le cloud).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const base = (args.base ?? 'http://localhost:3000').replace(/\/$/, '');
const routes = (args.routes ?? '/').split(',').map((r) => r.trim()).filter(Boolean);
const out = args.out ?? 'qa-sortie';
const schemes = (args.schemes ?? 'light,dark').split(',');
fs.mkdirSync(out, { recursive: true });

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href);
  }
}

const { chromium } = await loadPlaywright();
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

/** Mesures faites dans la page : tout ce qui se voit sans lire le code. */
function audit() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const label = (el) =>
    (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim() ||
    (el.querySelector('img[alt]')?.getAttribute('alt') ?? '').trim();
  const desc = (el) => {
    const t = (el.textContent || '').trim().slice(0, 30);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${t ? ` « ${t} »` : ''}`;
  };
  const clickables = [...document.querySelectorAll('button, [role="button"], a[href], input:not([type="hidden"]), select, textarea')].filter(vis);
  const small = clickables.filter((el) => {
    // Un lien dans une phrase n'a pas à faire 44 px : on ne compte que les commandes isolées.
    if (el.tagName === 'A' && el.closest('p')) return false;
    // Une case dont le libellé se touche aussi a la cible de son libellé.
    const lab = el.labels?.[0]?.getBoundingClientRect();
    if (lab && lab.width >= 44 && lab.height >= 44) return false;
    const r = el.getBoundingClientRect();
    return r.width < 44 || r.height < 44;
  });
  const tiny = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue;
    const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
    if (fs < 11) tiny.push(`${fs}px « ${n.textContent.trim().slice(0, 30)} »`);
  }
  return {
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth : 0,
    imgNoAlt: [...document.querySelectorAll('img:not([alt])')].filter(vis).map((i) => i.src.slice(0, 80)),
    unnamed: clickables.filter((el) => !label(el) && !(el.labels && el.labels.length)).map(desc),
    smallTargets: small.map((el) => {
      const r = el.getBoundingClientRect();
      return `${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)}`;
    }),
    tinyText: [...new Set(tiny)],
    title: document.title,
  };
}

const results = [];
for (const scheme of schemes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: 'reduce', locale: 'fr-FR' });
  const page = await ctx.newPage();
  let bucket = null;
  page.on('console', (m) => m.type() === 'error' && bucket?.console.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => bucket?.pageErrors.push(String(e).slice(0, 300)));
  // Les préchargements de Next (`?_rsc=`) abandonnés au changement de page ne sont pas des erreurs.
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    if (err.includes('ERR_ABORTED') && r.url().includes('_rsc=')) return;
    bucket?.failed.push(`${err} ${r.url().slice(0, 120)}`);
  });
  page.on('response', (r) => r.status() >= 400 && bucket?.failed.push(`${r.status()} ${r.url().slice(0, 120)}`));

  if (process.env.QA_EMAIL && process.env.QA_PASSWORD) {
    await page.goto(base + '/connexion', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', process.env.QA_EMAIL);
    await page.fill('input[type="password"]', process.env.QA_PASSWORD);
    await Promise.all([page.waitForLoadState('networkidle'), page.keyboard.press('Enter')]);
  }

  for (const route of routes) {
    bucket = { route, scheme, console: [], pageErrors: [], failed: [] };
    const t0 = Date.now();
    let status = 0;
    try {
      const res = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30000 });
      status = res?.status() ?? 0;
      await page.waitForTimeout(800);
    } catch (e) {
      bucket.pageErrors.push('Navigation : ' + String(e).slice(0, 200));
    }
    const shot = path.join(out, `${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'racine'}-${scheme}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    const a = await page.evaluate(audit).catch((e) => ({ error: String(e) }));
    const finalPath = new URL(page.url()).pathname;
    results.push({ ...bucket, status, redirectedTo: finalPath !== route ? finalPath : null, ms: Date.now() - t0, screenshot: shot, ...a });
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(out, 'rapport.json'), JSON.stringify(results, null, 2));

const lines = ['# Parcours web', '', `Base : ${base} · ${new Date().toISOString()}`, ''];
let total = 0;
for (const r of results) {
  const issues = [
    r.status >= 400 && `Statut ${r.status}`,
    r.redirectedTo && `Redirigé vers ${r.redirectedTo}`,
    ...r.pageErrors.map((e) => `Erreur de page : ${e}`),
    ...r.console.map((e) => `Console : ${e}`),
    ...r.failed.map((e) => `Requête en échec : ${e}`),
    r.overflowX && `Débordement horizontal : ${r.overflowX} px pour 390`,
    ...(r.imgNoAlt ?? []).map((s) => `Image sans alt : ${s}`),
    ...(r.unnamed ?? []).map((s) => `Commande sans nom : ${s}`),
    ...(r.smallTargets ?? []).map((s) => `Cible sous 44 px : ${s}`),
    ...(r.tinyText ?? []).map((s) => `Texte sous 11 px : ${s}`),
  ].filter(Boolean);
  total += issues.length;
  lines.push(`## ${r.route} (${r.scheme}) — ${issues.length ? issues.length + ' point(s)' : 'rien à signaler'}`, '');
  lines.push(...issues.map((i) => `- ${i}`), `- Capture : ${r.screenshot}`, '');
}
lines.splice(3, 0, `${results.length} pages vues, ${total} point(s) relevé(s).`, '');
fs.writeFileSync(path.join(out, 'rapport.md'), lines.join('\n'));
console.log(`${results.length} pages, ${total} point(s). Rapport : ${path.join(out, 'rapport.md')}`);
