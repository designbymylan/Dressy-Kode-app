# Refonte Dresskode — étape 1 : recherche, étape 2 : directions

Cible : femmes de 18 à 34 ans, en France, urbaines, habituées de Vinted. Elles
veulent gagner du temps le matin et redécouvrir ce qu'elles ont. Elles fuient
la lenteur, l'IA incohérente, la pub et les onboardings longs.

Les planches des trois directions (Accueil et Dressing en vue Portants, clair
et sombre) sont sur le canevas « Dresskode — directions ». Les contrastes sont
vérifiés par `design/refonte/contraste.py`.

## Ce que j'ai pu consulter, et ce que je n'ai pas pu consulter

- **Consulté directement** : les Human Interface Guidelines d'Apple (Materials,
  Color, Tab bars, Motion, Accessibility, Dark Mode, Onboarding, via l'API de
  developer.apple.com), la session WWDC25 « Get to know the new design system »,
  la page officielle des Apple Design Awards 2026, l'entretien avec l'équipe de
  Moonlitt, et les licences des polices (dépôt google/fonts, licence ITF de
  Gambarino).
- **Consulté par l'index de recherche seulement** : 21st.dev (catalogue et
  articles), les avis publiés sur Whering et Acloset, la presse sur iOS 26.1.
  Le réseau de cet environnement bloque 21st.dev, apple.com (hors
  developer.apple.com), fonts.google.com et mobbin.com.
- **Pas consulté : Mobbin.** Le site est bloqué ici, et ses parcours complets
  demandent de toute façon un compte payant. Je n'ai donc rien affirmé qui
  viendrait de Mobbin. Pour l'étape 4, deux options : ouvrir l'accès réseau et
  me donner un compte, ou exporter les tableaux utiles en captures.

## Douze enseignements, appliqués à Dresskode

### 1. Le verre sert à naviguer, pas à porter le contenu
Source : [HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials).

- **Ce qu'Apple écrit** : « Liquid Glass forms a distinct functional layer for
  controls and navigation elements… » et « Don't use Liquid Glass in the
  content layer. » Le verre s'emploie avec parcimonie. La variante
  transparente (*clear*) est réservée aux fonds riches en images, avec un
  voile sombre à 35 % si le fond est clair.
- **Pourquoi ça marche** : la hiérarchie vient de la matière (ce qui flotte
  se manipule, ce qui est dessous se lit), sans bordures ni ombres lourdes.
- **Pour Dresskode** : barre d'onglets, boutons flottants, feuilles et champ
  de Kode en verre. Les cartes, les listes et les fiches restent opaques.
  C'est la règle des directions A et B. La direction C s'en écarte
  volontairement, et le paie en contraste (voir plus bas).

### 2. La couleur sur le verre, avec parcimonie
Source : [HIG — Color, Liquid Glass color](https://developer.apple.com/design/human-interface-guidelines/color).

- **Ce qu'Apple recommande** : colorer le fond d'une seule action principale
  plutôt que ses libellés. Pour une app dont le contenu est coloré, préférer
  une barre monochrome.
- **Pour Dresskode** : les vêtements portent toute la couleur de l'écran. La
  barre d'onglets reste monochrome, et le laiton est réservé à un seul rôle
  par écran (repère d'agenda, tringle ou numéros).

### 3. Concentricité, capsules, titres gras alignés à gauche
Source : [WWDC25, « Get to know the new design system »](https://developer.apple.com/videos/play/wwdc2025/356/).

- **Ce qu'Apple montre** : un rayon intérieur égal au rayon du parent moins la
  marge, des capsules pour les actions, une typographie « bolder and
  left-aligned », et un effet de bord au défilement au lieu des séparateurs.
  Il faut aussi regrouper les commandes par fonction et par fréquence :
  « hierarchy should be expressed through layout and grouping ».
- **Pour Dresskode** : carte de 28 px avec scène intérieure de 20 px (marge
  de 8), boutons en capsule, grands titres à gauche. Pas plus de deux actions
  sous la tenue du jour.

### 4. La barre d'onglets d'iOS 26
Sources : [HIG — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars),
[Apple Newsroom, juin 2025](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/).

- **Ce que ça dit** : la barre flotte au-dessus du contenu et se réduit quand
  on fait défiler. Ses libellés sont recommandés, en un mot. Cinq onglets au
  plus, et un onglet sert à naviguer, pas à déclencher une action.
- **Pour Dresskode** : cinq onglets libellés (Accueil, Dressing, Kode, Agenda,
  Moi). La barre actuelle n'a que des icônes : on la corrige. « Ajouter une
  pièce » devient un bouton dans le Dressing, pas un onglet.

### 5. Le retour de terrain d'iOS 26.1
Sources : [Engadget](https://www.engadget.com/mobile/smartphones/how-to-adjust-the-liquid-glass-effect-in-ios-261-203634681.html),
[MacRumors](https://www.macrumors.com/how-to/ios-26-1-reduce-liquid-glass-effects/).

- **Ce qui s'est passé** : face aux plaintes sur la lisibilité, Apple a ajouté
  un réglage « Teinté », plus opaque et plus contrasté.
- **Pour Dresskode** : je pars d'un verre « teinté » par défaut (80 % en
  clair, 86 % en sombre). La transparence forte ne va qu'aux zones sans texte.

### 6. Accessibilité : les chiffres à tenir
Sources : [HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility),
[HIG — Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode).

- **Les seuils** : 4,5:1 pour le texte courant, 3:1 pour le grand texte, et
  « strive for 7:1 » pour les petits textes sur couleurs personnalisées.
- **À prévoir** : un repli opaque quand « Réduire la transparence » est
  activé, et un fond « élevé » plus clair pour les feuilles en sombre. Une
  pièce sombre sur fond sombre a besoin d'un liseré.
- **Pour Dresskode** : le script `contraste.py` teste chaque couple texte/verre
  contre le pire fond possible. Les illustrations reçoivent un liseré clair en
  mode sombre.

### 7. Moonlitt, prix Interaction des ADA 2026 : cacher la complexité
Sources : [Apple Developer, ADA Q&A](https://developer.apple.com/news/?id=v1nphz91),
[lauréats 2026](https://developer.apple.com/design/awards/).

- **Ce que dit l'équipe** : « the goal was never to make people feel the
  complexity ». Le calcul astronomique reste invisible, et l'app est primée
  pour la sensation tactile de son curseur et de son retour haptique.
- **Pour Dresskode** : météo, agenda, silhouette et historique de port
  restent sous le capot. L'utilisatrice voit une tenue et une phrase qui dit
  pourquoi. « Je la porte » donne un retour haptique net.

### 8. grug, prix Delight and Fun des ADA 2026 : un trait dessiné assumé
Source : [Apple Design Awards 2026](https://developer.apple.com/design/awards/).

- **Pourquoi c'est primé** : le jury salue un « scribbled design » et une
  « clever simplicity » autour d'un rituel quotidien.
- **Pour Dresskode** : les illustrations à plat sont une signature, pas un
  pis-aller face à la 3D. On le traite comme tel, avec un style dessiné
  cohérent. La tenue du jour est le rituel.

### 9. Tide Guide, prix Visuals des ADA 2026 : une donnée dense qui se lit d'un coup d'œil
Source : [Apple Design Awards 2026](https://developer.apple.com/design/awards/).

- **Ce qui est salué** : des courbes de marée lisibles immédiatement, avec
  Liquid Glass et des animations sur mesure.
- **Pour Dresskode** : agenda et météo en bande de sept jours, et statistiques
  de port sur la fiche vêtement. Une information par ligne, jamais un
  tableau.

### 10. 21st.dev : le verre a un coût, la capsule flottante a trois défauts
Sources : [« Liquid Glass in React: the look, the CSS and the bill »](https://21st.dev/blog/liquid-glass-react-components),
[« Floating navbars: the pill and its three problems »](https://21st.dev/blog/react-floating-navbar-components),
[« Docks: a beautiful interaction with a pointer requirement »](https://21st.dev/blog/react-dock-components).

- **Le verre en trois niveaux** : dépoli, teinté-superposé, puis réfractif
  (le seul vraiment coûteux). Le flou d'arrière-plan est la propriété la plus
  chère à afficher, et c'est la surface floutée qui coûte, pas le nombre
  d'éléments.
- **La capsule flottante** : elle exige un fond coûteux, elle masque du
  contenu (il faut une marge basse égale à sa hauteur) et elle tient environ
  quatre destinations.
- **Le dock** : il suppose un pointeur (pas de survol au doigt). Une
  navigation par icônes seules est « a memory test ».
- **Pour Dresskode** : verre réel limité à la barre, aux boutons et aux
  feuilles. Marge basse de 110 px sous chaque écran, libellés visibles, pas
  de dock à grossissement.

### 11. L'onboarding : court, facultatif, en faisant
Source : [HIG — Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding).

- **Ce qu'Apple recommande** : « fast, fun, and optional », apprendre par
  l'action, repousser les réglages non essentiels. Il ne faut proposer un
  achat qu'une fois la personne engagée.
- **Pour Dresskode** : trois écrans au plus avant la première valeur
  (prénom, deux ou trois goûts, première pièce en photo). Les mensurations
  deviennent facultatives et passent dans « Ma silhouette ». Aucune offre
  avant la première tenue proposée.

### 12. Les concurrents : ce qu'il ne faut pas refaire
Sources : [avis App Store sur Acloset](https://apps.apple.com/ca/app/acloset-ai-fashion-assistant/id1542311809?see-all=reviews),
[avis sur Whering (JustUseApp)](https://justuseapp.com/en/app/1519461680/whering-digital-wardrobe/reviews).

- **Acloset** : des associations absurdes, les deux ou trois mêmes pièces
  sans cesse, deux hauts dans une tenue. Des publicités et un plafond de 100
  pièces arrivés après coup ont provoqué la colère des utilisatrices.
- **Whering** : plantages, lenteurs et détourage imparfait.
- **Pour Dresskode** :
  - Kode dit toujours pourquoi, et la pièce oubliée est mise en avant.
  - La validation côté serveur interdit deux hauts (déjà codée).
  - Zéro publicité, et des limites annoncées dès le départ, en contexte.
  - Un affichage optimiste pour paraître instantané.

## Principes communs aux trois directions

Ce sont des choix d'UX, pas d'esthétique : ils valent quelle que soit la
direction retenue.

1. Une seule tenue du jour, deux actions (« Je la porte », « Une autre »),
   et la raison en une phrase.
2. Cinq onglets libellés dans une barre flottante en verre teinté.
3. Portants : une tringle par catégorie, défilement horizontal, et la
   dernière pièce coupée au bord pour montrer qu'on peut faire défiler.
   Chaussures et sacs sont posés sur une étagère.
4. Ajouter une pièce se fait par un bouton « + » toujours au même endroit
   (en haut du Dressing), jamais par un onglet.
5. Verre = navigation. Contenu opaque, sauf la direction C.
6. Illustrations originales à plat, liseré clair en sombre, aucune marque.

## Les trois directions

| | A — Lin et verre | B — Éditorial | C — Penderie lumineuse |
|---|---|---|---|
| Idée | L'app Apple native la plus nette possible | Un lookbook quotidien, papier et serif | Une penderie éclairée, matière et profondeur |
| Typographie | Police système (SF Pro sur iOS) | Instrument Serif + Hanken Grotesk (OFL) | Archivo étendu + Hanken Grotesk (OFL) |
| Verre | Navigation seulement | Navigation seulement | Navigation **et** cartes de contenu |
| Laiton | Repères de l'agenda | Numéros, tringle, cintres | Tringle en métal brillant |
| Force | Évidente, rapide, la plus facile à rendre fluide | Identité mode forte, se distingue des concurrents | La plus spectaculaire en démonstration |
| Risque | Ressemble à une app Apple de plus | Serif exigeante en petite taille ; demande de la rigueur de mise en page | Le verre doit être opaque à 78–86 % pour rester lisible, donc la transparence disparaît. Coûteux sur Android, pièces qui se chevauchent moins lisibles |

**Recommandation : B, construite sur les règles de A.** La cible est
sensible à la mode et la promesse est éditoriale (« Porte mieux, achète
moins »). B donne une voix à Kode (la citation) et une signature (les numéros
de pièces), sans rien céder sur la lisibilité ni la rapidité. De C, je
garderais seulement le léger balancement des pièces au défilement, comme
détail de mouvement.

## Contraste mesuré (pire fond possible)

```
python3 design/refonte/contraste.py
```

Les 44 couples texte/fond des trois directions passent le niveau AA, en clair
comme en sombre. Il a fallu relever le verre sombre à 86 % d'opacité, sinon
un vêtement blanc sous la barre faisait tomber les libellés inactifs à 3,6:1.
Le verre des cartes de C doit être à 78 % en clair et à 86 % en sombre.

## Faisabilité (Expo)

`expo-glass-effect` (Expo SDK 57) rend le vrai Liquid Glass natif sur iOS 26.
Ailleurs, on replie vers `expo-blur`, puis vers un fond opaque si
« Réduire la transparence » est activé. Versions vérifiées sur npm le
26 septembre 2026 : expo 57.0.25, expo-glass-effect 57.0.4, expo-blur 57.0.3,
nativewind 4.2.7, react-native-reanimated 4.7.0, moti 0.30.0. La compatibilité
de NativeWind 4 et de Moti avec Reanimated 4 est à vérifier à l'étape 3.

## Points d'attention hors design

- **Le dépôt GitHub est public.** Tout le monde peut voir les maquettes, le
  brief et le code.
- **Police Gambarino.** Sa licence (ITF Free Font License) interdit de
  redistribuer les fichiers de police par un dépôt ou un serveur public, et
  interdit de les convertir ou de les sous-ensembler. Or ils sont commités
  ici. Il faut rendre le dépôt privé, ou retirer ces fichiers. La refonte
  n'utilise que des polices sous licence OFL, qui autorise tout cela.
