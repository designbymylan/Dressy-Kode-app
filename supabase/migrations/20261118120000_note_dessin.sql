-- Noter le dessin d'une pièce (18/11) : trois notes de 1 à 5 (le temps que
-- Kodi a mis, la qualité, le rendu final), une seule fois par pièce, modifiable.
-- Elles servent à mesurer la bêta (qualité des dessins, vitesse) ; rien n'est
-- lu par Kodi. La note part avec la pièce quand elle est retirée ou que le
-- compte est supprimé.
create table public.piece_ratings (
  garment_id uuid primary key references public.garments(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  speed smallint not null check (speed between 1 and 5),
  quality smallint not null check (quality between 1 and 5),
  result smallint not null check (result between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index piece_ratings_space_idx on public.piece_ratings (space_id);

create trigger piece_ratings_touch before update on public.piece_ratings
  for each row execute function public.touch_updated_at();

alter table public.piece_ratings enable row level security;
revoke all on public.piece_ratings from anon;
revoke truncate, references, trigger on public.piece_ratings from authenticated;

create policy piece_ratings_select_member on public.piece_ratings
  for select to authenticated using (public.is_space_member(space_id));
-- La pièce notée doit être celle de l'espace : on ne note pas le dessin d'un autre.
create policy piece_ratings_insert_member on public.piece_ratings
  for insert to authenticated with check (
    public.is_space_member(space_id)
    and exists (select 1 from public.garments g where g.id = garment_id and g.space_id = piece_ratings.space_id)
  );
create policy piece_ratings_update_member on public.piece_ratings
  for update to authenticated
  using (public.is_space_member(space_id))
  with check (
    public.is_space_member(space_id)
    and exists (select 1 from public.garments g where g.id = garment_id and g.space_id = piece_ratings.space_id)
  );
create policy piece_ratings_delete_member on public.piece_ratings
  for delete to authenticated using (public.is_space_member(space_id));

-- Moyennes de la bêta (fermées au client, lues dans Supabase) :
-- select * from piece_ratings_summary;
create view public.piece_ratings_summary with (security_invoker = true) as
select
  count(*)::int as notes,
  round(avg(speed), 2) as temps,
  round(avg(quality), 2) as qualite,
  round(avg(result), 2) as rendu
from public.piece_ratings;
revoke all on public.piece_ratings_summary from anon, authenticated;
