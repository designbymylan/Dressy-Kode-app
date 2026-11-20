/**
 * La taxonomie fermée : validation des réponses du modèle (y compris des
 * réponses invalides, critère de la spec), noms accordés, saisons, et
 * concordance avec les anciennes listes du site, de l'app et de l'agent.
 *
 *   node supabase/functions/_shared/taxonomy.test.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATEGORIES, COULEURS, IDS, nomDeLaPiece, saisonResumee, saisonsDe, schemaEtiquetage, sqlTaxonomie, validerEtiquettes,
} from './taxonomy.ts';
import { KINDS, COLOUR_IDS, MOTIFS as MOTIFS_AGENT, COUPES as COUPES_AGENT, CATEGORIES as CATS_AGENT } from '../dressy-agent/prompts.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '../../..');
let echecs = 0;
function check(nom: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (!ok) echecs++;
  console.log(`${ok ? 'ok ' : 'ÉCHEC'} ${nom}${ok ? '' : `\n     obtenu  ${JSON.stringify(obtenu)}\n     attendu ${JSON.stringify(attendu)}`}`);
}

const bon = {
  piece_unique: true, categorie: 'vestes', type: 'veste', couleur: 'marine', couleur_2: null, matiere: 'denim',
  motif: 'uni', coupe: 'droite', saisons: ['automne', 'printemps'], habillage: 2, confiance: 0.86,
};

// ---- réponses valides
const v = validerEtiquettes(bon);
check('réponse valide acceptée', v.ok, true);
check('saisons rangées dans l’ordre de la taxonomie', v.ok && v.etiquettes.saisons, ['printemps', 'automne']);
check('seconde couleur égale à la première effacée', (() => { const r = validerEtiquettes({ ...bon, couleur_2: 'marine' }); return r.ok && r.etiquettes.couleur_2; })(), null);

// ---- réponses invalides : toutes rejetées (critère « toute valeur écrite est dans la taxonomie »)
const invalides: [string, Record<string, unknown>][] = [
  ['catégorie inventée', { ...bon, categorie: 'outerwear' }],
  ['type inventé', { ...bon, type: 'bomber' }],
  ['type d’une autre catégorie', { ...bon, type: 'jean' }],
  ['couleur inventée', { ...bon, couleur: 'navy' }],
  ['seconde couleur inventée', { ...bon, couleur_2: 'multicolor' }],
  ['matière en texte libre', { ...bon, matiere: 'denim brut' }],
  ['motif inventé', { ...bon, motif: 'camouflage' }],
  ['coupe inventée', { ...bon, coupe: 'slim' }],
  ['saisons vides', { ...bon, saisons: [] }],
  ['saison inventée', { ...bon, saisons: ['mi_saison'] }],
  ['saison en double', { ...bon, saisons: ['ete', 'ete'] }],
  ['habillage hors de 1 à 5', { ...bon, habillage: 7 }],
  ['habillage en texte', { ...bon, habillage: 'casual' }],
  ['confiance au-dessus de 1', { ...bon, confiance: 1.4 }],
  ['confiance absente', (() => { const { confiance: _, ...r } = bon; return r; })()],
  ['champ en trop (marque)', { ...bon, marque: 'X' }],
  ['piece_unique en texte', { ...bon, piece_unique: 'oui' }],
];
for (const [nom, rep] of invalides) check(`rejetée : ${nom}`, validerEtiquettes(rep).ok, false);
check('rejetée : pas un objet', validerEtiquettes('{"categorie":"hauts"}').ok, false);
check('rejetée : null', validerEtiquettes(null).ok, false);

// ---- schéma : chaque champ fermé est un enum de la taxonomie
const s = schemaEtiquetage();
check('schéma : types', s.properties.type.enum, IDS.types);
check('schéma : couleurs', s.properties.couleur.enum, IDS.couleurs);
check('schéma : tous les champs requis', [...s.required].sort(), Object.keys(s.properties).sort());

// ---- noms accordés
check('nom : féminin singulier', nomDeLaPiece('jupe', 'noir'), 'Jupe noire');
check('nom : féminin pluriel', nomDeLaPiece('baskets', 'blanc'), 'Baskets blanches');
check('nom : masculin pluriel', nomDeLaPiece('gants', 'gris'), 'Gants gris');
check('nom : couleur invariable', nomDeLaPiece('veste', 'marine'), 'Veste bleu marine');
check('nom : nom propre au type', nomDeLaPiece('bandouliere', 'camel'), 'Sac bandoulière camel');
check('nom : sans couleur', nomDeLaPiece('pull', null), 'Pull');
check('nom : type inconnu', nomDeLaPiece('bomber', 'noir'), 'Pièce');

// ---- saisons
check('saison résumée', [['hiver'], ['ete', 'printemps'], ['printemps', 'automne'], ['hiver', 'ete'], IDS.saisons, []].map(saisonResumee),
  ['hiver', 'ete', 'mi_saison', 'toute_annee', 'toute_annee', 'toute_annee']);
check('aller-retour des anciennes saisons', ['toute_annee', 'mi_saison', 'hiver', 'ete'].map((x) => saisonResumee(saisonsDe(x))), ['toute_annee', 'mi_saison', 'hiver', 'ete']);

// ---- SQL
const sql = sqlTaxonomie();
check('SQL : chaque paire catégorie, type', CATEGORIES.every((c) => c.types.every((k) => sql.includes(`('${c.id}', '${k.id}')`))), true);
check('SQL : bornes de la taxonomie', sql.startsWith('-- taxonomie:debut') && sql.endsWith('-- taxonomie:fin'), true);

// ---- les anciennes listes ne dérivent pas (en attendant qu'elles lisent toutes taxonomy.ts)
check('agent : catégories', [...CATS_AGENT], IDS.categories);
check('agent : types', Object.fromEntries(Object.entries(KINDS).map(([c, ks]) => [c, [...ks]])), Object.fromEntries(CATEGORIES.map((c) => [c.id, c.types.map((k) => k.id)])));
check('agent : couleurs', [...COLOUR_IDS], IDS.couleurs);
check('agent : motifs', [...MOTIFS_AGENT], IDS.motifs);
check('agent : coupes', [...COUPES_AGENT], IDS.coupes);

const ids = (fichier: string, motif: RegExp) => [...readFileSync(join(racine, fichier), 'utf8').matchAll(motif)].map((m) => m[1]);
const blocCouleurs = (fichier: string) => {
  const txt = readFileSync(join(racine, fichier), 'utf8');
  const debut = txt.indexOf('export const COLOURS');
  return [...txt.slice(debut, txt.indexOf('];', debut)).matchAll(/id: '([a-z_]+)'/g)].map((m) => m[1]);
};
check('site : types du dressing', ids('web/src/lib/wardrobe.ts', /\{ id: '([a-z]+)', label:/g).filter((x) => !IDS.categories.includes(x)), IDS.types);
check('site : couleurs du profil', blocCouleurs('web/src/lib/onboarding.ts'), IDS.couleurs);
check('app : couleurs', blocCouleurs('mobile/src/data/wardrobe.ts'), IDS.couleurs);
check('couleurs : teintes du site', COULEURS.map((c) => c.hex), (() => {
  const txt = readFileSync(join(racine, 'web/src/lib/onboarding.ts'), 'utf8');
  const debut = txt.indexOf('export const COLOURS');
  return [...txt.slice(debut, txt.indexOf('];', debut)).matchAll(/hex: '(#[0-9A-F]{6})'/g)].map((m) => m[1]);
})());

if (echecs) {
  console.error(`\n${echecs} échec(s)`);
  process.exit(1);
}
console.log('\nTaxonomie : tout passe.');
