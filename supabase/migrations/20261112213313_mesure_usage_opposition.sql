-- Droit d'opposition à la mesure de l'usage (12/11) : la mesure repose sur
-- l'intérêt légitime (RGPD, art. 6.1.f), la personne peut donc s'y opposer
-- (art. 21). Sur demande, son espace est inscrit ici par l'éditeur et sort du
-- calcul. La liste ne garde que l'identifiant de l'espace et la date ; elle
-- part avec le compte. Fermée au client.
create table if not exists public.usage_exclus (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.usage_exclus enable row level security;
revoke all on public.usage_exclus from anon, authenticated;

-- La même vue qu'avant (migration `mesure_usage`), sans les espaces qui se
-- sont opposés.
create or replace view public.usage_funnel with (security_invoker = on) as
with jour as (
  select (now() at time zone 'Europe/Paris')::date as d
), comptes as (
  select s.id, (s.created_at at time zone 'Europe/Paris')::date as ne
  from public.spaces s
  where not public.space_is_creator(s.id)
    and not exists (select 1 from public.usage_exclus x where x.space_id = s.id)
), actes as (
  select g.space_id, (g.created_at at time zone 'Europe/Paris')::date as jour from public.garments g
  union
  select g.space_id, (w.created_at at time zone 'Europe/Paris')::date from public.wears w join public.garments g on g.id = w.garment_id
  union
  select m.space_id, (m.created_at at time zone 'Europe/Paris')::date from public.kode_messages m where m.author = 'user'
), par_compte as (
  select c.id, c.ne,
    (select count(*) from public.garments g where g.space_id = c.id and g.status <> 'archived') as pieces,
    (select min(w.worn_on) from public.wears w join public.garments g on g.id = w.garment_id where g.space_id = c.id) as premier_port,
    exists (select 1 from public.kode_messages m where m.space_id = c.id and m.author = 'user') as a_demande,
    exists (select 1 from actes a where a.space_id = c.id and a.jour = c.ne + 1) as lendemain,
    exists (select 1 from actes a where a.space_id = c.id and a.jour between c.ne + 1 and c.ne + 7) as semaine
  from comptes c
)
select
  count(*) as comptes,
  count(*) filter (where pieces >= 3) as avec_trois_pieces,
  count(*) filter (where premier_port is not null) as premiere_tenue_portee,
  round(count(*) filter (where premier_port is not null)::numeric / nullif(count(*), 0), 3) as part_premiere_tenue,
  percentile_cont(0.5) within group (order by greatest(premier_port - ne, 0)) filter (where premier_port is not null) as jours_medians_avant_premiere_tenue,
  count(*) filter (where a_demande) as question_a_kodi,
  round(count(*) filter (where a_demande)::numeric / nullif(count(*), 0), 3) as part_question_a_kodi,
  count(*) filter (where ne <= (select d from jour) - 2) as comptes_de_deux_jours,
  count(*) filter (where lendemain and ne <= (select d from jour) - 2) as revenus_le_lendemain,
  round(count(*) filter (where lendemain and ne <= (select d from jour) - 2)::numeric / nullif(count(*) filter (where ne <= (select d from jour) - 2), 0), 3) as part_retour_lendemain,
  count(*) filter (where ne <= (select d from jour) - 8) as comptes_de_huit_jours,
  count(*) filter (where semaine and ne <= (select d from jour) - 8) as revenus_dans_la_semaine,
  round(count(*) filter (where semaine and ne <= (select d from jour) - 8)::numeric / nullif(count(*) filter (where ne <= (select d from jour) - 8), 0), 3) as part_retour_semaine
from par_compte;

revoke all on public.usage_funnel from anon, authenticated;
grant select on public.usage_funnel to service_role;
