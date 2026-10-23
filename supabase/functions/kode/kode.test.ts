/**
 * node supabase/functions/kode/kode.test.ts
 *
 * Ne teste que les modules sans dépendance (dressing, historique, consigne) :
 * ils tournent à l'identique sous Node et dans l'Edge Function.
 */
import { withRefs, wardrobeText, pickPieces, pickPlan, normaliseHistory, type Garment } from './wardrobe.ts';
import { conditionsDuJour, plafondDe, besoinDe, interdites, meteoTexte, chaleurDe, type Jour } from './meteo.ts';
import { profileText, agendaText, eventText, ecartsText, hourText, planDaysText, voyageText, aimeesText, faitsText, interditesText, ANSWER_SCHEMA, PLAN_SCHEMA, RULES, PLAN_RULES, type EventRow } from './prompt.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

const g = (id: string, category_id: string, name: string, extra: Partial<Garment> = {}): Garment => ({
  id, name, category_id, kind: null, season: null, colors: [], material: null, wear_count: 0, last_worn_on: null, ...extra,
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

const profile = profileText({
  gender: 'non_precise', styles: ['smart_casual', 'minimal'], colours: ['noir'], avoid: ['couleurs_vives'],
  occasions: [], favourite_items: [], goals: [], morning_time: null, time_intent: null, assistance: 'dressing',
});
check('profil lisible, genre non précisé, sans prénom', profile,
  'Styles choisis : smart casual, minimal.\nCouleurs aimées : noir.\nÀ éviter : couleurs vives.\nPar défaut : fais ressortir les pièces peu ou jamais portées.');
check('profil absent', profileText(null), 'Profil de style : pas encore renseigné.');
check('silhouette et taille, avec accord', profileText(null, { shape: 'sablier', height_cm: 168 }),
  'Pour les coupes et les longueurs : silhouette en X (taille marquée), taille 168 cm. Ne commente jamais le corps : sers-t’en seulement pour mettre en valeur.');
check('sans accord, rien du corps', profileText(null, null), 'Profil de style : pas encore renseigné.');

// ---------------------------------------------------------------- « Pas pour moi »

const refOf = new Map([['g-a', 'p1'], ['g-b', 'p2'], ['g-c', 'p3']]);
check('tenues écartées, références du dressing et raison', ecartsText([
  { garment_ids: ['g-a', 'g-b'], reason: 'couleurs', target_ids: [], created_at: '2026-10-08T07:12:00Z' },
  { garment_ids: ['g-a', 'g-c', 'g-x'], reason: 'piece', target_ids: ['g-c'], created_at: '2026-10-07T07:00:00Z' },
  { garment_ids: ['g-x', 'g-b'], reason: 'style', target_ids: null, created_at: '2026-10-06T07:00:00Z' },
], refOf),
  'Tenues écartées d’un « Pas pour moi » (ne les repropose pas telles quelles, et tiens compte de la raison) :\n- 2026-10-08 : p1 + p2 (les couleurs ne lui plaisaient pas ensemble)\n- 2026-10-07 : p1 + p3 (une pièce ne lui allait pas : p3)');
check('aucune tenue écartée', ecartsText([], refOf), '');
check('agenda trié par jour', agendaText([
  { day: '2026-09-30 (mardi)', text: 'Entretien' },
  { day: '2026-09-27 (dimanche)', text: 'Brunch' },
]), '- 2026-09-27 (dimanche) : Brunch\n- 2026-09-30 (mardi) : Entretien');
check('agenda vide', agendaText([]), 'Rien de noté dans son agenda Dresskode.');
check('schéma strict : tout est requis', [ANSWER_SCHEMA.required, ANSWER_SCHEMA.properties.tenue.required],
  [['reponse', 'tenue'], ['titre', 'pourquoi', 'pieces']]);

// ---------------------------------------------------------------- plusieurs jours (07/10)

const ev = (extra: Partial<EventRow>): EventRow => ({
  day: '2026-10-09', starts_at: null, title: 'Dîner', slot: null, kind: null, dress_code: null, stake: null,
  impressions: [], place: null, setting: null, flags: [], note: null, ...extra,
});

check('heure lisible', [hourText('19:30:00'), hourText('09:00:00'), hourText('08:15')], ['19 h 30', '9 h', '8 h 15']);
check('rendez-vous complet en une ligne', eventText(ev({
  starts_at: '19:30:00', title: 'Dîner chez Léa', kind: 'Repas de famille', dress_code: 'Casual chic', stake: 'Important',
  impressions: ['Chaleur', 'Élégance'], place: 'Chez Léa', setting: 'Intérieur', flags: ['Beaucoup marcher'], note: 'Sa grand-mère sera là',
})), 'à 19 h 30, « Dîner chez Léa » (Repas de famille ; tenue voulue : casual chic ; importance : important ; veut dégager : chaleur, élégance ; lieu : Chez Léa ; à l’intérieur ; contraintes : beaucoup marcher ; sa note : « Sa grand-mère sera là »)');
check('rendez-vous minimal, moment sans heure', eventText(ev({ slot: 'Soir', title: 'Ciné' })), 'soir, « Ciné »');

const daysText = planDaysText([
  { date: '2026-10-09', label: 'jeudi 9 octobre', meteo: '12° à 18°, averses', before: null,
    events: [ev({ starts_at: '19:00:00', title: 'Dîner' }), ev({ starts_at: '09:00:00', title: 'Entretien', kind: 'Entretien d’embauche' })] },
  { date: '2026-10-10', label: 'vendredi 10 octobre', meteo: null, events: [], before: 'Jean brut, Chemise blanche' },
]);
check('jours à prévoir : rendez-vous dans l’ordre de l’heure', daysText.split('\n')[0],
  '- 2026-10-09 (jeudi 9 octobre) : météo : 12° à 18°, averses ; rendez-vous : à 9 h, « Entretien » (Entretien d’embauche) ; puis à 19 h, « Dîner »');
check('jour sans météo ni rendez-vous, tenue à renouveler', daysText.split('\n')[1],
  '- 2026-10-10 (vendredi 10 octobre) : météo : pas encore connue, pense à la saison ; aucun rendez-vous ; tenue prévue jusqu’ici, à renouveler : Jean brut, Chemise blanche');
check('voyage', voyageText({ destination: 'Tokyo', pays: 'Japon', motif: 'Plaisir', activites: ['Visites', 'Restaurants'] }, 'lundi 12 octobre', 'dimanche 18 octobre'),
  'Voyage : Tokyo (Japon), du lundi 12 octobre au dimanche 18 octobre. Motif : plaisir. Activités prévues : visites, restaurants.');

const plan = pickPlan([
  { date: '2026-10-10', titre: 'Doux et net', pourquoi: 'Parce que.', pieces: ['p1', 'p2', 'p3'] },
  { date: '2026-10-09', titre: 'Entretien', pourquoi: 'Structure.', pieces: ['p4', 'p1', 'p2'] },
  { date: '2026-10-09', titre: 'Doublon', pourquoi: '', pieces: ['p1', 'p2'] },
  { date: '2026-12-25', titre: 'Pas demandé', pourquoi: '', pieces: ['p1', 'p2'] },
  { date: '2026-10-11', titre: 'Bancal', pourquoi: '', pieces: ['p99'] },
  null,
], refs, ['2026-10-09', '2026-10-10', '2026-10-11']);
check('planification : jours demandés seulement, une fois, dans l’ordre', plan.map((p) => p.date), ['2026-10-09', '2026-10-10', '2026-10-11']);
check('planification : la première proposition d’un jour l’emporte', plan[0].titre, 'Entretien');
check('planification : pièces vérifiées, jour bancal laissé vide', plan.map((p) => p.pieces.map((x) => x.garment.id).join('')), ['dab', 'abc', '']);
check('planification : réponse mal formée', pickPlan('rien', refs, ['2026-10-09']), []);
check('schéma de planification strict', [PLAN_SCHEMA.required, PLAN_SCHEMA.properties.jours.items.required],
  [['message', 'jours'], ['date', 'titre', 'pourquoi', 'pieces']]);
check('la culture de styliste est dans les règles', ['Couleurs', 'Coupes et proportions', 'Dress codes', 'Mariage (invité)', 'Entretien'].every((x) => RULES.includes(x)), true);
check('aucun tiret cadratin dans la consigne', /—/.test(RULES + PLAN_RULES), false);

// ---------------------------------------------------------------- météo (23/10)

const jour = (extra: Partial<Jour>): Jour => ({ min: 14, max: 20, ciel: 'soleil', pluie: null, uv: 2, vent: null, ...extra });
const piece = (id: string, kind: string, extra: { material?: string | null; season?: string | null } = {}) => ({
  id, kind, material: extra.material ?? null, season: extra.season ?? null,
});
const ecartees = (c: ReturnType<typeof conditionsDuJour>, pieces: ReturnType<typeof piece>[]) => [...interdites(pieces, c).keys()];

check('plafond : le plus chaud de la journée', [plafondDe(33), plafondDe(29), plafondDe(25), plafondDe(21), plafondDe(15)], [0, 1, 2, 3, 4]);
check('besoin : le plus froid de la journée', [besoinDe(3), besoinDe(8), besoinDe(12), besoinDe(17), besoinDe(22)], [4, 3, 2, 1, 0]);
check('chaleur : débardeur 0, pull 3, doudoune 4, pull en laine 4', [chaleurDe('debardeur', null), chaleurDe('pull', null), chaleurDe('doudoune', null), chaleurDe('pull', 'laine')], [0, 3, 4, 4]);
check('chaleur : le lin allège, la laine alourdit', [chaleurDe('pantalon', 'lin'), chaleurDe('pantalon', 'coton')], [1, 2]);
check('chaleur inconnue pour un bijou ou un sac', [chaleurDe('collier', null), chaleurDe(null, null)], [null, null]);

const chaud = conditionsDuJour(jour({ min: 18, max: 28, ciel: 'soleil', uv: 8 }));
check('28° : pas de manteau, pas de sweat, pas de doudoune',
  ecartees(chaud, [piece('m', 'manteau'), piece('s', 'sweat'), piece('d', 'doudoune'), piece('t', 'tshirt'), piece('v', 'veste')]),
  ['m', 's', 'd', 'v']);
check('28° : même une veste d’entre-saison est écartée', ecartees(chaud, [piece('v', 'veste')]), ['v']);
check('28° : un trench reste écarté (la fraîcheur du matin est faible)', ecartees(chaud, [piece('tr', 'trench')]), ['tr']);
check('28° : un débardeur et un short passent', ecartees(chaud, [piece('d', 'debardeur'), piece('sh', 'short')]), []);
check('soleil fort : conseil texte', meteoTexte(chaud, 'de demain').includes('soleil fort'), true);

const froid = conditionsDuJour(jour({ min: 3, max: 9 }));
check('3° à 9° : manteau et doudoune autorisés', ecartees(froid, [piece('m', 'manteau'), piece('d', 'doudoune')]), []);
check('3° à 9° : un t-shirt reste possible sous une couche', ecartees(froid, [piece('t', 'tshirt')]), []);
check('matin froid : conseil de couche', meteoTexte(froid, 'de demain').includes('couche chaude'), true);

const pluvieux = conditionsDuJour(jour({ min: 11, max: 16, ciel: 'averses', pluie: 6 }));
check('pluie : sandales et daim écartés, trench permis',
  ecartees(pluvieux, [piece('sa', 'sandales'), piece('da', 'bottines', { material: 'daim' }), piece('tr', 'trench'), piece('ba', 'baskets')]),
  ['sa', 'da']);
check('pluie : raison donnée à Kodi', interdites([piece('sa', 'sandales')], pluvieux).get('sa'), 'chaussures ouvertes sous la pluie');

const venteux = conditionsDuJour(jour({ min: 12, max: 20, vent: 45 }));
check('vent : jupe légère écartée, jupe en coton permise, chapeau écarté',
  ecartees(venteux, [piece('j1', 'jupe', { material: 'mousseline' }), piece('j2', 'jupe', { material: 'coton' }), piece('ch', 'chapeau')]),
  ['j1', 'ch']);
check('vent faible : rien à écarter', ecartees(conditionsDuJour(jour({ vent: 12 })), [piece('ch', 'chapeau')]), []);

const orage = conditionsDuJour(jour({ min: 15, max: 22, ciel: 'orage' }));
check('orage : sandales et escarpins écartés', ecartees(orage, [piece('sa', 'sandales'), piece('es', 'escarpins'), piece('ba', 'baskets')]), ['sa', 'es']);

const mi = conditionsDuJour(jour({ min: 10, max: 23 }));
check('saison : pièce d’hiver écartée par temps doux, pièce d’été par temps froid',
  ecartees(mi, [piece('h', 'pull', { season: 'hiver' }), piece('e', 'debardeur', { season: 'ete' }), piece('ex', 'tshirt', { season: 'toute_annee' })]),
  ['h']);
check('saison : pièce d’été écartée quand il fait froid le matin',
  ecartees(conditionsDuJour(jour({ min: 5, max: 14 })), [piece('e', 'debardeur', { season: 'ete' })]), ['e']);

check('bijoux et sacs ne sont jamais écartés par la météo', ecartees(chaud, [piece('b', 'collier'), piece('sac', 'cabas')]), []);

// La règle tient jusqu’au bout : une pièce interdite ne sort jamais d’une tenue.
const refsMeteo = withRefs([
  g('a', 'hauts', 'Débardeur blanc', { kind: 'debardeur' }),
  g('b', 'bas', 'Short', { kind: 'short' }),
  g('c', 'vestes', 'Manteau long', { kind: 'manteau' }),
]);
const interditesMeteo = interdites([...refsMeteo.values()].map((x) => piece(x.id, x.kind ?? '')), chaud);
check('pickPieces retire la pièce interdite, même proposée par le modèle',
  pickPieces(['p1', 'p2', 'p3'], refsMeteo, interditesMeteo).map((p) => p.garment.id), ['a', 'b']);
check('sans les pièces restantes : pas de tenue',
  pickPieces(['p3', 'p1'], refsMeteo, interditesMeteo), []);
check('planification : interdits par jour',
  pickPlan([{ date: '2026-10-09', titre: 'Doux', pourquoi: '', pieces: ['p3', 'p1', 'p2'] }], refsMeteo, ['2026-10-09'],
    new Map([['2026-10-09', interditesMeteo]])).map((p) => p.pieces.map((x) => x.garment.id)), [['a', 'b']]);

check('texte météo lisible', meteoTexte(pluvieux, 'd’aujourd’hui'),
  'Météo d’aujourd’hui : de 11° à 16°, pluie. Conseils : une veste qui protège, des chaussures fermées.');

// ---------------------------------------------------------------- tailles, Mes choix (23/10)

check('tailles habituelles, avec l’accord silhouette', profileText(null, { shape: null, height_cm: null, usual_sizes: { haut: 'S', bas: '38', pointure: '39' } }),
  'Tailles habituelles : haut S, bas 38, pointure 39. Ne propose jamais une pièce dont la taille ne correspond pas.');
check('pièces et tenues aimées', aimeesText(['p2', 'p5'], [{ titre: 'Doux et net', refs: ['p1', 'p3'] }, { titre: 'Seul', refs: ['p4'] }]),
  'Pièces qu’elle aime : p2, p5. Mets-les en avant quand elles vont avec la demande.\nTenue aimée « Doux et net » : p1 + p3. Reste dans son esprit sans la recopier.');
check('souvenirs retenus', faitsText([{ texte: 'Ne porte pas de couleurs vives.' }, { texte: 'Aime le denim.' }]),
  'Ce que Kodi retient de cette personne (il s’en sert sans le citer) :\n- Ne porte pas de couleurs vives.\n- Aime le denim.');
check('aucun souvenir : rien', faitsText([]), '');
check('pièces interdites, avec les références', interditesText(new Map([['a', 'trop chaud pour la journée, il fait 28° au plus chaud']]), new Map([['a', 'p1']])),
  'Pièces à ne pas proposer ce jour-là, à cause de la météo :\n- p1 : trop chaud pour la journée, il fait 28° au plus chaud');

console.log(fails ? `\n${fails} échec(s)` : '\ntout est bon');
if (fails) process.exit(1);
