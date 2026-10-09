-- RGPD (09/10) : les accords. Voir docs/rgpd/ (registre, analyse d'impact).
-- Une ligne par accord donné ou retiré : la plus récente fait foi, les
-- autres prouvent quand et sous quelle version il a été donné (art. 7.1).
-- « silhouette » : taille, silhouette et mesures, données qui touchent au
-- corps, traitées seulement avec un accord explicite (art. 9.2.a, par prudence).
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('silhouette')),
  version smallint not null default 1 check (version > 0),
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consents_space_kind_idx on public.consents (space_id, kind, created_at desc);

alter table public.consents enable row level security;
revoke all on public.consents from anon;
revoke update, delete, truncate, references, trigger on public.consents from authenticated;

create policy consents_select_member on public.consents
  for select to authenticated using (public.is_space_member(space_id));
create policy consents_insert_self on public.consents
  for insert to authenticated
  with check (public.is_space_member(space_id) and profile_id = (select auth.uid()));

-- L'accord en vigueur pour un espace. Invoker : la RLS s'applique.
create or replace function public.has_consent(target uuid, what text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select c.granted from public.consents c
    where c.space_id = target and c.kind = what
    order by c.created_at desc
    limit 1
  ), false);
$$;
revoke all on function public.has_consent(uuid, text) from public, anon;
grant execute on function public.has_consent(uuid, text) to authenticated, service_role;

-- Accord retiré : la taille, le poids, la silhouette et les mesures sont
-- effacés aussitôt, même si l'app n'a pas pu le faire.
create or replace function public.consents_after_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'silhouette' and not new.granted then
    update public.silhouettes
    set height_cm = null, weight_kg = null, shape = null, shape_source = null, measurements = '{}'::jsonb
    where space_id = new.space_id;
  end if;
  return null;
end
$$;
revoke all on function public.consents_after_insert() from public, anon, authenticated;
create trigger consents_after_insert
  after insert on public.consents
  for each row execute function public.consents_after_insert();

-- Sans accord, aucune nouvelle donnée de silhouette n'entre : une valeur
-- changée sans accord en vigueur est remise à l'ancienne. Les valeurs déjà
-- là attendent la décision de la personne (garder en donnant son accord,
-- ou effacer). Effacer reste toujours possible.
create or replace function public.silhouettes_need_consent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select auth.role()) = 'service_role' or public.has_consent(new.space_id, 'silhouette') then
    return new;
  end if;
  if new.height_cm is not null and new.height_cm is distinct from old.height_cm then new.height_cm := old.height_cm; end if;
  if new.weight_kg is not null and new.weight_kg is distinct from old.weight_kg then new.weight_kg := old.weight_kg; end if;
  if new.shape is not null and new.shape is distinct from old.shape then new.shape := old.shape; new.shape_source := old.shape_source; end if;
  if new.measurements <> '{}'::jsonb and new.measurements is distinct from old.measurements then new.measurements := old.measurements; end if;
  return new;
end
$$;
revoke all on function public.silhouettes_need_consent() from public, anon, authenticated;
create trigger silhouettes_need_consent
  before update on public.silhouettes
  for each row execute function public.silhouettes_need_consent();
