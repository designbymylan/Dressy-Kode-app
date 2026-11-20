/**
 * L'étiquetage d'une pièce (spec) : le modèle rend exactement l'objet de la
 * taxonomie, le serveur le valide avant d'écrire, une réponse hors liste est
 * redemandée une seule fois, puis la pièce est rangée avec une fiche vide.
 *
 * Logique pure : l'appel au modèle est passé en paramètre (`Appel`), branché
 * sur Gemini ou Claude Haiku 5.5 dans `modeles.ts`.
 */
import { CATEGORIES, COULEURS, COUPES, HABILLAGES, MATIERES, MOTIFS, SAISONS, validerEtiquettes, type Etiquettes } from '../_shared/taxonomy.ts';

const liste = (xs: readonly { id: string | number; label: string }[]) => xs.map((x) => `${x.id} (${x.label})`).join(', ');

export const CONSIGNE = `Tu étiquettes la photo d'UN vêtement ou accessoire, posé à plat ou suspendu, pour une garde-robe numérique. Tu décris uniquement ce qui se voit, avec les seules valeurs proposées : aucun texte libre, aucune marque.

Champs :
- piece_unique : true si la photo montre une seule pièce (une paire de chaussures, de boucles d'oreilles ou de gants compte pour UNE pièce) ; false si on voit plusieurs pièces distinctes (une tenue entière, un tas de vêtements, un haut et un bas).
- categorie et type : la catégorie, puis un type de CETTE catégorie :
${CATEGORIES.map((c) => `  ${c.id} → ${c.types.map((t) => `${t.id} (${t.label})`).join(', ')}`).join('\n')}
- couleur : la couleur dominante, parmi ${liste(COULEURS)}.
- couleur_2 : la seconde couleur si elle occupe une vraie surface (rayures, col, semelle…), sinon null.
- matiere : la matière apparente, parmi ${liste(MATIERES)}.
- motif : parmi ${liste(MOTIFS)}.
- coupe : parmi ${liste(COUPES)} (sans_objet pour les chaussures, sacs, bijoux et accessoires).
- saisons : une ou plusieurs parmi ${liste(SAISONS)}, d'après la matière et l'épaisseur visibles (un t-shirt en coton : les quatre ; une doudoune : automne, hiver ; une robe en lin : printemps, été).
- habillage : de 1 à 5 : ${liste(HABILLAGES)}.
- confiance : de 0 à 1, ta certitude sur l'ensemble.

En cas de doute, réponds « autre » quand la liste le propose et baisse la confiance. Ne devine pas.`;

export type Appel = (consigne: string) => Promise<{ brut: unknown; modele: string; coutUsd: number }>;

export type Resultat = {
  etiquettes: Etiquettes | null;
  essais: number;
  modele: string | null;
  coutUsd: number;
  erreurs: string[];
};

/** Deux réponses au plus : la première, et un seul nouvel essai si elle est invalide ou en erreur. */
export async function etiqueter(appel: Appel): Promise<Resultat> {
  const erreurs: string[] = [];
  let cout = 0;
  let modele: string | null = null;
  let consigne = CONSIGNE;
  for (let essai = 1; essai <= 2; essai++) {
    try {
      const r = await appel(consigne);
      cout += r.coutUsd;
      modele = r.modele;
      const v = validerEtiquettes(r.brut);
      if (v.ok) return { etiquettes: v.etiquettes, essais: essai, modele, coutUsd: cout, erreurs };
      erreurs.push(`réponse rejetée : ${v.erreurs.join(' ; ')}`);
      consigne = `${CONSIGNE}\n\nTa réponse précédente a été rejetée : ${v.erreurs.join(' ; ')}. Recommence en n'utilisant QUE les valeurs proposées.`;
    } catch (err) {
      erreurs.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { etiquettes: null, essais: 2, modele, coutUsd: cout, erreurs };
}
