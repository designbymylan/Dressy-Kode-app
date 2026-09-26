# Dresskode — application mobile

L'app Expo (iOS d'abord), direction de design **B « Éditorial »**. Les 18 écrans du brief,
en clair et en sombre, avec des données de démonstration : tout est cliquable, rien
n'est encore relié à Supabase. « Commencer » crée un compte neuf (onboarding complet,
dressing vide ou rempli en route) ; « J'ai déjà un compte » ouvre le compte de démonstration.

## L'essayer sur ton iPhone

1. Installe **Expo Go** depuis l'App Store (il doit être en version SDK 57).
2. Sur ton ordinateur, dans ce dossier :
   ```bash
   npm install
   npx expo start
   ```
3. Scanne le QR code affiché avec l'appareil photo de l'iPhone (même réseau Wi-Fi).

Pour l'aperçu dans un navigateur : `npx expo start --web`.

## Où sont les choses

| Dossier | Contenu |
|---|---|
| `src/theme/` | Jetons (couleurs, typo, rayons, mouvement) et thème clair/sombre |
| `src/ui/` | Composants : verre, barre d'onglets, boutons, feuilles, illustrations, icônes |
| `src/screens/` | Les écrans (voir la table ci-dessous) |
| `src/state/` | État de démonstration et réponses simulées de Kode |
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
