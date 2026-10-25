# Dossier d'humanisation des textes (Dresskode, Kodi)

Analyse faite le 23/10/2026 sur la branche `claude/compassionate-maxwell-csiwlj`.
Ce dossier ne corrige rien : il liste ce qu'il faut corriger, dans quel ordre, et ce qui reste à trancher.

**Périmètre** : tous les textes visibles par la personne. Écrans et composants mobiles (`mobile/src/screens`, `mobile/src/ui`, `mobile/src/state`, `mobile/src/data`), pages et composants web (`web/src/app`, `web/src/components`, `web/src/lib`), politique de confidentialité, réponses types de Kodi. Hors périmètre : `design/`, `docs/`, `.claude/skills/`, les prompts serveur (sauf le ton, voir §7).

---

## 0. Avant de toucher quoi que ce soit

1. Le `CLAUDE.md` de la racine fait foi. Ce dossier applique ses règles aux textes, il n'en ajoute pas.
2. **Change seulement du texte.** Pas de disposition, pas de couleur, pas de logique, pas de dépendance, pas de renommage de clé, de `testID`, de fichier ou de fonction.
3. `web/src/lib/politique.ts` est généré. Après une modification de `mobile/src/data/legal.ts`, lance `node tools/politique.mjs`. Ne l'édite jamais à la main.
4. Les décisions de la section 4 appartiennent au propriétaire du projet. Ne les tranche pas seul : laisse le texte en l'état et signale-le.
5. Un changement de chiffre, de durée ou de règle RGPD n'est pas un changement de style. Il passe par le propriétaire.

---

## 1. Règles d'écriture (à appliquer partout)

- **Tutoiement**, jamais « vous ». Phrases courtes. Ton de styliste : chaleureux, direct, sans jargon.
- **Pas de tiret cadratin** (le long tiret, U+2014), nulle part. Remplace par une virgule, deux-points, des parenthèses ou un point médian (·). Les tirets de mots (rendez-vous, porte-manteau) restent.
  - Dans `mobile/src` et `web/src` : 0 occurrence (bon).
  - Restent : `supabase/migrations/` (3 fichiers), `supabase/functions/kode/kode.test.ts`, `tools/` (2 fichiers), `docs/qa/2026-10-13-recette.md`, `charte-typographique-v1.md`, `web/.env.local.example`, 18 fichiers dans `design/`, 11 dans `.claude/`, et le nom d'un fichier à la racine (« Dresskode », tiret cadratin, « palette accent.html »).
- **Apostrophe typographique ’**, jamais `'` ni `&apos;` dans un texte visible.
  - Web : 41 apostrophes droites dans `web/src/app/actions.ts`, 7 `&apos;` dans le JSX (liste en §3, lot 3).
  - Mobile : déjà cohérent (’).
- **Guillemets français** « » pour les citations.
- **Unités** : `19 °C`, jamais `19°`.
- **Aucun nom de modèle, de fournisseur d'IA ou de marque de vêtement** à l'écran. Pour le paiement, écrire « prestataire de paiement » ou « paiement sécurisé », comme la politique.
- **Kodi** se nomme « Kodi » à l'écran. « Kode » n'existe que dans les noms de code (fichiers, fonctions, `/kodi`).
- **Conditionnel pour les conseils** : « tu pourrais », jamais « tu dois ».
- **Un point d'exclamation** seulement pour une réussite ou une chaleur (« Bravo ! », « Merci ! »).
- **Une attente** = une animation + une phrase de Kodi. **Une erreur** = ce qui s'est passé + ce que la personne peut faire. Pas de mot technique (« session », « token », « réseau » seul).

### Glossaire à respecter

| Terme | Emploi |
|---|---|
| Dresskode | Nom de l'app (jamais « Dressy ») |
| Kodi | Le styliste IA. Parle à « tu ». Dans les bulles, il dit « je » ; ailleurs, on parle de lui à la troisième personne |
| Dressing, portant, pièce, tenue, port | Vocabulaire central. Un « port » = une sortie d'une pièce |
| Coût par port | Terme figé. Ne pas écrire « par sortie » |
| Tenue du jour, Ta semaine, Bilan du dimanche | Titres d'accueil |
| Pas pour moi | Écart de tenue (écart, raison, autre tenue) |
| Découverte | Formule gratuite. Fashion et Sapologue sont les formules payantes |
| Pack Occasion, +30 places | Achats uniques |
| Tes données | Réglages › Tes données |
| Moi | Onglet profil (mobile). Le web dit « Mon compte » |

---

## 2. Diagnostic du ton

**Le fond est bon.** Le tutoiement tient partout, les phrases sont courtes, Kodi parle en styliste (« Une photo, et Kodi range ta pièce. », « Elles dorment », « Une tenue, c’est au moins deux pièces. », « Ce n’est pas de ton fait. Réessaie dans un instant. »). Garder ce registre.

**Les faiblesses sont mécaniques, pas grammaticales :**

1. **Formules répétées.** « Réessaie dans un instant » (14 fois), « Session expirée. » (10 fois sur le web), « Kodi repère / dessine / range » (23 fois). Un texte qui revient à l'identique fatigue.
2. **« Kodi » sujet de 136 chaînes.** Dans les attentes, c'est voulu. Ailleurs, le sujet devient systématiquement Kodi. Varier : sujet « ta tenue », « ton dressing », ou verbe à l'impératif tu.
3. **Deux voix.** Kodi dit « je » (`ui/usage.tsx`, `web/src/lib/usage.ts` : « Ajoute tes pièces, je m’occupe du reste. ») et l'interface parle de Kodi à la troisième personne partout ailleurs. Règle : « je » seulement dans une bulle de Kodi.
4. **Tournures lourdes ou obscures** (liste en §3, lots 1 et 4).
5. **Promesses de temps non vérifiées** (« en une minute », « en 2 minutes », « en 3 minutes »). Garder « rapide » ou « quelques minutes » tant que rien ne mesure le temps réel.
6. **Un mot de trop dans les titres** : « Garde-robe exploitée » (terme qui sonne mal, §4 décision 12).

---

## 3. Corrections ciblées

Format : fichier:ligne · texte actuel → texte proposé · motif. Les lignes sont celles de la lecture du 23/10 ; vérifie-les avant d'éditer.

### Lot 1. Sens et tournure (priorité haute)

| # | Fichier:ligne | Actuel | Proposé | Motif |
|---|---|---|---|---|
| 1 | `web/src/app/bienvenue/page.tsx:43` | « …et à t’habiller sans y penser une heure. » | « …et à t’habiller sans y passer une heure. » | Collocation fausse |
| 2 | `web/src/app/actions.ts:112` | « L’e-mail n’est pas reparti. » | « L’e-mail n’a pas pu partir. » | Tournure |
| 3 | `web/src/app/actions.ts:223` | « Le prix ne se lit pas. Exemple : 49,90 » | « Ce prix n’est pas lisible. Exemple : 49,90 » | Ambigu |
| 4 | `web/src/app/actions.ts:264` | « Photo hors de ton espace. » | « Cette photo n’est pas dans ton espace. Choisis-en une autre. » | Trop sec, aucune action |
| 5 | `mobile/src/state/store.tsx:570` | « Connexion ouverte, mais ton compte n’a pas pu être lu. » | « Connexion réussie, mais ton compte n’a pas pu se charger. Réessaie. » | « Connexion ouverte » ne se dit pas |
| 6 | `mobile/src/ui/account.tsx:187` | « Dans l’app, ton compte se retrouve avec ton e-mail et ton mot de passe. » | « Dans la vraie app, tu te connectes avec ton e-mail et ton mot de passe. » | Lourd |
| 7 | `mobile/src/screens/Kode.tsx:154` | « Elles reviennent le 1er du mois. Sapologue rend Kodi sans limite. » | « Elles reviennent le 1er du mois. Avec Sapologue, Kodi n’a pas de limite. » | « rend Kodi sans limite » est bancal |
| 8 | `web/src/components/Onboarding.tsx:591` | « Ça m’évite de te proposer à côté. » | « Pour ne pas te proposer ce qui ne te ressemble pas. » | Sens peu clair |
| 9 | `mobile/src/screens/Silhouette.tsx:82` et `mobile/src/screens/Onboarding.tsx:568` | « Précision de Kodi » | « Conseil de Kodi » | « Précision » sonne comme une mesure |
| 10 | `mobile/src/screens/TesDonnees.tsx:121` | « Garde-les en l’activant, ou efface-les. » | « Garde-les en donnant ton accord, ou efface-les. » | Ambigu |
| 11 | `mobile/src/screens/States.tsx:171` | « …revient à 3 € la sortie. » | « …revient à 3 € par port. » | Le terme figé est « par port » |
| 12 | `mobile/src/screens/Event.tsx:101` (texte dynamique) | « Prévois une étole : 12° après le dîner. » | `Prévois une étole, il fera ${w.low} °C après le dîner.` | Unité et phrase |
| 13 | `mobile/src/screens/Onboarding.tsx:738` | « …pas de laine quand il fait 25°. » | « …pas de laine quand il fait 25 °C. » | Unité |
| 14 | `mobile/src/state/kode.ts:127` | « Samedi, il fera 19° et grand beau. » | « Samedi, il fera 19 °C et grand soleil. » | Unité |
| 15 | `web/src/app/(app)/calendrier/page.tsx:6` | « Tenues planifiées, occasions, prêts, voyage. » | « …, prêts, voyages. » | Accord |
| 16 | `mobile/src/screens/Onboarding.tsx:771` | « Kodi regardera sa météo chaque matin… » | « Kodi regardera la météo de ta ville chaque matin, dès ton compte créé. » | « sa météo » ne désigne rien |
| 17 | `mobile/src/screens/Onboarding.tsx:862` | « …c’est l’app, avec ton compte, qui les confie à Kodi. » | « Dans cet aperçu, elles restent sur l’appareil. Dans la vraie app, ton compte les confie à Kodi. » | Lourd |

### Lot 2. Mots à changer (ton, anglicismes, sens)

| # | Fichier:ligne | Actuel | Proposé |
|---|---|---|---|
| 18 | `web/src/lib/onboarding.ts:156` | « Débardeurs et tops » | « Débardeurs et hauts » (le reste de l'app dit « haut ») |
| 19 | `web/src/lib/onboarding.ts:162` | « Sweats et hoodies » | « Sweats et sweats à capuche » |
| 20 | `web/src/lib/onboarding.ts:327` | « L’oversize » | « Les coupes amples » (si pas de décision contraire) |
| 21 | `web/src/lib/onboarding.ts:139`, `:140` | « Smart casual », « Old money » | À garder si la terminologie mode le veut ; à trancher (§4, décision 13) |
| 22 | `web/src/lib/onboarding.ts:259-262` | « Cabas ou tote bag » | « Cabas ou sac fourre-tout » |

### Lot 3. Typographie (web)

- `&apos;` → `’` dans : `web/src/components/OutfitBuilder.tsx:442`, `web/src/components/Onboarding.tsx:482`, `web/src/components/WearButton.tsx:57`, `web/src/app/(app)/accueil/page.tsx:68`, `web/src/app/(app)/dressing/page.tsx:129`, `web/src/app/bienvenue/page.tsx:42, 43, 52`.
- `'` → `’` dans les messages de `web/src/app/actions.ts` (41 occurrences de lettre'lettre), `web/src/lib/plans.ts:43, 84`, `web/src/components/ThemeChoice.tsx:26`.
- Ne touche jamais une apostrophe qui sert dans du code (chaînes de requête, sélecteurs CSS).

### Lot 4. Répétitions à varier (ton)

| # | Où | Actuel | Piste |
|---|---|---|---|
| 23 | `web/src/app/actions.ts` (10 fois) | « Session expirée. » | « Ta session a expiré. Reconnecte-toi pour continuer. » |
| 24 | 14 occurrences de « Réessaie dans un instant. » (`grep -rn "dans un instant" mobile/src web/src`) | Identique partout | Dire la cause : « Pas de réseau. Réessaie quand la connexion revient. » ; « Le paiement n’a pas pu s’ouvrir. Réessaie. » |
| 25 | `mobile/src/screens/AddPiece.tsx:295` | « Gratuit, en une minute : Kodi range chaque vêtement de tes photos. » | « Gratuit pour commencer. Kodi range chaque vêtement de tes photos. » (décision 9) |
| 26 | `mobile/src/screens/Event.tsx:155`, `mobile/src/screens/Shop.tsx:29` | « Prêt en 2 minutes, valable 30 jours. » | « Prêt en quelques minutes, valable 30 jours. » (décision 9) |
| 27 | `mobile/src/screens/Shop.tsx:30` | « Prête en 3 minutes, modifiable jusqu’au départ » | « Prête en quelques minutes, modifiable jusqu’au départ. » (décision 9) |
| 28 | `mobile/src/screens/Onboarding.tsx:666`, `mobile/src/screens/Silhouette.tsx:244`, `web/src/components/Onboarding.tsx:165` | « Trois : on oublie. » | Après la décision 2 : « Trois touches : on repart de zéro. » |
| 29 | `mobile/src/screens/ProfileEdit.tsx:210` | « Une touche : aimée · deux : évitée » | Après la décision 2, aligner sur « Une touche : tu aimes · deux touches : tu évites » |
| 30 | `mobile/src/ui/onboarding.tsx:265` (aria) | « Touche pour passer de neutre à j’aime, puis à j’évite » | « Touche pour passer de neutre à « tu aimes », puis à « tu évites ». » |
| 31 | `web/src/components/Pricing.tsx:226` | « …paiement sécurisé par Stripe. » | « …paiement sécurisé. » (décision 3) |
| 32 | `web/src/app/(app)/moi/page.tsx:162` | « Merci ! Stripe confirme ton paiement : ton offre s’active dans quelques secondes. Recharge la page si elle ne s’affiche pas. » | « Merci ! Ton paiement est confirmé, ton offre s’active dans quelques secondes. Recharge la page si rien ne change. » |

---

## 4. Décisions à faire trancher par le propriétaire

Ne tranche pas seul. Pour chacune, le texte actuel reste en place jusqu'à réponse.

1. **Seuil de la première tenue.** Mobile : « Trois pièces suffisent » (`mobile/src/screens/Home.tsx:376`), « Dès trois pièces » (`Agenda.tsx:230`). Web : « au moins deux pièces » (`web/src/components/OutfitBuilder.tsx:279`, `KodeChat.tsx:267`), « deux ou trois pièces » (`accueil/page.tsx:68`, `dressing/page.tsx:129`). **Proposition** : trois, car le mobile est le produit principal ; aligner le web.
2. **Légende des « touches »** (goûts). Trois échelles différentes : mobile = une touche « tu aimes », deux « tu évites » (`Onboarding.tsx:666`) ; profil = « aimée / évitée » (`ProfileEdit.tsx:210`) ; web = une touche « tu portes au quotidien », deux « tu aimerais en porter » (`web/src/components/Onboarding.tsx:165`). Trancher le sens, puis unifier les trois.
3. **« Stripe » à l'écran** (`web/src/app/(app)/moi/page.tsx:162`, `web/src/components/Pricing.tsx:226`). La politique dit « prestataire de paiement ». **Proposition** : retirer le nom.
4. **Écrans de design visibles en production.** Réglages affiche « Aperçu du design » (`mobile/src/screens/Settings.tsx:135`), qui ouvre l'écran `States` (« Aperçu design », « Figés si les animations sont réduites »). **Proposition** : masquer derrière `__DEV__` ou un réglage caché.
5. **Page web `/apercu`** (`web/src/app/apercu/page.tsx`). Elle est accessible par URL, sans `noindex`, et contient des ratios de contraste et « La planche du 21/10 ». **Proposition** : `noindex` au minimum, ou retrait de la production.
6. **Éditeur absent de la politique (à traiter avant la sortie, c'est du RGPD).** `mobile/src/data/legal.ts:47` dit que l'identité de l'éditeur « figure en bas de cette page », mais `mobile/src/screens/Confidentialite.tsx:88` et `web/src/app/confidentialite/page.tsx:63` affichent seulement « L’adresse de contact sera indiquée ici avant la sortie de l’app ». À compléter avec le propriétaire (voir `docs/rgpd/README.md`).
7. **Mots genrés « amie »** : `mobile/src/screens/Share.tsx:72, 146`, `Piece.tsx:134, 185`, `Settings.tsx:157`, `store.tsx:51` (« Ce que tes amies ont »), `Onboarding.tsx:600` (« prêts entre amies »). **Proposition** : « un proche » ou « quelqu’un », selon le cas. L'app s'adresse à tout le monde.
8. **Sous-titre du chat web** : rien à faire. Vérifié : « questions illimitées » (`web/src/components/KodeChat.tsx:171`) n'apparaît que pour l'offre illimitée, les autres voient le compte de questions restantes.
9. **Promesses de temps** (§3, lot 4, lignes 25 à 27) : vérifier si le délai est mesuré. Sinon, « quelques minutes ».
10. **Achat à l'unité** : `mobile/src/screens/Offers.tsx:124` promet « Les packs commencent à 0,99 € », alors que `mobile/src/state/store.tsx:806-807` dit « Les achats à l’unité arrivent bientôt ». **Proposition** : retirer la phrase de `Offers.tsx:124` tant que l'achat à l'unité n'existe pas.
11. **E-mails d'authentification.** Le dépôt ne contient aucun modèle d'e-mail. Si les modèles Supabase sont restés en anglais, c'est le premier texte que voit une nouvelle personne. **À vérifier** dans le tableau de bord Supabase (Authentification › Modèles d'e-mails), puis rédiger en français, en tutoiement. Je n'ai pas pu vérifier.
12. **« Garde-robe exploitée »** (`mobile/src/ui/usage.tsx:107, 111`, `web/src/app/(app)/dressing/page.tsx:69, 72`, `web/src/app/apercu/page.tsx:108, 111`). « Exploitée » sonne comme une mise à profit. **Proposition** : « Pièces portées » ou « Ton dressing en mouvement ».
13. **Anglicismes de style** (`web/src/lib/onboarding.ts:138-140`, `:327`, `:259-262`). Garder pour le vocabulaire mode, ou traduire (lot 2).

---

## 5. Ce qu'il ne faut pas toucher

- **Chiffres et durées de la politique** (`mobile/src/data/legal.ts`) : ils correspondent à `menage` et au registre RGPD. Ne les modifie pas sans accord.
- **Noms des formules et prix** : Découverte (gratuite), Fashion, Sapologue, « +30 places · 4,99 € », packs. Ce sont des faits du produit.
- **Libellés de journaux** (`[rafale]`, `[supabase]`, `[kode]`, `[profil]`, `[rappels]`, `[app]`) : jamais visibles.
- **Données de démonstration** (`mobile/src/data/wardrobe.ts`, `kode.ts` : Léa, Juliette et Tom, « Chez Léa », « Mairie, puis jardin ») : ce sont des exemples de compte démo, pas des erreurs.
- **Textes qui marchent déjà** : « Porte mieux ce que tu as. », « Une photo, et Kodi range ta pièce. », « Elles dorment », « Je ne regarde pas, promis. », « Bonne journée. Kodi s’en souviendra pour tes prochaines tenues. », « Ce n’est pas de ton fait. ». Ne pas les lisser.
- **Noms de code** : `Kode.tsx`, `kode.ts`, `/kodi`, `KodeChat`, `askKode`. Ce sont des identifiants.

---

## 6. Vérifier après correction

Commandes :

```bash
cd mobile && npx tsc --noEmit
cd web && npm run typecheck && npm run build
node tools/politique.mjs        # seulement si legal.ts a changé ; puis vérifier le diff
```

Contrôles (chacun doit renvoyer 0) :

```bash
grep -rn $'\xe2\x80\x94' mobile/src web/src     # tiret cadratin
grep -rn "&apos;" web/src                        # apostrophe HTML
grep -rn "Stripe" web/src                        # nom de prestataire à l'écran
grep -rnE "[^a-zA-Z]vous[^a-zA-Z]" mobile/src web/src | grep -v "//"   # vouvoiement (à relire à la main)
grep -rn "dans un instant" mobile/src web/src    # répétition à varier
```

Visuel : sur iPhone seulement (`npm run apercu`, voir `mobile/README.md`) pour les écrans modifiés. Le navigateur ne suffit pas. Aucune structure, couleur ni typographie ne doit changer. Les textes peuvent s'allonger : vérifie qu'un titre tient sur 3 lignes au plus et qu'aucun bouton ne déborde.

---

## 7. Hors périmètre, ou à relire plus tard

- **Prompts serveur** (`supabase/functions/kode/prompt.ts`, `supabase/functions/dressy-agent/prompts.ts`). Le ton de Kodi est déjà bien cadré (tutoiement, conditionnel, deux ou trois phrases, sans liste). Relire seulement si les réponses générées paraissent raides, et compter alors les réponses réelles, pas le prompt.
- **Textes générés par le modèle** : pas évalués ici. Seuls les textes figés sont analysés.
- **`design/`, `docs/`, `.claude/skills/`** : ni l'app ni son texte. Les tirets cadratins y restent (§1) ; à traiter seulement si le propriétaire le demande.
- **Nom d'un fichier à la racine** (« Dresskode », tiret cadratin, « palette accent.html ») : à renommer avec le propriétaire ; un changement de nom touche les liens.

---

## 8. Statut au 25/10 (ce qui est appliqué dans l'app)

**Appliqué**
- §3 lot 1 : corrections 1 à 17, sauf 13 à 15 déjà couverts (unités, accords) : tout appliqué.
- §3 lot 2 : 18, 19, 20, 22 appliqués. Le 21 (« Smart casual », « Old money ») est gardé.
- §3 lot 3 : toutes les apostrophes droites et `&apos;` du web converties en ’ (9 fichiers web + `apercu`).
- §3 lot 4 : 23 (« Session expirée » remplacé), 25 à 27 (délais), 28 à 32 (touches, Stripe). Le 24 est appliqué à 4 messages (remote.ts, actions.ts), les autres « Réessaie dans un instant » sont gardés : ils disent bien une attente.
- §4 décision 2 : mobile aligné sur « tu aimes / tu évites / repart de zéro ». Le web garde son autre sens (« tu portes / tu aimerais »), avec « Trois touches : on repart de zéro ».
- §4 décision 3 : « Stripe » retiré de l'écran (Pricing, moi).
- §4 décision 4 : « Aperçu du design » masqué hors développement (`__DEV__`).
- §4 décision 7 : « amie » remplacé par « proche » partout.
- §4 décision 9 : délais remplacés par « quelques minutes ».
- §4 décision 10 : phrase « Les packs commencent à 0,99 € » retirée.
- §4 décision 12 : « Garde-robe exploitée » devient « Pièces portées ».
- §4 décision 13 : « Débardeurs et hauts », « Sweats et sweats à capuche », « Les coupes amples », « Cabas ou sac fourre-tout ».

**Non appliqué (à trancher)**
- §4 décision 1 (seuil de la première tenue) : le code n'a pas un seuil unique. Le web exige 2 pièces (`OutfitBuilder.tsx:274`, `remote.ts:184`), le mobile 3 pour une réponse de Kodi (`state/kode.ts:59`). Changer seulement le texte créerait une contradiction. Il faut d'abord fixer la règle produit, puis le code et le texte ensemble.
- §4 décision 5 (`/apercu`) : déjà fermée en production (`notFound()` sans la variable `DRESSY_APERCU=1`). Le dossier disait le contraire : c'était faux. Rien à faire tant que la variable n'est pas posée.
- §4 décision 6 (identité de l'éditeur, adresse de contact) : attend les informations du propriétaire (`EDITEUR` dans `legal.ts`).
- §4 décision 11 (e-mails Supabase) : à vérifier dans le tableau de bord, rien dans le dépôt.
- §4 décision 8 : rien à faire (le sous-titre est déjà conditionnel au plan).
- Anglicismes « Smart casual » et « Old money » : gardés volontairement.
- Sens de la légende des touches côté web : à décider (§4 décision 2).
