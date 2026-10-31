
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user) $$;
create table public.profiles (id uuid primary key);
create table public.spaces (id uuid primary key default gen_random_uuid());
create table public.space_members (space_id uuid references public.spaces(id), profile_id uuid references public.profiles(id));
create function public.is_space_member(target uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.space_members m where m.space_id = target and m.profile_id = (select auth.uid())) $$;
create table public.subscriptions (id text primary key, space_id uuid, plan text, period text, status text);
create function public.plan_limits(plan text) returns table (pieces int, kode int) language sql immutable as $$ select 30, 5 $$;
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
create table public.garments (id uuid primary key default gen_random_uuid(), space_id uuid references public.spaces(id), status text default 'active', reports smallint default 0, name text default 'x');
create table public.ai_jobs (id uuid primary key default gen_random_uuid(), space_id uuid references public.spaces(id), requested_by uuid, status text default 'queued', garment_id uuid, runs int default 0, error text, claimed_at timestamptz, redo smallint default 0, cutout jsonb, details jsonb, created_at timestamptz default now());
create table public.garment_reports (id uuid primary key default gen_random_uuid(), garment_id uuid, space_id uuid, level smallint, before jsonb);
create function public.garments_plan_limit() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.ai_jobs_plan_limit() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.ai_jobs_clean_details() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.pieces_left(target uuid) returns int language sql as $$ select 0 $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Comme Supabase : les tables créées ensuite sont ouvertes par défaut aux rôles de l'API (la RLS et les revoke de la migration restreignent).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
