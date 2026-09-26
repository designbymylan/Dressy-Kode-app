# Dressy — consignes pour Claude

Dressy (appelée Dresskode dans le brief v0.2) : garde-robe numérique et
styliste IA, **Kode**. Projet entièrement en français : interface, textes,
commentaires, documentation.

## État du projet

- L'application est une **application web Next.js pensée pour mobile**
  (App Router, React 19, TypeScript, Supabase). Voir `README.md`.
- **Il n'existe pas d'application native.** Ne crée pas de projet Expo /
  React Native et ne porte pas d'écran vers le natif sans décision explicite.
- Ne rajoute ni dépendance, ni skill, ni service externe sans demander.

## Commandes

```bash
cd web && npm run typecheck        # vérification des types
cd web && npm run build            # référence pour valider une modif
cd web && npm run test:agent       # tests de l'agent (détourage, décisions)
node tools/serve.mjs               # maquettes sur http://localhost:4173
```

`npm run dev` plante parfois (`__webpack_modules__[moduleId] is not a
function`) : en cas de doute, c'est `npm run build && npm start` qui fait foi.

## Design : ce qui fait foi

Ordre de priorité, du plus fort au plus faible :

1. **Les maquettes Claude Design** : `design/_projet/*.dc.html`
   (Design System, Accueil, Dressing Portants, Fiche vêtement, Kode,
   Calendrier, Offres, Paramètres). Un écran qui existe en maquette se code
   comme la maquette.
2. **Les jetons du code** : `web/src/app/globals.css`. Les corrections de
   contraste sont documentées dans `design/tokens.css`.
3. **Le brief v0.2** (`Brief_Dresskode_Claude_Design.docx`) pour ce que les
   maquettes ne couvrent pas. **Sa typographie est périmée** : on n'utilise ni
   Archivo ni Hanken Grotesk.
4. Les skills de design, en dernier (voir plus bas).

### Règles visuelles

- Direction : épurée, premium, « vitrine de magasin ». Beaucoup de vide, la
  couleur vient des vêtements, pas de l'interface.
- Polices : **Satoshi** pour le texte et l'interface (base 15 px, interligne
  1,45), **Gambarino** pour les titres `h1–h3`.
- Couleurs : **uniquement via les variables CSS** (`var(--ink)`,
  `var(--muted)`, `var(--tile)`…), jamais de code hexadécimal dans un
  composant. Chaque écran doit marcher en clair **et** en sombre.
- Laiton : `--hi` pour les aplats et le décor seulement ; pour du texte ou
  une icône, `--hi-ink`.
- Formes : tout ce qui se clique a un rayon de 999 px ; cartes et vignettes
  de 20 à 28 px. Pas de contour sur les cartes : des fonds et des ombres
  douces (`--shadow-card`, `--shadow-soft`).
- Mise en page : largeur 390 px (`<Screen>`), marge latérale 20 px,
  espacements par pas de 4 px.
- Mouvement : 200 à 280 ms, `cubic-bezier(.2,.8,.2,1)`, coupé par
  `prefers-reduced-motion` (déjà géré dans `globals.css`).
- Accessibilité : contraste AA minimum, cibles tactiles de 44 px minimum,
  focus clavier visible.

### Comment c'est codé

- Styles en ligne (`style={{…}}`) + `globals.css`. Réutilise les briques de
  `web/src/components/ui.tsx` (`Screen`, `Title`, `Card`, `buttonPrimary`,
  `buttonQuiet`, `inputStyle`…) avant d'en créer.
- **Pas de Tailwind, pas de shadcn/ui, pas de bibliothèque d'icônes
  (Lucide, Iconify…), pas de kit d'interface.** Les icônes sont des SVG en
  ligne, trait fin, couleur héritée des variables.

## Skills de design installés : des conseillers, pas des chefs

Les skills de `.claude/skills/` donnent des principes généraux. **En cas de
conflit avec ce fichier ou les maquettes, ce fichier et les maquettes
gagnent.** Ne reprends jamais leurs choix techniques ou visuels (Tailwind,
Lucide, Recharts, dégradés, effet de verre ailleurs que sur la barre
d'onglets) ni leurs palettes.

- `mobile-app-ui-design` : principes utiles (zone du pouce, hiérarchie,
  états vides, pic émotionnel). Ignore sa section « Implementation Notes ».
- `expo-native-ui` : ne s'applique **que** si une application Expo est
  créée. Sans objet pour `web/`.
- `design-mobile-apps` (Sleek, service payant, clé `SLEEK_API_KEY`) : ne
  l'utilise **que sur demande explicite**. Ne lance aucun rendu, ne crée
  aucune clé et n'envoie vers aucune page de paiement de ta propre
  initiative. N'y envoie jamais de photo d'utilisateur réel.

## Textes de l'interface

- Tutoiement, phrases courtes, aucun jargon technique.
- Mode conseil : « tu pourrais », jamais « tu dois ».
- Prix à la française : `12,99 €`.
- Aucune marque de vêtement, enseigne ou logo réel.
- Jamais de pop-up : les offres apparaissent en contexte.

## Sécurité

- Les clés `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` vivent
  dans Supabase > Edge Functions > Secrets, **jamais dans le code** ni dans
  un fichier commité. `.env*.local` est ignoré par git.
- Côté serveur, authentifie avec `supabase.auth.getUser()` et non
  `getSession()` : seul `getUser()` revalide le jeton.
- Schéma de base : `supabase/migrations/`. Toute modification passe par une
  nouvelle migration.
