# RGPD : où en est Dresskode

Dossier de conformité de l'app (mobile et web) et de son serveur Supabase.
Mis en place le 09/10 ; ce dossier date du 10/10.

| Fichier | Ce qu'il contient |
| --- | --- |
| `registre-des-traitements.md` | Le registre de l'art. 30 : chaque traitement, sa finalité, sa base, ses données, ses destinataires, ses durées. |
| `analyse-d-impact.md` | L'analyse d'impact (AIPD, art. 35) : pourquoi elle est faite, les risques, les mesures, ce qui reste. |
| `politique-de-confidentialite.md` | La politique lue par les personnes. **Générée**, ne pas la modifier ici (voir plus bas). |

Ce dossier décrit ce que fait le code. Il ne remplace pas la relecture d'un
juriste ou d'un délégué à la protection des données, à prévoir avant la
sortie publique.

## Ce qui est en place

Serveur (projet Supabase, région UE `eu-west-1`, Irlande) :

- **Accord pour la silhouette** : table `consents` (preuve datée et
  versionnée, art. 7.1). Retiré, la base efface taille, poids, silhouette et
  mesures ; sans accord en vigueur, aucune nouvelle valeur n'entre
  (migration `20261009211125_rgpd_accords.sql`).
- **Export et suppression** : fonction `compte` (avec vérification JWT).
  Export de tout en JSON par lien signé une heure (seau privé `exports`) ;
  suppression du compte : abonnement arrêté, fichiers puis compte effacés,
  cascade en base (`20261009211339_rgpd_export_effacement.sql`).
- **Conservation limitée** : fonction `menage`, chaque nuit à 3 h 41
  (pg_cron `rgpd-menage`, `20261009211514_rgpd_menage_nocturne.sql`) :
  photos confiées à Kode après 30 jours (jamais la photo de profil), exports
  après 2 jours, conversations 12 mois (2 si archivées), demandes de dessin
  90 jours. Les « Pas pour moi » (`outfit_feedback`) s'effacent après 6 mois.
- **Minimisation vers l'IA** : Kode ne reçoit ni le prénom, ni l'e-mail, ni
  le poids, ni les mesures ; la silhouette et la taille seulement avec
  l'accord (`supabase/functions/kode/`).
- **Cloisonnement** : RLS par espace sur toutes les tables, fichiers privés
  servis par liens signés, aucune clé secrète dans l'app.

App mobile :

- « Affiner » commence par l'accord « Ta silhouette, en confiance » ; sans
  lui, taille, silhouette et mesures sont sautées. Le poids n'est plus
  demandé.
- Réglages › Tes données (`screens/TesDonnees.tsx`) : ce qui est gardé, les
  accords, télécharger, corriger, effacer la silhouette, supprimer le compte
  (ou effacer ce téléphone sans compte).
- Politique lisible dans l'app (`screens/Confidentialite.tsx`).
- Création de compte : « J'ai 15 ans ou plus » et lien vers la politique.
- Information au bon moment : photo (effacée sous 30 jours, éviter le
  visage), note de rendez-vous (pas de santé), Kode est une IA.

Site web : la page publique `/confidentialite` et, à l'inscription, la même
case des 15 ans avec le lien vers la politique.

## À faire avant la sortie

Ce qui ne peut pas venir du code, dans l'ordre où cela bloque :

1. **L'identité de l'éditeur et une adresse de contact.** Remplir `EDITEUR`
   dans `mobile/src/data/legal.ts` (nom ou raison sociale, forme, adresse,
   SIREN, e-mail de contact), puis `node tools/politique.mjs`. Tant que ce
   n'est pas fait, l'app et le site disent que le contact arrive. Le site
   aura aussi besoin de mentions légales (LCEN, art. 6 III).
2. **Les contrats de sous-traitance (art. 28)** à accepter dans chaque
   console : Supabase, Anthropic, Google (API Gemini), Stripe, Expo.
3. **Vérifier chez chaque prestataire ce que la politique promet** :
   aucune réutilisation pour entraîner des modèles, effacement sous 30 jours
   au plus. Points d'attention :
   - l'API Gemini doit tourner sur un compte **payant** : les conditions des
     services gratuits de Google permettent de réutiliser les contenus ;
   - si un prestataire garde les requêtes plus longtemps (surveillance des
     abus, par exemple), demander une conservation réduite ou corriger le
     texte de la politique.
4. **Transferts hors UE (art. 44 et suivants)** : vérifier l'adhésion de
   chaque prestataire américain au cadre de protection des données entre l'UE et les États-Unis
   (dataprivacyframework.gov) ; à défaut, les clauses contractuelles types
   de leur contrat de sous-traitance.
5. **Fiches des magasins** : « Confidentialité de l'app » sur l'App Store et
   « Sécurité des données » sur Google Play, à remplir d'après le registre
   (données liées à la personne, aucun suivi publicitaire).
6. **Relecture juridique** du registre, de l'analyse d'impact et de la
   politique.

## Modifier la politique

Le texte vit dans `mobile/src/data/legal.ts`. Après toute modification :

```bash
node tools/politique.mjs          # régénère ce dossier et web/src/lib/politique.ts
node tools/politique.mjs --check  # vérifie que les copies sont à jour
```

Un changement important demande une nouvelle `POLITIQUE_VERSION` et de
prévenir les personnes dans l'app avant qu'il s'applique (c'est ce que la
politique promet). Un changement de durée se reporte aussi dans `DUREES`,
dans la fonction `menage` et dans le registre.
