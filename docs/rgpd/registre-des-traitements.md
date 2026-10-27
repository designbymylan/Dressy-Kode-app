# Registre des traitements de Dresskode

Registre tenu au titre de l'art. 30.1 du RGPD. Version du 10/10/2026, à
revoir à chaque nouvelle fonction qui touche aux données.

**Responsable du traitement** : l'éditeur de Dresskode (identité, adresse et
contact à compléter, voir `README.md`). Pas de délégué à la protection des
données désigné à ce jour.

**Personnes concernées**, pour tous les traitements : les utilisatrices et
utilisateurs de l'app et du site, à partir de 15 ans.

**Mesures de sécurité communes** (art. 32) : hébergement Supabase dans
l'Union européenne (Irlande, `eu-west-1`) ; échanges en HTTPS ; données
chiffrées au repos chez l'hébergeur ; RLS par espace sur chaque table
(seuls les membres d'un espace le lisent) ; fichiers dans des seaux privés,
servis par liens signés qui expirent ; mots de passe hachés par le service
d'authentification ; clés secrètes rangées dans les secrets du serveur,
jamais dans l'app ni dans le code ; jeton revalidé côté serveur par
`getUser()`.

**Prestataires (sous-traitants, art. 28)** :

| Prestataire | Rôle | Lieu de traitement |
| --- | --- | --- |
| Supabase | Base de données, authentification, fichiers, fonctions serveur | Union européenne (Irlande) |
| Anthropic | IA : repérage des pièces sur les photos, réponses et tenues de Kode, recherche du modèle d'une pièce | États-Unis |
| Google (API Gemini) | IA : dessin des pièces ; vectorisation des souvenirs de goût (textes courts, avec l'accord « gouts ») | États-Unis |
| Stripe | Paiement, factures | États-Unis et Union européenne |
| Expo (EAS Update) | Distribution des mises à jour de l'app, sans donnée de compte | États-Unis |

Les transferts vers les États-Unis reposent sur le cadre de protection des
données entre l'UE et les États-Unis quand le prestataire y adhère, sinon
sur les clauses contractuelles types de son contrat (à vérifier, voir
`README.md`).

---

## 1. Compte et authentification

- **Finalité** : créer le compte, se connecter, protéger l'accès.
- **Base** : exécution du contrat (art. 6.1.b).
- **Données** : e-mail, mot de passe haché, identifiants de connexion
  (Apple, Google si utilisés), prénom, nom, pseudo, nom affiché, photo de
  profil (facultatifs). La case « J'ai 15 ans ou plus » conditionne
  l'inscription ; elle n'est pas conservée.
- **Tables et fichiers** : `auth.users`, `profiles`, `spaces`,
  `space_members` ; photo de profil dans le seau `uploads`
  (`<space_id>/avatar-…`).
- **Destinataires** : Supabase.
- **Durée** : tant que le compte existe ; effacement immédiat à la
  suppression (fonction `compte`), sauvegardes de l'hébergeur écrasées
  d'elles-mêmes sous quelques jours.

## 2. Dressing et dessin des pièces

- **Finalité** : découper les pièces dans les photos de vêtements (la pièce
  est la vraie, détourée et mise au format du dressing, pas redessinée) et
  les étiqueter, pour le dressing.
- **Base** : exécution du contrat.
- **Données** : photos confiées (qui peuvent montrer une personne, d'où le
  conseil d'éviter le visage), consigne facultative (« seulement la veste »),
  précisions facultatives sur la pièce (marque, taille, coupe, matière, note),
  pièces détourées, étiquettes (nom, catégorie, couleur, matière, saison,
  prix), fiche technique facultative (composition, motif, manches,
  longueur, particularités, entretien, pays de fabrication, lieu et mois
  d'achat, état, occasions ; colonne `garments.fiche`, jamais envoyée à
  l'IA), ports, signalements « rendu incorrect » (niveau de reprise et
  contrôles de l'image, sans la photo).
- **Tables et fichiers** : `ai_jobs` (dont le journal de découpe : méthode,
  contrôles, durées, jetons), `ai_images`, `garments`, `garment_reports`,
  `categories` ; seaux `uploads`, `ai-generated`, `garments`.
- **Destinataires** : Supabase ; Anthropic (repérage des pièces sur la
  photo) ; Google (masque de découpe de chaque pièce, calculé sur la photo ;
  après deux signalements « rendu incorrect » seulement, dessin de la pièce
  à partir de la photo et d'une consigne).
- **Durée** : photos confiées, 30 jours après l'envoi ; demandes de dessin
  terminées, 90 jours ; pièces, tant qu'elles restent dans le dressing
  (fonction `menage`, chaque nuit).

## 3. Profil de style, tenues et Kode

- **Finalité** : proposer des tenues à son goût, adaptées à la météo et aux
  occasions ; répondre aux questions posées à Kode.
- **Base** : exécution du contrat.
- **Données** : styles, couleurs aimées et évitées, occasions, tailles de
  vêtements, ville, tranche d'âge ; tenues composées ou portées ;
  conversations avec Kode ; prêts de pièces, avec le prénom de la personne
  à qui l'on prête tel qu'on l'écrit (donnée d'un tiers, gardée au strict
  nécessaire).
- **Tables** : `style_profile`, `settings`, `outfits`, `outfit_items`,
  `kode_messages`, `loans`.
- **Destinataires** : Supabase ; Anthropic, pour chaque question : la liste
  des pièces (avec leur type, leur saison et leur matière), le profil de
  style, l'agenda des deux semaines à venir, les tenues écartées, la météo
  du jour, les cœurs et les souvenirs retrouvés (traitement 11), et la
  silhouette, la taille et les tailles habituelles seulement avec l'accord
  du traitement 4. Jamais le nom, l'e-mail, le poids ni les mesures.
- **Durée** : profil et tenues, tant que le compte existe ; conversations,
  12 mois, 2 mois une fois archivées.
- **Profilage** : les tenues sont des suggestions ; aucune décision
  automatisée produisant des effets juridiques ou significatifs (art. 22
  non applicable).

## 4. Silhouette

- **Finalité** : choisir des coupes et des longueurs qui vont à la personne.
- **Base** : consentement explicite (art. 9.2.a). Ces données touchent au
  corps et peuvent, recoupées, renseigner sur la santé : elles sont traitées
  comme des données sensibles, par prudence.
- **Données** : taille, silhouette, mesures. Le poids n'est plus demandé ;
  un poids déjà donné s'efface d'un geste (Ma silhouette).
- **Tables** : `silhouettes` ; preuve de l'accord dans `consents` (date,
  version, accordé ou retiré).
- **Destinataires** : Supabase ; Anthropic, la silhouette et la taille
  seulement, avec l'accord.
- **Durée** : jusqu'au retrait de l'accord (effacement immédiat par la
  base) ou la suppression du compte. Les lignes de `consents` servent de
  preuve tant que le compte existe.

## 5. Agenda, planification et voyages

- **Finalité** : préparer les tenues des jours à venir, des rendez-vous et
  des voyages ; faire la valise.
- **Base** : exécution du contrat.
- **Données** : rendez-vous (date, heure, type, importance, lieu,
  contraintes, note libre), jours planifiés, voyages (destination, dates,
  motif, activités). L'app conseille de ne pas noter d'information de santé.
- **Tables** : `events`, `planned_days`, `trips`.
- **Destinataires** : Supabase ; Anthropic (agenda des deux semaines à
  venir, avec la question ou la planification).
- **Durée** : tant que le compte existe.

## 6. Retours sur les tenues et journal des ports

- **Finalité** : ne plus proposer ce qui ne plaît pas (« Pas pour moi ») ;
  raconter la semaine (bilan du dimanche) et le coût par port.
- **Base** : exécution du contrat.
- **Données** : tenue écartée, raison facultative, pièce visée ; ports par
  jour.
- **Tables** : `outfit_feedback`, `wears`.
- **Destinataires** : Supabase ; Anthropic (les vingt derniers écarts des
  trois derniers mois).
- **Durée** : écarts, 6 mois (effacement chaque nuit par pg_cron) ; ports,
  tant que le compte existe.

## 7. Abonnement et paiement

- **Finalité** : vendre les offres et les achats à l'unité, facturer.
- **Base** : exécution du contrat ; obligation légale pour les factures
  (art. 6.1.c, code de commerce, art. L123-22).
- **Données** : offre, état de l'abonnement, identifiant client chez le
  prestataire, historique des paiements. Les coordonnées bancaires ne
  passent jamais par Dresskode.
- **Tables** : `subscriptions`, `billing_customers`.
- **Destinataires** : Supabase ; Stripe.
- **Durée** : tant que le compte existe ; factures, 10 ans chez Stripe.

## 8. Rappels

- **Finalité** : rappeler la tenue du matin, le planning, le bilan du
  dimanche.
- **Base** : consentement (choix « tout », « seulement le planning » ou
  « non », modifiable dans Réglages).
- **Données** : aucune côté serveur. Les rappels sont programmés par le
  téléphone lui-même (`expo-notifications`, notifications locales).
- **Durée** : sans objet.

## 9. Données du jour

- **Finalité** : météo, jours fériés, vacances scolaires, saison, pour des
  tenues adaptées.
- **Base** : exécution du contrat.
- **Données** : la ville du profil, ou la destination d'un voyage. Les
  serveurs de Dresskode interrogent des services publics et ouverts
  (Open-Meteo, MET Norway, data.gouv, Éducation nationale, Géoplateforme,
  Nominatim, Wikipédia, entre autres) avec ce lieu seulement, sans rien qui
  désigne la personne ; réponses mises en cache partagé (`data_cache`).
- **Durée** : cache de quelques heures à quelques jours selon la source.

## 10. Exercice des droits

- **Finalité** : permettre l'accès, la portabilité, la rectification,
  l'effacement et le retrait du consentement.
- **Base** : obligation légale (art. 6.1.c, art. 12 à 22).
- **Données** : export JSON de toutes les données du compte.
- **Fichiers** : seau privé `exports`, lien signé une heure.
- **Destinataires** : la personne elle-même ; Stripe, pour arrêter
  l'abonnement à la suppression.
- **Durée** : exports, 2 jours.

## 11. Sécurité et fonctionnement

- **Finalité** : faire fonctionner le service, détecter les pannes et les
  abus.
- **Base** : intérêt légitime (art. 6.1.f).
- **Données** : journaux techniques de l'hébergeur (erreurs, connexions,
  appels aux fonctions).
- **Destinataires** : Supabase.
- **Durée** : quelques jours, selon la conservation des journaux de
  l'hébergeur.

## 11. Mes choix et mémoire de Kodi

- **Finalité** : garder ce qu'on aime (cœurs), et apprendre de ses choix
  pour que Kodi propose des tenues plus justes à chacun.
- **Base** : les cœurs, exécution du contrat (favoris). La mémoire de Kodi,
  consentement : accord « gouts » (« Kodi apprend de mes choix »), donné
  ou retiré à tout moment dans Réglages › Mes choix, daté et versionné
  (table `consents`).
- **Données** : pièces et tenues aimées (cœurs) ; souvenirs en phrases
  (« Pièce aimée : … », « Tenue écartée (raison) : … ») créés à partir des
  cœurs et des tenues écartées ; leur vecteur (embedding, 768 nombres, qui
  ne se lit pas comme du texte mais décrit le sens d'une phrase).
- **Tables** : `likes`, `kodi_faits` (avec la colonne `embedding`), `consents`.
- **Destinataires** : Supabase (base, vecteurs) ; Google (API Gemini), qui
  reçoit le texte des souvenirs pour les vectoriser (à la première
  question qui suit leur création) ; Anthropic, pour chaque question, les
  souvenirs les plus proches de la question, jamais le vecteur.
- **Durée** : cœurs, tant que le compte existe ou jusqu'au retrait ;
  souvenirs, 12 mois (pg_cron `kodi-faits-retention`), et effacés aussitôt
  si l'accord est retiré, si le cœur ou la tenue d'origine disparaît, ou si
  le compte est supprimé.
- **Droits** : voir les souvenirs et les effacer un à un dans Mes choix ;
  les souvenirs figurent dans l'export (fonction `compte`).
- **Profilage** : Kodi adapte ses suggestions aux goûts retenus ; aucune
  décision automatisée produisant des effets juridiques ou significatifs
  (art. 22 non applicable). Les goûts se limitent au vêtement : aucune
  inférence sur la santé, la religion, l'origine ou l'orientation.

## Sans compte

Sans compte, tout reste sur le téléphone (stockage local de l'app) : rien
n'est envoyé aux serveurs, aucun traitement par Dresskode. Les photos
choisies attendent sur le téléphone et ne partent qu'à la création du
compte.
