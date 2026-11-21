#!/usr/bin/env node
/**
 * Le banc du pipeline d'ajout (spec, étape 3), en deux temps :
 *
 *   node tools/banc-pipeline.mjs preparer <dossier> [--detoureurs birefnet,bria] [--photos nom1,nom2]
 *       écrit <dossier>/jetons.json (jetons à usage unique, jamais commités) et
 *       <dossier>/lignes.sql, à exécuter par l'éditeur dans Supabase (table
 *       banc_ia, fermée au client) : une ligne par photo, avec l'empreinte du jeton.
 *   node tools/banc-pipeline.mjs lancer <dossier> [--par 4] [--pause 20]
 *       appelle process-garment pour chaque ligne, par lots de 4 espacés de 20 s.
 *
 * Les résultats se lisent ensuite dans banc_ia.result (et garment_runs, mode « banc »).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONCTION = 'https://pxjlbtevrexlckhxskdn.supabase.co/functions/v1/process-garment';
const [, , action, dossier, ...reste] = process.argv;
if (!action || !dossier) {
  console.error('usage : node tools/banc-pipeline.mjs preparer|lancer <dossier> [--detoureurs a,b]');
  process.exit(1);
}
const opt = (nom, defaut) => {
  const i = reste.indexOf(nom);
  return i >= 0 ? reste[i + 1] : defaut;
};

if (action === 'preparer') {
  const choix = opt('--photos', null)?.split(',');
  const photos = JSON.parse(readFileSync(join(racine, 'tools/banc-pipeline.json'), 'utf8')).photos.filter((p) => !choix || choix.includes(p.nom));
  const detoureurs = opt('--detoureurs', 'birefnet,bria').split(',');
  const etiqueteur = opt('--etiqueteur', null);
  mkdirSync(dossier, { recursive: true });
  // Un détoureur par essai, comme en production (une pièce par appel) : deux
  // traitements dans le même appel dépassaient le temps de calcul (banc du 20/11).
  const essais = photos.flatMap((p) => detoureurs.map((d) => ({ p, d })));
  const jetons = essais.map(({ p, d }) => ({ id: randomUUID(), jeton: randomBytes(32).toString('hex'), nom: `${p.nom}/${d}`, attendu: p.attendu }));
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const valeurs = jetons.map((j, i) => {
    const { p, d } = essais[i];
    const params = { photo: p.nom, url: p.url, detoureurs: [d], ...(etiqueteur ? { etiqueteur } : {}) };
    const sha = createHash('sha256').update(j.jeton).digest('hex');
    return `(${q(j.id)}, 'pipeline', ${q(`pipeline ${p.nom} ${d}`)}, ${q(JSON.stringify(params))}::jsonb, ${q(sha)})`;
  });
  writeFileSync(join(dossier, 'jetons.json'), JSON.stringify(jetons, null, 2));
  writeFileSync(join(dossier, 'lignes.sql'), `insert into public.banc_ia (id, mode, libelle, params, jeton_sha256) values\n${valeurs.join(',\n')};\n`);
  console.log(`${jetons.length} essais préparés dans ${dossier} (détoureurs : ${detoureurs.join(', ')})`);
} else if (action === 'lancer') {
  // Par lots espacés : des dizaines d'appels simultanés ne ressemblent pas à
  // l'usage réel et faisaient tomber les instances.
  const jetons = JSON.parse(readFileSync(join(dossier, 'jetons.json'), 'utf8'));
  const lot = Number(opt('--par', '4'));
  const pause = Number(opt('--pause', '20')) * 1000;
  for (let i = 0; i < jetons.length; i += lot) {
    const reponses = await Promise.all(jetons.slice(i, i + lot).map(async (j) => {
      const r = await fetch(FONCTION, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ banc: { id: j.id, jeton: j.jeton } }) });
      return `${j.nom} : ${r.status}`;
    }));
    console.log(reponses.join('\n'));
    if (i + lot < jetons.length) await new Promise((r) => setTimeout(r, pause));
  }
} else {
  console.error(`action inconnue : ${action}`);
  process.exit(1);
}
