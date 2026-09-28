# Dressy, consignes pour Claude

Dressy (appelée **Dresskode** dans l'app et le brief v0.2) : garde-robe
numérique et styliste IA, **Kode**. Projet entièrement en français :
interface, textes, commentaires, documentation.

## État du projet

Deux applications, un seul projet Supabase :

- **`mobile/` : l'app iPhone (Expo SDK 57, React Native, NativeWind,
  Reanimated). C'est le produit principal.** 18 écrans en clair et en sombre,
  branchés sur Supabase quand `mobile/.env` existe (voir `.env.example`),
  en démonstration sans réseau sinon. Travailler sur l'app native est
  autorisé et attendu : écrans, composants, état, branchement Supabase.
- **`web/` : l'app web Next.js pensée pour mobile** (App Router, React 19,
  TypeScript, `@supabase/ssr`) : compte, dressing, tenues, Kode, paiement.
- `supabase/` : migrations, Edge Functions (`dressy-agent`, `kode`,
  `billing`, `stripe-webhook`).

Règles de base de l'agent photo (`dressy-agent`), décidées par l'utilisateur :

- **Une photo, toutes ses pièces.** Opus 5 (`claude-opus-5`) repère chaque
  pièce visible (vêtements, chaussures, sacs, bijoux, accessoires) et écrit
  une consigne par pièce pour Nano Banana. Si la personne précise ce qu'elle
  veut (« seulement la veste et le jean »), seules ces pièces sont repérées.
- Les pièces se dessinent **en parallèle** (une tâche `ai_jobs` fille par
  pièce) : la vitesse compte autant que la ressemblance.
- Chaque pièce arrive dans le dressing **sans fond** (PNG transparent,
  détouré par `cutout.ts`), jamais avec le fond de la photo ou du générateur.

Ce qui ne bouge pas sans décision explicite de l'utilisateur :

- **La disposition de l'app mobile** (écrans, sections, parcours, ordre des
  blocs) : c'est celle de la refonte (`design/refonte/`, `mobile/src/screens/`).
  On peut retoucher l'apparence d'un écran sans changer sa structure.
- **L'apparence** : la direction « vitrine de verre » (voir plus bas), la même
  sur le web et sur le mobile.
- Ne rajoute ni dépendance, ni skill, ni service externe sans demander.

## Commandes

```bash
# App mobile
cd mobile && npx tsc --noEmit                  # vérification des types
cd mobile && npx expo start                    # Expo Go (--clear après un changement de .env)
cd mobile && EXPO_OFFLINE=1 npx expo install <paquet>   # ajouter une dépendance compatible SDK 57
python3 design/refonte/contraste.py            # contraste AA de la palette mobile (doit tout passer)

# App web
cd web && npm run typecheck
cd web && npm run build                        # référence pour valider une modif
cd web && npm run test:agent                   # tests de l'agent (détourage, décisions)

node tools/serve.mjs                           # maquettes sur http://localhost:4173
```

`npm run dev` (web) plante parfois (`__webpack_modules__[moduleId] is not a
function`) : en cas de doute, c'est `npm run build && npm start` qui fait foi.

## Design : ce qui fait foi

Ordre de priorité, du plus fort au plus faible :

1. **L'apparence « vitrine de verre »** : `web/src/app/globals.css` pour le
   web ; `mobile/src/theme/` (`palette.json`, `tokens.ts`) et les composants
   de `mobile/src/ui/` pour le mobile. Les deux doivent rester cohérents.
2. **La disposition des écrans mobiles** : `mobile/src/screens/` et
   `design/refonte/` (recherche, design system, parcours).
3. **Les maquettes Claude Design** (`design/_projet/*.dc.html`) pour le
   contenu et les fonctions d'un écran que ni l'app ni la refonte ne
   couvrent. Leur apparence est remplacée par la vitrine de verre.
4. **Le brief v0.2** (`Brief_Dresskode_Claude_Design.docx`) pour le reste.
   Sa typographie est périmée (ni Archivo ni Hanken Grotesk).
5. Les skills de design, en dernier (voir plus bas).

### Règles visuelles (vitrine de verre)

- Fond perle traversé de halos pastel qui dérivent lentement (pêche, lavande,
  ciel, rose poudré) : `.ambient` sur le web, `ui/Ambient.tsx` sur le mobile.
- Surfaces en verre : cartes et vignettes en blanc translucide, filet clair,
  ombre douce, sans contour sombre ; la navigation (onglets, boutons
  flottants, feuilles, messages) en verre flouté, ou Liquid Glass sur iOS 26.
- Boutons pilule : encre pleine pour l'action principale (une par écran),
  verre clair pour le reste. Puces et segments de verre, actifs en encre.
- Titres en grotesque serré (−0,035 em), le mot qui chante en italique serif
  (Instrument Serif). Texte courant en grotesque, base 15 px, jamais sous
  11,5 px.
- Polices : **Satoshi** dans la direction. Sur le mobile, **DM Sans** la
  remplace tant que ses fichiers ne sont pas dans `mobile/assets/fonts/` ;
  les polices y sont appelées par rôle (`Sans400`…`Sans700`, `Accent`), le
  changement se fait dans `mobile/App.tsx` seulement.
- Couleurs uniquement par les jetons : variables CSS sur le web
  (`var(--ink)`, `var(--glass)`…), `useTheme().c` ou classes NativeWind
  (`bg-card`, `text-ink2`…) sur le mobile. Jamais de code hexadécimal dans un
  composant, sauf pour une couleur qui ne suit pas le thème (teinte d'un
  vêtement, aperçu de thème). Chaque écran marche en clair **et** en sombre.
- Laiton (`--hi`, `brass`) : très rare, numéros et détails seulement.
- Formes : tout ce qui se clique est en capsule (999) ; cartes 28, vignettes 22.
- Vêtements : illustrations vectorielles plates, jamais de photo produit, pas
  de 3D.
- Mouvement : ressorts courts, jamais bloquants, coupés par « Réduire les
  animations ».
- Accessibilité : contraste AA (`contraste.py` après toute retouche de
  palette), cibles tactiles de 44 pt minimum, focus clavier visible, libellés
  pour les lecteurs d'écran (y compris la barre d'onglets, qui n'affiche que
  des icônes).

### Comment c'est codé

- **Mobile** : NativeWind (classes branchées sur les jetons de
  `palette.json`), Reanimated, react-native-svg. Réutilise `mobile/src/ui/`
  (`Glass`, `Button`, `IconButton`, `Card`, `Group`, `Row`, `Chip`,
  `Segmented`, `Sheet`, `TabBar`, `Ambient`, `T`…) avant de créer un
  composant. Les icônes sont les SVG de `ui/Icon.tsx`. L'état est dans
  `state/store.tsx`, le pont Supabase dans `state/remote.ts`.
- **Web** : styles en ligne + `globals.css` (classes `.glass`, `.btn`,
  `.chip`, `.segment`…). Réutilise `web/src/components/ui.tsx` (`Screen`,
  `Title`, `Card`, `buttonPrimary`…). Pas de Tailwind, pas de shadcn/ui, pas
  de bibliothèque d'icônes (Lucide, Iconify…), pas de kit d'interface.

## Skills de design

Les skills de `.claude/skills/` sont des conseillers, pas des chefs. **En cas
de conflit avec ce fichier, ce fichier gagne.** Ne reprends jamais leurs choix
techniques ou visuels (Tailwind, Lucide, Recharts, palettes) sans demander.

- `dressy-design` : la méthode maison pour passer d'une maquette à un écran
  web vérifié. Elle a été écrite pour `web/` avant la vitrine de verre : sa
  partie couleurs et polices (sable, lilas, beurre, Gambarino) est **périmée** ;
  garde sa méthode, suis les règles visuelles de ce fichier.
- `expo-native-ui` : s'applique à `mobile/`. Reste sur les choix déjà en place
  (NativeWind, Reanimated, `expo-glass-effect`, SVG maison).
- `mobile-app-ui-design` : principes utiles (zone du pouce, hiérarchie, états
  vides, pic émotionnel). Ignore sa section « Implementation Notes ».
- `design-mobile-apps` (Sleek, service payant, clé `SLEEK_API_KEY`) : **que
  sur demande explicite**. Ne lance aucun rendu, ne crée aucune clé et
  n'envoie vers aucune page de paiement de ta propre initiative. N'y envoie
  jamais de photo d'utilisateur réel.

## Écriture (interface, code, docs, réponses)

- **Jamais de tiret cadratin (le grand tiret, U+2014)**, nulle part : ni dans l'interface, ni dans
  les commentaires, ni dans la documentation, ni dans les réponses à
  l'utilisateur. Une virgule, deux-points, des parenthèses ou un point
  médian (·) font l'affaire.

## Textes de l'interface

- Tutoiement, phrases courtes, aucun jargon technique.
- **Aucun nom de modèle ni de fournisseur d'IA à l'écran** (Claude, Opus,
  Sonnet, Gemini, Nano Banana, Anthropic, Google IA…) : c'est Kode qui
  travaille. Pendant une attente, une animation et des phrases de Kode
  (« Kode repère chaque pièce », « Kode dessine ta pièce »,
  `web/src/components/KodeThinking.tsx`). Les messages d'erreur montrés
  suivent la même règle ; le détail technique part dans les journaux.
- Chaque attente a son animation : `loading.tsx` des routes (squelettes en
  verre), anneau `.spinner` dans un bouton qui attend, `KodeThinking` quand
  Kode travaille.
- Mode conseil : « tu pourrais », jamais « tu dois ».
- Prix à la française : `12,99 €`.
- Aucune marque de vêtement, enseigne ou logo réel.
- Jamais de pop-up : les offres apparaissent en contexte, les feuilles ne
  s'ouvrent que sur un geste.
- Les noms « Dresskode » et « Kode » ne changent pas.

## Sécurité et données

- Les clés secrètes (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`) vivent dans
  Supabase > Edge Functions > Secrets, **jamais dans le code** ni dans un
  fichier commité, et ne se collent jamais dans une conversation.
- `mobile/.env` et `web/.env.local` ne portent que l'URL du projet et la clé
  **publishable** : tout ce qui commence par `EXPO_PUBLIC_` ou `NEXT_PUBLIC_`
  finit dans l'app installée. C'est la RLS qui protège les données.
- Côté serveur, authentifie avec `supabase.auth.getUser()` et non
  `getSession()` : seul `getUser()` revalide le jeton.
- Schéma : `supabase/migrations/`. Toute modification passe par une nouvelle
  migration, dont le nom de fichier reprend la version appliquée au projet.
- Edge Functions : `kode` et `billing` avec vérification JWT,
  `stripe-webhook` et `dressy-agent` sans (signature Stripe, déclencheur
  interne).
