#!/usr/bin/env node
/**
 * La taxonomie fermée, recopiée là où elle sert (spec du 20/11).
 *
 *   node tools/taxonomie.mjs            recopie taxonomy.ts dans l'app et le site
 *   node tools/taxonomie.mjs --sql      affiche les contraintes SQL, à coller dans une NOUVELLE migration
 *   node tools/taxonomie.mjs --verifier sort en erreur si une copie ou la dernière migration a dérivé
 *
 * La source est supabase/functions/_shared/taxonomy.ts : on ne modifie jamais
 * les copies à la main. Node 22.18 ou plus (lecture directe du TypeScript).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(racine, 'supabase/functions/_shared/taxonomy.ts');
const COPIES = [join(racine, 'mobile/src/data/taxonomy.ts'), join(racine, 'web/src/lib/taxonomy.ts')];
const ENTETE = '// Copie générée par `node tools/taxonomie.mjs` depuis supabase/functions/_shared/taxonomy.ts : ne pas modifier.\n';

const source = readFileSync(SOURCE, 'utf8');
const copie = ENTETE + source;
const { sqlTaxonomie } = await import(SOURCE);
const args = new Set(process.argv.slice(2));

/** Le dernier bloc de taxonomie recopié dans une migration, ou null. */
function derniereCopieSql() {
  const dossier = join(racine, 'supabase/migrations');
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort().reverse();
  for (const f of fichiers) {
    const sql = readFileSync(join(dossier, f), 'utf8');
    const m = /-- taxonomie:debut[\s\S]*?-- taxonomie:fin/.exec(sql);
    if (m) return { fichier: f, bloc: m[0] };
  }
  return null;
}

if (args.has('--sql')) {
  process.stdout.write(`${sqlTaxonomie()}\n`);
} else if (args.has('--verifier')) {
  const ecarts = [];
  for (const c of COPIES) {
    let lu = '';
    try { lu = readFileSync(c, 'utf8'); } catch { /* absente */ }
    if (lu !== copie) ecarts.push(`${c.replace(`${racine}/`, '')} n'est pas à jour`);
  }
  const sql = derniereCopieSql();
  if (!sql) ecarts.push('aucune migration ne porte les contraintes de la taxonomie');
  else if (sql.bloc !== sqlTaxonomie()) ecarts.push(`les contraintes de ${sql.fichier} ne suivent plus taxonomy.ts : node tools/taxonomie.mjs --sql dans une nouvelle migration`);
  if (ecarts.length) {
    console.error(`Taxonomie : ${ecarts.join(' ; ')}. Lancer node tools/taxonomie.mjs.`);
    process.exit(1);
  }
  console.log('Taxonomie : copies et contraintes SQL à jour.');
} else {
  for (const c of COPIES) writeFileSync(c, copie);
  console.log(`Taxonomie recopiée : ${COPIES.map((c) => c.replace(`${racine}/`, '')).join(', ')}`);
}
