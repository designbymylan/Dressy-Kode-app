/**
 * node supabase/functions/_shared/fournisseurs.test.ts
 *
 * Les adresses d'un intermédiaire collées de toutes les façons possibles sont
 * ramenées à la base attendue par les SDK ; tout ce qui n'est pas https est
 * refusé. Sans réseau ni module à dépendance.
 */
import { accesGoogle, geminiUrl, normaliserBase } from './fournisseurs.ts';

// Les secrets d'une fonction, simulés : chaque cas repart d'un jeu vide.
let secrets: Record<string, string> = {};
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => secrets[k] } };

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

// Découpe et vecteurs : chez Google si GOOGLE_API_KEY existe, sinon comme le dessin.
const GOOGLE = 'https://generativelanguage.googleapis.com';
secrets = { GEMINI_API_KEY: 'sk-dessin' };
check('sans réglage : clé et adresse du dessin, chez Google', accesGoogle(), { nomCle: 'GEMINI_API_KEY', cle: 'sk-dessin', base: GOOGLE });
secrets = { GEMINI_API_KEY: 'sk-dessin', GEMINI_BASE_URL: `${B}/v1` };
check('dessin par un intermédiaire, pas de clé Google : la découpe suit le dessin', accesGoogle(), { nomCle: 'GEMINI_API_KEY', cle: 'sk-dessin', base: B });
secrets = { GEMINI_API_KEY: 'sk-dessin', GEMINI_BASE_URL: B, GOOGLE_API_KEY: ' "AIza-directe" ' };
check('clé Google : la découpe va chez Google, jamais chez l\'intermédiaire', accesGoogle(), { nomCle: 'GOOGLE_API_KEY', cle: 'AIza-directe', base: GOOGLE });
secrets = { GEMINI_BASE_URL: 'http://pas-https.com' };
check('adresse refusée : retour chez Google, sans clé', accesGoogle(), { nomCle: 'GEMINI_API_KEY', cle: undefined, base: GOOGLE });
secrets = { GEMINI_BASE_URL: B };
check('adresse du dessin par un intermédiaire', geminiUrl('m'), `${B}/v1beta/models/m:generateContent`);
check('adresse d\'une découpe chez Google', geminiUrl('m', 'generateContent', GOOGLE), `${GOOGLE}/v1beta/models/m:generateContent`);
secrets = {};
check('par défaut, Google', geminiUrl('m', 'batchEmbedContents'), `${GOOGLE}/v1beta/models/m:batchEmbedContents`);

if (fails) {
  console.error(`\n${fails} échec(s)`);
  process.exit(1);
}
console.log('\ntout est bon');
