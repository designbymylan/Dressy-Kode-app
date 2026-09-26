-- Catégories : table de référence commune, pas par espace. Les portants du
-- Dressing sont fixés par le design ; un espace neuf a donc ses rails, mais
-- aucun vêtement dedans.
create table public.categories (
  id text primary key,
  label text not null,
  sort smallint not null,
  shelf boolean not null default false
);

insert into public.categories (id, label, sort, shelf) values
  ('hauts',        'Hauts',        10, false),
  ('bas',          'Bas',          20, false),
  ('robes',        'Robes',        30, false),
  ('vestes',       'Vestes et manteaux', 40, false),
  ('chaussures',   'Chaussures',   50, true),
  ('sacs',         'Sacs',         60, true),
  ('accessoires',  'Accessoires',  70, true);

create table public.garments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  category_id text not null references public.categories(id),
  name text not null,
  colors text[] not null default '{}',
  material text,
  care text,
  notes text,
  -- Chemins dans le bucket storage, jamais des URL publiques : les images
  -- d'une garde-robe sont privées et servies par URL signée.
  image_path text,
  thumb_path text,
  source text not null default 'photo' check (source in ('photo', 'ai', 'import')),
  status text not null default 'active' check (status in ('active', 'archived', 'lent', 'laundry')),
  purchase_price_cents integer check (purchase_price_cents >= 0),
  acquired_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index garments_space_idx on public.garments(space_id);
create index garments_space_category_idx on public.garments(space_id, category_id);

-- Un port par jour et par pièce : c'est ce qui alimente « nombre de ports »,
-- « dernier port » et le coût par port de la fiche vêtement.
create table public.wears (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references public.garments(id) on delete cascade,
  worn_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (garment_id, worn_on)
);
create index wears_garment_idx on public.wears(garment_id);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references public.garments(id) on delete cascade,
  direction text not null check (direction in ('out', 'in')),
  counterpart_name text not null,
  counterpart_profile_id uuid references public.profiles(id) on delete set null,
  lent_on date not null default current_date,
  due_on date,
  returned_on date,
  created_at timestamptz not null default now()
);
create index loans_garment_idx on public.loans(garment_id);

-- security_invoker : la vue s'exécute avec les droits de l'appelant, donc la
-- RLS de garments s'applique. Sans cela, elle divulguerait tous les espaces.
create view public.garment_stats with (security_invoker = on) as
select
  g.id as garment_id,
  g.space_id,
  count(w.id)::int as wear_count,
  max(w.worn_on) as last_worn_on,
  case
    when count(w.id) > 0 and g.purchase_price_cents is not null
    then round(g.purchase_price_cents::numeric / count(w.id))::int
  end as cost_per_wear_cents
from public.garments g
left join public.wears w on w.garment_id = g.id
group by g.id, g.space_id, g.purchase_price_cents;

alter table public.categories enable row level security;
alter table public.garments enable row level security;
alter table public.wears enable row level security;
alter table public.loans enable row level security;

create policy categories_read_all on public.categories
  for select to authenticated using (true);

create policy garments_all_member on public.garments
  for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

create policy wears_all_member on public.wears
  for all to authenticated
  using (exists (select 1 from public.garments g where g.id = garment_id and public.is_space_member(g.space_id)))
  with check (exists (select 1 from public.garments g where g.id = garment_id and public.is_space_member(g.space_id)));

create policy loans_all_member on public.loans
  for all to authenticated
  using (exists (select 1 from public.garments g where g.id = garment_id and public.is_space_member(g.space_id)))
  with check (exists (select 1 from public.garments g where g.id = garment_id and public.is_space_member(g.space_id)));
