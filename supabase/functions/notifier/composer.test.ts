/** node supabase/functions/notifier/composer.test.ts */
import { message, termine, type Tache } from './composer.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};
const t = (status: string, name: string | null = null, garment = status === 'done'): Tache => ({
  id: Math.random().toString(36).slice(2), status, garment_id: garment ? 'g' : null, target: name ? { name } : null, analysis: null,
});

check('rien en cours : terminé', termine([t('done'), t('failed')]), true);
check('une pièce encore en cours : pas terminé', termine([t('done'), t('generating')]), false);
check('aucune tâche : pas terminé', termine([]), false);

check('une pièce', message([t('done', 'Veste en jean')]), { title: 'Ta pièce est dans ton dressing', body: '« Veste en jean » est prête.' });
check('une pièce sans nom', message([t('done')]), { title: 'Ta pièce est dans ton dressing', body: 'Kodi a fini de la ranger.' });
check('quatre pièces', message([t('done', 'A'), t('done', 'B'), t('done', 'C'), t('done', 'D')]), { title: '4 pièces sont dans ton dressing', body: 'Kodi a fini de ranger ta photo.' });
check('trois pièces, une ratée', message([t('done', 'A'), t('done', 'B'), t('failed')]), { title: '2 pièces sont dans ton dressing', body: 'Kodi a fini de ranger ta photo. Une n’a pas pu être dessinée.' });
check('une pièce, deux ratées', message([t('done', 'A'), t('failed'), t('failed')]), { title: 'Ta pièce est dans ton dressing', body: '« A » est prête. 2 n’ont pas pu être dessinées.' });
check('tout a échoué', message([t('failed')]), { title: 'Kodi n’a pas pu finir ta pièce', body: 'Tu peux réessayer, ou la ranger à la main dans ton dressing.' });
check('plusieurs échecs', message([t('failed'), t('failed')])?.title, 'Kodi n’a pas pu finir tes pièces');
check('done sans pièce créée : rien à dire', message([t('done', 'A', false)]), null);

// Jamais de tiret cadratin, de nom de modèle ni de fournisseur dans ce qu'on envoie.
const tous = JSON.stringify([message([t('done', 'A')]), message([t('failed')]), message([t('done', 'A'), t('done', 'B'), t('failed')])]);
check('aucun tiret cadratin', tous.includes(String.fromCharCode(0x2014)), false);
check('aucun nom de modèle', /claude|gemini|opus|sonnet|nano banana|anthropic|google/i.test(tous), false);

if (fails) { console.log(`\n${fails} échec(s)`); process.exit(1); }
console.log('\ntout est bon');
