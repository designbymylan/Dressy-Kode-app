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
  `billing`, `stripe-webhook`, `donnees`).
- **Données du jour** (météo, fériés, vacances scolaires, tendances…) :
  `supabase/functions/_shared/donnees/` (une source par fichier, cache
  partagé `data_cache`, chaîne de repli ; voir son `README.md`). L'app les
  reçoit par la fonction `donnees`, Kode les lit avec la question. Aucune API
  externe n'est appelée depuis l'app, et toute donnée affichée porte sa
  source et son heure de mise à jour (`mobile/src/ui/Credit.tsx`).

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
- **L'apparence** : la direction « galerie » (voir plus bas, décidée le
  02/10 à partir de la charte `design/charte-galerie.md`), la même sur le web
  et sur le mobile. Elle remplace la « vitrine de verre ».
- Ne rajoute ni dépendance, ni skill, ni service externe sans demander.

Changements de disposition validés par l'utilisateur (29/09), à garder :

- **Ajout d'une pièce (mobile, compte connecté)** : la galerie fictive
  « Photos récentes » laisse place au champ « Seulement certaines pièces ? » ;
  la galerie accepte jusqu'à 10 photos d'un coup.
- **Dressing web** : une vignette ouvre la fiche de la pièce, qui naît de la
  vignette, avec « Composer une tenue avec » (`DressingRails.tsx`).
- **Barre d'onglets (web et mobile)** : plate, collée en bas ; l'onglet
  actif montre son icône pleine et son nom dessous (décision du 02/10, qui
  remplace le point liquide du 29/09). Kode reste au centre, en rond.

Git : chaque étape terminée et vérifiée est commitée et poussée sur GitHub
aussitôt, sans attendre la fin de la demande.

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
cd web && npm run test:donnees                 # chaque source de données, contre la vraie API

node tools/serve.mjs                           # maquettes sur http://localhost:4173
```

`npm run dev` (web) plante parfois (`__webpack_modules__[moduleId] is not a
function`) : en cas de doute, c'est `npm run build && npm start` qui fait foi.

## Design : ce qui fait foi

Ordre de priorité, du plus fort au plus faible :

1. **L'apparence « galerie »** : `web/src/app/globals.css` pour le web ;
   `mobile/src/theme/` (`palette.json`, `tokens.ts`, `fonts.ts`) et les
   composants de `mobile/src/ui/` pour le mobile. Les deux doivent rester
   cohérents. La charte d'origine est dans `design/charte-galerie.md` (on en
   reprend le style, jamais le nom ni la marque).
2. **La disposition des écrans mobiles** : `mobile/src/screens/` et
   `design/refonte/` (recherche, design system, parcours).
3. **Les maquettes Claude Design** (`design/_projet/*.dc.html`) pour le
   contenu et les fonctions d'un écran que ni l'app ni la refonte ne
   couvrent. Leur apparence est remplacée par la galerie.
4. **Le brief v0.2** (`Brief_Dresskode_Claude_Design.docx`) pour le reste.
   Sa typographie est périmée.
5. Les skills de design, en dernier (voir plus bas).

### Règles visuelles (galerie)

- Une galerie : fond blanc (`#ffffff`), texte noir, filets gris clair d'un
  pixel (`#e9e9e9`) pour séparer, beaucoup de blanc. Pas de halos, pas de
  verre, pas de dégradé, **aucune ombre**.
- Une seule couleur : le **beurre** (`#faedbc`), réservé aux bandeaux de
  service (messages de Kode, offres, informations). Le reste est noir, blanc
  et gris. Gris studio (`#f3f3f3`) pour les vignettes de vêtements et les
  champs de saisie.
- **Angles droits partout** (cartes, vignettes, boutons, champs, feuilles,
  puces). Une seule forme ronde : le bouton de Kode au centre de la barre
  d'onglets (et les avatars).
- Boutons : l'action principale en noir plein, angles droits, libellé en
  capitales ; les autres en simple filet ou en texte en capitales, fond
  transparent. Liens de découverte : capitales + petite flèche noire.
- Typographie : **Helvetica Neue** (iPhone) et Helvetica/Arial (web), à la
  place de HelveticaNow (payante). Polices appelées par rôle (`Sans400`…
  `Sans700`, `Accent`) via `mobile/src/theme/fonts.ts`. Libellés, navigation
  et petites capitales en **13 px, graisse moyenne, sans interlettrage** ;
  texte courant 15 px ; titres modérés, sans italique ni serif. Jamais sous
  11,5 px.
- **Mode sombre tiré de la charte** : fond noir, texte blanc, filets gris
  foncé, beurre conservé (texte noir dessus). Chaque écran marche en clair
  **et** en sombre.
- Couleurs uniquement par les jetons : variables CSS sur le web
  (`var(--ink)`, `var(--rule)`…), `useTheme().c` ou classes NativeWind
  (`bg-paper`, `text-ink2`…) sur le mobile. Jamais de code hexadécimal dans un
  composant, sauf pour une couleur qui ne suit pas le thème (teinte d'un
  vêtement, aperçu de thème). Le gris inactif (`#aaaaaa`) ne sert jamais au
  texte courant.
- Vêtements : illustrations vectorielles plates ou détourages de Kode, posés
  sur gris studio dans des cadres droits ; jamais de photo produit, pas de 3D.
- Icônes : noires et monochromes, au trait, **pleines quand actives**, des
  formes qui se comprennent sans leur nom. Dans la barre d'onglets, seul
  l'onglet actif affiche son nom ; tous gardent leur libellé pour les
  lecteurs d'écran.
- Mouvement : discret (fondus, ressorts courts), jamais bloquant, coupé par
  « Réduire les animations ».
- Accessibilité : contraste AA (`contraste.py` après toute retouche de
  palette), cibles tactiles de 44 pt minimum, focus clavier visible, libellés
  pour les lecteurs d'écran.

### Comment c'est codé

- **Mobile** : NativeWind (classes branchées sur les jetons de
  `palette.json`), Reanimated, react-native-svg. Réutilise `mobile/src/ui/`
  (`Glass` (surface plate), `Button`, `IconButton`, `Card`, `Group`, `Row`,
  `Chip`, `Segmented`, `Sheet`, `TabBar`, `T`…) avant de créer un composant.
  Les icônes sont les SVG de `ui/Icon.tsx`. L'état est dans
  `state/store.tsx`, le pont Supabase dans `state/remote.ts`.
- **Web** : styles en ligne + `globals.css` (classes `.glass`, `.btn`,
  `.chip`, `.segment`…). Réutilise `web/src/components/ui.tsx` (`Screen`,
  `Title`, `Card`, `buttonPrimary`…). Pas de Tailwind, pas de shadcn/ui, pas
  de bibliothèque d'icônes (Lucide, Iconify…), pas de kit d'interface (le
  dock magnétique proposé le 02/10 a été écarté : web seulement, souris
  seulement, contraire à la charte).

## Skills de design

Les skills de `.claude/skills/` sont des conseillers, pas des chefs. **En cas
de conflit avec ce fichier, ce fichier gagne.** Ne reprends jamais leurs choix
techniques ou visuels (Tailwind, Lucide, Recharts, palettes) sans demander.

- `dressy-design` : la méthode maison pour passer d'une maquette à un écran
  web vérifié. Elle a été écrite pour `web/` avant la galerie : sa partie
  couleurs et polices (sable, lilas, beurre, Gambarino) est **périmée** ;
  garde sa méthode, suis les règles visuelles de ce fichier.
- `expo-native-ui` : s'applique à `mobile/`. Reste sur les choix déjà en place
  (NativeWind, Reanimated, SVG maison) ; pas de verre ni de Liquid Glass.
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
- Chaque attente a son animation : `loading.tsx` des routes (squelettes gris
  studio), anneau `.spinner` dans un bouton qui attend, `KodeThinking` quand
  Kode travaille.
- Mode conseil : « tu pourrais », jamais « tu dois ».
- Prix à la française : `12,99 €`.
- Aucune marque de vêtement, enseigne ou logo réel.
- Jamais de pop-up : les offres apparaissent en contexte, les feuilles ne
  s'ouvrent que sur un geste.
- Les noms « Dresskode » et « Kode » ne changent pas.

## Sécurité et données

- Les clés secrètes (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`, et le facultatif
  `DATA_USER_AGENT`) vivent dans
  Supabase > Edge Functions > Secrets, **jamais dans le code** ni dans un
  fichier commité, et ne se collent jamais dans une conversation.
- `mobile/.env` et `web/.env.local` ne portent que l'URL du projet et la clé
  **publishable** : tout ce qui commence par `EXPO_PUBLIC_` ou `NEXT_PUBLIC_`
  finit dans l'app installée. C'est la RLS qui protège les données.
- Côté serveur, authentifie avec `supabase.auth.getUser()` et non
  `getSession()` : seul `getUser()` revalide le jeton.
- Schéma : `supabase/migrations/`. Toute modification passe par une nouvelle
  migration, dont le nom de fichier reprend la version appliquée au projet.
- Edge Functions : `kode`, `billing` et `donnees` avec vérification JWT,
  `stripe-webhook` et `dressy-agent` sans (signature Stripe, déclencheur
  interne).
