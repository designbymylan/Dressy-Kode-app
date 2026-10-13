---
name: dressy-qa
description: Recette de Dresskode (site web et app mobile) - lance les vérifications du projet, parcourt les écrans dans un vrai navigateur en clair et en sombre, relit le code changé, puis écrit un rapport des bugs classés par gravité avec la cause et la solution de chacun. À utiliser pour « teste l'app », « trouve les bugs », « fais une recette », « vérifie avant la mise en ligne », ou après une grosse série de changements. Invocation directe : /dressy-qa [web | mobile | <écran> | <branche>].
---

# Dresskode, recette et rapport de bugs

But : **trouver, prouver et classer** les bugs, puis proposer une solution
pour chacun. On ne corrige pas pendant la recette, sauf si la personne l'a
demandé (« et corrige ») : un rapport sert à décider, pas à cacher des
changements dans une revue.

Les règles du projet (charte, verre, arrondis, typographie, accessibilité,
« jamais de hex dans un composant ») sont dans `CLAUDE.md` : elles servent de
référence pour juger ce qui est un écart.

## 0. Cadrer

- Périmètre : tout, `web`, `mobile`, un écran, ou les changements d'une
  branche (`git log --oneline main..HEAD`, `git diff --stat main...HEAD`).
- Note la branche et le commit testés : ils vont en tête du rapport.

## 1. Vérifications du projet (rapides, d'abord)

Lance ce qui concerne le périmètre ; chaque échec est un bug **bloquant**.

```bash
cd web && npm ci --no-audit --no-fund   # si node_modules manque
cd web && npm run typecheck
cd web && npm run build                 # fait foi (npm run dev plante parfois)
cd web && npm run test:agent && npm run test:kode && npm run test:billing
cd web && npm run test:donnees -- --hors-ligne
cd mobile && npm ci --no-audit --no-fund && npx tsc --noEmit
python3 design/refonte/contraste.py     # palette mobile, doit être tout vert
```

`test:donnees` sans `--hors-ligne` appelle les vraies API : seulement si on
te le demande.

## 2. Parcours dans un navigateur

**Site web** : `cd web && npm start` en arrière-plan, puis

```bash
node tools/qa-web.mjs --base http://localhost:3000 \
  --routes /bienvenue,/connexion,/inscription,/mot-de-passe,/confidentialite,/accueil,/dressing,/dressing/ajouter,/tenues,/tenues/nouvelle,/kode,/calendrier,/moi,/offres \
  --out <scratchpad>/qa-web
```

Les routes privées demandent `web/.env.local` (Supabase) et un compte de
test (`QA_EMAIL`, `QA_PASSWORD`) : sans eux elles redirigent ou renvoient
500. C'est une **limite de l'environnement**, à noter comme telle, pas un bug
de l'app. Ne crée jamais de compte sur la vraie base sans accord.

**App mobile** : on ne peut pas la lancer sur un iPhone depuis le cloud.
Son aperçu web tourne en démonstration (Alice, 37 pièces, sans réseau) :

```bash
cd mobile && npx expo export --platform web      # écrit dist/
python3 -m http.server -d dist 8081              # en arrière-plan, rien à installer
node ../tools/qa-web.mjs --base http://localhost:8081 --routes / --out <scratchpad>/qa-mobile
```

La navigation n'a pas de liens (React Navigation) : pour aller plus loin,
écris un petit script Playwright qui clique sur les `testID` (rendus en
`data-testid`), capture chaque écran en clair et en sombre, et relève les
erreurs de console. Ce qui dépend du natif (appareil photo, notifications,
Liquid Glass, haptique) ne se teste qu'en vrai dans Expo Go : liste-le dans
« À tester sur téléphone ».

**Regarde chaque capture** (Read sur les PNG) : texte coupé, chevauchement,
mode sombre illisible, élément hors charte, état vide absent. Un bug visuel
se prouve par sa capture.

## 3. Relecture du code

- Changements récents : `/code-review` sur la branche (niveau `high`).
- Recherches ciblées, chaque résultat est à vérifier avant d'être un bug :
  - couleurs en dur dans un composant : `rg -n "#[0-9a-fA-F]{3,6}\b" web/src/components mobile/src/screens mobile/src/ui`
    (permis pour la teinte d'un vêtement ou un aperçu de thème) ;
  - texte sous 11 px : `rg -n "fontSize: ?([0-9]|10)\b" mobile/src web/src` ;
  - promesses non attendues, `catch {}` muets, `any`, `TODO` dans le code touché ;
  - appels réseau depuis l'app vers une API externe (interdit : tout passe par
    les fonctions Supabase).
- Sécurité si le périmètre touche Supabase (RLS, fonctions, stockage) :
  `/security-review`.

## 4. Classer

| Gravité | Critère |
|---|---|
| **Bloquant** | Build, types ou tests en échec ; écran qui plante ; perte de données ; faille |
| **Majeur** | Parcours principal gêné (ajout de pièce, tenue du jour, Kode, compte, paiement) ; mode sombre illisible ; contraste AA raté |
| **Mineur** | Défaut visible sans blocage : cible sous 44 px, texte coupé, état vide manquant, écart de charte |
| **Cosmétique** | Détail d'alignement, d'espacement, de libellé |

Un point non reproduit deux fois n'est pas un bug : il va en « À surveiller ».
Les doublons (même cause, plusieurs écrans) sont fusionnés.

## 5. Rapport

Écris `docs/qa/<AAAA-MM-JJ>-recette.md` :

```markdown
# Recette du <date> — <branche> @ <commit>

Périmètre : … · Vérifications : typecheck ✓, build ✓, tests ✓ … · Pages vues : n

## Bugs
| # | Gravité | Où | Ce qui se passe | Reproduire | Cause | Solution proposée |

## À tester sur téléphone
## À surveiller
## Limites de cette recette
```

Chaque bug a sa preuve (sortie de commande, capture, ligne de code
`fichier:ligne`). Une solution dit **quoi** changer et **où** ; si elle touche
la disposition d'un écran ou ajoute une dépendance, dis-le : ces choix
reviennent à la personne (`CLAUDE.md`).

Termine en trois lignes dans la conversation : le nombre de bugs par
gravité, les trois à corriger d'abord, et ce qui n'a pas pu être testé.
Commite le rapport (pas les captures) si la personne le veut dans le dépôt.
