-- Accès offerts (19/11), demandé par l'utilisateur : un compte peut recevoir
-- les mêmes droits que le compte créateur (pièces, Kodi et générations sans
-- limite, aucun écran d'abonnement : l'offre `createur`) sans devenir
-- administrateur.
--
--   - `admins` reste le seul compte de l'utilisateur : lui seul voit l'état des
--     services d'IA (`dressy-agent?verifier`) et sort de la mesure d'usage ;
--   - un accès offert compte dans `usage_funnel`, comme n'importe quelle
--     personne qui se sert de l'app ;
--   - la liste est fermée au client, comme `admins` : elle ne se modifie que
--     par SQL de l'administrateur du projet. Retirer une ligne rend l'offre
--     normale (Découverte ou l'abonnement en cours) au prochain chargement.
--
-- (Fichier ajouté au dépôt le 20/11 : la migration avait été appliquée au
-- projet le 19/11 sans être commitée. Texte relu dans
-- supabase_migrations.schema_migrations.)

create table public.acces_offerts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  motif text,
  created_at timestamptz not null default now()
);
alter table public.acces_offerts enable row level security;
revoke all on public.acces_offerts from anon, authenticated;

-- Vrai si l'espace appartient à un compte qui a reçu un accès offert. Ne rend
-- que cela : la liste ne sort jamais de la base.
create or replace function public.space_acces_offert(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.spaces s join public.acces_offerts o on o.user_id = s.owner_id
    where s.id = target
  );
$$;

revoke all on function public.space_acces_offert(uuid) from public, anon;
grant execute on function public.space_acces_offert(uuid) to authenticated, service_role;

-- L'offre en cours d'un espace : `createur` pour l'administrateur et pour un
-- accès offert, sinon la plus haute offre active (inchangé).
create or replace function public.space_plan(target uuid)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select case when public.space_is_creator(target) or public.space_acces_offert(target) then 'createur' else coalesce((
    select s.plan from public.subscriptions s
    where s.space_id = target and s.status in ('active', 'trialing', 'past_due')
    order by case s.plan when 'couture' then 3 when 'atelier' then 2 else 1 end desc
    limit 1
  ), 'decouverte') end;
$$;
