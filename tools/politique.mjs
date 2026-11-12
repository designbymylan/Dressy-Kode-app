/**
 * La politique de confidentialité et les conditions générales (07/11), une
 * seule source : mobile/src/data/legal.ts. Ce script en tire les copies, pour
 * qu'elles ne s'écartent jamais :
 *
 *   docs/rgpd/politique-de-confidentialite.md   (à lire, à joindre)
 *   docs/rgpd/conditions-generales.md           (à lire, à faire relire)
 *   web/src/lib/politique.ts                    (les pages /confidentialite et /conditions, les avis de changement)
 *
 *   node tools/politique.mjs           écrit les deux copies
 *   node tools/politique.mjs --check   vérifie qu'elles sont à jour (code 1 sinon)
 *
 * Node 22 lit le TypeScript de legal.ts tel quel (types retirés à la volée).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// legal.ts est dans un paquet sans « type » : Node le relit en module, sans que ce soit une erreur.
process.removeAllListeners('warning');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Une URL file:// et non un chemin : sous Windows, import() refuse « C:\… ».
const { EDITEUR, POLITIQUE, POLITIQUE_VERSION, CONDITIONS, CONDITIONS_VERSION, HEBERGEURS, AVIS } = await import(pathToFileURL(path.join(root, 'mobile/src/data/legal.ts')).href);

const editeur = [EDITEUR.nom, EDITEUR.forme, EDITEUR.adresse, EDITEUR.siren && `SIREN ${EDITEUR.siren}`].filter(Boolean).join(' · ');
const contact = EDITEUR.contact ?? 'L’adresse de contact sera indiquée ici avant la sortie de l’app.';

const section = (s) => [
  `## ${s.titre}`,
  '',
  ...(s.texte ?? []).flatMap((p) => [p, '']),
  ...(s.liste ?? []).map((x) => `- **${x.titre}.** ${x.texte}`),
  ...(s.liste?.length ? [''] : []),
];

const mentions = [
  '## Mentions légales',
  '',
  editeur,
  '',
  ...(EDITEUR.directeur ? [`Directeur de la publication : ${EDITEUR.directeur}.`, ''] : []),
  ...HEBERGEURS.flatMap((h) => [h, '']),
  ...(EDITEUR.mediateur ? [`Médiateur de la consommation : ${EDITEUR.mediateur}.`, ''] : ['Le médiateur de la consommation sera indiqué ici avant la sortie de l’app.', '']),
  contact,
  '',
];

const cg = [
  '# Conditions générales de Dresskode',
  '',
  `_${CONDITIONS_VERSION}. Texte tiré de \`mobile/src/data/legal.ts\` par \`tools/politique.mjs\` : ne pas modifier ici. Rédigé pendant l'audit du 07/11 : à faire relire par un professionnel du droit avant la sortie._`,
  '',
  ...CONDITIONS.flatMap(section),
  ...mentions,
].join('\n');

const md = [
  '# Politique de confidentialité de Dresskode',
  '',
  `_${POLITIQUE_VERSION}. Texte tiré de \`mobile/src/data/legal.ts\` par \`tools/politique.mjs\` : ne pas modifier ici._`,
  '',
  ...POLITIQUE.flatMap((s) => [
    `## ${s.titre}`,
    '',
    ...(s.texte ?? []).flatMap((p) => [p, '']),
    ...(s.liste ?? []).map((x) => `- **${x.titre}.** ${x.texte}`),
    ...(s.liste?.length ? [''] : []),
  ]),
  '## Éditeur et contact',
  '',
  editeur,
  '',
  contact,
  '',
].join('\n');

const ts = [
  '/**',
  ' * La politique de confidentialité, copiée de mobile/src/data/legal.ts par',
  ' * tools/politique.mjs. Ne pas modifier ici : changer legal.ts, puis relancer',
  ' * `node tools/politique.mjs`.',
  ' */',
  '',
  'export type Section = { titre: string; texte?: string[]; liste?: { titre: string; texte: string }[] };',
  '',
  `export const POLITIQUE_VERSION = ${JSON.stringify(POLITIQUE_VERSION)};`,
  '',
  `export const EDITEUR: { nom: string; forme: string | null; adresse: string | null; siren: string | null; contact: string | null; directeur: string | null; mediateur: string | null } = ${JSON.stringify(EDITEUR, null, 2)};`,
  '',
  `export const POLITIQUE: Section[] = ${JSON.stringify(POLITIQUE, null, 2)};`,
  '',
  `export const CONDITIONS_VERSION = ${JSON.stringify(CONDITIONS_VERSION)};`,
  '',
  `export const HEBERGEURS: string[] = ${JSON.stringify(HEBERGEURS, null, 2)};`,
  '',
  `export const CONDITIONS: Section[] = ${JSON.stringify(CONDITIONS, null, 2)};`,
  '',
  '/** Les avis de changement, le plus récent en tête (lib/avis.ts dit lequel montrer). */',
  "export type Avis = { id: string; doc: 'politique' | 'conditions'; publie: string; effet: string; titre: string; texte: string };",
  '',
  `export const AVIS: Avis[] = ${JSON.stringify(AVIS, null, 2)};`,
  '',
].join('\n');

const copies = [
  ['docs/rgpd/politique-de-confidentialite.md', md],
  ['docs/rgpd/conditions-generales.md', cg],
  ['web/src/lib/politique.ts', ts],
];

if (process.argv.includes('--check')) {
  const stale = copies.filter(([file, text]) => !fs.existsSync(path.join(root, file)) || fs.readFileSync(path.join(root, file), 'utf8') !== text);
  for (const [file] of stale) console.error(`pas à jour : ${file} (lance node tools/politique.mjs)`);
  process.exit(stale.length ? 1 : 0);
}
for (const [file, text] of copies) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
  console.log('écrit :', file);
}
