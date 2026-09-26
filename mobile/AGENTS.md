Application mobile Dresskode : Expo SDK 57 (React Native 0.86), iOS d'abord.
Direction de design validée : B « Éditorial » — voir `../design/refonte/02-design-system.md`.

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
- **Verre** : `src/ui/Glass.tsx`, uniquement pour la couche de navigation.
- **Animations** : Reanimated 4 (pas Moti, qui dépend de framer-motion 6 et suit mal Reanimated 4).
- **Données** : démonstration en mémoire (`src/state/store.tsx`, `src/data/wardrobe.ts`).
  Deux comptes : « nouveau » (créé par l'onboarding, dressing vide ou rempli pendant
  l'onboarding) et « demo » (Alice, 37 pièces). Le profil est dans `src/state/profile.ts`,
  les tenues composées pour n'importe quel dressing dans `src/state/outfits.ts`.
  Le branchement Supabase (tables `garments`, `outfits`, fonction `kode`) reste à faire.
- **Photos** : `expo-image-picker`. L'analyse de silhouette et la reconnaissance des
  pièces sont simulées dans l'aperçu ; les textes de permission sont dans `app.json`.

## Commandes

```bash
npx expo install <paquet>   # jamais npm install directement : versions compatibles SDK 57
npx expo start              # Expo Go sur le téléphone (même Wi-Fi), ou « w » pour le web
npx tsc --noEmit            # typage
npx expo export --platform web
```

Hors ligne (réseau bloqué vers api.expo.dev), préfixer `npx expo install` par `EXPO_OFFLINE=1`.
