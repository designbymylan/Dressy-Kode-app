-- Les règles du brief v6 sur la vraie logique SQL de la migration
-- quotas_generation, contre une base jetable (tools/test-quotas.sh).
-- Chaque cas lève une exception s'il échoue.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ECHEC : %', label; end if;
  raise notice 'ok    %', label;
end $$;

-- Deux comptes : une gratuite (u1/s1) et une future abonnée (u2/s2).
insert into public.profiles values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2');
insert into public.spaces values ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2');
insert into public.space_members values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2');

\set u1 '''00000000-0000-0000-0000-0000000000a1'''
\set s1 '''00000000-0000-0000-0000-0000000000b1'''
\set u2 '''00000000-0000-0000-0000-0000000000a2'''
\set s2 '''00000000-0000-0000-0000-0000000000b2'''

-- ------------------------------------------------------------ gratuit : 4 à vie
select pg_temp.ok('gratuit : 4 générations offertes', (select remaining = 4 and plan = 'decouverte' from public.generation_sync(:u1, :s1)));

do $$ declare r jsonb; i int; begin
  for i in 1..4 loop
    r := public.generation_reserve('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), 'lite');
    if not (r->>'ok')::boolean then raise exception 'ECHEC : la génération % aurait dû passer', i; end if;
    perform public.generation_settle((r->>'log_id')::uuid, 'succes', 0.04);
  end loop;
  r := public.generation_reserve('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), 'lite');
  if (r->>'ok')::boolean then raise exception 'ECHEC : la 5e génération gratuite ne devrait pas passer'; end if;
  raise notice 'ok    gratuit : 4 passent, la 5e est refusée (aucun appel API à faire)';
end $$;

select pg_temp.ok('gratuit : le compteur est à 0', (select remaining = 0 from public.generation_sync(:u1, :s1)));

-- Pas de renouvellement mensuel des gratuites : même un mois plus tard.
update public.generation_quota set period_start = now() - interval '70 days', updated_at = now() - interval '70 days' where user_id = :u1;
select pg_temp.ok('gratuit : aucun renouvellement mensuel', (select remaining = 0 from public.generation_sync(:u1, :s1)));

-- ------------------------------------------------------------ échec rendu, une seule fois
update public.generation_quota set remaining = 2 where user_id = :u1 and source = 'trial';
do $$ declare r jsonb; rest int; begin
  r := public.generation_reserve('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), 'lite');
  select remaining into rest from public.generation_quota where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'trial';
  if rest <> 1 then raise exception 'ECHEC : la génération devrait être prise (reste %)', rest; end if;
  perform public.generation_settle((r->>'log_id')::uuid, 'echec', 0);
  select remaining into rest from public.generation_quota where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'trial';
  if rest <> 2 then raise exception 'ECHEC : une génération échouée doit être rendue (reste %)', rest; end if;
  perform public.generation_settle((r->>'log_id')::uuid, 'echec', 0); -- rejoué
  select remaining into rest from public.generation_quota where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'trial';
  if rest <> 2 then raise exception 'ECHEC : le retour rejoué ne doit pas rendre deux fois (reste %)', rest; end if;
  r := public.generation_reserve('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), 'lite');
  perform public.generation_settle((r->>'log_id')::uuid, 'rejet', 0);
  select remaining into rest from public.generation_quota where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'trial';
  if rest <> 2 then raise exception 'ECHEC : une génération rejetée doit être rendue (reste %)', rest; end if;
  raise notice 'ok    échec et rejet : le compteur est rendu, une seule fois';
end $$;

-- Un passage tué en route puis repris ne prend pas une deuxième génération.
do $$ declare j uuid := gen_random_uuid(); a jsonb; b jsonb; rest int; begin
  a := public.generation_reserve('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', j, 'lite');
  b := public.generation_reserve('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', j, 'lite');
  select remaining into rest from public.generation_quota where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'trial';
  if rest <> 1 or a->>'log_id' <> b->>'log_id' then raise exception 'ECHEC : reprise du même passage (reste %)', rest; end if;
  perform public.generation_settle((a->>'log_id')::uuid, 'succes', 0.04);
  raise notice 'ok    reprise d''un passage tué : une seule génération prise';
end $$;

-- Une génération restée « en cours » trop longtemps est rendue par le ménage.
do $$ declare r jsonb; rest int; begin
  update public.generation_quota set remaining = 3 where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'trial';
  r := public.generation_reserve('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', gen_random_uuid(), 'lite');
  update public.generation_log set created_at = now() - interval '2 hours' where id = (r->>'log_id')::uuid;
  perform public.purge_generation('13 months', '30 days');
  select remaining into rest from public.generation_quota where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'trial';
  if rest <> 3 then raise exception 'ECHEC : le ménage doit rendre une génération jamais aboutie (reste %)', rest; end if;
  raise notice 'ok    ménage : une génération jamais aboutie est rendue';
end $$;

-- ------------------------------------------------------------ abonnement : 50 et 100 par mois
insert into public.subscriptions values ('sub_1', :s2, 'capsule', 'mois', 'active');
select pg_temp.ok('Fashion : 50 générations, aucune « offerte »', (select plan = 'capsule' and source = 'subscription' and remaining = 50 from public.generation_sync(:u2, :s2)));
select pg_temp.ok('Fashion : aucune ligne « trial » (pas de compteur gratuit)', not exists (select 1 from public.generation_quota where user_id = :u2 and source = 'trial'));

do $$ declare r jsonb; begin
  r := public.generation_reserve('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', gen_random_uuid(), 'complet');
  perform public.generation_settle((r->>'log_id')::uuid, 'succes', 0.1);
end $$;
select pg_temp.ok('Fashion : une génération réussie en décompte une', (select remaining = 49 from public.generation_sync(:u2, :s2)));

-- Passage à Sapologue en cours de mois : la différence s'ajoute.
update public.subscriptions set plan = 'atelier' where id = 'sub_1';
select pg_temp.ok('Sapologue en cours de mois : +50 (99 restantes)', (select plan = 'atelier' and remaining = 99 from public.generation_sync(:u2, :s2)));

-- Remise à zéro mensuelle, sans report.
update public.generation_quota set period_start = now() - interval '40 days', remaining = 80 where user_id = :u2 and source = 'subscription';
select pg_temp.ok('nouveau mois : remise à 100, sans report des 80', (select remaining = 100 from public.generation_sync(:u2, :s2)));

-- ------------------------------------------------------------ places de garde-robe
select pg_temp.ok('gratuit : 15 places', public.piece_limit(:s1) = 15);
insert into public.place_packs (space_id, pack, places, stripe_session_id) values (:s1, 'petit', 10, 'cs_1');
select pg_temp.ok('pack +10 : 25 places, sans toucher aux générations', public.piece_limit(:s1) = 25 and (select remaining = 3 from public.generation_quota where user_id = :u1 and source = 'trial'));
update public.subscriptions set plan = 'capsule' where id = 'sub_1';
insert into public.place_packs (space_id, pack, places, stripe_session_id) values (:s2, 'moyen', 30, 'cs_2');
select pg_temp.ok('Fashion 50 + pack +30 : 80 places', public.piece_limit(:s2) = 80);
do $$ begin
  begin
    insert into public.place_packs (space_id, pack, places, stripe_session_id) values ('00000000-0000-0000-0000-0000000000b2', 'moyen', 30, 'cs_2');
    raise exception 'ECHEC : un webhook rejoué ne doit pas créditer deux fois';
  exception when unique_violation then raise notice 'ok    un paiement rejoué ne crédite pas deux fois'; end;
end $$;

-- Les limites : le 16e vêtement en gratuit, le 51e en Fashion (sans pack).
delete from public.place_packs where space_id = :s1;
do $$ declare i int; blocked boolean := false; begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  for i in 1..15 loop insert into public.garments (space_id) values ('00000000-0000-0000-0000-0000000000b1'); end loop;
  begin
    insert into public.garments (space_id) values ('00000000-0000-0000-0000-0000000000b1');
  exception when others then
    blocked := sqlstate = 'P0001'; 
  end;
  reset role;
  if not blocked then raise exception 'ECHEC : le 16e vêtement gratuit doit être refusé'; end if;
  raise notice 'ok    gratuit : 15 vêtements passent, le 16e déclenche l''écran de limite';
end $$;

delete from public.place_packs where space_id = :s2;
do $$ declare i int; blocked boolean := false; begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
  for i in 1..50 loop insert into public.garments (space_id) values ('00000000-0000-0000-0000-0000000000b2'); end loop;
  begin
    insert into public.garments (space_id) values ('00000000-0000-0000-0000-0000000000b2');
  exception when others then
    blocked := sqlstate = 'P0001';
  end;
  reset role;
  if not blocked then raise exception 'ECHEC : le 51e vêtement Fashion doit être refusé'; end if;
  raise notice 'ok    Fashion : 50 vêtements passent, le 51e déclenche l''écran de limite';
end $$;

-- Un pack débloque de la place sans toucher à l'offre.
insert into public.place_packs (space_id, pack, places, stripe_session_id) values (:s2, 'petit', 10, 'cs_3');
do $$ begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
  insert into public.garments (space_id) values ('00000000-0000-0000-0000-0000000000b2');
  reset role;
  raise notice 'ok    après un pack +10, le 51e vêtement passe';
end $$;

-- ------------------------------------------------------------ « Image propre »
do $$ declare g uuid := gen_random_uuid(); j uuid; msg text; hint text; left_ int; begin
  select id into g from public.garments where space_id = '00000000-0000-0000-0000-0000000000b1' limit 1;
  alter table public.ai_jobs disable trigger ai_jobs_plan_limit; -- le dressing est plein, la demande de départ date d'avant
  insert into public.ai_jobs (space_id, requested_by, status, garment_id) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'done', g) returning id into j;
  alter table public.ai_jobs enable trigger ai_jobs_plan_limit;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  left_ := public.request_clean_image(g);
  reset role;
  if (select clean from public.ai_jobs where id = j) is not true or (select status from public.ai_jobs where id = j) <> 'queued' then
    raise exception 'ECHEC : Image propre doit remettre la pièce en file avec clean';
  end if;
  raise notice 'ok    Image propre : la pièce repart en file (% restantes avant le dessin)', left_;

  -- À 0 : refus avec le repère « quota », rien n'est mis en file.
  update public.ai_jobs set status = 'done', clean = false where id = j;
  update public.generation_quota set remaining = 0 where user_id = '00000000-0000-0000-0000-0000000000a1' and source = 'trial';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  begin
    perform public.request_clean_image(g);
    raise exception 'ECHEC : à 0 génération, Image propre doit être refusée';
  exception when sqlstate 'P0001' then
    get stacked diagnostics hint = pg_exception_hint;
    reset role;
    if hint <> 'quota' then raise exception 'ECHEC : repère attendu quota, obtenu %', hint; end if;
  end;
  if (select status from public.ai_jobs where id = j) <> 'done' then raise exception 'ECHEC : rien ne doit partir en file à 0'; end if;
  raise notice 'ok    quota à 0 : Image propre refusée (repère quota), rien en file, aucun appel';
end $$;

-- Le client ne lit ni le compteur ni le journal directement.
do $$ begin
  set local role authenticated;
  begin
    perform 1 from public.generation_quota;
    raise exception 'ECHEC : generation_quota ne doit pas être lisible par le client';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.generation_log;
    raise exception 'ECHEC : generation_log ne doit pas être lisible par le client';
  exception when insufficient_privilege then null; end;
  begin
    perform public.free_generation_quota();
    raise exception 'ECHEC : FREE_GENERATION_QUOTA ne doit pas être exposée au client';
  exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'ok    le client ne lit que le compteur restant (generation_status)';
end $$;

-- Le suivi de la bêta se calcule.
select pg_temp.ok('suivi : les vues répondent', (select count(*) >= 0 from public.generation_costs) and (select gratuites >= 1 from public.generation_free_funnel));
