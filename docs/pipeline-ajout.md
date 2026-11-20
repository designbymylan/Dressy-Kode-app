# Pipeline d'ajout de vêtements : état et banc

Spec du 20/11 (« Spec · Pipeline d'ajout de vêtements (Dresskode) »), mise en œuvre le même jour.

## Ce qui est en place

| Étape de la spec | État | Où |
| --- | --- | --- |
| 1. `taxonomy.ts`, source unique | Fait. Listes en place (8 catégories, 55 types, 22 couleurs, identifiants français, décision du 20/11), matières fermées, saisons en tableau. Génère schéma du modèle, contraintes SQL, copies app et site. | `supabase/functions/_shared/taxonomy.ts`, `node tools/taxonomie.mjs` |
| 2. Base | Fait, en production (migration `20261120224423_pipeline_ajout`, additive). État de traitement, photo d'origine, colonnes tenues par le serveur, « Tout ajouter », Realtime, Storage (le client n'écrit que `original.jpg`), journal `garment_runs`, vue `pipeline_indicateurs`. 36 essais sur base jetable. | `bash tools/test-pipeline.sh` |
| 3. Banc | Premier passage fait (ci-dessous). Reste : 20 photos prises au téléphone, chez soi. | `tools/banc-pipeline.*` |
| 4. `process-garment` | Fait, déployé (ajout pur : l'app et le site ne l'appellent pas encore). 42 essais sans réseau. | `supabase/functions/process-garment/`, `npm run test:pipeline` (web) |
| 5. Client | Fait sur la branche, derrière `PIPELINE_AJOUT` (faux) : photo préparée sur l'appareil (1024 px, JPEG 85, refus sous 600 px), envoi, ligne « processing », appel, suivi Realtime (relu toutes les 4 s en filet), « Réessayer », « Reprendre la photo ». | `mobile/src/state/ajout.ts`, `web/src/lib/ajout.ts` |
| 6. Interface | Faite sur la branche : aide à la capture, caméra à cadre guide (app), galerie jusqu'à 20 photos, tuiles par état, fiche par sélecteurs, « À confirmer », « Tout ajouter ». Types et construction vérifiés ; **pas encore essayée sur un vrai compte ni un vrai iPhone**. | `mobile/src/screens/Ajout.tsx`, `mobile/src/ui/{CameraCadre,fiche}.tsx`, `web/src/components/AjoutPieces.tsx` |
| 7. Suivi | Journal et vue en place ; mesure finale en 4G à faire sur un vrai iPhone. | `select * from pipeline_indicateurs;` |

Écarts assumés avec la spec, et pourquoi :

- **Taxonomie en français, plus riche** (décision du 20/11) : pas de migration des 73 pièces ni de Kodi.
- **Espace plutôt que `user_id`** : la base est construite sur les espaces (un espace par personne aujourd'hui) ; RLS et Storage suivent l'appartenance à l'espace. Chemins : `garments/<espace>/<pièce>/{original.jpg,cutout.webp,thumb.webp}`.
- **`pipeline_status`** plutôt que `status` (déjà pris : active, archived, lent, laundry) ; `cutout_path` est l'ancien `image_path`, `color_hex` l'ancien `tint`, pour que toutes les vues lisent la même image sans changement.
- **Protection des colonnes par déclencheur** plutôt que par GRANT de colonnes : même effet, sans casser l'app actuelle qui met `garments` à jour librement.
- **Étiquetage par Gemini Flash-Lite** tant que les clés passent par l'intermédiaire (Claude n'y voit pas les photos, constat du 17/11). Claude Haiku 5.5 prend le relais tout seul dès qu'une clé Anthropic directe est posée (`ETIQUETEUR` pour forcer).
- **« Image propre » reste** dans la fiche pièce, à la demande (décision du 20/11) : les offres vendent des générations. Le pipeline d'ajout, lui, n'appelle aucun modèle génératif.

## Banc du 20/11

20 photos libres d'Unsplash (`tools/banc-pipeline.json`), préparées comme l'app (1024 px, JPEG 85), chacune passée par les deux services de détourage de fal.ai. Étiquetage : Gemini 3.5 Flash-Lite par l'intermédiaire.

| | BiRefNet v2 (masque seul) | Bria RMBG 2.0 |
| --- | --- | --- |
| Traitements | 23 | 22 |
| Durée serveur, médiane / p95 | 4,2 s / 6,1 s | 3,8 s / 6,5 s |
| Détourage, médiane / p95 | 0,7 s / 1,2 s | 1,5 s / 2,6 s |
| Étiquetage, médiane / p95 | 4,0 s / 6,1 s | 3,7 s / 6,3 s |
| Contrôle et normalisation, p95 | 0,4 s | 0,4 s |
| Coût moyen par pièce | 0,003 $ (détourage estimé, à vérifier sur la facture fal) | 0,019 $ |
| Échecs | 0 | 0 |
| Fiches valides | 100 % | 100 % |

**Choix : BiRefNet.** Même qualité de bord que Bria sur les 14 vraies pièces seules, couleurs intactes (nos pixels, seul le masque vient du service), deux fois plus rapide, six fois moins cher.

Ce que le banc montre :

- **Les 4 photos à plusieurs pièces sont refusées** (« Une seule pièce par photo ») : tenue sur un lit, pile de jeans, chemise avec lunettes et mocassins, penderie pleine. Deux autres photos que j'avais classées « une pièce » montraient en fait deux t-shirts ou une scène encombrée : refusées aussi, à raison.
- **Les paires** (4 paires de chaussures) passent : leurs deux morceaux comptent ensemble.
- **Limite du détourage générique** : ce qui est posé avec la pièce reste dans l'image : la boîte sous des baskets, une patère, des cintres, une tringle. Le contrôle ne le voit pas. La capture guidée (fond uni, pièce seule) est le premier remède ; un détourage guidé par le type (SAM 3, déjà branché pour l'ancien agent) serait le second, au prix d'une étape de plus après l'étiquetage.
- **Pièce coupée par le cadre** (un top coupé en bas) : acceptée par les règles de la spec. Une mesure `bord` est désormais journalisée pour calibrer une règle.
- **L'étiquetage fait l'essentiel de l'attente** (6,1 s au p95, cible 4 s) et n'est pas constant : le même t-shirt entouré d'objets a été jugé une fois seul, une fois non. Une clé directe (Google ou Anthropic) est le levier : sans intermédiaire, le même appel tient en 1 à 3 s.
- **Estimation de bout en bout** : 6,1 s serveur + préparation et envoi de 150 à 250 Ko + réveil de la fonction, soit environ 8 à 9 s au p95. Dans la cible de 10 s, à mesurer en 4G sur un vrai iPhone.

## Avant la bascule (app et site)

1. **20 photos prises au téléphone**, chez soi, en suivant l'aide à la capture : c'est le vrai banc (critère : 18 sur 20 prêtes sans reprise). `node tools/banc-pipeline.mjs` accepte d'autres photos (déposées dans le compartiment `banc`).
2. **Politique de confidentialité** : la photo d'origine est gardée tant que la pièce existe (spec), alors que la politique promet l'effacement des photos sous 30 jours. Nouvelle version, avis, registre, avant la bascule. Même chose pour le texte de permission « photos » de l'app.
3. **Kodi, le dressing de l'app et du site** ne lisent plus que les pièces ajoutées (`added_at`), sur la branche ; redéployer `kode` à la bascule.
4. **Contraintes de la taxonomie** sur `kind` et `colors` (l'app actuelle écrit encore ses types d'illustration) : nouvelle migration, une fois l'app basculée.
5. **Bascule** : `PIPELINE_AJOUT = true` dans `mobile/src/state/ajout.ts` et `web/src/lib/ajout.ts`, essai de bout en bout sur un vrai compte (app en Expo Go, site en Preview), mesure en 4G, puis main.
