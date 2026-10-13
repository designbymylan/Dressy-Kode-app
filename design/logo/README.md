# Logo Dresskode : le K étoilé (piste A, validée le 13/10)

Un K fin, dont la branche haute s'arrête sur l'**étincelle de Kode** : la
garde-robe et le styliste dans un seul signe. Le nom s'écrit à côté,
DRESSKODE en Inter Tight 400, capitales espacées de 0,3 em (charte v2).

Planches (pistes, variations, couleurs, mock-ups, rendu sur le site) :
https://claude.ai/artifact/LJomyeYSjzN9abt5v5VpJP

## Fichiers

| Fichier | Usage |
|---|---|
| `monogramme-noir.svg` | Le logo, sur fond clair |
| `monogramme-blanc.svg` | Sur fond sombre |
| `monogramme-blanc-etincelle-rose.svg` | Sur noir, étincelle rose poudré (icône, lancement) |
| `monogramme-gras-noir.svg` | Petites tailles (favicon, notification), trait épaissi |
| `icone-app.svg`, `icone-app-1024.png` | Icône d'app : carré noir plein cadre, iOS arrondit lui-même |
| `*-1024.png` | Les mêmes en PNG, pour Canva, les réseaux, la presse |

Dans le code : `web/src/components/Logo.tsx` (`Monogram`, `Wordmark mark`),
`web/src/app/icon.svg` (favicon), `web/src/app/apple-icon.png`, et les
icônes de `mobile/assets/` (`icon.png`, `splash-icon.png`,
`android-icon-*.png`, `favicon.png`).

## Règles

- Le K est toujours **noir ou blanc**, comme le texte.
- L'étincelle passe en **rose poudré** (`#f8e9e4`) seulement sur fond noir.
- Ni dégradé, ni ombre, ni chrome sur le logo.
- Zone de protection : la hauteur de l'étincelle tout autour. Taille
  minimale : 16 px, avec la version grasse sous 24 px.

## Géométrie (viewBox 100 × 100)

Fût de 6,5 d'épaisseur de y 14 à 86 (centre x 30) ; branche haute de
(30, 61) à (61, 30), bout droit ; branche basse de (44, 47) vers le bas,
coupée à l'horizontale en y 86 ; étincelle à quatre pointes centrée en
(71, 17), rayon 14. Version grasse : épaisseur 9,5.
