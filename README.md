# Dressy

Ton dressing, en vitrine. Une application pour voir toute sa garde-robe,
l'enrichir en photo et laisser **Kode**, le styliste IA, composer des tenues
avec ce qu'on possède déjà.

## Organisation

| Dossier | Contenu |
|---|---|
| `web/` | L'application (Next.js App Router, React 19, `@supabase/ssr`). |
| `supabase/functions/dressy-agent/` | L'agent central : photo → Claude → Nano Banana → Claude → dressing. |
| `supabase/migrations/` | Le schéma SQL appliqué au projet Supabase. |
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

1. demande à **Claude** de décrire la pièce et d'écrire la consigne d'image ;
2. fait redessiner la pièce par **Nano Banana 2** à partir de la photo ;
3. fait noter la fidélité par **Claude** — validée à 95/100 ;
4. sinon recommence (3 essais au plus, avec la critique de Claude), puis fait
   choisir la meilleure image à Claude ;
5. détoure l'image retenue et la range dans le dressing.

Les clés `GEMINI_API_KEY` et `ANTHROPIC_API_KEY` se règlent dans
Supabase > Edge Functions > Secrets, jamais dans le code. `CLAUDE_MODEL` règle
le modèle Claude ; `CLAUDE_DESCRIBE_MODEL`, facultatif, fait tourner la
description sur un autre modèle que le contrôle qualité. Vérification
gratuite de la configuration : `GET /functions/v1/dressy-agent?verifier`.

Tests de l'agent (détourage, décisions) :

```bash
cd web && npm run test:agent
```
