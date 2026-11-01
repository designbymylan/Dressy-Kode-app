-- Compte créateur (01/11), demandé par l'utilisateur : un compte administrateur
-- (designbymylan@gmail.com) sans aucune limite, pour tous les essais.
--
--   - pièces illimitées, Kodi illimité, générations pratiquement illimitées ;
--   - aucun écran d'abonnement : l'offre de ce compte s'appelle `createur` ;
--   - la liste `admins` est fermée au client : seule la base la lit, et elle
--     ne se modifie que par une migration (ou SQL de l'administrateur du projet).

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- Vrai si l'espace appartient à un administrateur. Ne rend que cela : la
-- liste elle-même ne sort jamais de la base.
create or replace function public.space_is_creator(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.spaces s join public.admins a on a.user_id = s.owner_id
    where s.id = target
  );
$$;

revoke all on function public.space_is_creator(uuid) from public, anon;
grant execute on function public.space_is_creator(uuid) to authenticated, service_role;

-- L'offre en cours d'un espace : `createur` pour l'administrateur, sinon la
-- plus haute offre active (past_due garde les droits pendant les relances).
create or replace function public.space_plan(target uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select case when public.space_is_creator(target) then 'createur' else coalesce((
    select s.plan from public.subscriptions s
    where s.space_id = target and s.status in ('active', 'trialing', 'past_due')
    order by case s.plan when 'couture' then 3 when 'atelier' then 2 else 1 end desc
    limit 1
  ), 'decouverte') end;
$$;

-- Limites : `createur` n'en a aucune (null = sans limite).
create or replace function public.plan_limits(plan text)
returns table (pieces int, kode int)
language sql
immutable
set search_path = pg_temp
as $$
  select
    case plan when 'capsule' then 50 when 'atelier' then 100 when 'couture' then 100 when 'createur' then null else 15 end,
    case plan when 'capsule' then 30 when 'atelier' then null when 'couture' then null when 'createur' then null else 5 end;
$$;

-- Générations par mois : un million pour le créateur, qui n'atteint jamais le plafond.
create or replace function public.plan_generations(plan text)
returns int
language sql
immutable
set search_path = pg_temp
as $$
  select case plan when 'capsule' then 50 when 'atelier' then 100 when 'couture' then 100 when 'createur' then 1000000 else 0 end;
$$;

-- Le seul administrateur : le compte de l'utilisateur.
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'designbymylan@gmail.com'
on conflict do nothing;
