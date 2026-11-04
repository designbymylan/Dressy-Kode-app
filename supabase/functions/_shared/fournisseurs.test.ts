/**
 * node supabase/functions/_shared/fournisseurs.test.ts
 *
 * Les adresses d'un intermédiaire collées de toutes les façons possibles sont
 * ramenées à la base attendue par les SDK ; tout ce qui n'est pas https est
 * refusé. Sans réseau ni module à dépendance.
 */
import { normaliserBase } from './fournisseurs.ts';

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`}`);
};

const B = 'https://api.exemple.com';
check('base nue', normaliserBase(B), B);
check('barre finale', normaliserBase(`${B}/`), B);
check('/v1 (le SDK l\'ajoute)', normaliserBase(`${B}/v1`), B);
check('/v1/', normaliserBase(`${B}/v1/`), B);
check('/v1/messages', normaliserBase(`${B}/v1/messages`), B);
check('/v1beta', normaliserBase(`${B}/v1beta`), B);
check('/v1beta/models/x:generateContent', normaliserBase(`${B}/v1beta/models/x:generateContent`), B);
check('guillemets et espaces du copier-coller', normaliserBase(`  "${B}/v1" \n`), B);
check('chemin propre conservé', normaliserBase('https://hote.com/proxy/v1'), 'https://hote.com/proxy');
check('/v10 n\'est pas /v1', normaliserBase('https://hote.com/v10'), 'https://hote.com/v10');
check('http refusé', normaliserBase('http://api.exemple.com'), undefined);
check('texte sans adresse', normaliserBase('abc'), undefined);
check('vide', normaliserBase('   '), undefined);
check('absent', normaliserBase(undefined), undefined);

if (fails) {
  console.error(`\n${fails} échec(s)`);
  process.exit(1);
}
console.log('\ntout est bon');
