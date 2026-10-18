-- Abonnements Stripe et limites de chaque offre.
--
-- Stripe est la référence : ces tables n'en sont que le reflet, écrit par
-- l'Edge Function stripe-webhook avec la clé service. Le navigateur les lit,
-- ne les écrit jamais : une offre ne s'accorde pas depuis le client.

create table public.billing_customers (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id text primary key, -- sub_… chez Stripe
  space_id uuid not null references public.spaces(id) on delete cascade,
  stripe_customer_id text not null,
  plan text not null check (plan in ('capsule', 'atelier', 'couture')),
  period text not null check (period in ('mois', 'an')),
  status text not null, -- tel que Stripe le donne : active, trialing, past_due, canceled…
  price_id text not null,
  current_period_end timestamptz,
  cancel_at timestamptz,
  trial_end timestamptz,
  updated_at timestamptz not null default now()
);
create index subscriptions_space_idx on public.subscriptions (space_id);

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;

create policy billing_customers_select_member on public.billing_customers
  for select to authenticated using (public.is_space_member(space_id));
create policy subscriptions_select_member on public.subscriptions
  for select to authenticated using (public.is_space_member(space_id));

revoke all on public.billing_customers from anon;
revoke all on public.subscriptions from anon;
revoke insert, update, delete, truncate, references, trigger on public.billing_customers from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.subscriptions from authenticated;

-- ---------------------------------------------------------------- offres

-- Ce que chaque offre permet ; null = sans limite. Mêmes valeurs que
-- web/src/lib/plans.ts, qui les affiche. « decouverte » = sans abonnement.
create or replace function public.plan_limits(plan text)
returns table (pieces int, kode int)
language sql
immutable
set search_path = pg_temp
as $$
  select
    case plan when 'capsule' then 60 when 'atelier' then 200 when 'couture' then null else 30 end,
    case plan when 'capsule' then 20 when 'atelier' then null when 'couture' then null else 5 end;
$$;

-- L'offre en cours d'un espace. past_due garde les droits pendant que
-- Stripe relance le paiement : on ne coupe pas au premier refus de carte.
-- Invoker : la RLS de subscriptions s'applique.
create or replace function public.space_plan(target uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select s.plan from public.subscriptions s
    where s.space_id = target and s.status in ('active', 'trialing', 'past_due')
    order by case s.plan when 'couture' then 3 when 'atelier' then 2 else 1 end desc
    limit 1
  ), 'decouverte');
$$;

revoke all on function public.space_plan(uuid) from public, anon;
grant execute on function public.space_plan(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- Kode

-- Le quota de Kode suit désormais l'offre ; quota null = questions illimitées.
create or replace function public.kode_usage(target uuid)
returns table (used int, quota int)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    (
      select count(*)::int from public.kode_messages
      where space_id = target
        and author = 'user'
        and created_at >= (date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')
    ),
    (select l.kode from public.plan_limits(public.space_plan(target)) l);
$$;

create or replace function public.kode_ask(target uuid, question text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  u record;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('kode:' || target::text, 0));

  select * into u from public.kode_usage(target);
  if u.quota is not null and u.used >= u.quota then
    raise exception 'Tu as posé tes % questions à Kode ce mois-ci. Elles reviennent le 1er du mois, ou sans limite avec Atelier.',
      u.quota
      using errcode = 'P0001', hint = 'quota';
  end if;

  insert into public.kode_messages (space_id, author, body)
  values (target, 'user', left(btrim(question), 600))
  returning id into new_id;
  return new_id;
end
$$;

drop function public.kode_monthly_limit();

-- ---------------------------------------------------------------- pièces

-- Une pièce de plus que l'offre ne permet est refusée, qu'elle soit saisie
-- à la main ou confiée en photo. Le verrou empêche deux ajouts simultanés
-- de passer tous les deux sur la dernière place.
create or replace function public.pieces_left(target uuid)
returns int
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lim int;
  n int;
begin
  select l.pieces into lim from public.plan_limits(public.space_plan(target)) l;
  if lim is null then return null; end if;

  perform pg_advisory_xact_lock(hashtextextended('pieces:' || target::text, 0));
  select
    (select count(*) from public.garments where space_id = target and status <> 'archived')
    + (select count(*) from public.ai_jobs where space_id = target and status not in ('done', 'failed'))
  into n;
  return lim - n;
end
$$;

create or replace function public.garments_plan_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lim int;
begin
  -- L'agent range une pièce déjà comptée quand sa photo a été confiée. Le
  -- rôle Postgres fait foi, quel que soit le type de clé qui l'a ouvert.
  if current_user = 'service_role' or (select auth.role()) = 'service_role' then
    return new;
  end if;
  if public.pieces_left(new.space_id) <= 0 then
    select l.pieces into lim from public.plan_limits(public.space_plan(new.space_id)) l;
    raise exception 'Ton dressing est plein : % pièces avec ton offre actuelle. Les offres supérieures en accueillent plus.', lim
      using errcode = 'P0001', hint = 'pieces';
  end if;
  return new;
end
$$;

create trigger garments_plan_limit
  before insert on public.garments
  for each row execute function public.garments_plan_limit();

create or replace function public.ai_jobs_plan_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lim int;
begin
  if public.pieces_left(new.space_id) <= 0 then
    select l.pieces into lim from public.plan_limits(public.space_plan(new.space_id)) l;
    raise exception 'Ton dressing est plein : % pièces avec ton offre actuelle. Les offres supérieures en accueillent plus.', lim
      using errcode = 'P0001', hint = 'pieces';
  end if;
  return new;
end
$$;

create trigger ai_jobs_plan_limit
  before insert on public.ai_jobs
  for each row execute function public.ai_jobs_plan_limit();

revoke all on function public.pieces_left(uuid) from public, anon;
grant execute on function public.pieces_left(uuid) to authenticated, service_role;
revoke all on function public.garments_plan_limit() from public, anon, authenticated;
revoke all on function public.ai_jobs_plan_limit() from public, anon, authenticated;
