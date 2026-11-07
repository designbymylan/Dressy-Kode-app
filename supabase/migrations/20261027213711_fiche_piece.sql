-- La fiche d'une pièce (27/10) : ce que Kodi a relevé sur la photo, gardé
-- avec la pièce (objet JSON de 2 Ko au plus).
-- Appliquée au projet sous la version 20261027213711 ; fichier recréé le
-- 07/11 depuis supabase_migrations.schema_migrations, pour que le dépôt
-- reconstruise la même base.
alter table public.garments
  add column fiche jsonb check (fiche is null or (jsonb_typeof(fiche) = 'object' and pg_column_size(fiche) <= 2000));
