-- Le ménage de la nuit suit le pipeline d'ajout (politique 1.7, 21/11) :
-- la photo d'origine d'une pièce est gardée tant que la pièce est dans le
-- dressing (pour la retraiter sans la redemander), puis effacée :
--   - les fichiers d'une pièce supprimée (photo d'origine, détourage,
--     vignette), un jour de grâce pour un envoi en cours ;
--   - la photo d'origine d'une pièce retirée du dressing depuis 30 jours
--     (son détourage reste pour l'historique de ses ports).
-- Seuls les chemins du pipeline (<espace>/<pièce>/<fichier>) sont visés : les
-- images de l'ancien agent (<espace>/<fichier>.png) ne bougent pas.
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
     or (o.bucket_id = 'garments'
         and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z]+\.(jpg|webp)$'
         and o.created_at < now() - interval '1 day'
         and not exists (select 1 from public.garments g where g.id = public.safe_uuid(split_part(o.name, '/', 2))))
     or (o.bucket_id = 'garments'
         and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/original\.jpg$'
         and exists (select 1 from public.garments g
                     where g.id = public.safe_uuid(split_part(o.name, '/', 2))
                       and g.status = 'archived' and g.updated_at < now() - interval '30 days'))
  order by o.created_at
  limit max_rows;
$$;
revoke all on function public.expired_files(int) from public, anon, authenticated;
grant execute on function public.expired_files(int) to service_role;
