# Analyse d'impact (AIPD) de Dresskode

Analyse d'impact relative à la protection des données (art. 35 du RGPD),
selon la méthode de la CNIL (contexte, principes, risques). Version du
10/10/2026, avant la sortie publique. À revoir à chaque changement qui
touche aux données sensibles, aux prestataires d'IA ou aux durées.

## 1. Pourquoi une analyse d'impact

La CNIL recommande une analyse quand un traitement remplit au moins deux
de ses neuf critères. Dresskode en remplit trois :

- **Données sensibles ou très personnelles** : photos de vêtements portés
  (corps, parfois visage, lieu de vie), silhouette, taille et mesures,
  agenda personnel.
- **Usage innovant** : analyse des photos et conseils par intelligence
  artificielle, chez des prestataires extérieurs.
- **Évaluation et profilage** : un profil de style, des goûts et des écarts
  pour orienter les tenues proposées.

La cible (18 à 34 ans, ouverte dès 15 ans) ajoute une attention aux
mineurs de 15 à 17 ans.

## 2. Le traitement en bref

Garde-robe numérique et styliste IA. La personne photographie ses
vêtements ; une IA repère chaque pièce et une autre la dessine, détourée,
pour le dressing. Kode, l'assistant, compose des tenues d'après les pièces,
le profil de style, la météo de la ville, l'agenda et, avec un accord à
part, la silhouette. Le détail des données, des durées et des prestataires
est dans `registre-des-traitements.md`.

Cycle de vie d'une photo : prise sur le téléphone, envoyée dans un seau
privé de l'espace, lue par l'IA de repérage, recadrée et transmise à l'IA
de dessin pièce par pièce, puis effacée 30 jours après l'envoi par le
ménage de la nuit. Seuls les dessins détourés restent.

## 3. Principes : nécessité et proportionnalité

| Principe | Ce qui le garantit |
| --- | --- |
| Finalité déterminée | Une seule : habiller la personne avec ce qu'elle a. Ni publicité, ni revente, ni traceur. |
| Minimisation | Le poids n'est plus demandé. Kode ne reçoit ni prénom, ni e-mail, ni poids, ni mesures ; l'agenda se limite aux deux semaines à venir ; les écarts aux vingt derniers. Les données du jour partent avec la ville seule. |
| Questions intimes tardives | Le questionnaire d'entrée se limite à quatre écrans (prénom, rayon, style, premier portant). Le reste passe dans « Affiner », facultatif, après la première tenue. |
| Base légale adaptée | Contrat pour le service ; consentement explicite (art. 9.2.a) pour la silhouette, avec preuve datée et versionnée (`consents`), retrait d'un geste. |
| Conservation limitée | Photos 30 jours, demandes de dessin 90 jours, conversations 12 mois (2 si archivées), écarts 6 mois, exports 2 jours, appliqués chaque nuit. |
| Information | Politique lisible dans l'app et sur le site ; information au moment utile (photo, note de rendez-vous, Kode est une IA). |
| Droits | Export JSON, suppression du compte, retrait de l'accord, effacement de la silhouette depuis Réglages › Tes données ; le reste par e-mail, réponse sous un mois. |
| Âge | Inscription réservée aux 15 ans et plus (art. 8 RGPD et loi Informatique et Libertés, art. 45). |
| Transferts | Prestataires d'IA et de paiement aux États-Unis, encadrés par leur contrat (cadre UE et États-Unis ou clauses types) ; hébergement principal dans l'UE. |

## 4. Risques

Échelle de la CNIL : négligeable, limitée, importante, maximale. Les
niveaux ci-dessous sont ceux qui restent, mesures en place.

### 4.1 Accès illégitime aux données

- **Ce qui est redouté** : des photos du corps ou du lieu de vie, la
  silhouette, l'agenda (lieux et heures de rendez-vous) lus par un tiers.
- **Sources** : attaque du compte (mot de passe faible), faille dans les
  droits d'accès, fuite chez un prestataire, appareil perdu.
- **Mesures** : RLS par espace sur chaque table ; seaux privés et liens signés qui expirent ; aucune clé secrète
  dans l'app ; jeton revalidé par `getUser()` ; photos effacées après 30
  jours, ce qui réduit ce qu'une fuite exposerait ; conseil d'éviter le
  visage ; procédure de notification sous 72 heures prévue par la
  politique.
- **Gravité** : importante (données intimes). **Vraisemblance** : limitée.

### 4.2 Réutilisation par un prestataire d'IA

- **Ce qui est redouté** : photos ou profil réutilisés pour entraîner des
  modèles, ou gardés longtemps hors de l'UE.
- **Sources** : conditions du prestataire, compte gratuit au lieu d'un
  compte professionnel, conservation pour la surveillance des abus.
- **Mesures** : appels par API sous contrat professionnel, données
  minimisées avant l'envoi, aucun identifiant direct transmis.
- **Reste à faire** : accepter les contrats de sous-traitance, vérifier que
  l'API Gemini tourne sur un compte payant et la durée de conservation de
  chaque prestataire (voir `README.md`, points 2 à 4).
- **Gravité** : importante. **Vraisemblance** : limitée une fois ces
  vérifications faites, importante sinon.

### 4.3 Traitement de la silhouette sans accord valable

- **Ce qui est redouté** : des données qui touchent au corps gardées ou
  envoyées sans accord, ou après son retrait.
- **Mesures** : la base refuse toute nouvelle valeur sans accord en vigueur
  et efface tout au retrait, même si l'app n'a pas pu le faire ; Kode ne lit
  la silhouette qu'avec l'accord ; le poids a été retiré.
- **Gravité** : importante. **Vraisemblance** : négligeable.

### 4.4 Données glissées où elles n'ont pas lieu d'être

- **Ce qui est redouté** : une information de santé dans la note d'un
  rendez-vous, un visage ou une autre personne sur une photo, le prénom
  d'un tiers dans un prêt.
- **Mesures** : conseils au moment de la saisie (note de rendez-vous,
  photo) ; photos effacées après 30 jours ; l'IA de repérage ne retient que
  les vêtements ; prénom du tiers limité à ce que la personne écrit, effacé
  avec la pièce ou le compte.
- **Gravité** : limitée. **Vraisemblance** : limitée.

### 4.5 Perte ou modification non voulue

- **Ce qui est redouté** : dressing ou tenues perdus, étiquettes faussées.
- **Mesures** : sauvegardes de l'hébergeur ; étiquettes corrigeables dans
  la fiche pièce ; export complet à tout moment.
- **Gravité** : limitée. **Vraisemblance** : négligeable.

### 4.6 Conseils de l'IA mal reçus

- **Ce qui est redouté** : une tenue ou un commentaire vécu comme un
  jugement sur le corps, des associations incohérentes.
- **Mesures** : Kode conseille (« tu pourrais »), ne décide rien ; « Pas
  pour moi » permet de dire ce qui ne va pas, et Kode en tient compte ; la
  consigne de Kode lui interdit de commenter le corps
  (`supabase/functions/kode/prompt.ts`).
- **Gravité** : limitée. **Vraisemblance** : limitée.

## 5. Conclusion

Les risques résiduels sont acceptables, **sous réserve** des points encore
ouverts, qui doivent être réglés avant la sortie publique :

1. contrats de sous-traitance acceptés et conditions des prestataires d'IA
   vérifiées (risque 4.2) ;
2. identité de l'éditeur et contact publiés ;
3. relecture par un juriste ou un délégué à la protection des données.

Aucune consultation préalable de la CNIL (art. 36) ne paraît nécessaire :
aucun risque résiduel ne reste élevé une fois ces points réglés.
