---
name: dressy-design
description: Méthode maison pour créer, coder, retoucher ou vérifier un écran ou un composant de l'application Dressy (dossier web/) fidèlement aux maquettes Claude Design de design/_projet. À utiliser pour tout travail d'interface sur Dressy, avant tout autre skill de design, qu'il s'agisse d'un nouvel écran, d'une correction visuelle, d'une couleur, d'un état vide ou d'une revue de conformité. Invocation directe : /dressy-design <écran ou demande>.
---

# Dressy — coder un écran fidèle aux maquettes

Les règles (priorités, jetons, polices, formes, textes, interdits techniques)
sont dans `CLAUDE.md` à la racine : relis-les, ce skill ne les répète pas. Il
donne la **méthode** pour passer d'une maquette à un écran qui marche.

## 1. Cadrer

Repère la maquette et la route concernées :

| Maquette (`design/_projet/`) | Route (`web/src/app/`)          |
| ---------------------------- | ------------------------------- |
| `Accueil.dc.html`            | `(app)/accueil`                 |
| `Dressing Portants.dc.html`  | `(app)/dressing`                |
| `Fiche vetement.dc.html`     | pas encore de route             |
| `Kode.dc.html`               | `(app)/kode`                    |
| `Calendrier.dc.html`         | `(app)/calendrier`              |
| `Offres.dc.html`             | pas encore de route             |
| `Parametres.dc.html`         | `(app)/moi` (Mon compte)        |
| `Design System.dc.html`      | composants et couleurs de base  |

Pas de maquette pour l'écran demandé : pars du Design System et du brief v0.2,
et **dis-le** avant de coder. N'invente pas un motif visuel nouveau sans
l'annoncer.

## 2. Lire la maquette

- Lis le source HTML : les styles en ligne donnent les mesures exactes
  (tailles, rayons, espacements, graisses). Ne devine pas à l'œil.
- Pour la voir : `node tools/serve.mjs`, puis
  `http://localhost:4173/<Fichier>.dc.html`.
- Un fichier contient plusieurs planches (clair, sombre, états vides, de
  chargement, d'erreur). **Code tous les états montrés**, pas seulement le
  premier.

## 3. Lire l'existant

Ouvre la page, ses composants (`web/src/components/`) et `ui.tsx`.
Réutilise `Screen`, `Title`, `Card`, `buttonPrimary`, `buttonQuiet`,
`inputStyle` ; crée une brique seulement si elle servira ailleurs.

## 4. Traduire la maquette en code

Les maquettes écrivent les couleurs en dur ; le code **jamais**. Remplace
chaque valeur par sa variable :

| Maquette (clair) | Variable        | Rôle                          |
| ---------------- | --------------- | ----------------------------- |
| `#EEEDEA`        | `--desk`        | fond d'écran                  |
| `#FFFFFF`        | `--ground`      | cartes, feuilles              |
| `#F3F2EF`        | `--tile`        | vignettes, boutons discrets   |
| `#E7E5E0`        | `--tile-2`      | dégradé de vignette           |
| `#ECEAE6`        | `--line`        | filets 1 px                   |
| `#0D0D0E`        | `--ink`         | texte, boutons pleins         |
| `#5F5D59`        | `--muted`       | texte secondaire              |
| `#A88B61`        | `--hi`          | laiton, décor seulement       |
| `#766144`        | `--hi-ink`      | laiton lisible (texte, icône) |
| `#DEDAF6`        | `--accent-tint` | fond lilas                    |
| `#241F52`        | `--accent-ink`  | texte sur lilas               |

Couleurs par sujet du Design System, à utiliser seulement pour leur sujet :
**sable** `#EDE3D8` (Tenue du jour), **lilas** `#DEDAF6` (Cercle et ajouts),
**beurre** `#F4EBC6` (Chiffres et photo), chacune avec ses deux teintes de
texte indiquées dans la maquette.

Une couleur de maquette sans variable (sable, beurre, `#4B4488`…) : crée la
variable dans `web/src/app/globals.css`, **dans les trois blocs** (clair,
sombre forcé, sombre automatique), avec une valeur sombre qui tient le
contraste AA. Ne l'écris jamais en dur dans un composant.

Les teintes des vêtements dessinés dans les maquettes sont des exemples de
contenu, pas des couleurs d'interface : elles ne deviennent pas des variables.

Le reste :
- Titres en `h1`–`h3` (Gambarino via `globals.css`), tout le reste hérite de
  Satoshi.
- Icônes : recopie le SVG de la maquette en ligne, `stroke="currentColor"` ou
  une variable.
- Textes : reprends ceux de la maquette mot pour mot. S'il faut en écrire,
  suis les règles de textes de `CLAUDE.md`.

## 5. Vérifier avant de rendre

- [ ] Aucun code hexadécimal ajouté dans `web/src/components` ni `web/src/app`
      (hors `globals.css`), sauf couleur qui ne suit pas le thème (pastille de
      couleur d'un vêtement, aperçu de thème).
- [ ] L'écran marche en clair **et** en sombre.
- [ ] Cibles tactiles de 44 px minimum, rayon 999 px sur tout ce qui se clique.
- [ ] Contraste AA sur chaque texte, y compris sur les fonds sable, lilas et
      beurre.
- [ ] Tous les états de la maquette sont codés (vide, chargement, erreur).
- [ ] `cd web && npm run typecheck` puis `npm run build` passent.
- [ ] Si un navigateur est disponible (skill `run`) : capture à 390 px de
      large, en clair et en sombre, comparée à la maquette.

## 6. Rendre compte

Dis ce qui a été fait, puis **liste chaque écart avec la maquette et sa
raison** (contrainte technique, donnée manquante, choix à valider). Aucun
écart silencieux.
