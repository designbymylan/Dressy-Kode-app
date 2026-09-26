-- Agent central : photo → ChatGPT → Nano Banana → Claude → dressing.
--
-- Une ligne ai_jobs = une pièce. L'Edge Function `dressy-agent` la prend,
-- fait UN essai par passage (pour rester sous la limite de durée d'une
-- fonction) et la remet en file tant qu'elle n'est pas validée.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------- colonnes

alter table public.ai_jobs
  add column source_paths text[] not null default '{}',
  add column analysis jsonb,
  add column runs smallint not null default 0,
  add column retries smallint not null default 0,
  add column claimed_at timestamptz,
  alter column user_input set default '';

alter table public.ai_jobs drop constraint ai_jobs_status_check;
alter table public.ai_jobs add constraint ai_jobs_status_check check (status in (
  'queued', 'prompting', 'generating', 'verifying', 'selecting',
  'cutout', 'uploading', 'done', 'failed'
));

-- La file se lit désormais par updated_at : une pièce remise en file après
-- un essai repasse derrière celles qui attendent déjà. Le quota s'appuie
-- sur ai_jobs_space_idx (space_id, created_at), déjà en place.
drop index public.ai_jobs_queue_idx;
create index ai_jobs_queue_idx on public.ai_jobs (updated_at) where status = 'queued';

-- Une ligne par image générée : c'est l'historique des essais que Claude
-- compare quand aucun n'atteint le seuil.
alter table public.ai_images
  add column attempt smallint,
  add column prompt text,
  add column mime text,
  add column score smallint,
  add column critique jsonb,
  add column validated boolean not null default false,
  add column chosen boolean not null default false;

-- ---------------------------------------------------------------- sécurité

-- Avant : un membre pouvait modifier ses tâches, donc les remettre en file à
-- l'infini et faire payer autant de générations. Désormais il lit, crée, et
-- supprime une tâche en échec ; tout le reste passe par l'agent ou par
-- retry_ai_job().
drop policy ai_jobs_all_member on public.ai_jobs;
create policy ai_jobs_select_member on public.ai_jobs
  for select to authenticated using (public.is_space_member(space_id));
create policy ai_jobs_insert_member on public.ai_jobs
  for insert to authenticated with check (public.is_space_member(space_id));
create policy ai_jobs_delete_failed on public.ai_jobs
  for delete to authenticated using (public.is_space_member(space_id) and status = 'failed');

revoke all on public.ai_jobs from anon;
revoke all on public.ai_images from anon;
revoke update, truncate, references, trigger on public.ai_jobs from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.ai_images from authenticated;

-- Le client ne choisit que l'espace, les photos et sa précision : le reste
-- appartient à l'agent. Le quota protège la facture tant que Stripe n'est
-- pas branché.
create or replace function public.ai_jobs_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  used int;
  p text;
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
  where space_id = new.space_id and created_at > now() - interval '24 hours';

  if used >= 20 then
    raise exception 'Tu as ajouté 20 pièces avec Kode aujourd''hui, c''est la limite du jour. Reviens demain.'
      using errcode = 'P0001', hint = 'quota';
  end if;

  return new;
end
$$;

create trigger ai_jobs_before_insert
  before insert on public.ai_jobs
  for each row execute function public.ai_jobs_before_insert();

-- Relancer une pièce en échec reprend là où elle s'est arrêtée : les essais
-- déjà payés sont gardés. Deux relances au plus par pièce.
create or replace function public.retry_ai_job(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  j public.ai_jobs;
begin
  select * into j from public.ai_jobs where id = target for update;

  if not found or not public.is_space_member(j.space_id) then
    raise exception 'Demande introuvable.' using errcode = 'P0001';
  end if;
  if j.status <> 'failed' then
    raise exception 'Cette pièce est déjà en cours.' using errcode = 'P0001';
  end if;
  if j.retries >= 2 then
    raise exception 'Cette pièce a déjà été relancée deux fois. Essaie avec une autre photo.'
      using errcode = 'P0001';
  end if;

  update public.ai_jobs
  set status = 'queued', runs = 0, error = null, claimed_at = null, retries = retries + 1
  where id = target;
end
$$;

revoke all on function public.retry_ai_job(uuid) from public, anon;
grant execute on function public.retry_ai_job(uuid) to authenticated;

-- ---------------------------------------------------------------- stockage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Nano Banana peut répondre en JPEG : les essais bruts doivent pouvoir être gardés.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'ai-generated';

drop policy garments_objects_member on storage.objects;
create policy garments_objects_member on storage.objects
  for all to authenticated
  using (
    bucket_id = any (array['garments', 'ai-generated', 'uploads'])
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = any (array['garments', 'ai-generated', 'uploads'])
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
  );

-- ---------------------------------------------------------------- file

create or replace function public.agent_url()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select 'https://pxjlbtevrexlckhxskdn.supabase.co/functions/v1/dressy-agent' $$;

-- L'appel ne transporte aucune donnée de confiance : c'est un réveil.
-- L'agent prend lui-même la tâche la plus ancienne en file.
create or replace function public.ai_jobs_wake_agent()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform net.http_post(
    url := public.agent_url(),
    body := jsonb_build_object('job_id', new.id),
    timeout_milliseconds := 5000
  );
  return null;
end
$$;

create trigger ai_jobs_wake_on_insert
  after insert on public.ai_jobs
  for each row when (new.status = 'queued')
  execute function public.ai_jobs_wake_agent();

create trigger ai_jobs_wake_on_requeue
  after update of status on public.ai_jobs
  for each row when (new.status = 'queued' and old.status <> 'queued')
  execute function public.ai_jobs_wake_agent();

-- SKIP LOCKED : deux passages simultanés ne prennent jamais la même pièce.
create or replace function public.claim_ai_job()
returns setof public.ai_jobs
language sql
set search_path = public, pg_temp
as $$
  update public.ai_jobs j
  set status = 'prompting', runs = j.runs + 1, claimed_at = now()
  where j.id = (
    select id from public.ai_jobs
    where status = 'queued'
    order by updated_at
    limit 1
    for update skip locked
  )
  returning j.*;
$$;

-- Filet de sécurité, chaque minute : un passage tué en route (limite de
-- durée, déploiement) remet sa pièce en file ; un réveil perdu est renvoyé.
create or replace function public.ai_jobs_sweep()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  j record;
begin
  update public.ai_jobs
  set
    status = case when runs >= 6 then 'failed' else 'queued' end,
    error = case when runs >= 6
      then 'Kode n''a pas réussi à terminer cette pièce. Réessaie dans un moment.'
      else error end
  where status in ('prompting', 'generating', 'verifying', 'selecting', 'cutout', 'uploading')
    and claimed_at < now() - interval '4 minutes';

  for j in
    select id from public.ai_jobs
    where status = 'queued' and updated_at < now() - interval '1 minute'
  loop
    perform net.http_post(
      url := public.agent_url(),
      body := jsonb_build_object('job_id', j.id),
      timeout_milliseconds := 5000
    );
  end loop;
end
$$;

revoke all on function public.agent_url() from public, anon, authenticated;
revoke all on function public.ai_jobs_wake_agent() from public, anon, authenticated;
revoke all on function public.ai_jobs_sweep() from public, anon, authenticated;
revoke all on function public.claim_ai_job() from public, anon, authenticated;
grant execute on function public.claim_ai_job() to service_role;

select cron.schedule('dressy-agent-sweep', '* * * * *', 'select public.ai_jobs_sweep()');
