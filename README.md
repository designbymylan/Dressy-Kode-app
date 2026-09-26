# Dressy

Ton dressing, en vitrine. Une application pour voir toute sa garde-robe,
l'enrichir en photo et laisser **Kode**, le styliste IA, composer des tenues
avec ce qu'on possède déjà.

## Organisation

| Dossier | Contenu |
|---|---|
| `web/` | L'application (Next.js App Router, React 19, `@supabase/ssr`). |
| `supabase/functions/dressy-agent/` | L'agent central : photo → ChatGPT → Nano Banana → Claude → dressing. |
| `supabase/functions/kode/` | Kode, le styliste : question → Claude → tenue composée avec les pièces du dressing. |
| `supabase/migrations/` | Le schéma SQL complet, dans l'ordre où il a été appliqué au projet Supabase. |
| `design/` | Les maquettes Claude Design (`_projet/*.dc.html`), spécification visuelle de référence. |
| `tools/` | Petits outils : extraction du bundle de design, serveur des maquettes, tests du calendrier. |

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

1. demande à **ChatGPT** de décrire la pièce et d'écrire la consigne d'image ;
2. fait redessiner la pièce par **Nano Banana 2** à partir de la photo ;
3. fait noter la fidélité par **Claude** — validée à 95/100 ;
4. sinon recommence (3 essais au plus, avec la critique de Claude), puis fait
   choisir la meilleure image à Claude ;
5. détoure l'image retenue et la range dans le dressing.

Les clés `OPENAI_API_KEY`, `GEMINI_API_KEY` et `ANTHROPIC_API_KEY` se règlent
dans Supabase > Edge Functions > Secrets, jamais dans le code. Vérification
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
- Quota : 20 questions par mois et par espace (offre gratuite de
  `Offres.dc.html`), compté en base par `kode_ask()`. Une question sans
  réponse (erreur, refus) est retirée et ne compte pas.
- Modèle : `claude-opus-5` par défaut, avec repli automatique en cas de refus.
  Pour réduire le coût par question, le secret facultatif `KODE_MODEL` accepte
  par exemple `claude-sonnet-5`.

Déploiement (vérification JWT **activée**, contrairement à `dressy-agent`) :

```bash
supabase db push                 # applique 20260926120000_kode.sql
supabase functions deploy kode   # utilise ANTHROPIC_API_KEY, déjà en secret
```

## Tests

Sans réseau ni clé : détourage et décisions de l'agent, dressing et
historique de Kode.

```bash
cd web && npm test
```
