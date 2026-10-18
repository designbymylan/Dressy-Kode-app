# Dresskode · Charte typographique v1

*03/10/2026. Décision de Mylan après test sur iPhone : duo A validé (Cormorant Garamond + DM Mono), titres en majuscules, mono conservée pour les étiquettes. Remplace la typographie du brief Claude Design v0.2 (Archivo + Hanken Grotesk) et celle du prototype v0.2. Comparatif consulté : https://claude.ai/artifact/Yair1DhEddpp7qqBfXs7qx*

## Les 3 polices et leurs rôles
| Rôle | Police | Réglage |
|---|---|---|
| Titres d'écran, logo, chiffres (prix, coût par port, compteurs) | **Cormorant Garamond** | 500 (600 si le trait paraît trop fin, surtout en mode sombre). Titres en **MAJUSCULES**, interlettrage +0,012 em. Chiffres alignés sur la ligne de base (lining) |
| Étiquettes (« Tenue du jour », météo, légendes, unités) | **DM Mono** | 400, 10,5 à 12 px, casse normale, couleur `muted` |
| Texte courant, boutons, chat Kode, onglets, formulaires | **Hanken Grotesk** | 400 / 500 / 600, base 15 px |

Le texte courant reste en Hanken Grotesk : c'est une troisième police, assumée. Seules les étiquettes courtes passent en mono.

## Échelle de tailles
- Titre XL (Cormorant, majuscules) : 31 px environ (28 px × 1,1, car Cormorant a une petite hauteur d'x)
- Chiffres de stats : 26 à 29 px
- Titre de section : 22 px minimum
- Corps : 15 px · secondaire : 13 px
- Étiquette mono : 10,5 à 12 px

## Règles à ne pas casser
1. **Cormorant jamais sous 22 px**, sauf le logo (à dessiner en vrai wordmark avant le lancement). Ses traits fins disparaissent sur petit écran.
2. **La mono ne sert jamais à lire** : pas de réponse de Kode, pas de description, pas de bouton. Étiquettes de 25 caractères maximum.
3. **Garder les accents sur les majuscules** (É, À, Ç). Avec `text-transform: uppercase`, vérifier que les accents s'affichent.
4. **Chiffres lining obligatoires** : Cormorant affiche des chiffres « elzévir » par défaut, qui montent et descendent et rendent un prix illisible. CSS : `font-variant-numeric: lining-nums`. React Native : `fontVariant: ['lining-nums']`.
5. **Mode sombre** : tester le poids 500 puis 600 sur fond `#141416` avant de figer.
6. **Titres sur 3 lignes maximum**, en bloc aligné à gauche (modèle du prototype : « TON / DRESSING, / EN VITRINE. »).

## Mise en œuvre dans l'app
- Licences : les trois polices sont sous OFL (usage commercial libre, publication sur l'App Store possible).
- React Native / Expo : charger des fichiers statiques (Cormorant Garamond Medium et SemiBold, DM Mono Regular, Hanken Grotesk Regular, Medium et SemiBold) avec `expo-font` plutôt que des polices variables, mieux gérées en natif.
- Poids total à surveiller : 8 fichiers environ, quelques centaines de ko.

## Bloc de remplacement pour le brief Claude Design (section « Typographie »)
```
**Typographie**
- Titres, logo et chiffres : Cormorant Garamond 500 (600 en mode sombre si besoin). Titres d'écran en MAJUSCULES, interlettrage +0,012 em, jamais sous 22 px. Chiffres alignés sur la ligne de base (lining numerals).
- Étiquettes : DM Mono 400, 10,5 à 12 px, casse normale, couleur muted. Jamais pour du texte lu.
- Texte et interface : Hanken Grotesk 400 / 500 / 600, base 15 px, interligne 1,45.
- Marque : Cormorant Garamond en capitales, interlettrage 0,24 em → « DRESSKODE ».
- Échelle : titre XL 31 px, chiffres 26-29 px, titre 22 px, corps 15 px, secondaire 13 px, étiquette 10,5-12 px.
```

## À faire ensuite
- Mettre à jour le prototype (v0.3) avec ce duo, puis le brief Claude Design.
- Faire dessiner le logo DRESSKODE (wordmark) au lieu de le composer en texte.
- Tester le rendu en mode sombre sur iPhone.

## Mise en œuvre (03/10/2026)
- Fichiers tirés des polices Google Fonts (Cormorant Garamond 4.001, Hanken Grotesk 3.013, DM Mono), en graisses statiques : Cormorant 500 et 600, Hanken 400, 500 et 600, DM Mono 400. Licences OFL jointes aux fichiers.
- Réduits au latin utile au français (accents, Œ, «  », €, espaces fines, flèches) : 420 Ko pour l'app (.ttf), 125 Ko pour le web (.woff2). La version complète de Cormorant pèse 1 Mo par graisse.
- Chiffres : la version statique de Cormorant publiée par son auteur n'a pas de réglage « lining », seule la version Google en a un. Les chiffres alignés y sont mis **par défaut dans le fichier** : un prix se lit partout, sans `lining-nums`.
- Rangement : `mobile/assets/fonts/` et `web/public/fonts/`, rôles dans `mobile/src/theme/fonts.ts` et `web/src/app/globals.css`.
- Tailles réduites le 03/10 à la demande de Mylan : titre XL 28 px (36 px sur l'écran de bienvenue), titre d'écran 25 px, titres de section au plancher de 22 px.
- Écarts assumés : étiquettes mono à 12 px (le bas de la fourchette, 10,5 px, passe sous le minimum de 11,5 px de l'app) ; poids 500 gardé en mode sombre, lisible sur fond noir aux tailles de titre (600 reste chargé si le rendu sur iPhone paraît trop fin).

