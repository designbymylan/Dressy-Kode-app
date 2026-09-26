/**
 * node supabase/functions/kode/kode.test.ts
 *
 * Ne teste que les modules sans dépendance (dressing, historique, consigne) :
 * ils tournent à l'identique sous Node et dans l'Edge Function.
 */
import { withRefs, wardrobeText, pickPieces, normaliseHistory, type Garment } from './wardrobe.ts';
import { profileText, agendaText, ANSWER_SCHEMA } from './prompt.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` — attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

const g = (id: string, category_id: string, name: string, extra: Partial<Garment> = {}): Garment => ({
  id, name, category_id, colors: [], material: null, wear_count: 0, last_worn_on: null, ...extra,
});

const wardrobe = [
  g('a', 'hauts', 'Chemise blanche', { colors: ['blanc'], material: 'coton', wear_count: 3, last_worn_on: '2026-09-20' }),
  g('b', 'bas', 'Jean brut', { colors: ['marine'] }),
  g('c', 'chaussures', 'Derbies noires'),
  g('d', 'vestes', 'Blazer noir'),
  g('e', 'accessoires', 'Ceinture cuir'),
  g('f', 'sacs', 'Cabas camel'),
  g('h', 'robes', 'Robe noire'),
];
const refs = withRefs(wardrobe);

// ---------------------------------------------------------------- références

check('références courtes dans l’ordre', [...refs.keys()], ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);

// ---------------------------------------------------------------- tenue

const ids = (list: ReturnType<typeof pickPieces>) => list.map((p) => `${p.garment.id}:${p.slot}`);

check('tenue valide, emplacements déduits de la catégorie',
  ids(pickPieces(['p1', 'p2', 'p3'], refs)), ['a:haut', 'b:bas', 'c:chaussures']);
check('référence inventée écartée',
  ids(pickPieces(['p1', 'p99', 'p2'], refs)), ['a:haut', 'b:bas']);
check('doublon retiré, casse et espaces tolérés',
  ids(pickPieces(['P1', ' p1 ', 'p2'], refs)), ['a:haut', 'b:bas']);
check('une seule pièce : pas de tenue', pickPieces(['p1'], refs), []);
check('que des références inventées : pas de tenue', pickPieces(['x', 'p0', 'p42'], refs), []);
check('réponse mal formée : pas de tenue', pickPieces('p1,p2', refs), []);
check('six pièces au plus',
  pickPieces(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'], refs).length, 6);
check('un UUID recopié n’est pas une référence', pickPieces(['a', 'b'], refs), []);

// ---------------------------------------------------------------- dressing

const labels = new Map([['hauts', 'Hauts'], ['bas', 'Bas'], ['robes', 'Robes'], ['vestes', 'Vestes et manteaux'],
  ['chaussures', 'Chaussures'], ['sacs', 'Sacs'], ['accessoires', 'Accessoires']]);
const text = wardrobeText(refs, labels, '2026-09-26');

check('regroupé dans l’ordre des portants',
  text.split('\n').filter((l) => l.endsWith(':')),
  ['Hauts :', 'Bas :', 'Robes :', 'Vestes et manteaux :', 'Chaussures :', 'Sacs :', 'Accessoires :']);
check('ligne complète avec l’historique de port',
  text.split('\n')[1], '- p1 · Chemise blanche · blanc · coton · portée 3 fois, la dernière il y a 6 jours');
check('pièce jamais portée', text.includes('- p2 · Jean brut · marine · jamais portée ici'), true);
check('aucun UUID ne part vers le modèle', /\b[a-h]\b ·/.test(text), false);

// ---------------------------------------------------------------- historique

check('commence par la personne, bulles consécutives fusionnées', normaliseHistory([
  { role: 'assistant', content: 'Salut !' },
  { role: 'user', content: 'Demain ?' },
  { role: 'user', content: 'Plutôt habillé.' },
  { role: 'assistant', content: 'Voilà.' },
  { role: 'user', content: '  ' },
  { role: 'user', content: 'Et vendredi ?' },
]), [
  { role: 'user', content: 'Demain ?\n\nPlutôt habillé.' },
  { role: 'assistant', content: 'Voilà.' },
  { role: 'user', content: 'Et vendredi ?' },
]);

// ---------------------------------------------------------------- consigne

const profile = profileText('Sam', {
  gender: 'non_precise', styles: ['smart_casual', 'minimal'], colours: ['noir'], avoid: ['couleurs_vives'],
  occasions: [], favourite_items: [], goals: [], morning_time: null, time_intent: null, assistance: 'dressing',
});
check('profil lisible, genre non précisé', profile,
  'Prénom : Sam.\nStyles choisis : smart casual, minimal.\nCouleurs aimées : noir.\nÀ éviter : couleurs vives.\nPar défaut : fais ressortir les pièces peu ou jamais portées.');
check('profil absent', profileText(null, null), 'Prénom : non donné.');
check('agenda trié par jour', agendaText([
  { day: '2026-09-30 (mardi)', text: 'Entretien' },
  { day: '2026-09-27 (dimanche)', text: 'Brunch' },
]), '- 2026-09-27 (dimanche) : Brunch\n- 2026-09-30 (mardi) : Entretien');
check('agenda vide', agendaText([]), 'Rien de noté dans son agenda Dressy.');
check('schéma strict : tout est requis', [ANSWER_SCHEMA.required, ANSWER_SCHEMA.properties.tenue.required],
  [['reponse', 'tenue'], ['titre', 'pourquoi', 'pieces']]);

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) process.exit(1);
