# Dresskode, application mobile

L'app Expo (iOS d'abord). **La disposition** (écrans, sections, parcours) est celle de la
refonte, direction B ; **l'apparence** reprend les couleurs de la « galerie » (fond blanc,
texte noir, beurre pour les messages, gris studio sous les vêtements) et la typographie v1,
sur les formes de la vitrine de verre : arrondis, verre dépoli, transparence, halos crème
très discrets derrière (noirs en sombre). Les 18 écrans du brief, en clair et en sombre.

Branchée sur Supabase quand `.env` contient l'URL et la clé publishable du projet
(voir `.env.example`) : compte, profil, dressing, ports, tenues prévues, Kode et paiement
y sont enregistrés. Les photos ajoutées partent chez Kode, qui repère chaque pièce, la
dessine et la range sans fond ; l'écran d'ajout montre le scan de repérage puis le
détourage de chaque pièce. Sans ces deux lignes, l'app tourne en démonstration, sans
réseau, et la reconnaissance des photos est simulée. « J'ai déjà un compte » ouvre
alors le compte de démonstration.

Connectée, l'app reçoit aussi les **données du jour** de la fonction `donnees` : vraie
météo de ta ville (accueil, agenda, Kode), jours fériés et ponts, vacances scolaires de
ton académie, fête du jour, tendances du moment, chacune avec sa source et l'heure de sa
mise à jour. En démonstration, la météo reste simulée.

## Polices

Charte typographique v1 (`../design/charte-typographique-v1.md`) : Cormorant
Garamond pour les titres en capitales, la marque et les grands chiffres ; Hanken
Grotesk pour le texte, les boutons et les onglets ; DM Mono pour les étiquettes
courtes. Les fichiers sont dans `assets/fonts/` (OFL, licences jointes), chargés
par `App.tsx` avec `expo-font`. Les écrans appellent les polices par leur rôle
(`F.s400`… `F.s600`, `F.display`, `F.mono`) depuis `src/theme/fonts.ts`, et
l'échelle est dans `src/theme/tokens.ts` (`type`).

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

### Sans ordinateur : EAS Update dans Expo Go

`npm run apercu` publie l'app sur le canal `apercu` d'EAS Update et affiche un lien fixe
qui ouvre toujours la dernière version dans Expo Go, branchée sur Supabase.

- Il faut `EXPO_TOKEN` dans l'environnement (jeton d'accès du compte Expo, créé sur
  expo.dev > Account settings > Access tokens). Jamais dans un fichier commité.
- Le projet EAS est `7d598be6-b07e-4f0d-b7b0-2623fa014d12` (déjà dans `app.json`). Au premier
  passage, le script le relie au compte (`owner`) ; sans identifiant, il crée le projet et écrit `extra.eas.projectId`,
  `owner` et `updates.url` dans `app.json` : ce changement est à commiter.
- Sur l'iPhone, Expo Go doit être connecté au **même compte Expo** que le projet.
- `runtimeVersion` reste en `sdkVersion` (`exposdk:57.0.0`) : c'est ce qui permet à Expo
  Go de charger la mise à jour. Le jour d'une vraie build (TestFlight, App Store), on
  passera à `fingerprint` et à des builds `eas build --profile preview` (`eas.json`).
- `npm run apercu -- "message"` pour nommer la version, `-- --android` pour publier
  aussi pour Android.

## Où sont les choses

| Dossier | Contenu |
|---|---|
| `src/theme/` | Jetons (couleurs, typo, rayons, mouvement) et thème clair/sombre |
| `src/ui/` | Composants : surfaces plates, barre d'onglets, boutons, feuilles, illustrations, icônes |
| `src/screens/` | Les écrans (voir la table ci-dessous) |
| `src/state/` | État de l'app, pont Supabase (`remote.ts`), suivi des photos confiées à Kode (`jobs.ts`), réponses simulées de Kode en démonstration |
| `src/data/` | Le dressing fictif (37 pièces), l'agenda, la météo simulée de la démonstration |

| # | Écran du brief | Fichier |
|---|---|---|
| 1 | Bienvenue | `Welcome.tsx` |
| 2 | Onboarding : 4 chapitres, 15 écrans (profil, silhouette par photos, tailles, styles, couleurs, quotidien, premières pièces, compte) | `Onboarding.tsx` + `ui/onboarding.tsx` |
| 3 | Accueil + modules réordonnables | `Home.tsx` |
| 4–5 | Dressing, Portants et Grille | `Dressing.tsx` |
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
