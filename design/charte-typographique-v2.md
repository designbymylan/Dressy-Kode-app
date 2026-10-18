# Charte typographique v2 (09/10)

Décidée par Mylan le 09/10, sur la maquette validée « Dresskode, nouvelle
base » (https://claude.ai/artifact/JrJosA6gj1EEw9wH29gtM2). Elle remplace la
charte v1 (Cormorant Garamond, Hanken Grotesk, DM Mono), gardée pour
l'historique dans `charte-typographique-v1.md`.

## Le duo
- **Titres, marque, grands chiffres : Inter Tight**, fin (300) ; régulier
  (400) pour un titre sous 24 px et pour la marque. Une graisse plus marquée
  (500) pour le mot qu'on veut faire ressortir dans un titre (« est
  **prête** »).
- **Texte, boutons, onglets, formulaires : Inter**, un cran plus épais que la
  v1 : 500 pour le texte courant, 600 pour l'insistance et les boutons, 400
  seulement pour un texte de saisie.

Toutes deux sans empattement, sous licence OFL.

## L'échelle (proportionnée, sept tailles)
| Rôle | Police | Taille / interligne |
|---|---|---|
| Promesse des offres | Inter Tight 300 | 48 / 50 |
| Titre d'écran, salut | Inter Tight 300 | 30 / 34 (28 / 32) |
| Titre de section | Inter Tight 300 | 22 / 26 |
| Titre de carte | Inter Tight 400 | 20 / 24 |
| Grand chiffre | Inter Tight 300 | 26 / 30, chiffres de même largeur |
| Sous-titre | Inter 600 | 17 / 22 |
| Texte | Inter 500 | 15 / 21 |
| Secondaire | Inter 500 | 13 / 18 |
| Petite information | Inter 500 | 12 / 16 |
| Étiquette | Inter 500 | 11 / 14, capitales, +0,08 em |

Chaque palier monte d'un pas régulier : jamais un texte de 76 px à côté d'un
texte de 11 px. Rien sous 11 px.

## Les codes des grandes enseignes de mode
- **Étiquettes et liens de section en capitales espacées** (« TENUE DU JOUR »,
  « TOUT VOIR », « FILTRER »), deux ou trois mots au plus.
- **Noms de pièces en capitales espacées** sous la vignette, les ports en
  gris dessous, comme une fiche produit.
- **Rayons du dressing en texte** (TOUT · MANTEAUX · HAUTS · BAS…), le rayon
  actif souligné.
- **Titres en casse normale**, fins, alignés à gauche, sur trois lignes au plus.
- La marque, **DRESSKODE**, en Inter Tight 400 capitales espacées de 0,3 em.

## Icônes
Au trait (jeu maison de `mobile/src/ui/Icon.tsx`), avec un **reflet chromé** :
un dégradé métal tiré de leur couleur, sombre sur fond clair, clair sur fond
sombre. Une icône de couleur (vert de validation, rouge d'alerte, teinte d'un
vêtement) reste pleine. Tailles modestes : 18 à 22 px, 24 au plus.

## Mise en œuvre
- Fichiers tirés de Google Fonts (Inter 4, Inter Tight), graisses statiques,
  réduits au latin utile au français : 312 Ko pour l'app (.ttf), 124 Ko pour
  le web (.woff2). Licence OFL à côté (`OFL-Inter.txt`).
- Rangement : `mobile/assets/fonts/` et `web/public/fonts/` ; rôles dans
  `mobile/src/theme/fonts.ts` (`F.display`, `F.s500`…) et l'échelle dans
  `mobile/src/theme/tokens.ts` ; `@font-face` et variables dans
  `web/src/app/globals.css`.
- Pour régénérer une police : `pyftsubset <police>.ttf
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+0178,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD"
  --layout-features='*'` (ajouter `--flavor=woff2` pour le web).
