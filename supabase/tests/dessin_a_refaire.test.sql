-- Essais de la migration dessin_a_refaire (lancés par tools/test-dessin-a-refaire.sh).
do $$
declare
  n int; r record; a uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  -- 1. Rattrapage : seule la découpe par contraste récente, d'une pièce rangée, première passe.
  select count(*) into n from public.ai_jobs where a_redessiner;
  if n <> 1 or not (select a_redessiner from public.ai_jobs where id = a) then raise exception 'ECHEC 1 : rattrapage (% pièces)', n; end if;
  raise notice 'ok 1 : le rattrapage ne marque que la découpe par contraste récente';

  -- 2. La remise en file : trois pièces au plus, 48 h de patience, jamais une pièce déjà essayée il y a moins de dix minutes.
  insert into public.ai_jobs (status, garment_id, a_redessiner, redessiner_depuis, runs) select 'done', gen_random_uuid(), true, now(), 3 from generate_series(1, 5);
  insert into public.ai_jobs (id, status, garment_id, a_redessiner, redessiner_depuis, redessin_essai_at)
    values ('00000000-0000-0000-0000-0000000000b1', 'done', gen_random_uuid(), true, now() - interval '1 hour', now() - interval '2 minutes');
  insert into public.ai_jobs (id, status, garment_id, a_redessiner, redessiner_depuis)
    values ('00000000-0000-0000-0000-0000000000b2', 'done', gen_random_uuid(), true, now() - interval '3 days');
  delete from public.http_calls;
  perform public.ai_jobs_redessiner();
  select count(*) into n from public.ai_jobs where status = 'queued';
  if n <> 3 then raise exception 'ECHEC 2 : % pièces remises en file, trois attendues', n; end if;
  select * into r from public.ai_jobs where status = 'queued' limit 1;
  if r.runs <> 0 or r.redessin_essai_at is null or r.error is not null then raise exception 'ECHEC 2b : passages non remis à zéro'; end if;
  if (select status from public.ai_jobs where id = '00000000-0000-0000-0000-0000000000b1') <> 'done' then raise exception 'ECHEC 2c : essai de moins de dix minutes repris'; end if;
  if (select a_redessiner from public.ai_jobs where id = '00000000-0000-0000-0000-0000000000b2') then raise exception 'ECHEC 2d : abandon après 48 h manquant'; end if;
  raise notice 'ok 2 : trois pièces par passage, dix minutes entre deux essais, abandon après 48 h';

  -- 3. Aucune notification ne part d'un nouvel essai, qu'il réussisse ou non.
  select count(*) into n from public.http_calls;
  if n <> 0 then raise exception 'ECHEC 3 : % appel(s) au service de notification à la remise en file', n; end if;
  update public.ai_jobs set status = 'done' where status = 'queued';
  select count(*) into n from public.http_calls;
  if n <> 0 then raise exception 'ECHEC 3b : % appel(s) au service de notification à la fin d''un nouvel essai', n; end if;
  raise notice 'ok 3 : un nouvel essai de dessin ne prévient personne';

  -- 4. Une première arrivée (jamais essayée) prévient toujours.
  insert into public.ai_jobs (id, status) values ('00000000-0000-0000-0000-0000000000c1', 'queued');
  update public.ai_jobs set status = 'done' where id = '00000000-0000-0000-0000-0000000000c1';
  select count(*) into n from public.http_calls where body->>'job_id' = '00000000-0000-0000-0000-0000000000c1';
  if n <> 1 then raise exception 'ECHEC 4 : première arrivée sans notification'; end if;
  raise notice 'ok 4 : la première arrivée prévient comme avant';

  -- 5. La tâche planifiée existe, toutes les dix minutes.
  select count(*) into n from public.cron_jobs where name = 'dressy-agent-redessiner' and schedule = '*/10 * * * *';
  if n <> 1 then raise exception 'ECHEC 5 : tâche planifiée absente'; end if;
  raise notice 'ok 5 : tâche planifiée toutes les dix minutes';
end $$;
