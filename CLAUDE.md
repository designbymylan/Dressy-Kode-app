# Dressy, consignes pour Claude

Dressy (appelée **Dresskode** dans l'app et le brief v0.2) : garde-robe
numérique et styliste IA, **Kodi** (il s'appelait Kode jusqu'au 21/10 ; les
décisions plus anciennes plus bas gardent l'ancien nom). Projet entièrement
en français : interface, textes, commentaires, documentation.

## État du projet

Deux applications, un seul projet Supabase :

- **`mobile/` : l'app iPhone (Expo SDK 58, React Native, NativeWind,
  Reanimated). C'est le produit principal.** 18 écrans en clair et en sombre,
  branchés sur Supabase quand `mobile/.env` existe (voir `.env.example`),
  en démonstration sans réseau sinon. Travailler sur l'app native est
  autorisé et attendu : écrans, composants, état, branchement Supabase.
- **`web/` : l'app web Next.js pensée pour mobile** (App Router, React 19,
  TypeScript, `@supabase/ssr`) : compte, dressing, tenues, Kode, paiement.
- `supabase/` : migrations, Edge Functions (`dressy-agent`, `kode`,
  `billing`, `stripe-webhook`, `donnees`, `compte`, `menage`).
- `docs/rgpd/` : registre des traitements, analyse d'impact, politique de
  confidentialité, et ce qui reste à faire avant la sortie (`README.md`).
- **Données du jour** (météo, fériés, vacances scolaires, tendances…) :
  `supabase/functions/_shared/donnees/` (une source par fichier, cache
  partagé `data_cache`, chaîne de repli ; voir son `README.md`). L'app les
  reçoit par la fonction `donnees`, Kode les lit avec la question. Aucune API
  externe n'est appelée depuis l'app. **Décision du 05/11** : la ligne de
  crédits grise (`ui/Credit.tsx`, supprimé) ne s'affiche plus sous la météo ;
  l'attribution complète des sources et de leurs licences (CC BY 4.0 de MET
  Norway, etc.) vit à un seul endroit, « Sources des données » dans Réglages
  (`screens/Settings.tsx`) et en bas de `/confidentialite` sur le web
  (`lib/sources.ts`), à tenir à jour avec les `mention` des sources.

Règles de base de l'agent photo (`dressy-agent`), décidées par l'utilisateur
(les modèles ont changé depuis : voir « Chantier IA du 13/11 » plus bas) :

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
  jour, pointillés pour « Prévoir », « Compléter avec Kode ») ; À redécouvrir, des arches ; Tendance, une page de
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
- **Notifications** : la question se pose en contexte (carte du planning,
  réglage dans Réglages ; l'étape du questionnaire est retirée le 09/10) avec
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

**Diagnostic UX du 09/10** (page
https://claude.ai/artifact/TmpQN3Qkud1J3QnS2varVN, commit `c18dc9b`),
demandé par l'utilisateur pour lever les freins de la cible :

- **Questionnaire court** : quatre écrans avant l'app (prénom, rayon,
  style, premier portant), le compte seulement si des photos attendent
  Kode, la préparation, puis on entre. Taille, poids, silhouette, mesures,
  tailles, couleurs, quotidien, ville et âge passent dans **« Affiner »**
  (`Affiner`, `screens/Onboarding.tsx`), facultatif, ouvert depuis Moi, Ma
  silhouette et les premiers pas ; y passer une question garde la réponse
  déjà donnée. On ne redemande jamais de données intimes avant d'avoir
  montré une tenue.
- **Accueil d'une débutante** (aucune tenue possible) : la seule carte
  « Tes premiers pas » (trois pièces, ton style, aider Kode) ; les sections
  reviennent dès la première tenue.
- **Le matin en un geste** : « Je la porte » et « Une autre » en tête de la
  carte de la tenue du jour.
- **Moins de trois pièces** : Moi et l'ajout montrent le chemin vers la
  première tenue (0/3), pas de quota ni de chiffres à zéro.
- **L'offre après la première tenue** : avant, Moi ne montre ni la carte de
  membre ni la Boutique (une abonnée garde sa carte).
- **« Pas pour moi »** sous la tenue du jour (`ui/ecart.tsx`,
  `state/ecarts.ts`) : une raison facultative en un geste (style, couleurs,
  confort, météo, journée, une pièce), puis une autre tenue tout de suite.
  La tenue écartée ne revient plus, une pièce visée passe en dernier deux
  semaines ; table `outfit_feedback` (effacée après six mois), que Kode lit.
- **Bilan du dimanche** (`screens/Bilan.tsx`, `state/bilan.ts`) : la
  semaine en couleurs portées, les chiffres, la pièce de la semaine, ce qui
  dort, ce que Kode a retenu, la semaine qui vient. Carte à l'accueil le
  dimanche et le lundi, ouvert depuis Moi toute la semaine, rappel local le
  dimanche à 18 h pour qui a tout accepté. Une semaine vide se tourne vers
  la suivante, sans reproche. Ports notés par jour (table `wears`).
- **Photos en rafale** (10/10, `shootBurst`, `lib/camera.ts`) : l'appareil
  se rouvre après chaque photo jusqu'à « Annuler » (dix au plus) ; connectée,
  chaque photo part chez Kode pendant qu'on prend la suivante. Aussi au
  premier portant du questionnaire ; la démonstration garde une photo.

**RGPD (09/10)**, demandé par l'utilisateur (détail et reste à faire :
`docs/rgpd/README.md`) :

- **Silhouette avec accord** : « Affiner » commence par « Ta silhouette, en
  confiance » ; sans accord, taille, silhouette et mesures sont sautées. Le
  poids n'est plus demandé. Table `consents` (preuve datée, versionnée) ;
  retiré, la base efface tout et refuse toute nouvelle valeur.
- **Réglages › Tes données** (`screens/TesDonnees.tsx`) : ce qui est gardé,
  les accords, télécharger (fonction `compte`, JSON par lien signé),
  corriger, effacer la silhouette, supprimer le compte. **Vie privée**
  (`screens/Confidentialite.tsx`) et la page web `/confidentialite`.
- **Conservation limitée** : `menage` chaque nuit (photos 30 jours, exports
  2 jours, conversations 12 mois ou 2 si archivées, demandes de dessin 90
  jours).
- **Inscription dès 15 ans** (case et lien vers la politique, mobile et
  web) ; information au bon moment (photo effacée sous 30 jours, éviter le
  visage ; pas de santé dans une note ; Kode est une IA).

**Logo (25/10)**, demandé par l'utilisateur : **l'orbe de Kodi** remplace le
K étoilé (13/10, retiré). Une sphère lavande vers ciel avec son reflet, la
même que l'orbe au repos. Dessin : `design/logo/orbe.svg` (logo) et
`design/logo/icone-app.svg` (icône, orbe sur noir plein cadre). Web :
`components/Logo.tsx` (`Monogram`, `Wordmark mark`), `app/icon.svg`,
`app/apple-icon.png`, `app/opengraph-image.png`, `public/icons/`. Mobile :
`src/ui/Logo.tsx` (`Monogram`, `BrandMark`), icônes et écran de lancement
dans `mobile/assets/`. Le dégradé de l'orbe est permis dans le logo (il
déroge à « ni dégradé » de `design/logo/README.md`). Le mot DRESSKODE reste
en Inter Tight.

**Intro (25/10)**, demandée par l'utilisateur : à l'arrivée, une fois par
visite (web, `sessionStorage`) ou par lancement (mobile), l'orbe apparaît,
son reflet fait le tour de la sphère, DRESSKODE se resserre, puis la caméra
plonge dans l'orbe (2,7 s). Fond noir ou blanc selon le thème ; un toucher la
passe ; « Réduire les animations » la réduit à un fondu. Web :
`components/Intro.tsx` et `.intro` dans `globals.css` ; mobile :
`src/ui/Intro.tsx` (Reanimated, react-native-svg).

**Refonte du 21/10 (web), demandée par l'utilisateur** sur ses images de
référence (`Design app inspiration/`). Elle remplace, sur le web, ce qui
la contredit plus haut ; couleurs mises à part, verre, arrondis et
transparence restent. **Le mobile est aligné depuis le 22/10** (palette
dans `palette.json`, `ui/TabBar.tsx` à bosse, icônes pleines de
`ui/iconsSolid.ts` tirées du web, boutons en verre bleu, `ui/usage.tsx`
pour la progression, offres Fashion et Sapologue ; `ui/Kodi.tsx` a depuis
disparu avec la mascotte, voir plus bas, 25/10).

- **Palette** (« Palette de couleur officiel ») : fond blanc pur, texte noir
  pur ; Blue `#c4dae8` pour ce qui est choisi et l'action principale (texte
  noir), son bleu profond `#2b5f86` pour une icône ou un texte choisi (le bleu
  clair ne se lit pas sur blanc) ; Butter `#feefb8` pour les bandeaux de Kodi
  et les étiquettes (le jeton `--butter`) ; Chocopie `#432f2e` pour le rond de
  Kodi et les points forts. Contrastes en tête de `globals.css`.
- **Ce qui est choisi passe en bleu** : puces, segments, pastilles, onglet
  actif, bouton enfoncé, interrupteur.
- **Boutons « verre »** façon Apple : reflet en haut, liseré clair, ombre
  courte, libellé en casse normale (15 px, 600). L'action principale en
  verre bleu, texte noir ; les autres en verre clair ; `btn-dark` (noir)
  pour une action forte posée sur du verre.
- **Icônes pleines** (planche « Micro icons (solid) »,
  `components/icons.tsx`), chacune avec son geste au survol et à l'appui
  (`data-anim`). L'ancien composant `Icon` (`ui.tsx`) montre la version
  pleine dès qu'elle existe ; les types de bijoux ou d'accessoires sans
  version pleine restent au trait, arrondi.
- **Barre de navigation** (« Inspiration Navbar 1 ») : barre de verre
  arrondie, bosse au centre (le rond chocopie de Kodi, remplacé le 25/10
  par l'orbe, voir plus bas), petit trait au-dessus de l'onglet actif qui
  glisse, icône au trait qui devient pleine et bleue, tous les noms écrits
  (Accueil, Dressing, Kodi, Calendrier, Profil). Clair et sombre.
- ~~**Kodi, la mascotte** (`components/Kodi.tsx`) : une petite boutique
  vivante (auvent rayé bleu et blanc, crochet de cintre, corps beurre, yeux
  chocopie). Ses humeurs (`data-mood`, styles dans `globals.css`) : idle,
  wave, happy, love, thinking, listening, surprised, wink, sleepy, sad, shy,
  celebrate, talking ; ses yeux suivent le doigt, un toucher le fait réagir.
  Il est le visage de l'IA : intro, attentes (`KodeThinking`), conversation
  (`/kodi`, l'ancien `/kode` y renvoie), connexion (il se cache les yeux sur
  le mot de passe), bienvenue, accueil, dressing, erreurs.~~ Abandonnée le
  25/10, remplacée par l'orbe, voir plus bas.
- **Encoche clair / sombre** en haut à droite (`ThemeNotch.tsx`), masquable
  dans Mon compte › Paramètres ; réglage d'appareil (cookie `dk_theme_tab`).
  Depuis le 22/10, elle est posée dans la page (elle défile avec elle) et
  les écrans gardent 52 px en haut, pour ne jamais couvrir un titre.
  Un visiteur garde son thème dans le cookie `dk_theme`.
- **Barre de progression du dressing** (« Inspiration progress bar ») : la
  part des pièces portées ces 90 jours, en tout et par catégorie, dans une
  **section découpée** noire qui coule en S dans la page (« Image découpage
  de section 2 », `Cut` dans `ui.tsx`). « Je l'ai portée aujourd'hui » dans
  la fiche d'une pièce la fait avancer.
- **Mon compte** sur le modèle « Image exemple Page Profile » : photo et
  pastille d'édition, nom sur deux lignes, trois chiffres, pastille de
  l'offre, groupes de lignes à pastille de couleur, compteur et chevron, puis
  Tarifs et Paramètres.
- **Offres** (`lib/plans.ts`, `components/Pricing.tsx`, sur « App design
  price ») : **Fashion** 6,99 € par mois ou 59,99 € par an (identifiant
  `capsule`), **Sapologue** 14,99 € par mois ou 129,99 € par an
  (identifiant `atelier`) ; Couture n'est plus vendue. Tableau de
  comparaison à deux colonnes, feuille mois ou année, remise affichée
  arrondie vers le bas et prix barré. Limites dans la migration
  `offres_fashion_sapologue`. Ceci remplace « plus aucune pastille de
  réduction » du 09/10 pour les offres du web.

**Accueil mobile avant le compte (24/10), demandé par l'utilisateur** sur
deux modèles de connexion envoyés : photo de mode verticale en plein écran
(tirée au hasard parmi sept, `data/welcome.ts`, `mobile/assets/welcome/`,
issues du dossier « Image fashion ref »), et par-dessus une carte aux couleurs
de l'app (jetons du thème) : DRESSKODE, « Commencer », « Se connecter »,
Google et Apple (visibles mais désactivés, « Bientôt disponible » : la
liaison des comptes n'est pas faite), « Voir la démo ». Le portant, Kodi et
les puces de l'ancien accueil sont retirés. Remplace l'accueil du 05/10 et
du 21/10 sur le mobile.
**Même chose sur le web (25/10)** : `/bienvenue` (photo plein écran, carte,
Commencer, Se connecter) et les écrans de compte (photo en haut, carte
dessus, `AuthShell`), photos dans `web/public/welcome/`
(`PhotoBackdrop.tsx`, tirage au navigateur). Sur le web, Google et Apple
fonctionnent déjà (connexion et inscription).

**Abandon de la mascotte, l'orbe (25/10), demandé par l'utilisateur** : la
mascotte Kodi (sa boutique, ses humeurs, ses bras, ses yeux, décidée le
21/10) prenait trop de temps à entretenir et a été entièrement retirée,
web et mobile, avec ses animations (`globals.css`, `kodi-*`) et ses
composants (`components/Kodi.tsx`, `ui/Kodi.tsx`, supprimés). Il ne reste
qu'un visage à Kodi, **l'orbe** (canevas « Mouvements Dresskode »,
https://claude.ai/artifact/CP7u7B729GJzenhW6eBqNH, démonstration 7) :
une sphère qui tourne, dont la couleur dit l'étape quand il travaille
(lavande au repérage, pêche au dessin, ciel au contrôle, menthe au
rangement ; `OrbStep`, `lib/jobs.ts` et `state/jobs.ts`), posée au centre
de la barre de navigation (elle y remplace le rond chocopie), et dans
`KodeThinking` partout où Kodi réfléchit. Composants : `components/Orb.tsx`
(web, CSS, dégradé conique animé) et `ui/Orb.tsx` (mobile, même dessin par
SVG et Reanimated, le dégradé conique n'existant pas nativement). Kodi ne
se montre plus nulle part ailleurs : ni dans l'en-tête de la conversation
ni dans ses bulles, ni à la connexion, ni à l'intro, ni sur l'accueil, ni
sur les messages d'erreur ; le strict nécessaire, c'est la navigation et
le travail de Kodi, rien de plus.

**Compte créateur (01/11), demandé par l'utilisateur** : `designbymylan@gmail.com` est le seul administrateur (table `admins`, fermée au client). Son offre se nomme `createur` (`space_plan`) : pièces, Kodi et générations sans limite, aucun écran d'abonnement. Il sert à tous les essais. Migration `compte_createur`.

**Décisions du 08/11, juridique et paiement, demandées par l'utilisateur :**

- **Éditeur** : Mylan Francois, entrepreneur individuel, sous le nom commercial « Agence E-commerce Mylan Francois » (INPI). Dresskode appartient à cette agence ; c'est dit dans les conditions et la politique. Source : `mobile/src/data/legal.ts`.
- **Textes légaux** : tutoiement. Les fournisseurs d'IA (Anthropic, Google) y sont nommés : c'est une exception à la règle « Aucun nom de fournisseur d'IA à l'écran », qui vaut pour l'interface.
- **Cases à cocher** : inscription (15 ans, lecture et acceptation des conditions et de la politique), abonnement (début immédiat, rétractation réduite au temps écoulé), packs de places (renonciation à la rétractation une fois les places ajoutées). Obligatoires dans l'app et sur le site.
- **Résilier** : Réglages › « Mon abonnement » (app) ouvre le portail Stripe, où l'on résilie ; le site a « Gérer mon abonnement ».
- **Paiement** : Stripe dans le navigateur jusqu'à la licence Apple. Le paiement Apple se fera avant la soumission à l'App Store.
- **Responsabilité** : entrepreneur individuel tant que l'app n'a pas de clients avérés ; la forme juridique se reverra alors.

**L'annuel revient, page Offres refaite (08/11), demandé par l'utilisateur** sur
trois modèles envoyés (page d'abonnement à deux offres, feuille mois ou année,
pastille « Annual plan, Save 57 % »). Il remplace « au mois seulement, plus
d'annuel » du brief v6 et « plus aucune pastille de réduction » du 09/10, sur
les offres du mobile comme du catalogue partagé :

- **Prix** : Fashion **75 €** par an, Sapologue **159 €** par an (identifiants
  de prix `dressy_<offre>_an`), soit au moins 30 % sous douze mois (30,4 % et
  30,2 %). Remise affichée arrondie vers le bas (`annualOff`), prix de l'année
  ramené au mois arrondi au-dessus (`perMonth`). Source : `web/src/lib/plans.ts`
  (`cents: { mois, an }`), reprise dans `mobile/src/screens/Offers.tsx`.
- **Les générations et les questions restent remises à zéro chaque mois**, même
  pour un abonné à l'année (la base ne change pas). Découverte inchangée.
- **Écran** (`screens/Offers.tsx`, `ui/shop.tsx`) : « Passe à » puis le nom de la
  formule en grand ; sélecteur Fashion / Sapologue ; carte de prix juste dessous
  (interrupteur « Abonnement annuel » avec l'étiquette beurre « −30 % », prix
  par mois, prix du mois barré, total de l'année dit en toutes lettres) ; ce
  qui est inclus ; bouton fixé en bas (`BottomFade`). Un seul dégradé, le bleu
  de la palette (`PageGlow`), très léger en sombre. Qui n'est pas abonné arrive
  sur l'annuel ; un abonné retrouve sa période et peut passer de l'une à l'autre
  (le portail Stripe gère le prorata).
- **Paiement** : `PERIODS = ['mois', 'an']` (`_shared/billing.ts`),
  `tools/stripe-setup.mjs` crée les prix annuels (et les ajoute au portail).
  **À relancer avec la clé Stripe** pour que « S'abonner » à l'année marche.
- **Conditions générales** (version 1.2) : annuel, renouvellement annuel,
  résiliation à la fin de la période payée.
- Pas encore sur le web : `Pricing.tsx` reste au mois (la base et le paiement
  acceptent déjà l'année).

**Offres, places et générations (brief v6, 31/10), demandé par l'utilisateur.**
Remplace les prix, les limites et l'annuel du 21/10, web et mobile.

- **Deux abonnements** (l'annuel est revenu le 08/11, voir plus bas) : **Fashion 8,99 €** (`capsule`,
  50 pièces, 50 générations par mois) et **Sapologue 18,99 €** (`atelier`,
  100 pièces, 100 générations par mois, Kodi sans limite). Plus d'annuel ni
  de mois offert. Découverte : 15 pièces, 4 générations offertes à vie, sans
  renouvellement. Aucune mention de Couture. Source des montants :
  `web/src/lib/plans.ts` ; limites : `plan_limits()` et `plan_generations()`
  (migration `quotas_generation`).
- **Packs de places** (boutique) : +10 places 1,99 € (`petit`), +30 places
  4,99 € (`moyen`), paiement unique Stripe (`dressy_places_<pack>`), sans
  limite d'achats, **des places et jamais des générations**. Ils s'ajoutent à
  la limite de l'offre (`piece_limit`, table `place_packs`, créditée par le
  webhook). Plein : l'offre du dessus d'abord, les packs en option.
- **Une génération = un appel à Nano Banana** : « Image propre » (fiche
  pièce, `request_clean_image`) et la 2e reprise de « Rendu incorrect ». Le
  détourage ne consomme rien. Prise avant l'appel (`generation_reserve`),
  rendue si l'appel échoue ou est refusé (`generation_settle`), jamais
  prise si l'image est en cache (`generation_cache`, clé photo + pièce +
  modèle + version de la consigne, `quota.ts`). Aucune relance automatique.
  Modèle Lite en 1K pour Découverte, complet en 2K pour les abonnées
  (secrets `GEMINI_IMAGE_MODEL_LITE` et `GEMINI_IMAGE_MODEL`).
- **Fin des générations offertes** : un seul écran (`/generations`,
  `screens/Generations.tsx`), Sapologue en avant, Fashion en plus petit,
  « Continuer sans générer », ni pack ni prix annuel. À zéro, « Image
  propre » est éteinte et dit pourquoi. Un abonné ne voit pas le compteur
  des offertes. `FREE_GENERATION_QUOTA` (`free_generation_quota()`, 4, entre
  3 et 5) ne sort jamais de la base : le client ne lit que ce qui reste
  (`generation_status`).
- **Mesures de la bêta** : `generation_log` (offre, source, cache, modèle,
  statut, coût estimé en dollars, Anthropic et Google séparés), vues
  `generation_costs` et `generation_free_funnel`. Prix estimés réglables par
  secrets (`COST_*`). Tests : `npm run test:quotas` (SQL, base jetable),
  `test:agent`, `test:billing`.

**Accueil, calendrier et dressing du web alignés sur le mobile (03/11), demandé
par l'utilisateur.** Ses captures montraient le site, dont l'accueil se
réduisait à une carte et le calendrier à une grille de points, alors que
l'aperçu de l'app mobile (le zip « Dresskode, l'app ») avait l'accueil
complet : le web n'avait jamais eu ces écrans. Il les reprend, avec les mêmes
formes et les mêmes jetons :

- **Accueil** (`components/HomeView.tsx`, données `lib/accueil.ts`) : salut et
  puces météo, tenue du jour de la tête aux pieds (voisines, cadenas, « Une
  autre », « Je la porte », « Pas pour moi »), Ta semaine avec météo et tenues
  prévues, À redécouvrir, Tendance. Données du jour par la fonction `donnees` (2,5 s au plus : la
  page s'affiche sans elles). Le moteur de tenues est `lib/outfits.ts`, le
  même esprit que `mobile/src/state/outfits.ts`.
- **Calendrier** (`components/CalendarView.tsx`, `lib/agenda.ts`) : la semaine
  avec sa météo (l'Agenda), le mois en grand (le Planning), et sous chacun le
  jour ouvert : rendez-vous détaillés (`DayEvents`) et tenue qu'on prévoit,
  change ou retire (`DayOutfit`). « Choisir des jours pour Kodi » et
  « Compléter avec Kodi » passent par l'action `planWithKodi` (action
  `planifier` de la fonction `kode`). L'état est dans l'adresse (`?jour=`,
  `?vue=mois`, `?mois=`) ; `/tenues/nouvelle?jour=` prévoit la tenue composée.
- **Dressing** : onglets de catégories et grille de vignettes (Nouveau,
  Jamais portée, ports) par défaut, les portants à un toucher (`?vue=portants`).
- Les titres de section posés en vrac (« Ta » puis `<em>semaine</em>`) étaient
  écartés mot à mot : `SectionTitle` (`ui.tsx`) range le titre dans un seul
  élément.
- **Planches sans compte** pour contrôler ces écrans : `/apercu/accueil`,
  `/apercu/calendrier`, `/apercu/dressing`, nourries de `app/apercu/fixtures.ts`
  (fermées sauf `DRESSY_APERCU=1`).
- Pas encore sur le web : création de voyage, Personnaliser l'accueil, les
  sections optionnelles (Le plus porté, Nouveautés, Prêts, Ton mois),
  recherche et filtres du dressing, fiche d'une pièce depuis l'accueil.

**Accueil sans « Demande à Kodi » (08/11), décidé avec l'utilisateur** : la
carte (champ « Une tenue pour… » et trois questions toutes prêtes) est
retirée, mobile et web. Elle doublait ce qui existe ailleurs : Kodi est au
centre de la barre d'onglets et son écran propose déjà les mêmes questions
(`kodeStarters`) ; « Une autre », « Prévoir » et « Compléter avec Kodi » sont
sur la tenue du jour et Ta semaine ; « Ce que je ne porte jamais » est
« À redécouvrir ». Sur le mobile, le champ n'était qu'un bouton déguisé en
champ. La section disparaît de Personnaliser ; `normalizeModules` écarte
l'ancien identifiant `kode` des réglages déjà enregistrés. L'adresse
`/kodi?q=` (web) reste. À ne pas remettre sans une raison mesurée.

**Détails d'usage du 10/11 (mobile), demandés par l'utilisateur** : des
micro-interactions sur le moment clé, la tenue du matin, sans toucher à la
disposition ni aux couleurs.

- **Glisser une rangée** de la tenue du jour change la pièce (`DressRow`,
  `ui/outfit.tsx`, `react-native-gesture-handler` déjà présent) : la rangée
  suit le doigt, la nouvelle pièce entre du côté d'où elle vient. Le geste
  ne s'active que sur un mouvement horizontal (la page défile comme avant) ;
  toucher une voisine marche toujours, c'est aussi le chemin du lecteur
  d'écran.
- **Un indice, une seule fois** sous la tenue (« Glisse une rangée pour
  changer une pièce »), effacé pour de bon au premier échange (`useOnce`,
  `state/once.ts`). Tout nouvel indice de geste passe par là.
- **La série** (`serie`, `motDuPort`, `state/bilan.ts`) : « 3e jour de
  suite » dans le message de « Je la porte » et dans la carte, à partir de
  deux jours. Jamais de zéro, jamais de série perdue affichée.
- **« Une autre »** : la flèche fait un tour (`IconButton spin`) ; le cadenas
  rebondit. **Salut** : « Bonsoir » de 18 h à 5 h. **Kodi** : envoi éteint
  sans texte (`IconButton disabled`), retour haptique léger à sa réponse.
- **La récompense de « Je la porte » remonte** juste sous les boutons de
  la carte (coche, série, ports), web et mobile : plus bas, la barre
  d'onglets la cachait. Changement d'ordre des blocs validé par
  l'utilisateur le 10/11.
- **Le web est aligné le même jour** (`HomeToday.tsx`, `.dress-*` dans
  `globals.css`) : glissé par événements de pointeur (`touch-action: pan-y`),
  indice gardé dans `localStorage` (`dk_indice_rangees`), série lue dans
  `wears` (`streak`, `lib/accueil.ts`) et dite par `WornLine`, flèche qui
  tourne, cadenas qui rebondit, salut à l'heure de Paris (`parisHour`).

**Parcours du 12/11 (mobile), demandés par l'utilisateur** : ce qui
s'affiche après un geste, sur le modèle des apps de garde-robe (mélange par
glissé, conversation qui s'ajuste). Ni la disposition ni les couleurs ne
changent.

- **La tenue prévue passe en tête de l'accueil** (`tenuesDuJour`, `estPrevue`,
  `state/store.tsx`) : prévue la veille, elle est la tenue du jour, étiquetée
  « Prévue pour aujourd'hui » ; « Une autre » mène aux propositions de Kodi.
  Le site le faisait déjà (`planned0`, `lib/accueil.ts`).
- **Après « Je la porte »** : sous la récompense, « Préparer demain » (ouvre
  Habille-moi) ou « Demain est prête » (ouvre le calendrier).
- **Un message peut mener à la suite** (`ToastGo`, `navigation/ref.ts`) : un
  bouton « Voir » (pièces qui arrivent, tenue prévue). Jamais avec « Annuler ».
- **Kodi** (`screens/Kode.tsx`, `state/kode.ts`) : sous sa tenue, « Je la
  porte » si la question parle d'aujourd'hui (`pourAujourdhui`), « Prévoir
  demain » sinon ; le bouton dit ce qui est fait (« Prévue demain », lu dans
  l'agenda). Sous la dernière réponse seulement, trois puces (`KODE_SUITES` :
  « Une autre idée », « Plus habillée », « Plus décontractée »), aussi sur le
  site (`KodeChat.tsx`) ; chacune compte comme une question. « Nouvelle
  conversation » dans l'en-tête (`newChat`, fonction `kode_reset`).
- **Habille-moi** : les rangées se glissent comme à l'accueil (`SwipeRow`,
  `ui/outfit.tsx`), la pièce entre du côté d'où elle vient, même indice
  unique (`useOnce('rangees')`). « Mélanger » ne dit plus rien quand le
  changement se voit ; un message seulement si rien n'a pu bouger.
- **Dressing** : tant que Kodi dessine, une ligne beurre le dit là où les
  pièces arriveront ; dans la grille, une pièce qui arrive se pose avec
  « Vient d'arriver », une fois, quand l'onglet est devant (`PieceTile`,
  `arriving`, `hold`).
- Vérifié dans l'aperçu navigateur (19 contrôles) ; les gestes restent à
  essayer sur un vrai iPhone.

**Suite du 12/11, demandée par l'utilisateur** :

- **Tirer pour actualiser** (`usePullRefresh`, `ui/refresh.tsx`) sur Accueil,
  Dressing, Calendrier et Moi, compte connecté seulement (sans compte, il n'y
  a rien à relire, donc pas de geste). Le compte et les données du jour sont
  relus (`a.refresh`, action `resync`) sans toucher à l'écran en cours :
  tenue montrée, dessins suivis, conversation en route.
- **« Je la porte » dans le Calendrier** (`screens/Agenda.tsx`), sous la
  tenue d'aujourd'hui, prévue ou proposée.
- **Mesure de l'usage** : vue `usage_funnel` (migration `mesure_usage`), une
  ligne d'agrégats sur les données déjà en base : première tenue portée,
  retour le lendemain et dans la semaine, question posée à Kodi. Aucune
  nouvelle collecte, aucun service externe ; fermée au client, compte
  créateur écarté. Elle se lit dans Supabase : `select * from usage_funnel;`.
  « Retour » veut dire un acte (pièce ajoutée, port, question), pas une
  ouverture de l'app : mesurer les ouvertures demanderait une nouvelle
  donnée, donc une décision. Registre des traitements, §7 ter.
- **Politique de confidentialité, version 1.3** (demandée le 12/11) : « Des
  chiffres d'ensemble » dans « Ce que nous gardons, et pourquoi » (finalité,
  intérêt légitime, aucun traceur, droit d'opposition), et une phrase dans
  « Cookies et traceurs ». L'opposition est tenue par la table `usage_exclus`
  (migration `mesure_usage_opposition`, fermée au client) : l'éditeur y
  inscrit l'espace sur demande écrite, il sort du calcul. « En bref » n'a pas
  bougé. À faire relire par le juriste avec le reste.

**Prévenir d'un changement (12/11), demandé par l'utilisateur** : les
conditions promettent « Nous te prévenons dans l'app avant qu'un changement
important s'applique », et le RGPD le demande quand la politique change ce
qu'on fait des données. Une seule source, `AVIS` (`mobile/src/data/legal.ts`,
copiée sur le web par `node tools/politique.mjs`) : un avis par changement qui
compte (identifiant jamais réutilisé, date de publication, date d'effet, titre,
une ou deux phrases). Il s'affiche en **bandeau beurre en tête de l'accueil**
(app `AvisCard`, `state/avis.ts` ; site `AvisBand.tsx`, `lib/avis.ts`) pour un
compte créé avant sa publication, avec « Lire » et « Compris ». La lecture est
gardée dans les métadonnées du compte (`avis_lus`, identifiant → date), preuve
que la personne a été prévenue, et vaut pour tous ses appareils ; sans réseau,
le téléphone la renvoie au lancement suivant. Pas de fenêtre qui s'ouvre seule,
pas d'e-mail tant qu'aucun service d'envoi n'est choisi. Premier avis :
`politique-1.3`. **Pour un changement important des conditions**, la date
d'effet se pose au moins un mois après la publication. Planche :
`/apercu/accueil?avis=1`.

**Passage au SDK 58 (12/11), demandé par l'utilisateur** : `mobile/` quitte Expo
SDK 57 pour le **SDK 58** (`expo` 58.0.25, React Native 0.88.1, React 19.3.0,
Reanimated 4.7.1, Worklets 0.13.0, Gesture Handler 3.3.0, Screens 4.30,
Safe Area Context 5.11, SVG 15.16, `react-native-web` 0.21.4), par
`npx expo install expo@~58.0.25 --fix`. `expo-doctor` passe 20 contrôles sur 20 et
`npx expo install --check` est vert.

- **API TypeScript stricte de React Native** (par défaut au SDK 58) : une ref se
  type par l'instance, jamais par le composant (`useRef<ViewInstance>`,
  `ScrollViewInstance`, `TextInputInstance`). Cinq refs retypées
  (`ui/bits.tsx`, `ui/onboarding.tsx`, `screens/Dressing.tsx`, `Piece.tsx`,
  `Kode.tsx`) ; c'était la seule erreur de typage.
- **Expo Go doit être en SDK 58.** La version d'exécution des mises à jour devient
  `exposdk:58.0.0` (vérifié dans le projet iOS généré par `expo prebuild`) : le
  lien fixe de `mobile/README.md` change, et il ne trouve rien tant que
  `npm run apercu` n'a pas été relancé.
- **Déprécié mais fonctionnel, à migrer plus tard** : `Gesture.Pan()` de Gesture
  Handler 3 (`ui/outfit.tsx`, `ui/Sheet.tsx`, remplacé par `usePanGesture`) et
  `runOnJS` (remplacé par `scheduleOnRN`). À faire avec un essai sur un vrai iPhone.
- `expo-status-bar` a reçu son plugin de config dans `app.json` (ajouté par la
  commande, sans réglage). `expo-notifications` affiche désormais les notifications
  au premier plan par défaut : `state/notifications.ts` le réglait déjà.
- **Vérifié** : typecheck, exports Metro web et iOS (Hermes) sans avertissement,
  `expo prebuild` iOS, puis l'aperçu web rejoué dans un navigateur, identique à celui
  du SDK 57 (16 contrôles sur 16, aucune erreur console, moins de 0,06 % de pixels
  différents). **Reste à essayer sur un vrai iPhone, dans Expo Go SDK 58** : le glissé
  des rangées, les feuilles, le verre, les notifications.
- `npm audit` : 16 vulnérabilités signalées avant, 7 après, toutes dans l'outillage
  de build (aucune dans le bundle). Ne pas lancer `npm audit fix --force`.

**Chantier IA du 13/11 (« pièces fidèles et Kodi qui conseille juste »),
demandé par l'utilisateur.** Décisions et état :

- **Fournisseurs** : les clés en place passaient par un intermédiaire
  (revendeur) qui perd les sorties JSON structurées : Kodi et le repérage des
  photos échouaient en production. Décision : **clés directes** d'Anthropic et
  de Google, à poser par l'utilisateur dans les secrets, puis retirer
  `ANTHROPIC_BASE_URL` et `GEMINI_BASE_URL`. `_shared/fournisseurs.ts` lit les
  clés et ces adresses facultatives ; `GOOGLE_API_KEY` facultative. Budget des
  essais d'IA : 10 $.
- **Agent photo** : repérage par Sonnet 5 (`MODELS.survey`), découpe de la vraie
  pièce par masque de segmentation Gemini (`decoupage.ts`), dessin seulement sur
  « Image propre » par **Nano Banana 2.1** (`gemini-nano-banana-2.1`, accordé).
  Fiche de pièce (motif, coupe, habillage, saison, détails) gardée dans
  `garments.fiche`. Nouveaux types (F7) : polo, capuche, chino, jupeculotte,
  salopette, mules, derbies, connus du site, de l'app et de `kode/meteo.ts`.
- **Photos réduites sur le téléphone** (F4, `lib/photo.ts`,
  `expo-image-manipulator` accordé) : 2048 px, JPEG 0,85, sans métadonnées.
- **Kodi v2** (`kode/repondre.ts`, `controle.ts`, `prompt.ts`) : réponse en
  JSON (intention, réponse, tenue, variante, question, manque, a_retenir) ;
  la tenue passe un **contrôle du code** (une base, un bas, une paire, un sac,
  superpositions, couleurs évitées, métal, taille) ; une relance avec l'erreur,
  puis réparation, sinon pas de tenue et une phrase honnête. Sept pièces au
  plus ; Kodi lit la fiche, la coupe et la note des pièces, les portées des
  sept derniers jours, et les 50 souvenirs les plus récents (plus de vecteurs
  ni d'appel à Google). La taille d'une pièce ne part qu'avec l'accord
  silhouette. Tout est gardé dans `kode_messages.meta` (contrôles, variante,
  durées, jetons cumulés).
- **Écran de Kodi v2** (maquette https://claude.ai/artifact/3BzxVFrF4WtjfZxgmbyLbW,
  validée le 14/11, mobile `screens/Kode.tsx` et site `KodeChat.tsx`) : la
  question de Kodi en bas de sa bulle, avec « Ta réponse ne compte pas dans tes
  questions » et le champ « Réponds à Kodi » (même à zéro question) ; la puce
  de la variante prête en bleu avec « prête » (`suitesDe`, `DotChip selected
  badge`), servie par l'action `variante` de la fonction `kode`, sans modèle
  ni question décomptée, une seule fois ; « Ce qui te manque » (un type de
  pièce, jamais une marque) avec « Ajouter une pièce ». Planche du site :
  `/apercu/kodi?cas=question|chaude|manque&quota=0`.
- **Décisions Kodi v2** : répondre à la question de Kodi est gratuit
  (`kode_ask`, `meta.gratuit`) ; une puce servie par la variante sera
  gratuite ; Kodi retient ce qu'on lui dit (souvenirs `dit`, deux au plus,
  rien de sensible, `aRetenir`) seulement avec l'accord « goûts » **version 2**
  (`CONSENT_VERSION`, `remote.ts`) ; Sapologue reste « sans limite » dans un
  **usage raisonnable de 300 questions par mois**, appliqué à partir du
  15/12/2026 (conditions 1.3, politique 1.4, avis `conditions-1.3` et
  `politique-1.4`). Migration `kodi_v2` (appliquée le 14/11, version
  `20261114132242`), `kode` déployé le même jour. Le compartiment `depot` est vide
  et privé : Supabase interdit de le supprimer par SQL, à retirer depuis Storage.
- **Banc d'essai** (`banc-ia`, table `banc_ia` fermée au client) : une ligne
  porte l'empreinte d'un jeton à usage unique ; 40 scénarios de Kodi
  (`banc-ia/scenarios.ts`) notés par un juge, sondes des fournisseurs, essais
  de découpe (`dressy-agent`, mode banc). Référence avant v2 : étiquette git
  `banc-v1`.
- **Déploiement des fonctions** : par la CLI Supabase, depuis un commit
  poussé, `supabase functions deploy <fonction> --use-api --project-ref
  pxjlbtevrexlckhxskdn`, avec un jeton d'accès personnel donné par
  l'utilisateur (jamais dans le code ni la conversation), puis contrôle que le
  code servi est celui du dépôt. Les fonctions `depot` et `nettoyage-comptes`
  sont supprimées.

**Suite du chantier IA, essais du 17/11 (`dressy-agent` et `kode` déployés le jour même)** :

- **Cause du repérage vide** : derrière l'intermédiaire (`ANTHROPIC_BASE_URL`), Claude ne voit pas les photos. Quatre formats essayés (image en base64, par adresse, format OpenAI, en-tête Bearer) : lues comme du texte (~0,34 jeton par octet) ou ignorées. « 0 pièce » est alors une réponse valide, donc aucun repli ne se déclenchait. Garde-fou : `verifierImagesVues` (`steps.ts`) lève une erreur claire quand Claude a lu bien plus de jetons que n'en coûtent des images.
- **Repérage par Gemini seul (défaut depuis le 17/11, demandé par l'utilisateur : Claude seulement pour Kodi)** : `surveyGemini` (`steps.ts`), un seul appel (`gemini-3.5-flash`, réflexion minimale, `GEMINI_VISION_MODEL`), mêmes règles et même schéma que Claude, une réponse illisible redemandée une fois. Essai comparatif du 17/11 sur 2 photos (une tenue portée à 6 pièces, un blouson) : mêmes pièces, types et saisons que le relais Gemini puis Claude, environ 3 fois moins cher (0,004 $ contre 0,013 $ la photo à 6 pièces), 17 à 26 s contre 38 à 59 s ; `gemini-3.6-flash` en `low` est plus lent (45 à 51 s) et ses cadres et teintes sont plus approximatifs. Le jean à plat n'a pas tourné (appel non pris). L'exactitude des fiches n'est pas vérifiée à l'œil : à contrôler sur de vraies photos. `SURVEY_PROVIDER=claude` rend le repérage à Claude.
- **Relais** (`observer`, `claudeVoitLesImages`, `steps.ts` ; `RELAIS_SYSTEM`, `observationPrompt`, `prompts.ts`) : solution de repli quand le repérage est confié à Claude derrière un intermédiaire : Gemini regarde les photos et Claude classe ses observations en texte. `CLAUDE_VOIT_LES_IMAGES=1` rétablit l'envoi direct si l'intermédiaire change. Une clé Anthropic directe rend le relais inutile.
- **Découpe** : chez l'intermédiaire, aucun modèle Gemini ne rend de masque (8 essais : cadre seulement, 23 à 60 s). `decoupage.ts` passe donc directement au détourage par contraste ; `GOOGLE_API_KEY` (clé Google directe) rétablit les masques.
- **Consigne « catalogue »** (choisie par l'utilisateur sur le comparatif A manuelle, B agent, C catalogue) : `fallbackPrompt` demande un packshot d'éclairage doux **sans ombre**, la clause de fond dynamique restant en fin de consigne ; `PROMPT_VERSION` passe à `dessin-3`. L'image reste dessinée sur fond uni puis détourée : Nano Banana ne produit jamais de vraie transparence.
- **Kodi derrière l'intermédiaire (essai du 17/11 au banc, `banc-ia`)** : il répondait bien sur le fond mais la réponse arrivait en bloc de code ```json (le format JSON strict est ignoré en silence), et `readJson` échouait : « La réponse de Kodi est arrivée incomplète ». Correctif (`kode/claude.ts`, tests `claude.test.ts`) : `lireJson` tolérant, et derrière un intermédiaire le schéma passe dans la consigne (`formatDansLaConsigne`), l'effort restant réglé ; `KODE_FORMAT=schema` rétablit le format strict. Une clé Anthropic directe n'en a plus besoin.
- **Comparatif des modèles de Kodi** (10 scénarios, juge `claude-opus-5-5`, donc favorable à sa propre famille, un seul passage : ordre de grandeur, pas un classement ferme). Justesse moyenne sur 5 : Opus 5.5 4,40 (17 s, 0,051 $ l'essai), Haiku 5.5 4,29 (56 s, 3 essais sur 10 en échec), Sonnet 5 4,20 (13 s, 0,033 $), Opus 5 4,11 (29 s, 0,060 $, 9 essais sur 10), Sonnet 5.5 3,80 (33 s, 0,033 $). Aucune erreur de contrôle du code (couleurs, pièces interdites, météo, pièces inventées) chez aucun modèle. Brièveté faible partout (3,2 à 3,9) : le texte de la réponse et le « pourquoi » de la tenue se répètent, à corriger dans la consigne, quel que soit le modèle. `claude-fable-5-2` : refusé par la clé de l'intermédiaire. Seuls les modèles Claude sont essayables (le code de Kodi parle l'API Anthropic). Coût : à 300 questions par mois, Opus 5.5 coûte environ 15 $ de réponses, Sonnet 5 environ 10 $ (estimation sans cache chaud), à mettre en regard du prix de Sapologue.
- **Décision du 17/11 : Kodi passe sur Sonnet 5** (`claude-sonnet-5`, `MODEL` dans `kode/claude.ts`, remplaçable par le secret `KODE_MODEL` : à vérifier qu'il n'est pas posé à `claude-opus-5` dans les secrets), demandée par l'utilisateur pour son coût (0,033 $ la réponse) à qualité voisine. Remesuré le 17/11 sur 36 des 40 scénarios (après la consigne de brièveté) : justesse 4,44, raison 3,94, personnalisation 3,72 (le point faible), ton 4,31, brièveté 4,25 (3,80 avant), honnêteté 4,61 ; zéro erreur de contrôle, pièce interdite, météo ou pièce inventée ; 14 s et 0,032 $ en moyenne. La consigne limite maintenant la réponse à deux phrases et un « pourquoi » qui ne la répète pas. Sans le format strict, environ 1 réponse sur 20 était un JSON invalide : `askClaude` la redemande une fois (`standardLisible`).
- **Personnalisation de Kodi : deux enrichissements essayés le 17/11, aucun gardé** (commit `7a660ae`, annulé par `e1d3153`). Essai 1 : synthèse du dressing dans le contexte (palette, couleurs aimées, pièces-phares, pièces qui dorment, habillage) et règle « cite un fait personnel ». Essai 2 : règle adoucie et synthèse réduite. Résultats sur le banc (justesse, personnalisation, honnêteté) : référence 4,44 / 3,72 / 4,61 ; essai 1 : 3,73 de justesse, 3,76 de personnalisation, 3,84 d'honnêteté, météo 3,0, coût +47 % ; essai 2 : 4,11 / 3,56 / 4,14, 21 s, 0,040 $ la réponse. La personnalisation ne monte pas, le reste baisse. Causes probables : profils du banc trop minces (peu à citer), juge bruité. **Ne pas remettre sans refaire le banc avec des profils riches** (30 pièces ou plus, portées, souvenirs). Production inchangée (Sonnet 5, consigne du 17/11).
- **Décision du 18/11 : le dessin revient par défaut, demandée par l'utilisateur.** Constat en base : toutes les découpes des 17 et 18/11 étaient faites par `contraste` (aucun masque derrière l'intermédiaire), donc gardaient peau, sol et décor, et les contrôles les validaient. Désormais une pièce qui arrive est d'abord **redessinée seule sur fond uni par Nano Banana puis détourée** (`redraw(..., { offert: true })`, `index.ts`) : **offert, sans prendre de génération au compteur** (coût noté par `generation_note`) ; la découpe dans la photo ne sert plus que de repli si le dessin échoue. « Image propre » et « Rendu incorrect » inchangés. `DESSIN_PAR_DEFAUT=0` (secret) rend la découpe seule. Coût : environ 0,03 $ (Lite 1K, Découverte) à 0,05 $ (2K) par pièce, à surveiller dans `generation_costs`. Une clé `GOOGLE_API_KEY` directe rendrait les vrais masques (à essayer ensuite).
- **Fonction temporaire `banc-dessin`** (`supabase/functions/banc-dessin/`, déployée sans JWT, jeton à usage unique) : essais de consignes, de découpe et de « Claude voit-il la photo ». À supprimer depuis Supabase quand les essais sont finis.

**Panne du repérage (19/11), signalée par l'utilisateur sur le compte de
Laurette** : depuis le 18/11 après-midi, `gemini-3.5-flash` (et 3.7-flash)
ne répondent plus chez l'intermédiaire (clés valides, modèle listé, mais
chaque appel pend jusqu'au délai) : **toutes** les photos échouaient au
repérage, pas seulement la sienne. Correctifs (`steps.ts`, `index.ts`) :

- **Repérage en chaîne de relais** (`modelesDeVision`, `surveyGemini`,
  demandé par l'utilisateur : « ne pas s'appuyer sur un seul modèle ») : le
  premier part ; sans réponse en 20 s (`REPERAGE_RELAIS_MS`), le suivant part
  **en parallèle**, et ainsi de suite ; la première réponse lisible gagne, les
  autres appels sont coupés ; une erreur lance le suivant aussitôt. Chaîne
  par défaut (`RELAIS_VISION_DEFAUT`, remplaçable par `GEMINI_VISION_MODELS`) :
  3.5-flash-lite, 3.5-flash, 3.1-flash-lite-preview, 3.6-flash, 3.8-flash.
  Banc du 19/11 (21 h 17, une tenue portée, 9 modèles en parallèle) :
  3.5-flash-lite 15 s et 5 pièces (le sac en plus), 3.1-flash-lite-preview
  15 s, 3.5-flash 18 s, 3.8-flash 35 s (4 pièces chacun) ; 3.6-flash,
  4-hydrogen, 4-neon, 4-carbon pendent ; 3.1-pro-preview refusé (400). Une
  heure plus tôt, 3.6-flash répondait et 3.5-flash pendait : la
  disponibilité chez l'intermédiaire change d'une heure à l'autre. Refaire le
  banc (`sonde`, `vision`) avant de changer l'ordre.
- **Dessin en chaîne de relais** (`course`, `dessiner`, `modelesDeDessin`,
  même outil que le repérage) : le modèle de l'offre d'abord, puis
  `RELAIS_DESSIN_DEFAUT` (nano-banana-2.1, 3.1-flash-image, 3-pro-image,
  remplaçable par `GEMINI_IMAGE_MODELS`). Le relais part après 40 s
  (`DESSIN_RELAIS_MS`) : un dessin coûte environ 10 fois un repérage, on n'en
  double pas un qui avance. 75 s au plus par appel. Une seule génération est
  prise au compteur, quel que soit le nombre de relais ; le modèle qui a
  dessiné est noté (`generation_log`, journal de la pièce). Banc du 19/11
  (un pull à logo, 1K, en parallèle) : nano-banana-2.1 et 3.1-flash-image
  30 s, 3-pro-image 47 s, les trois fidèles (texte et logo justes), 0,17 $.
  Tests : `deno test -A dessin.test.ts`.
- **Kodi en chaîne de relais** (`kode/claude.ts`, `modelesDeKodi`) : Sonnet 5
  (`MODEL`) d'abord ; sans réponse en 25 s (`KODE_RELAIS_MS`), Opus 5.5 part
  en parallèle, puis Sonnet 5.5 et Opus 5 (`RELAIS_KODI_DEFAUT`, remplaçable
  par `KODE_MODELS`) ; Haiku 5.5 écarté (3 échecs sur 10 au comparatif du
  17/11). Un appel qui nomme son modèle (le banc) n'a pas de relais. Le
  modèle qui a répondu est gardé dans `kode_messages.meta.model`. La course
  est un seul module, `_shared/relais.ts`, partagé avec l'agent photo.
  Essai du 19/11 au banc (scénario Q1, sans juge) : les quatre modèles
  répondent chez l'intermédiaire ; ce soir-là il était lent (Sonnet 5.5
  14 s, Opus 5.5 54 s, Sonnet 5 98 s et Opus 5 112 s pour la réponse
  complète, relance du contrôle comprise ; la chaîne 46 s). Quand
  l'intermédiaire est lent, le relais part souvent : une question peut
  alors coûter deux réponses (0,012 $ + 0,025 $). Tests : `deno test -A
  claude.test.ts`.
- **Panne passagère** (délai, réseau, 5xx, 429 : `AgentError.passager`) : la
  tâche repart en file au lieu d'échouer, trois passages au plus
  (`REPRISES_PASSAGERES`). Le réveil est immédiat (déclencheur
  `ai_jobs_wake_on_requeue`), donc les trois passages s'enchaînent.
- **Banc** : `sonde` accepte `vision: [modèles]` et `reperage: false` pour
  essayer chaque modèle de repérage sur une image de test.
- Une clé Google directe (`GOOGLE_API_KEY`) et une clé Anthropic directe
  sortiraient l'IA de l'intermédiaire, qui reste le point fragile : s'il tombe
  en entier, toutes les chaînes tombent avec lui.

**Détourage par SAM 3 (20/11), demandé par l'utilisateur** (plan « Dresskode,
plan technique complet », décisions 1 et 2 : détourage par défaut, génération
en option ; aucune boucle IA automatique). Il remplace « le dessin revient par
défaut » du 18/11. Constat en base avant le changement : 100 s et plus par
pièce (le dessin pendait chez l'intermédiaire puis retombait sur le contraste,
qui garde peau et décor).

- **Découpe** : `sam.ts` (consigne anglaise par type, `SAM_KIND` ; zone de la
  photo autour du cadre du repérage, +25 % ; choix des masques ; une paire
  réunit ses masques) et `fal.ts` (l'appel, sans dépendance). Un seul appel à
  `fal-ai/sam-3/image` par pièce (0,005 $, prix public du 20/11), les trois
  masques les plus probables départagés par les contrôles automatiques (calcul
  local). Rien d'utilisable : contraste, sans autre appel d'IA. Clé refusée :
  la pièce échoue (`SAY.notReady`) ; panne passagère : la tâche repart en file.
- **Actif dès que le secret `FAL_KEY` est posé** dans Supabase. Sans lui,
  l'ancien chemin du 18/11 reste (dessin d'arrivée offert).
  `DESSIN_PAR_DEFAUT=1` force le dessin, `=0` la découpe ; `COST_SAM_USD` règle
  le prix noté.
- **Données** : `X-Fal-Store-IO: 0` (la requête n'est pas gardée dans
  l'historique de fal, 90 jours sinon), `sync_mode` (masques dans la réponse),
  fichiers éventuels de leur CDN effacés après une heure. Politique 1.6 (avis
  `politique-1.6`), registre, analyse d'impact ; le contrat de fal reste à
  accepter (`docs/rgpd/README.md`, point 2).
- **Mesures** : chaque appel noté dans `generation_log` (fournisseur `fal`,
  type `segmentation` ; migration `decoupe_sam3`) ; journal de la pièce
  (`ai_jobs.cutout.sam` : consigne, masques, confiances, choix).
- **Mode Studio** : « Image propre » revient dans le menu de la fiche pièce
  (mobile, comme avant le 18/11 ; le site l'avait gardée). Quotas inchangés
  (brief v6).
- **Interrupteur `AI_ENABLED=false`** (secret) : `dressy-agent` ne prend plus
  aucune tâche (les photos attendent en file) et `kode` répond 503 (l'app et le
  site passent en version simple).
- **Banc** : mode `decoupe` avec `modeles: ['sam', …]`. Tests :
  `node supabase/functions/dressy-agent/sam.test.ts` (dans `npm run test:agent`).
  Deno n'est pas installé dans les conteneurs : `npm i deno` dans un dossier de
  travail donne `deno check`.
- **Pas repris du plan, et pourquoi** : Vercel, OpenRouter, sharp et zod (le
  pipeline vit dans les Edge Functions, sans dépendance d'image) ; le schéma
  SQL du plan (`ai_jobs`, `generation_log`, `generation_reserve` et
  `generation_settle` font déjà la file, les coûts et les quotas, échecs non
  décomptés) ; le tagging par Claude (le repérage par Gemini rend déjà type,
  couleurs, teintes, saison et fiche) ; le canevas 4:5 (les vignettes de l'app
  sont carrées).

**Menu « Cette pièce » et note du dessin (18/11), demandés par l'utilisateur** :
le menu de la fiche pièce ne garde que ce qui marche : « Modifier l'étiquette »,
« Noter le dessin », « Retirer du dressing ». « Image propre », « Rendu
incorrect » et « Prêter ou donner à une amie » en sont retirés (leurs actions
`cleanImage` et `reportPiece` restent dans le store et la base, sans entrée dans
l'app ; l'écran Partager est toujours un décor sans serveur). **Noter le
dessin** (`ui/Rating.tsx`, `state/notes.ts`) : trois notes de 1 à 5 (le temps,
la qualité, le rendu final), une fois par pièce dessinée, modifiables ; table
`piece_ratings` (migration `note_dessin`, appliquée le 18/11, version `20261118171635`), moyennes
dans la vue `piece_ratings_summary`. Kodi ne les lit pas. Registre RGPD §7
quater, export `notes_des_dessins`. Les entrées « Partager » de la fiche
(icône de l'en-tête, « À une amie » sur la carte des pièces qui dorment) sont
retirées aussi ; l'écran `Share` et sa route restent, sans entrée.

**Notifications (18/11), demandées par l'utilisateur** : rappeler et prévenir, sans spammer.

- **Rappels locaux** (`state/rappels.ts`, toujours sur le téléphone, aucun serveur) :
  en plus de l'existant, « Dans deux jours : <rendez-vous> » quand il n'a pas de
  tenue (choix « planning »), et, avec « tout », un seul coup de pouce du soir
  « Rien de prévu pour demain » (20 h, jamais un soir où un autre rappel part déjà,
  jamais sous trois pièces) qui demande aussi « tu l'as portée ? » si la tenue du
  jour n'est pas notée ; le bilan du dimanche demande si un événement arrive quand
  la semaine suivante est vide. Reprogrammés à chaque changement d'état.
- **Push « tes pièces sont prêtes »** (service **Expo Push**, accordé le 18/11, gratuit,
  sans clé : `EXPO_ACCESS_TOKEN` est facultatif). Migration `notifications_push` : table
  `push_tokens` (fermée au client, `register_push_token` / `unregister_push_token`),
  `ai_jobs.notified_at`, déclencheur `ai_jobs_notify` qui réveille la fonction
  `notifier` (sans JWT, comme l'agent) à la fin de chaque tâche. Elle prévient **une
  fois par photo**, quand plus aucune pièce n'est en cours, avec « tout » ou « planning »
  seulement. Texte dans `notifier/composer.ts` (`node supabase/functions/notifier/composer.test.ts`).
  App : `state/push.ts` (jeton suivi avec le choix, retiré à la sortie), bannière coupée
  app ouverte (le message de l'app le dit déjà), un toucher ouvre le dressing.
  Essai de la migration : `bash tools/test-notifications.sh` (base jetable).
  **En production le 18/11** : migration appliquée (version `20261118190717`), `notifier`
  déployée sans JWT et essayée (400 sur un identifiant invalide, « tâche introuvable » sur
  un inconnu). `menage` (retire les appareils de plus de 6 mois, via `purge_push_tokens`)
  et `compte` (l'export liste les appareils) sont déployées aussi, par la CLI
  (`npx supabase@latest functions deploy <fonction> --use-api --yes`, le proxy fournit
  l'accès) : `menage` v21 sans JWT, `compte` v22 avec. Le premier vrai passage de `menage`
  avec `purge_push_tokens` est celui de la nuit du 18 au 19/11 (3 h 41) : à contrôler
  dans ses journaux.
- **Politique mise à jour le 18/11** (version 1.5, avis `politique-1.5`) : identifiant
  d'appareil, Expo et Apple comme destinataires, 6 mois (`DUREES.appareils`).
- **Reste à faire avant de livrer l'app avec le push** : Expo (Push) et Apple aux contrats
  de sous-traitance (`docs/rgpd/README.md`), un compte Apple Developer et une clé APNs
  (EAS) pour la production ; en Expo Go le push ne marche pas sur Android.
- **Pas encore** : les relances (pièces qui dorment, saison, féries) ; à ne pas ajouter
  sans mesurer (`usage_funnel`) : une notification par jour au plus.

**Écran des styles (18/11), demandé par l'utilisateur** : les douze styles
dessinés (Minimal, Classique, Chic parisien…) laissent place à neuf styles
montrés par de vraies tenues : Y2K, Workwear (ici l'allure de bureau classe et
sobre, pas le vêtement de chantier), Gothique, Grunge, Old money, Techwear,
Preppy, Gorpcore, Streetwear (`STYLE_CARDS`, `state/profile.ts`).

- **Photos** : dossier « Image style » du Drive de l'utilisateur (Style femme,
  Style homme), la personne et sa tenue détourées sans le décor par
  `tools/detour-styles.py` (rembg et BiRefNet portrait, sur la machine, sans
  service externe ; 8 Go de mémoire), en WebP dans `mobile/assets/styles/<rayon>/`,
  listées dans `data/stylePhotos.ts` (écrit par l'outil, jamais à la main).
  Contrôler la planche qu'il écrit avant de garder un détourage. Le gothique
  homme (`homme/gothique-1.webp`, selfie en boutique) a été retouché à la main
  (vestes suspendues effacées) : relancer l'outil sur sa photo les ramènerait.
- **Tirage** : à chaque passage sur l'écran, une tenue par style, au hasard,
  dans le rayon choisi ; « Un peu des deux » pioche dans les deux
  (`tirerTenues`, `data/styles.ts`). Carte : `StyleCard` (`ui/onboarding.tsx`),
  la tenue sur le gris studio, le nom et deux ou trois repères.
- **Écran du rayon** (« Tu t'habilles plutôt… », demandé le même soir) : les
  petits dessins de pièces (`Trio`, retiré) laissent place à de vraies tenues
  détourées, trois femme, trois homme, une de chaque pour « Un peu des deux »
  (`RAYON_TENUES`, `data/styles.ts` ; `Tenues`, `ui/onboarding.tsx`), dans
  des cartes plus hautes (`ChoiceCard artSize`, 128 × 132).
- **Premier portant du questionnaire** (19/11) : les cintres vides dessinés
  laissent place à un « Exemple de portant », les sept vraies pièces
  photographiées (`PORTANT_EXEMPLE`, `data/wardrobe.ts`), plus grandes (84).
  Elles illustrent l'étape et n'entrent jamais dans un espace ; le dressing
  vide d'un compte garde ses cintres vides (règle du 03/10).
- **Données** : identifiants `slug` du nom (`y2k`, `old_money`…), les mêmes sur
  le site (`STYLES`, `web/src/lib/onboarding.ts`, encore avec des icônes). Un
  ancien style déjà enregistré reste lisible mais ne se choisit plus. Kodi
  connaît chaque style (`kode/prompt.ts`, « Les styles que la personne peut
  choisir »).
- **À régler avant la sortie** : les droits sur ces photos (prises sur les
  réseaux sociaux, une porte un filigrane) et le droit à l'image des
  personnes. Les remplacer par des photos sous licence ou commandées.

**Audit du 07/11, demandé par l'utilisateur** (rapport complet dans la
conversation) :

- **Tenues du jour** (`mobile/src/state/outfits.ts`, `web/src/lib/outfits.ts`,
  même moteur) : toutes les combinaisons haut et bas et chaque robe sont
  pesées (repos de la pièce, saison face à la température, cœur, retrait) ;
  trois tenues qui partagent le moins de pièces possible ; la raison nomme
  la pièce qui dormait. `npm run test:tenues` (web) les essaie.
- **Aucun chiffre ni donnée inventés hors démonstration** : sans compte, la
  météo n'est pas connue et ne s'affiche pas ; la courbe des ports d'une
  pièce lit le journal (six mois) ; Kodi ne cite que les vrais rendez-vous.
- **Port du jour** : gardé d'un lancement à l'autre (journal), une pièce
  comptée une fois par jour, comme la table `wears`.
- **Boutique mobile** : les packs de places seulement (brief v6) ; les cinq
  services à l'unité, jamais construits, ne sont plus en vente. **Validé par
  l'utilisateur le 07/11.**
- **Paiement sur iPhone (décision du 07/11)** : on garde Stripe dans le
  navigateur pour l'instant ; le passage au paiement Apple (In-App Purchase
  ou autorisation européenne) se fera au moment de la demande de licence
  Apple, pas avant.
- **En attente de l'utilisateur (07/11)** : remplacer `GEMINI_API_KEY` (une
  clé OpenAI y est collée) et `ANTHROPIC_API_KEY` (refusée), ajouter
  `APP_URL` ; donner l'identité de l'éditeur (`EDITEUR`, `legal.ts`) pour
  la politique et les conditions.
- **Web** : le middleware vit dans `web/src/middleware.ts` (à la racine de
  `web/`, il était ignoré) ; `/confidentialite` est publique ; la connexion
  ramène à la page demandée (`?suite=`).
- **Questionnaire du site** : au premier passage, identité (prénom, rayon)
  et style, puis on entre, comme le mobile ; le reste dans Profil › Ajuster.
  **Ville** dans Profil › Paramètres (`settings.city`, sans elle pas de
  météo) ; Google et Apple ne s'affichent que s'ils sont activés dans
  Supabase.
- **Conditions générales** (CGU, CGV, mentions légales) dans
  `mobile/src/data/legal.ts` (`CONDITIONS`, `HEBERGEURS`, champs `EDITEUR`
  à remplir), copiées par `node tools/politique.mjs`, page publique
  `/conditions` ; mention de rétractation sur la page de paiement Stripe.
  À faire relire par un juriste.
- **Tes données sur le site** (Profil › Paramètres) : télécharger, supprimer
  le compte ; la suppression efface aussi la fiche Stripe d'une personne qui
  n'a jamais payé.
- **Si l'IA tombe, l'app reste utile** : sur une panne (5xx) de `kode`, Kodi
  répond « en version simple » avec le moteur de tenues (web et mobile) ;
  une photo qui échoue propose de ranger la pièce à la main ; le mobile a
  « Ou la saisir sans photo » (l'éditeur d'étiquette) ; sur le site, une
  pièce sans couleur choisie prend celle de son nom (`couleurDuNom`).
- **État de Kodi** : `dressy-agent?verifier` dit si les clés d'IA sont
  acceptées ; le compte créateur voit une alerte dans Profil quand ce n'est
  pas le cas. `APP_URL` retombe sur l'adresse de production (elle valait
  localhost).

Git : chaque étape terminée et vérifiée est commitée et poussée sur GitHub
aussitôt, sans attendre la fin de la demande.

**Déploiement (demande du 18/10)** : le site est sur Vercel
(https://dresskode-app.vercel.app, projet `dresskode-app`, Root Directory
`web`), qui met en production chaque push sur `main`. Toute modification
demandée sur l'app finit donc sur `main` une fois vérifiée (`npm run
typecheck`, `npm run build`), puis on contrôle que la production sert la
nouvelle version. Une branche `claude/…` seule n'est qu'une Preview :
c'est ainsi que la version Dresskode est restée hors ligne jusqu'au 18/10.

## Commandes

```bash
# App mobile
cd mobile && npx tsc --noEmit                  # vérification des types
cd mobile && npx expo start                    # Expo Go (--clear après un changement de .env)
cd mobile && EXPO_OFFLINE=1 npx expo install <paquet>   # ajouter une dépendance compatible SDK 58
cd mobile && npm run apercu                    # EAS Update : publie dans Expo Go (EXPO_TOKEN requis, voir mobile/README.md)
python3 design/refonte/contraste.py            # contraste AA de la palette mobile (doit tout passer)

# App web
cd web && npm run typecheck
cd web && npm run build                        # référence pour valider une modif
cd web && npm run test:agent                   # tests de l'agent (détourage, décisions)
cd web && npm run test:donnees                 # chaque source de données, contre la vraie API
cd supabase/functions/kode && deno run -A kode.test.ts   # Kodi : contrôle, réparation, souvenirs, météo
cd supabase/functions/kode && deno check index.ts        # types d'une fonction (avec son deno.json)

node tools/serve.mjs                           # maquettes sur http://localhost:4173
node tools/qa-web.mjs --base http://localhost:3000 --routes /bienvenue,/connexion --out <dossier>
                                               # parcours navigateur (clair et sombre), rapport de points ; la recette complète : /dressy-qa
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
- Couleurs (21/10, web) : Blue `#c4dae8` pour ce qui est choisi et l'action
  principale, Butter `#feefb8` (le jeton `butter`) pour les bandeaux de
  service (messages de Kodi, offres, informations) avec texte noir en clair
  comme en sombre, Chocopie `#432f2e` pour le rond de Kodi. Le reste est
  noir, blanc et gris. Gris studio (`#f3f3f3`) pour les vignettes de
  vêtements et les champs de saisie. Le mobile suit la même palette depuis
  le 22/10.
- Boutons (21/10, web) : en verre, libellé en casse normale ; l'action
  principale en verre bleu, texte noir ; les autres en verre clair, en
  pastille ou en texte. Liens de section (« Tout voir », « Agenda ») : texte
  discret.
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
- Icônes : pleines sur le web depuis le 21/10 (`components/icons.tsx`), avec
  leur micro-interaction ; pleines aussi sur le mobile depuis le 22/10
  (`ui/iconsSolid.ts`, régénéré depuis le web ; `line` pour le trait de la
  barre d'onglets au repos). Des formes qui se
  comprennent sans leur nom ; toutes gardent leur libellé pour les lecteurs
  d'écran.
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
- Le nom « Dresskode » ne change pas. Le styliste s'appelle **Kodi** depuis
  le 21/10 (demande de l'utilisateur) ; la fonction `kode` et les noms de
  code internes (`KodeChat`, `askKode`…) gardent l'ancien nom.

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
- Edge Functions : `kode`, `billing`, `donnees` et `compte` avec
  vérification JWT, `stripe-webhook`, `dressy-agent` et `menage` sans
  (signature Stripe, déclencheur interne, ménage de la nuit sans entrée).
- **RGPD** : toute nouvelle donnée personnelle passe dans le registre
  (`docs/rgpd/registre-des-traitements.md`) et, si elle touche au corps, à
  la santé ou part chez l'IA, dans l'analyse d'impact. Toute nouvelle durée
  de conservation se règle dans `menage` (ou pg_cron) et dans `DUREES`.
  Kode ne reçoit jamais le prénom, l'e-mail, le poids ni les mesures ; la
  silhouette et la taille seulement avec l'accord en vigueur.
- **La politique de confidentialité** vit dans `mobile/src/data/legal.ts` ;
  après une modification, `node tools/politique.mjs` régénère
  `docs/rgpd/politique-de-confidentialite.md` et `web/src/lib/politique.ts`
  (jamais à la main).
