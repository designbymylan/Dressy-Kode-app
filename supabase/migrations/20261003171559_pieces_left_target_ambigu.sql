-- La colonne ai_jobs.target (20260928202117) porte le même nom que le
-- paramètre de pieces_left et de retry_ai_job : Postgres refusait la requête
-- (« column reference "target" is ambiguous »). Depuis, toute photo confiée
-- à Kode échouait au contrôle des places, et « Réessayer » aussi. Le paramètre
-- garde son nom (les appels existants ne changent pas) ; chaque référence est
-- désormais qualifiée.

create or replace function public.pieces_left(target uuid)
returns int
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lim int;
  n int;
begin
  select l.pieces into lim from public.plan_limits(public.space_plan(pieces_left.target)) l;
  if lim is null then return null; end if;

  perform pg_advisory_xact_lock(hashtextextended('pieces:' || pieces_left.target::text, 0));
  select
    (select count(*) from public.garments g where g.space_id = pieces_left.target and g.status <> 'archived')
    + (select count(*) from public.ai_jobs j where j.space_id = pieces_left.target and j.status not in ('done', 'failed'))
  into n;
  return lim - n;
end
$$;

create or replace function public.retry_ai_job(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  j public.ai_jobs;
begin
  select * into j from public.ai_jobs a where a.id = retry_ai_job.target for update;

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

  update public.ai_jobs a
  set status = 'queued', runs = 0, error = null, claimed_at = null, retries = a.retries + 1
  where a.id = retry_ai_job.target;
end
$$;
