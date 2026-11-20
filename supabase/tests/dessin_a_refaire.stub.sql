-- Doublures en plus de notifications_push.stub.sql pour essayer la migration dessin_a_refaire.
alter table public.ai_jobs
  add column garment_id uuid,
  add column runs int not null default 0,
  add column error text,
  add column redo int not null default 0,
  add column cutout jsonb,
  add column created_at timestamptz not null default now();
create schema cron;
create table public.cron_jobs (name text, schedule text, command text);
create function cron.schedule(name text, schedule text, command text) returns bigint language plpgsql as $$
begin insert into public.cron_jobs values (name, schedule, command); return 1; end $$;
