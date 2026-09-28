# Dresskode — application mobile

L'app Expo (iOS d'abord). **La disposition** (écrans, sections, parcours) est celle de la
refonte, direction B ; **l'apparence** suit la direction « vitrine de verre » du travail
fait sur le portable (`web/src/app/globals.css`, planches `App design/`) : fond perle
traversé de halos pastel, cartes de verre, boutons pilule, titres serrés avec un mot en
italique serif. Les 18 écrans du brief, en clair et en sombre.

Branchée sur Supabase quand `.env` contient l'URL et la clé publishable du projet
(voir `.env.example`) : compte, profil, dressing, ports, tenues prévues, Kode et paiement
y sont enregistrés. Sans ces deux lignes, l'app tourne en démonstration, sans réseau.
« J'ai déjà un compte » ouvre alors le compte de démonstration.

## Polices

La direction est dessinée en **Satoshi** (Fontshare). Ses fichiers ne sont pas publiés
sur npm et n'ont pas pu être téléchargés depuis l'environnement de travail : **DM Sans**,
libre et très proche, la remplace. Pour passer à Satoshi, dépose `Satoshi-Regular.otf`,
`Satoshi-Medium.otf` et `Satoshi-Bold.otf` dans `assets/fonts/`, puis dans `App.tsx` :

```ts
Sans400: require('./assets/fonts/Satoshi-Regular.otf'),
Sans500: require('./assets/fonts/Satoshi-Medium.otf'),
Sans600: require('./assets/fonts/Satoshi-Bold.otf'),
Sans700: require('./assets/fonts/Satoshi-Bold.otf'),
```

Tout le reste de l'app appelle les polices par leur rôle (`Sans400`…, `Accent`) : rien
d'autre à changer. L'italique des titres reste Instrument Serif.

## L'essayer sur ton iPhone

1. Installe **Expo Go** depuis l'App Store (il doit être en version SDK 57).
2. Sur ton ordinateur, dans ce dossier :
   ```bash
   npm install
   cp .env.example .env   # branche l'app sur Supabase (sinon : démonstration)
   npx expo start
   ```
3. Scanne le QR code affiché avec l'appareil photo de l'iPhone (même réseau Wi-Fi).

Pour l'aperçu dans un navigateur : `npx expo start --web`. Après une modification de `.env`,
relance avec `npx expo start --clear` : les variables sont figées dans le cache.

## Où sont les choses

| Dossier | Contenu |
|---|---|
| `src/theme/` | Jetons (couleurs, typo, rayons, mouvement) et thème clair/sombre |
| `src/ui/` | Composants : verre, barre d'onglets, boutons, feuilles, illustrations, icônes |
| `src/screens/` | Les écrans (voir la table ci-dessous) |
| `src/state/` | État de l'app, pont Supabase (`remote.ts`), réponses simulées de Kode en démonstration |
| `src/data/` | Le dressing fictif (37 pièces), l'agenda, la météo |

| # | Écran du brief | Fichier |
|---|---|---|
| 1 | Bienvenue | `Welcome.tsx` |
| 2 | Onboarding : 4 chapitres, 15 écrans (profil, silhouette par photos, tailles, styles, couleurs, quotidien, premières pièces, compte) | `Onboarding.tsx` + `ui/onboarding.tsx` |
| 3 | Accueil + modules réordonnables | `Home.tsx` |
| 4–5 | Dressing — Portants et Grille | `Dressing.tsx` |
| 6 | Fiche vêtement | `Piece.tsx` |
| 7 | Kode | `Kode.tsx` |
| 8 | Ajouter un vêtement | `AddPiece.tsx` |
| 9 | Composer une tenue | `Compose.tsx` |
| 10 | Agenda | `Agenda.tsx` |
| 11 | Événement / Pack Occasion | `Event.tsx` |
| 12 | Ma silhouette | `Silhouette.tsx` |
| 13 | Personnaliser | `Customize.tsx` |
| 14 | Partage à une amie | `Share.tsx` |
| 15 | Offres | `Offers.tsx` |
| 16 | Boutique | `Shop.tsx` |
| 17 | Profil (Moi) | `Me.tsx` |
| 18 | Feuilles, états vides et chargements | `States.tsx` + `ui/Sheet.tsx` |

Design system et justifications : `../design/refonte/02-design-system.md`.
