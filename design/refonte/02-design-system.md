# Dresskode, design system (direction B « Éditorial »)

> **Mise à jour du 28/09 : l'apparence a changé, pas la disposition.** Couleurs, matières,
> typographie et composants suivent désormais la direction « vitrine de verre » du travail
> du portable (`web/src/app/globals.css`) : fond perle et halos pastel, cartes de verre,
> boutons pilule encre, titres en grotesque serré avec un mot en italique serif. Les
> valeurs font foi dans `mobile/src/theme/` (palette, typo, ombres) et restent vérifiées AA
> par `contraste.py`. Ce qui suit sur la mise en page, les parcours et les principes 3 à 5
> reste valable ; les sections sur le papier et le serif décrivent l'ancienne apparence.

Direction validée : **B, construite sur les règles de A** (le verre ne sert qu'à naviguer).
Code : `mobile/src/theme/` (jetons), `mobile/src/ui/` (composants). Vérification AA :
`python3 design/refonte/contraste.py` lit directement `mobile/src/theme/palette.json`,
pour que le code et la vérification ne puissent pas diverger.

## 1. Principes

1. **La page d'un magazine, pas un catalogue.** Titres en serif, filets fins, pièces
   numérotées comme une légende. C'est ce qui distingue Dresskode des concurrents
   (grilles de photos produit, interfaces chargées).
2. **Le contenu est sur le papier, la navigation est en verre.** Apple l'écrit
   noir sur blanc : « Don't use Liquid Glass in the content layer » ([HIG, Materials](https://developer.apple.com/design/human-interface-guidelines/materials)).
   Barre d'onglets, boutons flottants, bandeau d'en-tête au défilement : verre.
   Cartes, tenues, listes : papier.
3. **Une action principale par écran**, en encre pleine. Le reste en contour ou en discret.
4. **Kode justifie toujours.** Chaque tenue a une raison écrite (météo, agenda, pièce
   oubliée). C'est la réponse directe aux avis sur Acloset (« tenues absurdes »).
5. **Jamais de pop-up.** Une offre apparaît là où elle sert (Pack Occasion dans
   l'événement, places en plus quand le dressing est plein), jamais par-dessus.
   Les feuilles du bas s'ouvrent uniquement par un geste de l'utilisatrice.

## 2. Couleurs

Fichier : `mobile/src/theme/palette.json`. Toutes les combinaisons texte/fond passent
WCAG AA (92 couples testés, verre compris, pire cas : un vêtement blanc ou une robe
noire qui passe dessous).

| Jeton | Clair | Sombre | Rôle |
|---|---|---|---|
| `paper` | `#F1ECE3` | `#121110` | Fond de page : papier ivoire chaud, pas de blanc pur (moins d'éblouissement, plus « magazine »). |
| `raised` | `#F9F6F0` | `#1C1A18` | Cartes et feuilles. En sombre, une surface « élevée » est plus claire que le fond (HIG, Dark Mode). |
| `sunk` | `#E8E1D5` | `#221F1C` | Champs de saisie, squelettes de chargement. |
| `stage` | `#E6DED1` | `#1A1816` | La « scène » où pose une pièce (fiche, ajout). |
| `ink` | `#1C1A17` | `#F1ECE3` | Texte courant, 14,8:1 / 16:1. |
| `ink2` | `#5E574C` | `#ABA398` | Texte secondaire, 6,1:1 / 7,6:1. |
| `brass` | `#7A5A2F` | `#CBAA76` | L'accent laiton, **rare** : numéros de légende, petites capitales, jauge de précision. Lisible en texte (5,4:1 / 8,6:1). |
| `rod` | `#9C7A48` | `#A88A5C` | Tringles et cintres (graphique, 3,4:1 / 5,8:1). |
| `rule` / `rule-strong` | encre à 14 % / 30 % | papier à 13 % / 32 % | Filets éditoriaux, contours de boutons secondaires (décoratifs : le libellé identifie le bouton). |
| `control` | `#857B6D` | `#7A7369` | Contour des interrupteurs, cases, emplacements vides : ≥ 3:1 (WCAG 1.4.11). |
| `primary-bg` / `primary-fg` | encre / papier | papier / encre | Bouton principal, bulle de l'utilisatrice. |
| `positive` (+ `-soft`) | `#2F6841` | `#8CC49A` | « Portée aujourd'hui », « Achat confirmé ». |
| `caution` (+ `-soft`) | `#8A4516` | `#E5A77C` | Pièces qui dorment, dressing presque plein. Jamais de rouge d'erreur pour une pièce non portée : c'est une invitation, pas une faute. |
| `glass` | `#F6F2EA` à 80 % | `#1A1816` à 86 % | Teinte du verre. **Minimum** d'opacité : en dessous, le texte ne tient plus AA sur un vêtement blanc (vérifié). |
| `tab-off` | `#4E483F` | `#C4BCB0` | Onglets inactifs sur verre (5,3:1 / 6,2:1 au pire cas). |

Pièces très sombres en mode sombre : la teinte est remontée d'un cran et un liseré
clair à 26 % les détoure (sinon une robe noire disparaît sur le fond).

## 3. Typographie

Deux familles, toutes deux sous **SIL Open Font License** (libres d'usage, d'intégration
et de redistribution dans l'app) : Instrument Serif et Hanken Grotesk, fournies par
`@expo-google-fonts` (fichiers de licence dans le paquet).

| Style | Police | Taille / interligne | Usage |
|---|---|---|---|
| `hero` | Instrument Serif | 46 / 46 | Titre de la tenue du jour, bienvenue (54). |
| `title` | Instrument Serif | 40 / 42 | Titre d'écran. Le dernier mot en italique porte la voix (« allure *nette.* »). |
| `section` | Instrument Serif | 28 / 31 | Titres de portant, de section. |
| `cardTitle` | Instrument Serif | 23 / 27 | Titre de carte, chiffres clés. |
| `quote` | Instrument Serif italique | 21 / 26 | La raison de Kode, entre guillemets français. |
| `numeral` | Instrument Serif | 19 | Numéros laiton 01, 02… (ils renvoient à la légende : information, pas décoration). |
| `bodyL` / `body` | Hanken Grotesk 400 | 17 / 24, 15 / 21 | Texte courant (17 = corps iOS). |
| `bodyStrong`, `button` | Hanken Grotesk 600 | 15, 16 | Libellés, boutons. |
| `caption` | Hanken Grotesk 500 | 13 / 18 | Métadonnées. |
| `small` | Hanken Grotesk 500 | 11,5 / 15 | Plancher : rien en dessous. |
| `masthead` | Hanken Grotesk 700 | 11, interlettrage 2,9 | L'ours de page (DRESSKODE, LE DRESSING…). |

Taille de texte du système respectée ; les grands titres plafonnent (×1,25 à ×1,4)
pour ne pas casser la page, le texte courant va jusqu'à ×2.

## 4. Espace, rayons, cibles

- Grille de **4 pt**, gouttière de page **20 pt**.
- Rayons **concentriques** ([WWDC25, session 356](https://developer.apple.com/videos/play/wwdc2025/356/)) :
  capsule pour tout ce qui se touche, 24 pour les cartes, 32 pour les feuilles, 18/16 pour les vignettes.
- Cible tactile **44 × 44 pt minimum** partout (vérifié à l'automate ; les puces de 36 pt
  ont une zone de toucher étendue à 44).

## 5. Matière (verre) et élévation

- Verre uniquement sur : barre d'onglets, boutons retour/partage flottants, bandeau
  d'en-tête au défilement (« effet de bord » d'iOS 26), messages de confirmation.
- iOS 26 : vrai Liquid Glass (`expo-glass-effect`), **teinté**, la variante qu'Apple a
  ajoutée en 26.1 après les plaintes de lisibilité ([MacRumors](https://www.macrumors.com/how-to/ios-26-1-reduce-liquid-glass-effects/)).
  Ailleurs (iOS < 26, Android, web) : flou `expo-blur` + teinte à 80/86 %.
- Réglage **« Verre plus opaque »** dans Personnaliser : tout le verre devient plein
  (l'équivalent maison de Réduire la transparence).
- Ombres : une seule, douce (`0 10 30`, 16 % en clair, 55 % en sombre), réservée au verre.
  Le contenu n'a pas d'ombre : ce sont les aplats qui le séparent.

## 6. Mouvement

Des ressorts plutôt que des courbes, courts, jamais bloquants. Tout se fige si
« Réduire les animations » est actif.

| Jeton | Ressort | Usage |
|---|---|---|
| `press` | amortissement 22, raideur 420 | Appui sur tout élément touchable (échelle 0,97). |
| `snappy` | 20 / 300 | Interrupteurs, puces. |
| `sheet` | 26 / 260 | Entrée des feuilles. |
| `gentle` | 18 / 170 | Barres de progression, apparitions. |
| `swing` | 6 / 90 (sous-amorti) | **Le balancement des cintres** : quand on fait défiler un portant, les pièces penchent puis oscillent avant de se stabiliser. C'est le seul effet « plaisir » de l'app, placé là où il a du sens. |

Autres moments : les cintres qui tombent sur la tringle à la bienvenue ; la barre
d'onglets qui se replie quand on descend et revient quand on remonte ; la tenue qui
se fond dans la suivante sur « Une autre ».

## 7. Composants

| Composant | Fichier | Règle |
|---|---|---|
| Bouton (principal, secondaire, discret, texte) | `ui/Button.tsx` | Capsule, 50/44/36 pt, retour haptique (moyen pour le principal). |
| Bouton icône | `ui/Button.tsx` | 44 pt, variantes contour / plein / verre / discret. |
| Barre d'onglets | `ui/TabBar.tsx` | 5 destinations libellées, navigation seulement, repli au défilement. |
| En-tête empilé | `ui/layout.tsx` | Retour en verre ; titre et bandeau n'apparaissent qu'au défilement. |
| Feuille | `ui/Sheet.tsx` | Ouverte par un geste, fermée en glissant, par le voile ou la croix. |
| Message de confirmation | `ui/Toast.tsx` | Confirme une action, propose « Annuler », disparaît seul. Jamais une offre. |
| Planche de tenue + légende | `ui/outfit.tsx` | Pièces posées par rôle, numérotées dans l'ordre de la légende. |
| Puce, onglets soulignés, sélecteur, interrupteur, pas à pas | `ui/controls.tsx` | États lisibles sans la couleur (plein / contour, coche). |
| Illustrations de vêtements (21 coupes) | `ui/Garment.tsx` | Originales, à plat, déclinables en teinte, sans marque. |
| Icônes | `ui/Icon.tsx` | Jeu original, trait 1,6 sur grille 24. |

## 8. Accessibilité (vérifiée)

- Contraste AA : 92 couples, verre au pire cas (`contraste.py`).
- Toutes les commandes ont un rôle et un libellé VoiceOver ; les états (sélectionné,
  coché, désactivé) sont annoncés.
- Taille de texte dynamique, animations réduites, verre plus opaque : pris en charge.
- Écran 18 (« États et feuilles », depuis Moi) : chaque état vide, chargement et erreur
  a une phrase et une action, aucune impasse.

## 9. Onboarding et premier espace

Quatre chapitres, une question par écran, affichés en haut (Toi · Silhouette · Style ·
Dressing) avec une barre qui avance à l'intérieur de chaque chapitre. Environ deux minutes.

| # | Écran | Obligatoire | Pourquoi on le demande (écrit à l'écran) |
|---|---|---|---|
| 1 | Prénom | oui | Kode s'adresse à la personne. |
| 2 | Rayon (femme, homme, les deux) | oui | Coupes et tailles, « pas pour te ranger dans une case ». |
| 3 | Tranche d'âge | non | Adapter les conseils ; jamais affichée. |
| 4 | Taille et poids (règle graduée) | non ; poids désactivé par défaut | Ajuster coupes et longueurs ; jamais affichés, partagés ni commentés. |
| 5 | Silhouette : analyse par 2 photos, ou choix parmi 5, ou « je ne sais pas » | non | Consentement explicite, conseils de pose (tenue ajustée, pas besoin de se déshabiller), photos supprimées après l'analyse, résultat modifiable. |
| 6 | Mesures (poitrine, taille, hanches) avec figure | non | Précision de Kode affichée en direct. |
| 7 | Tailles habituelles (haut, bas, pointure selon le rayon) | non | Prêts entre amies, coupes. |
| 8 | Styles (12 cartes illustrées, 1 à 3) | non | Limite annoncée, jamais bloquante. |
| 9 | Couleurs aimées / évitées | non | Une touche aime, deux évite, trois oublie. |
| 10 | Quotidien (bureau, études, sorties…) | non | La bonne tenue au bon moment. |
| 11 | Ville et agenda | non | Météo du matin ; agenda relié seulement si on l'active. |
| 12 | Premier portant : photos → pièces sur une tringle | non | Trois pièces suffisent pour une première tenue ; « Plus tard » toujours possible. |
| 13 | Kode prépare l'espace (récapitulatif animé) | · | Montre ce qui a été compris, pas une attente vide. |
| 14 | Compte (e-mail, lien magique) ou « sans compte pour l'instant » | non | Retrouver son dressing partout. |
| 15 | Bienvenue : première tenue, ou portant vide qui attend | · | La valeur avant l'entrée. |

« Passer » n'enregistre jamais une valeur par défaut : une étape passée reste vide.

**Espace vide.** Aucun écran blanc : l'accueil montre un portant de cintres vides qui se
balancent, une jauge vers la première tenue (« il manque un bas ou une robe ») et les trois
étapes photo → illustration → tenues ; le dressing liste les six portants vides ; Kode dit
ce qu'il sait déjà et ce qui lui manque ; l'agenda propose de relier le sien. Une pièce
ajoutée depuis moins de deux semaines est « nouvelle », jamais « oubliée ».

## 10. Ce qui reste à valider sur un vrai iPhone

- Le rendu du Liquid Glass natif (iOS 26) : l'aperçu web montre le repli flou.
- Le retour par glissement et les feuilles natives (la pile native n'est active que sur téléphone).
- Les retours haptiques.
