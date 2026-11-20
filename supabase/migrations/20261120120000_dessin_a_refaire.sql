-- 20/11 : une pièce dont le dessin a échoué (fournisseur d'images injoignable)
-- n'est plus rangée en découpe par contraste (elle gardait le tapis, le sol ou la
-- peau et passait pour finie). L'agent range la photo recadrée et marque la tâche
-- « à redessiner » ; `ai_jobs_redessiner` la remet en file toutes les dix minutes,
-- trois pièces au plus à la fois, pendant 48 heures, et le dessin la remplace.

alter table public.ai_jobs
  add column if not exists a_redessiner boolean not null default false,
  add column if not exists redessiner_depuis timestamptz,
  add column if not exists redessin_essai_at timestamptz;

create index if not exists ai_jobs_a_redessiner_idx on public.ai_jobs (redessin_essai_at nulls first) where a_redessiner;

create or replace function public.ai_jobs_redessiner()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Au bout de 48 heures, la pièce garde son image et on cesse d'essayer.
  update public.ai_jobs set a_redessiner = false
  where a_redessiner and redessiner_depuis < now() - interval '48 hours';

  -- Le réveil de l'agent part du déclencheur `ai_jobs_wake_on_requeue`.
  update public.ai_jobs
  set status = 'queued', runs = 0, error = null, redessin_essai_at = now()
  where id in (
    select id from public.ai_jobs
    where a_redessiner and status = 'done' and garment_id is not null
      and (redessin_essai_at is null or redessin_essai_at < now() - interval '10 minutes')
    order by redessin_essai_at nulls first, created_at
    limit 3
    for update skip locked
  );
end
$$;

revoke all on function public.ai_jobs_redessiner() from public, anon, authenticated;

-- Un nouvel essai de dessin ne prévient jamais la personne (déjà prévenue à
-- l'arrivée de la pièce) : sans cela, « tes pièces sont prêtes » repartirait
-- toutes les dix minutes tant que le fournisseur ne répond pas.
drop trigger if exists ai_jobs_notify_on_end on public.ai_jobs;
create trigger ai_jobs_notify_on_end
  after update of status on public.ai_jobs
  for each row when (new.status in ('done', 'failed') and old.status is distinct from new.status and new.redessin_essai_at is null)
  execute function public.ai_jobs_notify();

drop trigger if exists ai_jobs_notify_on_retry on public.ai_jobs;
create trigger ai_jobs_notify_on_retry
  after update of status on public.ai_jobs
  for each row when (new.status = 'queued' and old.status in ('done', 'failed') and new.redessin_essai_at is null)
  execute function public.ai_jobs_notify_reset();

select cron.schedule('dressy-agent-redessiner', '*/10 * * * *', 'select public.ai_jobs_redessiner()');

-- Les pièces rangées en découpe par contraste depuis le 17/11 (aucun masque chez
-- l'intermédiaire) sont à redessiner.
update public.ai_jobs j
set a_redessiner = true, redessiner_depuis = now()
where j.status = 'done' and j.redo = 0 and j.garment_id is not null
  and j.cutout->>'methode' = 'contraste'
  and j.created_at >= '2026-11-17';
