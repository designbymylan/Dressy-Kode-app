-- Doublures minimales de Supabase pour essayer la migration pipeline_ajout :
-- rôles, auth.uid(), espaces, garments tel qu'en production le 20/11, Storage.
create schema auth; create schema storage;
create role anon; create role authenticated; create role service_role;
grant usage on schema public, storage, auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;

create table public.profiles (id uuid primary key);
create table public.spaces (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id));
create table public.space_members (space_id uuid references public.spaces(id), profile_id uuid references public.profiles(id), primary key (space_id, profile_id));
create function public.is_space_member(target uuid) returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.space_members m where m.space_id = target and m.profile_id = (select auth.uid())) $$;
create function public.safe_uuid(t text) returns uuid language plpgsql immutable set search_path = pg_temp
as $$ begin return t::uuid; exception when others then return null; end $$;
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table public.categories (id text primary key);
insert into public.categories values ('hauts'), ('bas'), ('robes'), ('vestes'), ('chaussures'), ('sacs'), ('bijoux'), ('accessoires');

create table public.garments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  category_id text not null references public.categories(id),
  name text not null,
  colors text[] not null default '{}',
  material text, care text, notes text, image_path text, thumb_path text,
  source text not null default 'photo',
  status text not null default 'active',
  purchase_price_cents integer, acquired_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text check (kind ~ '^[a-z]{2,20}$'),
  tint text, season text check (season in ('toute_annee', 'mi_saison', 'hiver', 'ete')),
  brand text, size text, fit text, reports smallint not null default 0, fiche jsonb
);
create trigger garments_touch before update on public.garments for each row execute function public.touch_updated_at();
alter table public.garments enable row level security;
create policy garments_all_member on public.garments for all to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
grant select, insert, update, delete on public.garments to authenticated, service_role;
grant select on public.categories to authenticated;

-- Storage
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null, unique (bucket_id, name));
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
create policy garments_objects_member on storage.objects for all to authenticated
  using (bucket_id = any (array['garments', 'ai-generated', 'uploads']) and public.is_space_member(public.safe_uuid((storage.foldername(name))[1])))
  with check (bucket_id = any (array['garments', 'ai-generated', 'uploads']) and public.is_space_member(public.safe_uuid((storage.foldername(name))[1])));

create publication supabase_realtime;

-- Deux personnes, deux espaces, une pièce d'avant chez chacune.
insert into public.profiles values ('a0000000-0000-4000-8000-000000000001'), ('b0000000-0000-4000-8000-000000000002');
insert into public.spaces values ('aaaaaaaa-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');
insert into public.space_members values ('aaaaaaaa-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002');
insert into public.garments (id, space_id, category_id, name, kind, season, colors, material, fiche) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hauts', 'Pull marine', 'pull', 'hiver', '{marine}', 'maille côtelée', '{"motif":"uni","habillage":2}'),
  ('bbbbbbbb-1111-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'bas', 'Jean brut', 'jean', 'toute_annee', '{bleu}', 'denim', null);
