-- Doublures minimales de Supabase pour essayer la migration notifications_push.
create schema auth; create schema extensions; create schema net;
create role anon; create role authenticated; create role service_role;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.ai_jobs(id),
  requested_by uuid,
  status text not null default 'queued',
  updated_at timestamptz not null default now()
);
-- net.http_post : on note les appels au lieu de les envoyer (et on peut le casser pour essayer l'avalement d'erreur).
create table public.http_calls (url text, body jsonb);
create function net.http_post(url text, body jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language plpgsql as $$
begin
  if current_setting('test.casse', true) = '1' then raise exception 'réseau coupé'; end if;
  insert into public.http_calls values (url, body); return 1;
end $$;
