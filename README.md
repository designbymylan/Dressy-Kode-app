# Dressy

Ton dressing, en vitrine. Une application pour voir toute sa garde-robe,
l'enrichir en photo et laisser **Kode**, le styliste IA, composer des tenues
avec ce qu'on possède déjà.

## Organisation

| Dossier | Contenu |
|---|---|
| `mobile/` | L'app iPhone (Expo SDK 57, NativeWind, Reanimated) : la refonte, 18 écrans en clair et sombre, branchée sur Supabase (mode démonstration sans réseau). Voir `mobile/README.md`. |
| `web/` | L'application web (Next.js App Router, React 19, `@supabase/ssr`), branchée sur Supabase. |
| `supabase/functions/dressy-agent/` | L'agent central : photo → Opus 5 (toutes les pièces) → Nano Banana (une image par pièce, en parallèle) → Sonnet 5 → dressing. |
| `supabase/functions/kode/` | Kode, le styliste : question → Claude → tenue composée avec les pièces du dressing. |
| `supabase/functions/billing/`, `stripe-webhook/` | Les abonnements : ouverture du paiement Stripe, et le webhook qui active l'offre. |
| `supabase/migrations/` | Le schéma SQL complet, dans l'ordre où il a été appliqué au projet Supabase. |
| `design/` | Les maquettes Claude Design (`_projet/*.dc.html`) et la refonte : recherche, design system, vérification du contraste (`refonte/`). |
| `tools/` | Petits outils : extraction du bundle de design, serveur des maquettes, tests du calendrier, mise en place de Stripe. |

## Lancer l'application

```bash
cd web
cp .env.local.example .env.local
npm install
npm run build && npm start
```

Puis http://localhost:3000. Le mode `npm run dev` existe, mais son bundler
plante parfois (`__webpack_modules__[moduleId] is not a function`) : le build
de production est la référence pour vérifier.

## L'agent central

Chaque photo ajoutée devient une ligne `ai_jobs`. Un trigger réveille l'Edge
Function `dressy-agent`, qui :

1. demande à **Claude Opus 5** de repérer TOUTES les pièces de la photo
   (vêtements, chaussures, sacs, bijoux, accessoires), ou seulement celles que
   la personne a nommées dans la précision, et d'écrire une consigne d'image
   par pièce ;
2. garde la première pièce et crée une tâche fille par pièce en plus : elles
   se dessinent en parallèle, chacune dans son propre passage ;
3. fait redessiner chaque pièce, seule et sur un fond uni choisi loin de ses
   couleurs, par **Nano Banana** à partir de la photo ;
4. fait noter la fidélité par **Claude Sonnet 5**, validée à 88/100 ; sinon
   Opus 5 corrige la consigne pour un second essai, puis le contrôle garde la
   meilleure des deux images ;
5. détoure l'image retenue (fond, trous enfermés, poussières, bords doux) et
   la range, transparente, dans le dressing.

Rien de tout cela ne se voit à l'écran : la personne ne lit que « Kode repère
chaque pièce », « Kode dessine ta pièce »… Les erreurs montrées ne nomment
jamais un modèle ; le détail technique part dans les journaux de la fonction.

Les clés `GEMINI_API_KEY` et `ANTHROPIC_API_KEY` se règlent dans
Supabase > Edge Functions > Secrets, jamais dans le code. Réglages facultatifs :
`CLAUDE_PROMPT_MODEL` (consignes, `claude-opus-5` par défaut),
`CLAUDE_MODEL` (contrôle, `claude-sonnet-5`), `CLAUDE_PROMPT_EFFORT` et
`CLAUDE_JUDGE_EFFORT` (`medium` et `low`), `GEMINI_IMAGE_MODEL`. Vérification
gratuite de la configuration : `GET /functions/v1/dressy-agent?verifier`.

## Kode, le styliste

L'écran `/kode` pose la question à l'Edge Function `kode`, qui relit avec le
jeton de la personne (donc sous RLS) son profil, son dressing (pièces
disponibles, nombre de ports), son agenda Dressy des 14 jours à venir et la
conversation en cours, puis fait répondre **Claude** en sortie structurée :
une réponse courte et, quand la question s'y prête, une tenue.

- Chaque pièce est présentée au modèle sous une référence courte (`p1`,
  `p2`…) ; une référence inventée est écartée, et sous deux pièces valides
  aucune carte n'est montrée. Kode ne peut donc proposer que ce qui existe.
- La tenue est enregistrée (`outfits`, source `kode`) : « Prévoir pour
  demain » la pose dans `planned_days`, et l'accueil l'affiche le jour venu
  avec « Je la porte », qui note un port par pièce (`wears`).
- Quota selon l'offre (voir Paiements), compté en base par `kode_ask()`.
  Une question sans réponse (erreur, refus) est retirée et ne compte pas.
- Modèle : `claude-opus-5` par défaut, avec repli automatique en cas de refus.
  Pour réduire le coût par question, le secret facultatif `KODE_MODEL` accepte
  par exemple `claude-sonnet-5`.

Déploiement (vérification JWT **activée**, contrairement à `dressy-agent`) :

```bash
supabase db push                 # applique 20260926200326_kode.sql
supabase functions deploy kode   # utilise ANTHROPIC_API_KEY, déjà en secret
```

## Paiements (Stripe)

Les offres de `Offres.dc.html`, vendues en abonnement mensuel ou annuel
(le premier mois de l'annuel offert, une fois par espace) :

| Offre | Mensuel | Annuel | Pièces | Kode |
|---|---|---|---|---|
| Découverte (sans abonnement) | · | · | 30 | 5 questions / mois |
| Capsule | 6,99 € | 59,99 € | 60 | 20 questions / mois |
| Atelier | 12,99 € | 109,99 € | 200 | sans limite |
| Couture | 24,99 € | 219,99 € | sans limite | sans limite |

Les montants vivent dans `web/src/lib/plans.ts`, les limites dans
`plan_limits()` (migration `abonnements`) : la base refuse la pièce ou la
question de trop, quel que soit l'écran. Une offre ne s'active **que** par
le webhook, une fois le paiement confirmé par Stripe ; le navigateur ne peut
rien s'accorder. Le changement d'offre, la carte, les factures et la
résiliation passent par le portail client de Stripe.

Mise en service, en mode test d'abord :

```bash
# 1. produits, prix, portail client et webhook dans le compte Stripe
STRIPE_SECRET_KEY=sk_test_… APP_URL=https://ton-domaine node tools/stripe-setup.mjs

# 2. les clés côté Supabase (le script affiche la commande exacte)
supabase secrets set STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=whsec_… APP_URL=https://ton-domaine

# 3. la base et les fonctions
supabase db push
supabase functions deploy billing
supabase functions deploy stripe-webhook --no-verify-jwt   # Stripe signe, il n'a pas de jeton
```

Paiement d'essai : carte `4242 4242 4242 4242`, date future, CVC quelconque.
Vérification sans frais : `GET /functions/v1/billing` dit si la clé est
test ou live et si le secret du webhook est posé. Pour passer en live :
relancer le script avec la clé live et `--live`, puis remplacer les secrets.

## Tests

Sans réseau ni clé : détourage et décisions de l'agent, dressing et
historique de Kode, lecture des abonnements Stripe et accord des catalogues.

```bash
cd web && npm test
```
