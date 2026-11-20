-- Dessin après la découpe (20/11), demandé par l'utilisateur : rendu
-- « catalogue » (mannequin invisible, de face) et attente courte. Une pièce qui
-- arrive est d'abord découpée dans sa photo (SAM 3) et rangée tout de suite ;
-- la même tâche repart aussitôt pour le dessin, qui remplace l'image quand il
-- est prêt. `dessin_auto` marque ce second passage : offert (aucune génération
-- prise au compteur), et sans seconde notification « tes pièces sont prêtes ».
alter table public.ai_jobs add column if not exists dessin_auto boolean not null default false;
comment on column public.ai_jobs.dessin_auto is 'Second passage automatique : le dessin catalogue après la découpe (20/11).';

drop trigger if exists ai_jobs_notify_on_retry on public.ai_jobs;
create trigger ai_jobs_notify_on_retry
  after update of status on public.ai_jobs
  for each row
  when (new.status = 'queued' and old.status = any (array['done', 'failed']) and not new.dessin_auto)
  execute function public.ai_jobs_notify_reset();
