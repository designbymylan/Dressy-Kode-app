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
- **Fidélité avant tout** (04/10) : Opus 5 relève les vraies teintes (`hex`)
  et les marquages visibles (logos, bandes, textes), qui sont reproduits tels
  quels sur le dessin. Le fond du dessin s'éloigne des teintes de la pièce :
  blanc, vert ou magenta (détourage par chrominance, sans liseré) ; le gris
  est réservé aux métaux. La teinte mesurée devient celle de la pièce.
- **Recherche du modèle** (04/10) : quand Opus 5 reconnaît une marque ou un
  modèle (certitude moyenne ou forte, jamais sur une simple supposition) et
  juge qu'une recherche aidera, Claude cherche le vrai modèle sur le web
  (`web_search`, `web_fetch`) avant la consigne, et le générateur s'appuie
  sur une recherche Google d'images. La marque sert au dessin, jamais au nom
  de la pièce ni à l'écran. Recherche payée à la requête : quatre au plus.
- **L'étiquette se corrige** dans la fiche pièce (`ui/LabelEditor.tsx`) :
  nom, catégorie, couleur, matière, saison, prix.
- **Aucune pièce d'exemple dans un espace utilisateur** (décision du 03/10) :
  un nouvel espace est vide, avec sa structure (portants, catégories, appel à
  ajouter). Seul le compte de démonstration (Alice) a des pièces dessinées.
  Les photos du questionnaire restent sur le téléphone puis partent chez
  Kode dès que le compte existe (`sendPending`, `state/store.tsx`) ; sans
  compte, elles attendent et la création du compte est proposée.

Ce qui ne bouge pas sans décision explicite de l'utilisateur :

- **La disposition de l'app mobile** (écrans, sections, parcours, ordre des
  blocs) : c'est celle de la refonte (`design/refonte/`, `mobile/src/screens/`).
  On peut retoucher l'apparence d'un écran sans changer sa structure.
- **L'apparence** : les couleurs de la « galerie » (charte
  `design/charte-galerie.md`, 02/10) et la typographie v2 (09/10), sur les
  formes de la « vitrine de verre » : arrondis, verre dépoli, transparence
  (décision du 03/10). La même sur le web et sur le mobile.
- Ne rajoute ni dépendance, ni skill, ni service externe sans demander.
  (Accordés le 03/10 : `expo-updates` et le service Expo EAS Update, pour
  essayer l'app dans Expo Go sans ordinateur.)
- **Décision du 03/10, appliquée le jour même** : les **arrondis**, l'**effet
  de verre dépoli** et la **transparence** façon iOS (barre d'onglets, feuilles,
  cartes, boutons) sont là pour de bon, sur le web et le mobile. Une nouvelle
  charte change les couleurs et les typographies, jamais ces trois choses.
- **Typographies** : la charte typographique v2
  (`design/charte-typographique-v2.md`, décidée le 09/10, Inter Tight et
  Inter) fait foi ; la v1 (Cormorant, Hanken, DM Mono) n'est plus. Polices
  rangées dans `mobile/assets/fonts/` (.ttf) et `web/public/fonts/` (.woff2),
  licences OFL à côté, branchées par `mobile/src/theme/fonts.ts` et des
  `@font-face` locales dans `globals.css`, jamais par un service externe.

Changements de disposition validés par l'utilisateur (29/09), à garder :

- **Ajout d'une pièce (mobile, compte connecté)** : la galerie fictive
  « Photos récentes » laisse place au champ « Seulement certaines pièces ? » ;
  la galerie accepte jusqu'à 10 photos d'un coup.
- **Dressing web** : une vignette ouvre la fiche de la pièce, qui naît de la
  vignette, avec « Composer une tenue avec » (`DressingRails.tsx`).
- **Barre d'onglets (web et mobile)** : une capsule de verre qui flotte en
  bas (03/10). **Décision du 04/10 (mobile)** : retour au dessin du 02/10,
  icônes au trait sans nom, un petit point sous l'onglet actif, Kode au
  centre en rond noir surélevé avec son étincelle. Le web garde pour
  l'instant l'icône pleine et son nom, à aligner.

**Décision du 04/10 : le design du 02/10 revient sur le mobile** (composants,
barre d'onglets, icônes, boutons, vignettes, toast, liens de section), avec
la typographie v1 et les couleurs de la galerie. Seuls ces deux points
gardent la galerie ; tout le reste suit le 02/10 (commit `76c2e5a`).

**Décision du 05/10 : la « version cartes » sur le mobile** (canevas
https://claude.ai/artifact/UT4Lmsxi88ummsePw9a3qM, validé par l'utilisateur,
commit `6767f94`). Elle remplace la disposition de la refonte là où elles
diffèrent ; couleurs, typographie, verre et arrondis ne changent pas.

- **En-tête en capsule** : une capsule de verre flotte en haut de chaque
  écran (`TabHeader` pour les onglets, `StackHeader` pour les écrans
  empilés, `ui/layout.tsx`) : le mot de la page en Cormorant ou la marque,
  un compteur en DM Mono, des actions rondes.
- **Cartes à étiquette** : chaque bloc est une carte de verre ouverte par
  une étiquette à point (`Tag`, `ui/bits.tsx`) ; les informations courtes
  passent en puces à point (`DotChip`) ; les vues se basculent par des
  onglets soulignés (`UnderlineTabs`, `ui/controls.tsx`).
- **Garde-robe** (inspirée des apps de garde-robe) : catégories en ronds,
  grille par défaut, vignettes à étiquette (« Nouveau », « Jamais portée »)
  et ports en DM Mono ; « Habille-moi » en rangées par emplacement, avec
  cadenas et « Mélanger ».
- **Fiche pièce** : la pièce sur une scène gris studio, un panneau de verre
  posé dessus (nom, ports, coût par port, flèche « Composer avec »).
- **Kode** répond dans un bandeau rose poudré ; ses suggestions sont des
  puces. **Bienvenue** et **Offres** suivent une page de vente : grand
  titre, deux boutons empilés, cartes.
- **Moins de texte** : un titre, des chiffres, un ou deux boutons ; plus de
  sur-titre en capitales espacées ni de phrase d'explication sous un titre.
- **Kode reste au centre de la barre d'onglets** (confirmé le 05/10).

**Retouches du 06/10, demandées par l'utilisateur :**

- **Capsule d'en-tête** : un encadrant bien visible au repos (verre dense,
  filet clair, sur le modèle de celle de Moi), qui s'allège quand on
  descend et reprend sa couleur en remontant (`HeaderShell`,
  `ui/layout.tsx`). Toujours floutée : rien ne se superpose en net sous un
  titre.
- **Tenue du jour en rangées, de la tête aux pieds** (sur le modèle
  « Dress me ») : visage et cou (lunettes, boucles, collier, foulard),
  veste, haut, bas, chaussures, sac ; la pièce au centre, ses voisines
  coupées par le bord ; toucher une voisine la prend, le cadenas la garde
  pour « Une autre » (`DressRows`, `ui/outfit.tsx`).
- **Agenda** : le calendrier de la semaine est l'élément central (date,
  météo, températures, rendez-vous), une carte par sujet dessous.
- **Accueil, une forme par section** (canevas
  https://claude.ai/artifact/D6Y93CiR4UXrrp6djzxXcc, validé le 06/10) :
  la tenue du jour est une section comme les autres, qu'on monte, descend
  ou masque dans Personnaliser. « Ta semaine » réunit météo et tenues
  prévues, en grand (titre Cormorant, barre de 7 jours, une carte par
  jour, pointillés pour « Prévoir », « Compléter avec Kode ») ; Kode est une
  bulle rose poudré ; À redécouvrir, des arches ; Tendance, une page de
  magazine aux ronds chevauchés ; Le plus porté, un classement à barres ;
  Nouveautés, une mosaïque ; Prêts en cours, des tickets à talon ; Ton
  mois, un bloc plein. Couleurs, polices, verre et arrondis ne changent
  pas. Dans Personnaliser, chaque section a son pictogramme ; les
  affichées passent avant les masquées et une flèche ne saute jamais une
  section masquée, pour que chaque geste se voie à l'accueil
  (`normalizeModules`, `state/store.tsx`).
- **Bande derrière l'heure** : sur les onglets, une bande floutée de la
  couleur du fond (`ScrollEdge`) cache la page qui passe sous la barre
  d'état. Depuis le 07/10, les écrans empilés l'ont aussi (`StackHeader`).

**Demandes du 07/10 (planification, voyages, notifications, photos) :**

- **Planning** (`screens/Planning.tsx`) : un grand calendrier mois par mois,
  vide ou non, ouvert depuis « Ta semaine » et l'Agenda ; un jour montre sa
  météo, ses rendez-vous et sa tenue. « Choisir des jours pour Kode » : la
  personne touche les jours, Kode prépare une tenue pour chacun.
- **Rendez-vous détaillés** (`screens/EventEdit.tsx`, `state/planning.ts`) :
  heure, type (entretien, premier rendez-vous, repas de famille, mariage…),
  importance, tenue voulue, ce qu'on veut dégager, lieu, contraintes, note.
  Tout part chez Kode.
- **Kode prévoit plusieurs jours** : action `planifier` de la fonction
  `kode` (rendez-vous, météo de chez soi ou du lieu, tenues voisines), avec
  une culture de styliste dans sa consigne (couleurs, coupes, matières,
  dress codes, occasions, impression à donner : `kode/prompt.ts`). Sans
  compte ou sans réponse, `state/planifier.ts` prend le relais.
- **Voyages** (`screens/TripScreen.tsx`) : destination cherchée dans le
  monde, dates, motif, activités ; photo libre du lieu et météo jour par
  jour (fonction `donnees`, actions `lieux` et `voyage`) ; une tenue par
  jour, modifiable, et la valise qui en découle.
- **Notifications** : la question se pose en contexte (étape « Kode te
  prévient ? » du questionnaire, carte du planning, réglage dans Moi) avec
  trois réponses : tout, seulement le planning, non. La fenêtre de l'iPhone
  ne s'ouvre qu'après un oui. Rappels locaux (`state/rappels.ts`,
  `expo-notifications`, ajouté le 07/10 pour cette demande) : rien ne part
  d'un serveur. Les e-mails attendent le choix d'un service d'envoi.
- **Vraies pièces photographiées** : les photos envoyées sont détourées par
  `tools/detour-photos.cjs` dans `mobile/assets/pieces/` et montrées par
  `image: 'photo:<clé>'` (`data/photos.ts`) : portant de l'accueil, carte
  de style Urbain, dressing de démonstration. Les autres cartes de style
  gardent leurs dessins en attendant d'autres photos.
- **Les marques sur les vêtements** (décision du 07/10) : un vêtement de
  marque, d'exemple ou de figuration, se montre tel qu'il est, logo et
  inscriptions compris. Pas de censure sur l'image ; les textes de l'app ne
  nomment toujours aucune marque.

**Demandes du 07/10 (Moi, profil, réglages, offres, boutique), sur les
modèles envoyés (applis de banque, page d'abonnement, page de réglages) :**

- **Une action propre à chaque onglet** : l'icône Personnaliser n'est qu'à
  l'accueil ; Moi porte la roue des Réglages ; Dressing, recherche et
  ajout ; Agenda, le mois. Personnaliser ne règle plus que l'accueil.
- **Moi** (`screens/Me.tsx`) : la photo et le nom choisi en
  haut, les chiffres en grand, quatre raccourcis ronds, la carte de membre
  (offre, places, questions, noire en clair et blanche en sombre), « Ton
  style » (styles, couleurs aimées et évitées, tailles, précision de Kode),
  le plus porté.
- **Profil** (`screens/ProfileEdit.tsx`) : photo (appareil ou galerie,
  bucket privé `uploads`, `<space_id>/avatar-…`, lien signé), prénom, nom,
  pseudo unique, ce qui s'affiche (prénom, prénom et nom, pseudo), styles,
  couleurs, tailles, ville. Migration `profil_visible`.
- **Réglages** (`screens/Settings.tsx`) : carte du profil, notifications,
  apparence (thème, grille, verre, gardés d'un lancement à l'autre), compte,
  aide, sortie en capsule.
- **Offres et Boutique** : remplacées le 09/10 (voir plus bas). Restent
  valables : la galerie seule palette (ni bleu ni vert anis des modèles),
  pas de faux avis ni de « la plus choisie » sans chiffres, une remise
  affichée arrondie vers le bas, un prix à la semaine vers le haut.

**Décision du 09/10 : la nouvelle base** (canevas
https://claude.ai/artifact/JrJosA6gj1EEw9wH29gtM2, validé par
l'utilisateur, commit `e1351e6`). Elle sert de base à toute l'app ;
couleurs de la galerie, verre et arrondis ne changent pas.

- **Offres et Boutique copient la page d'abonnement envoyée** : rond de
  fermeture, trait chromé en haut, promesse en grand (« −29 % sur
  l'année », « À l'unité, dès 0,99 € »), « Ce qui est inclus » en deux
  cartes, mois ou année, lignes à cocher avec prix barré, cartes de
  réassurance qui défilent, bouton noir fixe en bas (`ui/shop.tsx`). Elles
  suivent le thème clair ou sombre. **Plus aucune pastille ni patch de
  réduction** : l'économie se lit par le prix barré. Découverte se
  retrouve par un lien en bas des offres.
- **Typographie v2** : Inter Tight fin pour les titres et les grands
  chiffres, Inter 500 pour le texte ; sept tailles proportionnées de 11 à
  30 px (48 pour la seule promesse des offres) ; titres en casse normale.
- **Codes des grandes enseignes** (Zara, Stradivarius) : étiquettes de
  carte et liens de section en capitales espacées (`T v="label"`, `Tag`),
  rayons du dressing en texte souligné, noms de pièces en capitales sous la
  vignette. Cela remplace « plus de sur-titre en capitales espacées » du
  05/10 pour ces étiquettes courtes (deux ou trois mots).
- **Icônes chromées** : chaque icône noire, grise ou blanche est tracée d'un
  dégradé métal tiré de sa couleur (`chromeStops`, `ui/Icon.tsx`) ; une
  icône de couleur reste pleine (`flat` pour forcer). Tailles modestes.
- **Rien de trop gros** : sections, images et icônes à taille mesurée
  (Moi : photo à côté du nom, raccourcis de 48 px).

Git : chaque étape terminée et vérifiée est commitée et poussée sur GitHub
aussitôt, sans attendre la fin de la demande.

## Commandes

```bash
# App mobile
cd mobile && npx tsc --noEmit                  # vérification des types
cd mobile && npx expo start                    # Expo Go (--clear après un changement de .env)
cd mobile && EXPO_OFFLINE=1 npx expo install <paquet>   # ajouter une dépendance compatible SDK 57
cd mobile && npm run apercu                    # EAS Update : publie dans Expo Go (EXPO_TOKEN requis, voir mobile/README.md)
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

1. **L'apparence (galerie et verre)** : `web/src/app/globals.css` pour le web ;
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

### Règles visuelles (galerie et verre)

- Fond blanc (`#ffffff`), texte noir, filets gris clair (`#e9e9e9`),
  beaucoup de blanc. Derrière, des **halos crème** très discrets qui dérivent
  lentement (gris clair par temps de pluie), **noirs en mode sombre**, sans
  aucun jaune : c'est eux que le verre laisse voir (décision du 03/10).
- **Le verre** (03/10) : cartes en blanc translucide, filet fin, ombre douce ;
  la couche de navigation (barre d'onglets, en-têtes, boutons flottants,
  feuilles) floutée, en vrai Liquid Glass sur iOS 26 (`ui/Glass.tsx`,
  `.glass` sur le web). « Verre plus opaque » repasse en surfaces pleines.
- **Les arrondis** (03/10) : cartes 28, vignettes 22, feuilles 32 ; tout ce
  qui se clique est en capsule (boutons, puces, sélecteurs, champs) ; boutons
  icônes et Kode en rond.
- Une seule couleur : le **rose poudré pâle** (`#f8e9e4`, adouci du beurre
  `#faedbc` le 03/10 ; le jeton garde le nom `butter`), réservé aux bandeaux
  de service (messages de Kode, offres, informations), avec texte noir en
  clair comme en sombre. Le reste est noir, blanc et gris. Gris studio
  (`#f3f3f3`) pour les vignettes de vêtements et les champs de saisie.
- Boutons (02/10, revenus le 04/10) : l'action principale en capsule noire
  avec son ombre, libellé en casse normale ; les autres en capsule de verre,
  en pastille ou en texte gris. Liens de section (« Tout voir »,
  « Agenda ») : texte gris discret, sans flèche.
- Typographie (charte v2, 09/10) : **Inter Tight** 300 pour les titres
  d'écran (casse normale, légèrement resserrés), les grands chiffres et la
  promesse des offres, 400 pour la marque (DRESSKODE, capitales espacées de
  0,3 em) et les titres de carte ; **Inter** 500 pour le texte (15 px), 600
  pour l'insistance et les boutons (15 px) ; **étiquettes** en Inter 500,
  11 px, capitales espacées de 0,08 em (deux ou trois mots, jamais du texte
  lu). Polices appelées par rôle : `F.s400`… `F.display`, `F.mono`, et les
  variantes de `T` (`label`, `kicker`, `body`…) sur le mobile ; variables
  `--font`, `--font-display`, `--font-mono` sur le web. Titres sur 3 lignes
  au plus. Rien sous 11 px. Les fichiers sont réduits au latin : pour
  régénérer une police, voir la fin de la charte v2.
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
  sur gris studio dans des vignettes arrondies ; jamais de photo produit, pas
  de 3D.
- Icônes : au trait (jeu du 02/10 sur le mobile), des formes qui se
  comprennent sans leur nom, avec un reflet chromé depuis le 09/10 (dégradé
  métal sombre en clair, clair en sombre). Dans la barre d'onglets mobile,
  l'onglet actif se signale par un point ; tous gardent leur libellé pour
  les lecteurs d'écran.
- Mouvement : discret (fondus, ressorts courts), jamais bloquant, coupé par
  « Réduire les animations ».
- Accessibilité : contraste AA (`contraste.py` après toute retouche de
  palette), cibles tactiles de 44 pt minimum, focus clavier visible, libellés
  pour les lecteurs d'écran.

### Comment c'est codé

- **Mobile** : NativeWind (classes branchées sur les jetons de
  `palette.json`), Reanimated, react-native-svg. Réutilise `mobile/src/ui/`
  (`Glass` (verre flouté), `TabHeader`, `StackHeader`, `Button`,
  `IconButton`, `Card`, `Tag`, `DotChip`, `Group`, `Row`, `Chip`,
  `UnderlineTabs`, `Sheet`, `TabBar`, `T`…) avant de créer un composant.
  Les icônes sont les SVG de `ui/Icon.tsx`. L'état est dans
  `state/store.tsx`, le pont Supabase dans `state/remote.ts`.
  **Jamais de `className` sur un composant animé** (`Animated.View`,
  `Animated.Text`…) **ni sur `Tap`** : sur iPhone, NativeWind y fusionnait le
  style fixe et le style animé, et Reanimated ne gardait que l'animé (feuilles
  transparentes, tenues en vrac, constaté le 03/10). Ces composants prennent
  leur style par `style`, avec les jetons de `useTheme().c`. Le navigateur ne
  montre pas ce bug : seul un vrai iPhone (Expo Go, `npm run apercu`) fait foi.
  **Jamais d'animation `exiting` (Reanimated)** : sur iPhone, une vue en
  sortie peut rester montée, invisible, et bloquer les touches dessous
  (Reanimated #10275 ; bouton « Entrer » mort le 03/10). Une entrée animée
  suffit ; une sortie se fait à la main (`withTiming` puis démontage, voir
  `ui/Sheet.tsx`). Sur iPhone, les feuilles s'ouvrent dans une `Modal`
  native (sinon elles passent sous les écrans présentés en modale) ; le
  portail ne sert qu'à l'aperçu web.
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
  (NativeWind, Reanimated, SVG maison) ; le verre passe par `ui/Glass.tsx`.
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
- Aucune marque de vêtement ni enseigne dans les textes. Sur l'image d'un
  vêtement de marque, le logo reste visible tel quel (décision du 07/10).
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
