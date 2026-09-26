create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  name text,
  source text not null default 'user' check (source in ('user', 'kode', 'pack')),
  created_at timestamptz not null default now()
);
create index outfits_space_idx on public.outfits(space_id);

create table public.outfit_items (
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  slot text not null check (slot in ('haut', 'bas', 'robe', 'veste', 'chaussures', 'sac', 'accessoire')),
  primary key (outfit_id, garment_id)
);

-- Une tenue posée par jour, plus l'état « portée ». Reprend exactement l'état
-- que l'écran Calendrier tenait en mémoire : la clé est (espace, jour).
create table public.planned_days (
  space_id uuid not null references public.spaces(id) on delete cascade,
  day date not null,
  outfit_id uuid references public.outfits(id) on delete set null,
  worn boolean not null default false,
  primary key (space_id, day)
);

-- Les champs reprennent le formulaire « Un événement à habiller ».
create table public.events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  day date not null,
  title text not null,
  slot text check (slot in ('Matin', 'Après-midi', 'Soir')),
  kind text,
  dress_code text,
  stake text check (stake in ('Tranquille', 'Important', 'Décisif')),
  note text,
  flags text[] not null default '{}',
  outfit_id uuid references public.outfits(id) on delete set null,
  created_at timestamptz not null default now()
);
create index events_space_day_idx on public.events(space_id, day);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  destination text not null,
  starts_on date not null,
  ends_on date not null,
  capsule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index trips_space_idx on public.trips(space_id, starts_on);

alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.planned_days enable row level security;
alter table public.events enable row level security;
alter table public.trips enable row level security;

create policy outfits_all_member on public.outfits
  for all to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

create policy outfit_items_all_member on public.outfit_items
  for all to authenticated
  using (exists (select 1 from public.outfits o where o.id = outfit_id and public.is_space_member(o.space_id)))
  with check (exists (select 1 from public.outfits o where o.id = outfit_id and public.is_space_member(o.space_id)));

create policy planned_days_all_member on public.planned_days
  for all to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

create policy events_all_member on public.events
  for all to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

create policy trips_all_member on public.trips
  for all to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
