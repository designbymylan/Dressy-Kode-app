// Essai local, jamais déployé (rien ne l'importe) :
//   deno run -A --config deno.json essai-local.ts <photo.jpg> <masque.png> <dossier de sortie>
import { decode, sniffMime } from '../dressy-agent/codec.ts';
import { etiqueter } from './etiquetage.ts';
import { traiter } from './pipeline.ts';
import { encoderWebp } from './webp.ts';
const [photoPath, masquePath, sortie] = Deno.args;
const original = await Deno.readFile(photoPath);
const masque = await Deno.readFile(masquePath);
const ETIQ = { piece_unique: true, categorie: 'vestes', type: 'veste', couleur: 'noir', couleur_2: null, matiere: 'cuir', motif: 'uni', coupe: 'droite', saisons: ['automne', 'hiver'], habillage: 2, confiance: 0.8 };
for (let i = 0; i < 3; i++) {
  const t = performance.now();
  const s = await traiter(original, {
    decoderJpeg: (b) => decode(b, 'image/jpeg'),
    decoderPng: (b) => decode(b, sniffMime(b) ?? 'image/png'),
    encoderWebp,
    detourer: async () => ({ png: masque, essais: 1, erreurs: [] }),
    etiqueter: () => etiqueter(async () => ({ brut: ETIQ, modele: 'faux', coutUsd: 0 })),
    maintenant: () => Date.now(),
  });
  const ms = Math.round(performance.now() - t);
  if (s.statut !== 'ready') { console.log(s.statut, JSON.stringify(s).slice(0, 300)); continue; }
  console.log(`passage ${i + 1} : ${ms} ms au total, contrôle ${s.mesures.controle_ms} ms, cutout ${s.largeur}x${s.hauteur} ${s.cutout.length} o, vignette ${s.thumb.length} o, couleur ${s.couleurHex}, couverture ${s.analyse.couverture.toFixed(3)}`);
  if (i === 0) { await Deno.writeFile(`${sortie}/cutout.webp`, s.cutout); await Deno.writeFile(`${sortie}/thumb.webp`, s.thumb); }
}
