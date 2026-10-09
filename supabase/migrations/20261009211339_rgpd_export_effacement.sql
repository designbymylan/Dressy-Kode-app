-- RGPD (09/10) : export et effacement des fichiers.

-- L'export de ses données (art. 15 et 20) : un fichier JSON dans un seau
-- privé, lisible par lien signé une heure, effacé au bout de deux jours.
-- Aucune politique pour `authenticated` : seule la fonction `compte` (clé
-- service) écrit et signe ces fichiers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exports', 'exports', false, 20971520, array['application/json'])
on conflict (id) do nothing;

-- Les fichiers d'un espace, pour les effacer par l'API de stockage (la base
-- refuse les suppressions directes dans storage.objects).
create or replace function public.space_files(target uuid)
returns table (bucket text, path text)
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select o.bucket_id::text, o.name::text from storage.objects o
  where o.bucket_id in ('garments', 'ai-generated', 'uploads', 'exports')
    and o.name like target::text || '/%';
$$;
revoke all on function public.space_files(uuid) from public, anon, authenticated;
grant execute on function public.space_files(uuid) to service_role;

-- Les fichiers arrivés à échéance : photos confiées à Kode après 30 jours
-- (jamais la photo de profil), exports après deux jours.
create or replace function public.expired_files(max_rows int default 500)
returns table (bucket text, path text)
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select o.bucket_id::text, o.name::text from storage.objects o
  where (o.bucket_id = 'uploads' and o.created_at < now() - interval '30 days' and o.name !~ '/avatar-')
     or (o.bucket_id = 'exports' and o.created_at < now() - interval '2 days')
  order by o.created_at
  limit max_rows;
$$;
revoke all on function public.expired_files(int) from public, anon, authenticated;
grant execute on function public.expired_files(int) to service_role;
