# Le cerveau mode de Kodi (v2)

*14/11/2026. Reprend `architecture-cerveau-kode-v1.md` (13/11) et l'aligne sur
ce qui a été livré les 13 et 14/11 (Kodi v2, migration `kodi_v2`). Statut :
PROPOSITION, à valider par Mylan. Les décisions à prendre sont à la fin.*

## Ce qui change par rapport à la v1, en bref

1. **Une bonne partie est déjà construite.** La doctrine existe (`CULTURE`,
   `kode/prompt.ts`, environ 45 règles), le contrôle par le code aussi
   (`kode/controle.ts`), la fiche de pièce (`garments.fiche` : motif, coupe,
   habillage 0 à 5, détails), les retours (`outfit_feedback`, « Pas pour moi »),
   les souvenirs (50 plus récents) et un banc d'essai (`banc-ia`, 45 scénarios
   notés par un juge). La v2 part de là au lieu de tout reconstruire.
2. **Trois points de la v1 sont dépassés** : OpenRouter (décision du 13/11 :
   clés directes Anthropic et Google, sans intermédiaire, qui cassait les sorties
   JSON) ; « aucune boucle de régénération » (Kodi v2 fait une relance avec
   l'erreur, puis une réparation par le code) ; le nom Kode.
3. **Le coût était sous-estimé** : la v1 compte 600 jetons de sortie, sans la
   réflexion du modèle, qui en ajoute souvent 1 000 à 2 000. Avec le modèle
   actuel, Sapologue (300 questions par mois) peut coûter presque le prix de
   l'abonnement (voir §8).
4. **Ce qui manque vraiment** : des attributs de pièce plus fins, un moteur
   couleurs calculé, un **profil de goûts appris par le code** (l'atout le plus
   rentable, absent de la v1), des fiches récupérées à la demande, et des
   tendances datées.

## 1. Le principe (inchangé)

Pas de fine-tuning. Quatre couches, chacune à sa place :

| Kodi doit… | Où ça vit | Qui calcule |
|---|---|---|
| Savoir ce qu'est chaque pièce | `garments.fiche` (attributs) | L'IA au repérage photo, corrigée par la personne |
| Juger couleurs, formalité, proportions, météo | Code (`controle.ts` + moteur couleurs) | Code, jamais deviné par le modèle |
| Connaître la culture mode | Doctrine (en cache) + fiches récupérées | Rédigé par Claude, relu par un pro |
| Connaître la personne | Profil de goûts appris + souvenirs + retours | **Code** (pondérations), pas l'IA |
| Être à jour | Cartes tendance datées | Curation hebdomadaire |

Ordre en cas de conflit : **règle dure (code) > goûts déclarés de la personne >
doctrine > goûts appris > fiche > tendance.** Ajout v2 : ce que la personne a
dit (« jamais de jaune ») passe avant la doctrine ; ce que le code a déduit de
ses ports passe après.

## 2. Flux d'une question : « l'IA compose, le code propose et contrôle »

La v1 proposait que le code génère les tenues et que l'IA choisisse. Kodi v2 fait
l'inverse : l'IA compose, le code contrôle. **Recommandation : un hybride.**

1. **Code** : charge profil, dressing, météo, agenda, retours, souvenirs (déjà fait).
2. **Code** : le moteur de tenues (même esprit que `mobile/src/state/outfits.ts`)
   calcule **3 à 5 pistes notées** (couleurs, formalité, météo, repos de la
   pièce) et les passe à Kodi comme « pistes possibles », pas comme une liste
   fermée.
3. **Code** : récupère au plus 6 fiches utiles (filtres, §4) et 2 cartes tendance valides.
4. **IA, un appel** : Kodi part d'une piste ou compose mieux, explique pourquoi,
   cite ses fiches (`fiche_ids`).
5. **Code** : contrôle (existant) + nouvelles règles du §5.
6. Échec : une relance avec l'erreur (existant), puis la meilleure piste du code
   avec une phrase honnête. Jamais plus de deux appels.

Pourquoi l'hybride : les pistes rendent Kodi plus sûr (moins de tenues refusées
par le contrôle, donc moins de relances payées) sans le brider ; et si l'IA
tombe, la piste n° 1 est déjà la réponse « version simple ».

## 3. Les attributs de pièce (le vrai point faible)

« Pantalon bleu » ne permet aucune règle. Aujourd'hui la fiche a motif, coupe,
habillage, détails, saison et la teinte mesurée (`hex`). **À ajouter au même
appel de repérage (Sonnet 5), donc sans coût supplémentaire** :

| Groupe | Ajouts |
|---|---|
| Coupe | ajustement (ajusté, droit, ample, oversize) ; hauts : longueur (crop, taille, hanches, cuisses), encolure, épaules ; bas : taille (basse, moyenne, haute), jambe, longueur (mini, genou, midi, cheville, maxi) |
| Matière | structure (denim, maille fine ou épaisse, jersey, satin, lin, cuir, laine…), épaisseur (léger, moyen, lourd), tombé (fluide, structuré) |
| Motif | échelle (petit, moyen, grand) |
| Usage | rôle (base, pièce forte, couche, accent) |
| Fiabilité | confiance par attribut (0 à 1) ; sous 0,7, la règle ne s'applique pas et l'attribut peut être demandé à l'ajout |

**Calculés par le code, sans IA**, à partir de `hex` : clarté, intensité
(chroma), sous-ton (chaud, froid, neutre), famille de couleur, « neutre ou non ».
Rangés dans la fiche à l'enregistrement.

**Avant d'écrire une seule fiche** : test de fiabilité sur 50 vraies pièces
(mode `banc` de `dressy-agent`, déjà là). On mesure attribut par attribut ; on ne
garde que ce qui est juste à plus de 80 %. Le reste se demande ou s'abandonne.

## 4. Les fiches de connaissance

Format de la v1 gardé (une idée par fiche, environ 300 jetons, `se_declenche_si`,
`objectifs`, `confiance` : consensus, convention ou goût, `revue_par`).

Changements :
- **Commencer à 60, pas à 150.** La doctrine actuelle en contient déjà une
  quarantaine en condensé. On découpe d'abord `CULTURE` en fiches (rien de
  nouveau à relire), puis on ajoute par catégorie où le banc montre des erreurs.
  150 fiches relues par un pro en 2 à 3 semaines à temps partiel, c'est
  optimiste.
- **La doctrine reste courte** (environ 2 000 jetons : le ton, les principes, la
  hiérarchie) ; le détail passe dans les fiches récupérées.
- **Domaines ajoutés** : `entretien` (laine qui se repose un jour, daim et
  pluie : « porte mieux » veut aussi dire « fais durer »), `garde-robe` (pièces
  pivot, combien de tenues une pièce débloque, ce qui manque vraiment), et
  `objectifs-silhouette` (allonger, structurer, marquer la taille, adoucir) à
  la place des morphotypes (sablier, poire…), réservés aux personnes qui ont
  donné l'accord silhouette, sans aucun vocabulaire de défaut.
- **Récupération** par filtres seulement (attributs des pièces candidates,
  occasion, saison, formalité, objectifs). La recherche par vecteurs a été
  retirée le 13/11 : on ne la remet que si le banc montre des questions libres
  sans fiche trouvée.
- Table Supabase `kodi_fiches` (lecture serveur seulement), un fichier source
  par domaine dans le dépôt, versionné, chargé par un script : la relecture se
  fait en Markdown, pas dans la base.

## 5. Règles dures et moteur couleurs

Existant (`controle.ts`) : base, bas, chaussures, sac, superpositions, couleurs
évitées, métal, taille. **À ajouter** :
- **Formalité** : écart d'habillage au plus 2 entre les pièces, exceptions
  listées (blazer et baskets propres, t-shirt sous tailleur) ; formalité minimale
  et maximale par type de rendez-vous (`EventEdit` a déjà les types).
- **Couleurs** : au plus 3 couleurs non neutres ; jamais deux couleurs vives de
  même clarté qui se battent (calcul LCH).
- **Motifs** : au plus 2, d'échelles différentes.
- **Météo** : ressenti sous 10 °C, une couche chaude ; pluie, pas de daim ni de
  toile claire ; ces deux règles existent dans la doctrine, elles passent dans le code.
- **Disponibilité** : jamais une pièce prêtée ou au pressing.

Moteur couleurs : hex vers LCH, harmonies (ton sur ton, camaïeu, analogue,
complémentaire en touche), seuils **calibrés sur 50 tenues validées par le pro**,
pas inventés. Sous-ton de la personne déclaré (questionnaire « Affiner »),
jamais estimé sur photo. La colorimétrie « 12 saisons » reste une suggestion.

## 6. Le profil de goûts appris (ajout v2, le plus rentable)

La v1 n'en parle presque pas. C'est pourtant ce qui fera dire « Kodi me
connaît », et cela ne coûte aucun appel d'IA.

Un job (nuit, ou à chaque port) calcule par personne, à partir de `wears`,
`outfit_feedback` et des tenues gardées : affinités par famille de couleur, par
niveau d'habillage, par coupe et par matière ; pièces « refuge » (portées dès
que l'enjeu monte) ; associations qui marchent pour elle ; ce qu'elle refuse.
Pondération par récence (une demi-vie de 60 jours, à régler). Résultat :
**5 lignes de texte** envoyées à Kodi (« porte surtout du casual soigné,
habillage 2 ; aime le camaïeu de beiges ; refuse les hauts courts »), plus des
poids qui servent aux pistes du §2.

Garde-fous : aucune nouvelle donnée collectée (tout est déjà en base) ; si on
ajoute un pouce sur les réponses de Kodi, c'est une nouvelle donnée, donc
registre RGPD.

## 7. Tendances

Inchangé sur le fond : trois échelles (structurelle, saisonnière,
micro-tendance), cartes datées avec « comment la porter avec ce que tu as »,
jamais citées après expiration, curation manuelle de 30 minutes par semaine au
lancement, pas de scraping interdit par les CGU, Google Trends et Pinterest
seulement si l'accès officiel est obtenu. Déjà là : la source Wikipédia de
`donnees` sert de thermomètre. À moyen terme, la meilleure source sera vos
propres données d'usage, anonymisées et agrégées (vue sur le modèle de
`usage_funnel`).

Une tendance ne sert qu'à **remettre en avant une pièce que la personne
possède**, jamais à pousser un achat. C'est aussi un argument de vente cohérent
avec « Porte mieux, achète moins ».

## 8. Coûts (tarifs Anthropic directs, vérifiés le 14/11)

Hypothèses par question : 8 000 jetons stables en cache (doctrine et règles),
7 000 variables (contexte, pistes, fiches), 1 500 en sortie avec la réflexion.

| Modèle | Prix (entrée / sortie / lecture cache, $ par million) | Par question | 300 questions (Sapologue) |
|---|---|---|---|
| Opus 5 (**actuel**, `KODE_MODEL`) | 5 / 25 / 0,50 | ≈ 0,077 $ | ≈ 23 $ |
| Opus 5.5 | 4 / 20 / 0,20 | ≈ 0,060 $ | ≈ 18 $ |
| Sonnet 5.5 | 2 / 10 / 0,10 | ≈ 0,030 $ | ≈ 9 $ |
| Haiku 5.5 | 0,10 / 0,50 / 0,01 | ≈ 0,002 $ | ≈ 0,5 $ |

Lecture honnête :
- **Opus 5 est le plus cher et n'est plus le meilleur Opus.** Passer à Opus 5.5
  baisse le coût d'environ 20 %. À vérifier sur le banc avant (la réflexion ne
  peut plus être coupée sur Opus 5.5, l'effort reste réglable).
- **Une Sapologue qui utilise ses 300 questions coûte environ 18 à 23 $ sur
  Opus**, pour 18,99 € payés, avant Stripe (et la commission Apple plus tard).
  Fashion (30 questions) reste rentable. Il faut un **routage** : Sonnet 5.5 ou
  Haiku 5.5 pour les questions simples (« une autre », « plus chaud »), le gros
  modèle pour les rendez-vous à enjeu et la planification. Le banc tranche.
- Ce sont des estimations : les vrais jetons sont dans `kode_messages.meta`, à
  lire avant de décider.

## 9. Évaluation

Le banc existe : on l'étend au lieu d'en créer un autre. 45 scénarios
aujourd'hui, **100 avant de changer de modèle**, puis 200. Catégories à couvrir :
couleurs, proportions et objectifs, dress codes, météo, rendez-vous à enjeu,
tendance expirée (ne doit pas être citée), pièce inventée (interdite), corps (ni
« défaut » ni IMC), hors sujet, et **cohérence avec les goûts appris**. Juge
automatique, échantillon relu par le pro. Tests unitaires sans IA pour le moteur
couleurs et les nouvelles règles, dans `kode.test.ts`.

## 10. Plan

| Étape | Contenu | Coût IA |
|---|---|---|
| 0 (2 à 3 jours) | Mesurer le coût réel (`meta`) ; banc Opus 5 / Opus 5.5 / Sonnet 5.5 / Haiku 5.5 sur les 45 scénarios | ≈ 3 à 5 $ du budget de 10 $ |
| 1 (1 semaine) | Attributs ajoutés au repérage + calculs couleur ; test de fiabilité sur 50 pièces | ≈ 1 $ |
| 2 (1 semaine) | Profil de goûts appris ; pistes du moteur passées à Kodi ; nouvelles règles dures | 0 |
| 3 (2 semaines) | `CULTURE` découpée en fiches + récupération + citation ; banc à 100 scénarios ; routage des modèles | ≈ 2 $ |
| 4 (continu) | Relecture par un pro ; cartes tendance hebdomadaires ; 60 puis 150 fiches | selon relecture |

L'ordre compte : mesurer, puis fiabiliser les attributs, puis apprendre les
goûts. Écrire des fiches sur des attributs faux ne servirait à rien.

## 11. Décisions à prendre

1. Architecture hybride du §2 (pistes du code + composition libre de Kodi) ?
2. Lancer l'étape 0 (banc des quatre modèles, environ 5 $) et passer à Opus 5.5
   si le banc le confirme ?
3. Routage par type de question pour garder Sapologue rentable ?
4. Une conseillère en image pour relire doctrine, fiches et 50 tenues (budget) ?
5. Un écran ou une ligne « Pourquoi cette tenue ? » qui montre les fiches : c'est
   un ajout à l'écran de Kodi, donc à valider.
6. Un pouce sur les réponses de Kodi (nouvelle donnée, registre RGPD) ?
7. Cible des fiches v1 : femme 18-34 ans, France ? L'offre s'appelle
   « Sapologue », qui évoque une culture surtout masculine : à clarifier.
