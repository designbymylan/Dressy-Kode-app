// Exécute la logique de Calendrier.dc.html hors navigateur, avec un DCLogic minimal,
// pour vérifier la grille, les dates et les parcours du formulaire.
import fs from 'node:fs';

const F = new URL('../design/_projet/Calendrier.dc.html', import.meta.url);
const src = fs.readFileSync(F, 'utf8');
const open = src.indexOf('>', src.indexOf('<script type="text/x-dc"')) + 1;
const js = src.slice(open, src.lastIndexOf('</script>'));

class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(update) {
    const patch = typeof update === 'function' ? update(this.state) : update;
    this.state = { ...this.state, ...patch };
  }
}
const Component = new Function('DCLogic', js + '\n;return Component;')(DCLogic);
const c = new Component({});

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : `\n        attendu ${JSON.stringify(want)}\n        obtenu  ${JSON.stringify(got)}`}`);
};

let v = c.renderVals();

console.log('=== grille de septembre 2026 ===');
check('libellé du mois', v.monthLabel, 'Septembre');
check('résumé du mois', v.monthSummary, '3 occasions · 1 voyage');
// 1er septembre 2026 = mardi -> une seule case vide avant le 1
const blanks = v.cells.filter(x => x.label === '').length;
check('cases vides avant le 1er', blanks, 1);
check('nombre total de cases', v.cells.length, 1 + 30);
// Le 17 doit tomber dans la colonne du jeudi (index 3 de la semaine lundi-first)
const i17 = v.cells.findIndex(x => x.label === '17');
check('colonne du 17 (0=lundi)', i17 % 7, 3);
check('jour sélectionné au départ', v.dayTitle, 'Jeudi 17 septembre');
check('badge aujourd’hui', v.isToday, true);
check('aria du 17', v.cells[i17].aria, '17 septembre, aujourd’hui, tenue posée, occasion, lessive'.replace('’', "'"));

console.log('\n=== pastilles et légende ===');
check('couleur voyage (contraste corrigé)', v.legend[3].color, '#9E9371');
const i28 = v.cells.findIndex(x => x.label === '28');
check('le 28 porte une pastille voyage', v.cells[i28].dots.map(d => d.color), ['#9E9371']);

console.log('\n=== navigation entre mois ===');
v.nextMonth(); v = c.renderVals();
check('octobre après suivant', v.monthLabel, 'Octobre');
check('octobre a 31 jours', v.cells.filter(x => x.label !== '').length, 31);
// 1er octobre 2026 = jeudi -> 3 cases vides
check('cases vides avant le 1er octobre', v.cells.filter(x => x.label === '').length, 3);
check('mois vide -> résumé neutre', v.monthSummary, 'Rien de prévu');
check('mois vide -> état vide', v.isEmpty, true);
v.prevMonth(); v = c.renderVals();
check('retour sur septembre', v.monthLabel, 'Septembre');
check('retour sur le 17', v.dayTitle, 'Jeudi 17 septembre');

console.log('\n=== « marquer comme portée » par jour ===');
check('au départ, non portée', v.wornOn, false);
v.markWorn(); v = c.renderVals();
check('après clic, portée', v.wornOn, true);
v.cells[v.cells.findIndex(x => x.label === '19')].pick(); v = c.renderVals();
check('le 19 n’est pas portée', v.wornOn, false);
v.cells[i17].pick(); v = c.renderVals();
check('retour au 17 : toujours portée', v.wornOn, true);

console.log('\n=== « À venir » ===');
check('jours de semaine calculés', v.upcoming.map(u => u.dow), ['sam', 'jeu', 'sam', 'lun']);
v.upcoming[2].go(); v = c.renderVals();
check('aller au 26', v.dayTitle, 'Samedi 26 septembre');

console.log('\n=== actions autrefois mortes ===');
check('planDay ouvre le formulaire', typeof v.planDay, 'function');
v.cells[v.cells.findIndex(x => x.label === '5')].pick(); v = c.renderVals();
check('le 5 est vide', v.isEmpty, true);
v.planDay(); v = c.renderVals();
check('formulaire ouvert sur le jour choisi', [v.isForm, c.state.f.day], [true, 5]);
check('la pastille du jour choisi existe', v.dayChips.some(d => d.n === '5' && d.bg === '#0D0D0E'), true);

console.log('\n=== enregistrement d’un événement ===');
v.closeSheet(); v = c.renderVals();
v.openForm(); v = c.renderVals();
v.dayChips.find(d => d.n === '22').pick(); v = c.renderVals();
v.setTitle({ target: { value: 'Dîner Théo' } }); v = c.renderVals();
v.submit(); v = c.renderVals();
check('écran de résultat', v.isResult, true);
check('numéro de proposition', v.variantIndex, 1);
v.nextVariant(); v = c.renderVals();
check('proposition suivante', v.variantIndex, 2);
v.nextVariant(); v = c.renderVals();
check('la troisième reboucle sur 1', v.variantIndex, 1);
v.saveEvent(); v = c.renderVals();
check('posé sur le 22', v.dayTitle, 'Mardi 22 septembre');
check('une entrée le 22', v.entries.map(e => e.title), ['Dîner Théo']);
check('le résumé du mois suit', v.monthSummary, '4 occasions · 1 voyage');
// Deuxième événement le même jour : il doit s'ajouter, pas écraser le premier
v.openForm(); v = c.renderVals();
v.setTitle({ target: { value: 'Verre avec Inès' } }); v = c.renderVals();
v.submit(); v = c.renderVals();
v.saveEvent(); v = c.renderVals();
check('deux entrées le 22', v.entries.map(e => e.title), ['Dîner Théo', 'Verre avec Inès']);
check('le résumé compte les deux', v.monthSummary, '5 occasions · 1 voyage');

console.log('\n=== liens des entrées ===');
v.upcoming[1].go(); v = c.renderVals();
check('un prêt mène à la fiche vêtement', v.entries[0].href, 'Fiche vetement.dc.html');

console.log(fails === 0 ? '\nTOUT PASSE' : `\n${fails} ÉCHEC(S)`);
process.exit(fails ? 1 : 0);
