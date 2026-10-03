Application mobile Dresskode : Expo SDK 57 (React Native 0.86), iOS d'abord.
Disposition validée : B « Éditorial », voir `../design/refonte/02-design-system.md`.
Apparence : couleurs de la « galerie » et typographie v1, sur les arrondis et
le verre (règles visuelles dans `../CLAUDE.md`).

## Choix du projet (à respecter)

- **Navigation : React Navigation, sans liens profonds pour l'instant.** Onglets
  (`@react-navigation/bottom-tabs`, barre maison `src/ui/TabBar.tsx`) + pile native
  sur téléphone (`src/navigation/stack.tsx`) et pile JS réglée iOS sur le web
  (`stack.web.tsx`), pour que l'aperçu web anime les transitions. Expo Router n'est pas
  utilisé : l'aperçu tourne dans une iframe où l'historique du navigateur est bloqué.
  Passer à Expo Router quand on branchera les liens profonds et les notifications.
- **Styles : NativeWind 4** (Tailwind 3). Les couleurs sont des variables CSS posées à la
  racine par `ThemeProvider` depuis `src/theme/palette.json` ; `bg-paper`, `text-ink`…
  suivent donc le thème. N'écris pas de couleur en dur : ajoute un jeton.
- **Toute nouvelle couleur de texte** doit être ajoutée aux couples de
  `../design/refonte/contraste.py`, qui doit rester vert (`python3 ../design/refonte/contraste.py`).
- **Verre** : `src/ui/Glass.tsx` pour la couche de navigation (flou, Liquid
  Glass sur iOS 26) ; `glassSurface()` pour les cartes (blanc translucide,
  filet fin, ombre douce). Rayons dans `theme/tokens.ts` (`radius`), ombres
  dans `material`. Halos crème très discrets derrière (noirs en sombre) : `src/ui/Ambient.tsx`.
- **Beurre** : `<Card className="bg-butter">` passe son contenu en clair
  (`LightScope`), pour garder texte et boutons noirs sur le beurre en sombre.
- **Polices** : par rôle, depuis `src/theme/fonts.ts` (`...F.s500`), jamais
  un nom de fichier.
- **Animations** : Reanimated 4 (pas Moti, qui dépend de framer-motion 6 et suit mal Reanimated 4).
- **Données** : l'état vit dans `src/state/store.tsx` ; connecté, chaque action passe
  aussi par Supabase (`src/state/remote.ts`). Sans compte ou en démonstration (Alice,
  37 pièces), tout reste sur le téléphone. Le profil est dans `src/state/profile.ts`,
  les tenues composées pour n'importe quel dressing dans `src/state/outfits.ts`.
- **Photos** : `expo-image-picker`. Compte connecté : les photos partent dans le bucket
  `uploads`, une tâche `ai_jobs` par photo réveille l'agent `dressy-agent`, et l'écran
  d'ajout suit Kode (`src/state/jobs.ts`, scan de repérage et détourage révélé dans
  `src/ui/scan.tsx`) ; les pièces rangées gardent leur vignette détourée (`Piece.image`).
  Sans compte, la reconnaissance est simulée, comme l'analyse de silhouette. Les textes
  de permission sont dans `app.json`.
- **Données du jour** : météo, fériés, vacances scolaires, tendances, fête
  du jour arrivent de la fonction `donnees` (`remote.loadContexte`), jamais
  d'une API externe appelée depuis l'app. L'état les garde (`contexte`, aussi
  sur le téléphone pour le hors-ligne) et les relit au lancement, au
  changement de ville et au retour dans l'app après une heure. `useMeteo()`
  donne la vraie météo à un compte connecté, la simulée en démonstration.
  Chaque donnée affichée porte sa source et son heure (`ui/Credit.tsx`).
- **Mouvement** : les moments forts (scan, détourage, cintre qui tombe, tenue qui
  s'assemble, « Je la porte », vignette qui s'ouvre, nom de l'onglet actif, fil du
  questionnaire, anneau de Kode par étape) sont tous
  coupés par « Réduire les animations » (`useReducedMotion`).

## Commandes

```bash
npx expo install <paquet>   # jamais npm install directement : versions compatibles SDK 57
npx expo start              # Expo Go sur le téléphone (même Wi-Fi), ou « w » pour le web
npx tsc --noEmit            # typage
npx expo export --platform web
```

Hors ligne (réseau bloqué vers api.expo.dev), préfixer `npx expo install` par `EXPO_OFFLINE=1`.
