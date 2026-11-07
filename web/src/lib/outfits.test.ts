/**
 * Le moteur des tenues du jour (lib/outfits.ts) : il doit faire tourner tout
 * le dressing, suivre la météo et ressortir ce qui dort. Lancé par
 * `npm run test:tenues` (et `npm test`).
 */
import { suggestOutfits, evite, cleTenue, RIEN, type HomePiece } from './outfits.ts';

let echecs = 0;
const ok = (cond: boolean, nom: string, detail = '') => {
  console.log(`${cond ? 'ok   ' : 'ÉCHEC'} ${nom}${detail ? ` · ${detail}` : ''}`);
  if (!cond) echecs++;
};
const p = (id: string, category_id: string, o: Partial<HomePiece> = {}): HomePiece => ({
  id, name: id, category_id, kind: null, colour: null, url: null, wears: 1, lastWorn: 10, addedDaysAgo: 100, ...o,
});
const doux = { t: 19, kind: 'soleil' as const, label: 'ensoleillé' };

// 1. Le défaut corrigé le 07/11 : haut[i] avec bas[i] laissait la moitié du dressing de côté.
{
  const d = [p('h1', 'hauts'), p('h2', 'hauts'), p('b1', 'bas'), p('b2', 'bas'), p('r1', 'robes'), p('r2', 'robes'), p('c1', 'chaussures'), p('c2', 'chaussures')];
  const o = suggestOutfits(d, doux);
  const vus = new Set(o.flatMap((x) => x.pieces));
  ok(o.length === 3, 'trois tenues avec 2 hauts, 2 bas, 2 robes', `${o.length}`);
  ok(['h1', 'h2', 'b1', 'b2'].filter((id) => vus.has(id)).length >= 3 || ['r1', 'r2'].every((id) => vus.has(id)), 'les tenues puisent dans tout le dressing', [...vus].join(','));
  ok(new Set(o.map((x) => cleTenue(x.pieces))).size === o.length, 'trois tenues différentes');
}

// 2. Les pièces au repos passent devant celles portées hier.
{
  const d = [p('h-hier', 'hauts', { lastWorn: 1 }), p('h-repos', 'hauts', { lastWorn: 40 }), p('b1', 'bas', { lastWorn: 20 })];
  ok(suggestOutfits(d, doux)[0].pieces.includes('h-repos'), 'le haut au repos d’abord');
}

// 3. La météo : pas de gros pull par 26°, pas de robe d'été par 6°.
{
  const d = [p('pull', 'hauts', { season: 'hiver', lastWorn: 50 }), p('tshirt', 'hauts', { season: 'ete', lastWorn: 5 }), p('jean', 'bas')];
  ok(suggestOutfits(d, { t: 26, kind: 'soleil', label: 'chaud' })[0].pieces.includes('tshirt'), 'par 26°, le t-shirt plutôt que le pull d’hiver');
  ok(suggestOutfits(d, { t: 6, kind: 'nuages', label: 'froid' })[0].pieces.includes('pull'), 'par 6°, le pull plutôt que le t-shirt d’été');
}

// 4. Une veste quand il fait frais, ou quand il pleut à 19°.
{
  const d = [p('h1', 'hauts'), p('b1', 'bas'), p('trench', 'vestes', { season: 'mi_saison' })];
  ok(suggestOutfits(d, { t: 14, kind: 'nuages', label: 'couvert' })[0].pieces.includes('trench'), 'veste par 14°');
  ok(suggestOutfits(d, { t: 19, kind: 'pluie', label: 'pluie' })[0].pieces.includes('trench'), 'veste par 19° sous la pluie');
  ok(!suggestOutfits(d, doux)[0].pieces.includes('trench'), 'pas de veste par 19° au soleil');
}

// 5. Ce qui dort revient, et la raison le dit.
{
  const d = [p('h1', 'hauts', { lastWorn: 3 }), p('Robe verte', 'robes', { lastWorn: 95 }), p('b1', 'bas', { lastWorn: 3 })];
  const o = suggestOutfits(d, doux)[0];
  ok(o.pieces.includes('Robe verte'), 'la robe qui dort depuis 95 jours d’abord');
  ok(o.why === 'Robe verte en pièce centrale. Au repos depuis 95 jours.' && o.title === 'Ressortie du placard.', 'la raison dit depuis quand elle dormait', `${o.title} ${o.why}`);
  const j = suggestOutfits([p('Pull', 'hauts', { lastWorn: 3 }), p('Jean', 'bas', { lastWorn: 80 })], doux)[0];
  ok(j.why === 'Pull avec jean. Jean : au repos depuis 80 jours.', 'une autre pièce que la première est nommée', j.why);
}

// 6. « Pas pour moi » : la tenue écartée ne revient pas, une autre la remplace.
{
  const d = [p('h1', 'hauts'), p('h2', 'hauts'), p('b1', 'bas'), p('b2', 'bas')];
  const first = suggestOutfits(d, doux);
  const av = evite([{ garment_ids: first[0].pieces, reason: 'style', target_ids: [], created_at: new Date().toISOString() }]);
  const after = suggestOutfits(d, doux, av);
  ok(!after.some((o) => cleTenue(o.pieces) === cleTenue(first[0].pieces)), 'la tenue écartée disparaît');
  ok(after.length === 3, 'trois tenues restent (quatre combinaisons possibles)', `${after.length}`);
  const retrait = evite([{ garment_ids: first[0].pieces, reason: 'piece', target_ids: ['h1', 'h2'].filter((id) => first[0].pieces.includes(id)), created_at: new Date().toISOString() }]);
  const cible = ['h1', 'h2'].find((id) => first[0].pieces.includes(id))!;
  ok(!suggestOutfits(d, doux, retrait)[0].pieces.includes(cible), 'la pièce écartée passe en dernier');
}

// 7. Un dressing incomplet ne compose rien ; le premier jour a son titre.
{
  ok(suggestOutfits([p('h1', 'hauts')], doux, RIEN).length === 0, 'un haut seul : aucune tenue');
  const neuf = [p('h1', 'hauts', { wears: 0, lastWorn: null, addedDaysAgo: 0 }), p('b1', 'bas', { wears: 0, lastWorn: null, addedDaysAgo: 0 })];
  ok(suggestOutfits(neuf, doux)[0].title === 'Ta première tenue, déjà prête.', 'le tout premier jour', suggestOutfits(neuf, doux)[0].title);
}

// 8. Un grand dressing reste rapide.
{
  const d = [...Array(60)].flatMap((_, i) => [p(`h${i}`, 'hauts', { lastWorn: i }), p(`b${i}`, 'bas', { lastWorn: i })]);
  const t0 = performance.now();
  suggestOutfits(d, doux);
  ok(performance.now() - t0 < 50, '60 hauts et 60 bas en moins de 50 ms', `${Math.round(performance.now() - t0)} ms`);
}

console.log(echecs ? `\n${echecs} échec(s)` : '\nTOUT PASSE');
if (echecs) process.exit(1);
