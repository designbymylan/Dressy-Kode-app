-- Le cache partagé des données du monde réel (météo, jours fériés, vacances
-- scolaires, tendances…), rempli par les Edge Functions « donnees » et « kode ».
-- Une ligne par clé (« meteo:45.76,4.84 ») pour tout le monde : chaque source
-- n'est appelée qu'une fois par période, quel que soit le nombre de personnes.
-- Rien de personnel ici : une ville, des prévisions, des dates.
create table public.data_cache (
  cle text primary key check (char_length(cle) between 1 and 200),
  valeur jsonb not null,
  source text not null,
  mention text not null,
  maj timestamptz not null,
  expire timestamptz not null,
  -- Les sources ont toutes échoué : on ne les réinterroge pas avant cette heure.
  reessai timestamptz
);

comment on table public.data_cache is 'Cache des données externes (météo, fériés, vacances, tendances), lu et écrit par les Edge Functions avec la clé service uniquement.';

create index data_cache_expire on public.data_cache (expire);

-- RLS active et aucune politique : invisible pour l'app, seule la clé service y accède.
alter table public.data_cache enable row level security;
revoke all on public.data_cache from anon, authenticated;
