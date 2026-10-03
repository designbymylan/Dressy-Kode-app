// Publie l'app dans Expo Go par EAS Update : `npm run apercu`.
//
// Sans ordinateur ni compte Apple payant : la mise à jour s'ouvre dans Expo Go
// (runtimeVersion « sdkVersion » dans app.json, donc exposdk:57.0.0), sur un
// iPhone connecté au même compte Expo que le projet. Le lien affiché à la fin
// ne change pas : il ouvre toujours la dernière version du canal « apercu ».
//
// Il faut EXPO_TOKEN dans l'environnement (jeton d'accès du compte Expo, jamais
// dans un fichier commité). Au premier passage, le script crée le projet EAS et
// écrit son identifiant dans app.json : ce changement-là est à commiter.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EAS = ['--yes', 'eas-cli@24'];
const CHANNEL = 'apercu';
const args = process.argv.slice(2);
const platform = args.includes('--android') ? 'all' : 'ios';
const message = args.filter((a) => !a.startsWith('--')).join(' ').trim();

const fail = (text) => { console.error(`\n${text}\n`); process.exit(1); };
const run = (argv, opts = {}) => execFileSync('npx', [...EAS, ...argv], { cwd: ROOT, stdio: opts.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8', env: { ...process.env, EAS_NO_VCS: '1' } });
const readApp = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

if (!process.env.EXPO_TOKEN) {
  fail('EXPO_TOKEN manque. Crée un jeton sur expo.dev (Account settings > Access tokens) et ajoute-le comme variable d’environnement EXPO_TOKEN. Ne le colle jamais dans un fichier commité.');
}

// L'adresse du projet et la clé publishable : sans elles, l'app partirait en démonstration.
const env = path.join(ROOT, '.env');
if (!fs.existsSync(env)) {
  fs.copyFileSync(path.join(ROOT, '.env.example'), env);
  console.log('.env créé depuis .env.example (adresse du projet et clé publishable).');
}

// Premier passage : le projet EAS n'existe pas encore, ou il est connu (projectId)
// mais pas encore relié à son compte (owner) : eas init s'en charge.
const known = readApp().expo;
if (!known.extra?.eas?.projectId) {
  console.log('Création du projet EAS sur ton compte Expo…');
  run(['init', '--non-interactive', '--force']);
} else if (!known.owner) {
  console.log('Liaison au projet EAS existant…');
  run(['init', '--id', known.extra.eas.projectId, '--non-interactive', '--force']);
}
const app = readApp();
const projectId = app.expo.extra?.eas?.projectId;
if (!projectId) fail('Le projet EAS n’a pas pu être créé : regarde le message d’eas-cli au-dessus.');
const url = `https://u.expo.dev/${projectId}`;
if (app.expo.updates?.url !== url || app.expo.runtimeVersion?.policy !== 'sdkVersion') {
  // Expo Go ne charge que les mises à jour en exposdk:<SDK> : on garde sdkVersion.
  app.expo.updates = { ...app.expo.updates, url };
  app.expo.runtimeVersion = { policy: 'sdkVersion' };
  fs.writeFileSync(path.join(ROOT, 'app.json'), JSON.stringify(app, null, 2) + '\n');
  console.log('app.json : adresse des mises à jour écrite (à commiter).');
}

let label = message;
if (!label) {
  try { label = execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { label = 'Aperçu'; }
}

console.log(`Publication sur le canal « ${CHANNEL} » (${platform === 'ios' ? 'iPhone' : 'iPhone et Android'})…`);
const out = run(['update', '--channel', CHANNEL, '--environment', 'preview', '--platform', platform, '--message', label.slice(0, 200), '--non-interactive', '--json'], { capture: true });
const json = JSON.parse(out.slice(out.indexOf('[')));
const groupId = json[0]?.group;
const runtimeVersion = json[0]?.runtimeVersion;

const link = async (params) => {
  const q = new URLSearchParams({ ...params, slug: 'exp', format: 'url' });
  const r = await fetch(`https://qr.expo.dev/eas-update?${q}`);
  return r.ok ? (await r.text()).trim() : null;
};
const always = await link({ projectId, runtimeVersion, channel: CHANNEL }).catch(() => null);
const thisOne = groupId ? await link({ projectId, groupId }).catch(() => null) : null;

// L'app part-elle bien branchée sur Supabase ? EAS lit ses propres variables
// (eas env, environnement « preview »), pas le .env local : on vérifie le paquet.
const host = (fs.readFileSync(env, 'utf8').match(/^EXPO_PUBLIC_SUPABASE_URL=https?:\/\/([^\s/]+)/m) ?? [])[1];
const bundles = path.join(ROOT, 'dist/_expo/static/js/ios');
const branche = host && fs.existsSync(bundles) && fs.readdirSync(bundles).some((f) => fs.readFileSync(path.join(bundles, f)).includes(host));
if (!branche) {
  console.error(`\nAttention : cette version ne contient pas l'adresse Supabase (${host ?? 'introuvable'}), elle tournera en démonstration.`);
  console.error('Ajoute EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_KEY aux variables EAS : npx eas-cli env:create --environment preview …');
  process.exitCode = 1;
}

console.log(branche ? '\nPublié, branché sur Supabase.' : '\nPublié (en démonstration).');
if (always) console.log(`Toujours la dernière version (à ouvrir sur l'iPhone) :\n  ${always}`);
if (thisOne) console.log(`Cette version précise :\n  ${thisOne}`);
console.log(`QR code : https://qr.expo.dev/eas-update?${new URLSearchParams({ projectId, runtimeVersion, channel: CHANNEL, slug: 'exp' })}`);
console.log(`Sur expo.dev : https://expo.dev/projects/${projectId}/updates`);
