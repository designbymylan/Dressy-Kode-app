-- Deux sujets :
--   1. le questionnaire demande désormais les bijoux et les accessoires,
--      ceux qu'on porte et ceux qu'on aimerait porter, et la couleur de métal ;
--   2. l'agent range TOUTES les pièces d'une photo, pas seulement la
--      principale : la tâche de la photo repère les pièces, en garde une et
--      crée une tâche fille par pièce en plus, traitées en parallèle.

-- ---------------------------------------------------------------- profil

alter table public.style_profile
  add column if not exists jewelry text[] not null default '{}',
  add column if not exists jewelry_wish text[] not null default '{}',
  add column if not exists metals text[] not null default '{}',
  add column if not exists accessories text[] not null default '{}',
  add column if not exists accessories_wish text[] not null default '{}';

-- ---------------------------------------------------------------- agent

-- parent_id : la tâche de la photo d'où la pièce a été repérée.
-- target : la fiche de la pièce écrite au repérage (nom, catégorie,
-- emplacement sur la photo, consigne de dessin).
alter table public.ai_jobs
  add column if not exists parent_id uuid references public.ai_jobs(id) on delete set null,
  add column if not exists target jsonb;

create index if not exists ai_jobs_parent_idx on public.ai_jobs (parent_id) where parent_id is not null;

create or replace function public.ai_jobs_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  used int;
  p text;
  agent boolean := current_user = 'service_role' or (select auth.role()) = 'service_role';
begin
  new.status := 'queued';
  new.attempts := 0;
  new.runs := 0;
  new.retries := 0;
  new.error := null;
  new.garment_id := null;
  new.refined_prompt := null;
  new.analysis := null;
  new.claimed_at := null;
  new.prompt_model := null;
  new.image_model := null;
  new.user_input := left(coalesce(new.user_input, ''), 280);
  if (select auth.uid()) is not null then
    new.requested_by := (select auth.uid());
  end if;

  -- Une pièce repérée par l'agent sur une photo déjà confiée garde sa fiche.
  -- La photo a déjà passé les contrôles et le quota du jour, qui compte les
  -- photos : on ne les refait pas.
  if new.parent_id is not null and agent then
    return new;
  end if;

  -- Le navigateur ne peut ni rattacher sa tâche à une autre, ni écrire la
  -- fiche à la place de l'agent.
  new.parent_id := null;
  new.target := null;

  if coalesce(array_length(new.source_paths, 1), 0) not between 1 and 3 then
    raise exception 'Il faut entre une et trois photos par pièce.'
      using errcode = 'P0001', hint = 'photos';
  end if;

  foreach p in array new.source_paths loop
    if p !~ ('^' || new.space_id::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$') then
      raise exception 'Cette photo n''appartient pas à ton espace.'
        using errcode = 'P0001', hint = 'photos';
    end if;
  end loop;

  select count(*) into used
  from public.ai_jobs
  where space_id = new.space_id and parent_id is null and created_at > now() - interval '24 hours';

  if used >= 20 then
    raise exception 'Tu as confié 20 photos à Kode aujourd''hui, c''est la limite du jour. Reviens demain.'
      using errcode = 'P0001', hint = 'quota';
  end if;

  return new;
end
$$;

revoke all on function public.ai_jobs_before_insert() from public, anon, authenticated;
