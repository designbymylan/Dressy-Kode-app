# Données du jour

Météo, air, soleil, jours fériés, ponts, vacances scolaires, tendances et
fête du jour, pour l'app mobile (fonction `donnees`) et pour Kode (fonction
`kode`). L'app n'appelle jamais ces API elle-même : elle appelle la fonction
`donnees`, avec le jeton de la personne.

## Comment ça marche

- **Une source, un fichier** (`sources/`). Chaque source lit sa réponse avec
  `exiger()` : si un champ utilisé disparaît, la lecture échoue et le test le dit.
- **8 secondes au plus** par appel (`http.ts`), avec une identification
  (`User-Agent`, réglable par le secret facultatif `DATA_USER_AGENT`).
- **Un format unique** (`types.ts`) : chaque donnée arrive dans un `Bloc`
  (`valeur`, `source`, `mention`, `maj`, `etat`, `message`), quelle que soit la
  source qui a répondu.
- **Le cache partagé** : table `public.data_cache` (RLS active, aucune
  politique : seule la clé service y accède). Une ligne par clé, pour tout le
  monde : la météo de Lyon n'est demandée qu'une fois par heure.
- **La chaîne de repli** (`repli.ts`) : valeur fraîche en cache, sinon la
  principale, puis les secours, sinon la dernière valeur connue (marquée
  « ancien », avec son heure et un message), sinon notre secours maison
  (tendances), sinon « indisponible » avec une phrase claire. Jamais d'erreur
  levée, jamais de page cassée. Après un échec complet, les sources ne sont pas
  réinterrogées avant 5 minutes.

## Les sources branchées

| Donnée | Principale (adresse) | Clé | Limite | Cache | Secours |
|---|---|---|---|---|---|
| Ville vers coordonnées | IGN Géoplateforme `data.geopf.fr/geocodage/search` | non | 50 appels/s par IP | 30 jours | Nominatim (OpenStreetMap), 1 appel/s |
| Météo (10 jours) | MET Norway `api.met.no/weatherapi/locationforecast/2.0/complete` | non | 20 appels/s, User-Agent obligatoire | 1 h | Open-Meteo `api.open-meteo.com/v1/forecast` (non commercial) |
| Air, UV, pollens | Open-Meteo Air `air-quality-api.open-meteo.com/v1/air-quality` | non | 10 000 appels/jour, non commercial | 1 h | dernière valeur connue |
| Lever et coucher du soleil | MET Norway `api.met.no/weatherapi/sunrise/3.0/sun` | non | comme la météo | 24 h (une clé par jour) | sunrise-sunset.org |
| Jours fériés (année et suivante) | `calendrier.api.gouv.fr/jours-feries/{zone}/{année}.json` | non | non publiée | 24 h | Nager.Date, puis caldays.com |
| Ponts | calculés ici (`ponts.ts`) à partir des fériés | non | aucune | avec les fériés | (caldays.com sert de témoin dans les tests) |
| Vacances scolaires | Éducation nationale `data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records` | non | 50 000 appels/jour | 24 h | OpenHolidays API |
| Tendances | Wikimedia Pageviews `wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/…` (21 articles) | non | pas de rafale (3 appels à la fois) | 24 h | dernière valeur connue, puis sélection de saison |
| Fête du jour | `nameday.abalin.net/api/V2/today/fr` | non | 60 (en-tête x-ratelimit-limit) | 24 h (une clé par jour) | aucun |

Aucune source ne demande de clé : rien à mettre dans `.env`.

## Tester

```bash
cd web && npm run test:donnees              # appelle chaque vraie API (réseau requis)
cd web && npm run test:donnees -- --hors-ligne   # repli, ponts, académies, codes météo
```

`npm test` (web) lance la partie hors ligne avec les autres tests. La partie
en ligne peut échouer quand une source limite l'adresse IP de la machine de
test (Open-Meteo, Nominatim) : c'est le signal attendu, le test le dit.

## Avant un lancement payant

- **Open-Meteo** (météo de secours, air et pollens) est gratuit pour un usage
  **non commercial** seulement : prendre son offre commerciale, ou retirer ces
  deux sources (la météo garde MET Norway et la dernière valeur connue ; l'air
  et les pollens disparaissent simplement de l'agenda).
- Relire les conditions de Nominatim (usage léger, cache obligatoire), de
  nameday.abalin.net et de sunrise-sunset.org (lien vers le site demandé).
