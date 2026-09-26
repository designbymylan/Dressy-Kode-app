-- Ce que Dressy apprend de la personne au démarrage, pour orienter ses
-- propositions. Séparé de `settings` (réglages d'interface) et de
-- `silhouettes` (mesures du corps) : ce sont trois sujets différents, qui
-- évoluent à des rythmes différents.
create table public.style_profile (
  space_id uuid primary key references public.spaces(id) on delete cascade,

  -- Sert à choisir les coupes et les pièces proposées, pas à catégoriser
  -- la personne : le refus de répondre est une réponse valide.
  gender text check (gender in ('femme', 'homme', 'non_precise')),

  goals text[] not null default '{}',
  styles text[] not null default '{}',
  favourite_items text[] not null default '{}',
  colours text[] not null default '{}',
  avoid text[] not null default '{}',
  occasions text[] not null default '{}',

  -- Le train de vie : combien de temps l'habillage prend aujourd'hui, et
  -- si la personne veut en gagner ou au contraire s'en offrir davantage.
  morning_time text check (morning_time in ('express', 'court', 'pose', 'long')),
  time_intent text check (time_intent in ('gagner', 'prendre', 'ca_va')),

  -- Comment Kode doit se comporter par défaut.
  assistance text check (assistance in ('surprise', 'fidele', 'meteo', 'dressing', 'achats')),

  updated_at timestamptz not null default now()
);

create trigger style_profile_touch before update on public.style_profile
  for each row execute function public.touch_updated_at();

alter table public.style_profile enable row level security;

create policy style_profile_select_member on public.style_profile
  for select to authenticated using (public.is_space_member(space_id));
create policy style_profile_update_member on public.style_profile
  for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

-- La ligne naît avec l'espace, vide : le démarrage la remplit, et
-- profiles.onboarded_at dit s'il a été fait.
create or replace function public.handle_new_user()
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
  insert into public.style_profile (space_id) values (new_space);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
