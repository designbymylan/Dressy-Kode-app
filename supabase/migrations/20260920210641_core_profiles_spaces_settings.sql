-- Fondations multi-espace de Dresskode.
-- Un compte = un profil = un espace, créé automatiquement à l'inscription.
-- L'espace est une table à part (et non une colonne du profil) parce que le
-- brief prévoit le prêt de vêtements entre amies : un jour, plusieurs profils
-- devront pouvoir lire un même espace.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Mon dressing',
  created_at timestamptz not null default now()
);
create index spaces_owner_idx on public.spaces(owner_id);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (space_id, profile_id)
);
create index space_members_profile_idx on public.space_members(profile_id);

-- Réglages de l'espace. `theme` vit ici et non dans l'écran : c'est ce qui
-- permettra au mode sombre de valoir pour toute l'app et de suivre le compte
-- d'un appareil à l'autre.
create table public.settings (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  theme text not null default 'auto' check (theme in ('light', 'dark', 'auto')),
  accent text not null default 'lilas',
  dressing_view text not null default 'portants' check (dressing_view in ('portants', 'grille')),
  density text not null default 'confortable' check (density in ('confortable', 'compacte')),
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  home_modules jsonb not null default '[]'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  kode jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.silhouettes (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  shape text check (shape in ('triangle', 'triangle_inverse', 'rectangle', 'sablier', 'ronde')),
  height_cm smallint check (height_cm between 100 and 250),
  measurements jsonb not null default '{}'::jsonb,
  usual_sizes jsonb not null default '{}'::jsonb,
  fit_prefs jsonb not null default '{}'::jsonb,
  highlight_zones text[] not null default '{}',
  comfort_zones text[] not null default '{}',
  precision_score smallint not null default 0 check (precision_score between 0 and 100),
  updated_at timestamptz not null default now()
);

-- Appartenance à un espace. SECURITY DEFINER pour que la politique RLS de
-- space_members ne se lise pas elle-même en boucle.
create function public.is_space_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = target and m.profile_id = (select auth.uid())
  );
$$;

-- À l'inscription : profil, espace, réglages et silhouette vide.
-- Aucun vêtement n'est créé — la garde-robe reste vide jusqu'à un ajout manuel.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_space uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );

  insert into public.spaces (owner_id) values (new.id) returning id into new_space;
  insert into public.space_members (space_id, profile_id, role) values (new_space, new.id, 'owner');
  insert into public.settings (space_id) values (new_space);
  insert into public.silhouettes (space_id) values (new_space);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.settings enable row level security;
alter table public.silhouettes enable row level security;

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy spaces_select_member on public.spaces
  for select to authenticated using (public.is_space_member(id));
create policy spaces_update_owner on public.spaces
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy space_members_select_own on public.space_members
  for select to authenticated using (profile_id = (select auth.uid()) or public.is_space_member(space_id));

create policy settings_select_member on public.settings
  for select to authenticated using (public.is_space_member(space_id));
create policy settings_update_member on public.settings
  for update to authenticated using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

create policy silhouettes_select_member on public.silhouettes
  for select to authenticated using (public.is_space_member(space_id));
create policy silhouettes_update_member on public.silhouettes
  for update to authenticated using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
