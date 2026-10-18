-- Planification du 07/10 : des rendez-vous décrits finement pour Kode,
-- des voyages avec leur lieu, leur motif et leur photo, une tenue par jour.
alter table public.events
  add column if not exists starts_at time,
  add column if not exists place text,
  add column if not exists setting text check (setting in ('Intérieur', 'Extérieur', 'Les deux')),
  add column if not exists impressions text[] not null default '{}';

comment on column public.events.flags is 'Les contraintes du moment (marcher, danser, pas de talons…).';
comment on column public.events.dress_code is 'La tenue voulue (Décontracté, Chic, Habillé…) ; vide : Kode choisit.';

alter table public.trips
  add column if not exists country text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists purpose text not null default 'Plaisir' check (purpose in ('Plaisir', 'Travail', 'Les deux')),
  add column if not exists activities text[] not null default '{}',
  add column if not exists image jsonb;

-- Les tenues d'un voyage partent avec lui.
alter table public.planned_days
  add column if not exists trip_id uuid references public.trips(id) on delete cascade;
create index if not exists planned_days_trip_idx on public.planned_days(trip_id);
