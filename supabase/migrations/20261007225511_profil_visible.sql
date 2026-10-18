-- Le profil visible (07/10) : prénom, nom, pseudonyme, ce qui s'affiche, et
-- la photo. Tout est facultatif ; display_name reste le prénom, lu par Kode.
alter table public.profiles
  add column if not exists last_name text check (char_length(last_name) <= 60),
  add column if not exists username text check (username ~ '^[a-z0-9._]{3,24}$'),
  add column if not exists name_display text not null default 'prenom'
    check (name_display in ('prenom', 'prenom_nom', 'pseudo'));

-- Un pseudonyme n'appartient qu'à une personne. La RLS ne laisse voir que
-- son propre profil : c'est l'index qui refuse un pseudonyme déjà pris.
create unique index if not exists profiles_username_key on public.profiles (username);

comment on column public.profiles.avatar_url is
  'La photo de profil : chemin dans le bucket privé uploads (<space_id>/avatar-…), servie par URL signée.';
