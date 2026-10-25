# Logo Dresskode : l'orbe de Kodi (25/10)

Le logo est l'orbe de Kodi : une sphère lavande vers ciel avec son reflet,
la même que l'orbe au repos (`web/src/components/Orb.tsx`,
`mobile/src/ui/Orb.tsx`). Il remplace le K étoilé (piste A, 13/10), retiré
à la demande de l'utilisateur le 25/10. Le nom s'écrit à côté, DRESSKODE en
Inter Tight 400, capitales espacées de 0,3 em (charte v2).

## Fichiers

| Fichier | Usage |
|---|---|
| `orbe.svg` | Le logo, sur fond clair ou sombre |
| `icone-app.svg`, `icone-app-1024.png` | Icône d'app : orbe sur noir plein cadre, iOS arrondit lui-même |
| `orbe-1024.png` | Le logo en PNG, pour Canva, les réseaux, la presse |

Les autres tailles (favicon, icônes Android, lancement, icônes web et image
de partage) sont dérivées du même dessin ; elles sont dans `web/public/icons/`,
`web/src/app/` et `mobile/assets/`.

Dans le code : `web/src/components/Logo.tsx` (`Monogram`, `Wordmark mark`),
`web/src/app/icon.svg` (favicon), et `mobile/src/ui/Logo.tsx` (`Monogram`,
`BrandMark`).

## Règles

- Le dégradé de l'orbe (lavande vers ciel) est celui du logo. Pas d'ombre
  ni de chrome. Le reflet blanc en haut à gauche est toujours présent.
- Zone de protection : un quart du diamètre de l'orbe tout autour.
- Taille minimale : 16 px.

## Géométrie (viewBox 100 × 100)

Disque de rayon 50 centré en (50, 50). Dégradé radial, centre à 32 % / 28 %,
rayon 85 %, de `#b9adff` à `#9fd0ff`. Reflet : ellipse en (42, 21), rayons
20 et 13, blanc à 70 % d'opacité.
