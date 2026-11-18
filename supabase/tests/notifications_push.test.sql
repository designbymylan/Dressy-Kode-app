-- Essais de la migration notifications_push (lancés par tools/test-notifications.sh).
do $$
declare
  u1 uuid; u2 uuid; m uuid; f1 uuid; f2 uuid; n int; ok boolean;
begin
  insert into auth.users default values returning id into u1;
  insert into auth.users default values returning id into u2;

  -- 1. Enregistrer un jeton, puis le reprendre depuis un autre compte (même appareil).
  perform set_config('test.uid', u1::text, false);
  perform public.register_push_token('ExponentPushToken[abcdefghijklmnop]', 'ios');
  select count(*) into n from public.push_tokens where user_id = u1;
  if n <> 1 then raise exception 'ECHEC 1 : jeton non enregistré'; end if;
  perform set_config('test.uid', u2::text, false);
  perform public.register_push_token('ExponentPushToken[abcdefghijklmnop]', 'ios');
  select count(*) into n from public.push_tokens where user_id = u2;
  if n <> 1 then raise exception 'ECHEC 1b : jeton non repris par le nouveau compte'; end if;

  -- 2. Un jeton mal formé est refusé.
  begin
    perform public.register_push_token('nimporte quoi', 'ios');
    raise exception 'ECHEC 2 : jeton invalide accepté';
  exception when check_violation then null; end;

  -- 3. On ne retire que son propre jeton.
  perform set_config('test.uid', u1::text, false);
  perform public.unregister_push_token('ExponentPushToken[abcdefghijklmnop]');
  select count(*) into n from public.push_tokens;
  if n <> 1 then raise exception 'ECHEC 3 : le jeton d''un autre a été retiré'; end if;
  perform set_config('test.uid', u2::text, false);
  perform public.unregister_push_token('ExponentPushToken[abcdefghijklmnop]');
  select count(*) into n from public.push_tokens;
  if n <> 0 then raise exception 'ECHEC 3b : jeton non retiré'; end if;

  -- 4. Sans connexion, on ne peut rien enregistrer.
  perform set_config('test.uid', '', false);
  begin
    perform public.register_push_token('ExponentPushToken[abcdefghijklmnop]', 'ios');
    raise exception 'ECHEC 4 : enregistrement sans compte';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
  end;

  -- 5. La table est fermée au client.
  select has_table_privilege('authenticated', 'public.push_tokens', 'select') into ok;
  if ok then raise exception 'ECHEC 5 : push_tokens lisible par le client'; end if;

  -- 6. Une photo à deux pièces : le réveil part à chaque pièce terminée (la fonction décide d'envoyer une fois).
  insert into public.ai_jobs (requested_by) values (u1) returning id into m;
  insert into public.ai_jobs (requested_by, parent_id) values (u1, m) returning id into f1;
  update public.ai_jobs set status = 'prompting' where id in (m, f1);
  delete from public.http_calls;
  update public.ai_jobs set status = 'done' where id = m;
  update public.ai_jobs set status = 'failed' where id = f1;
  select count(*) into n from public.http_calls;
  if n <> 2 then raise exception 'ECHEC 6 : % réveil(s) au lieu de 2', n; end if;
  -- Un changement qui ne touche pas la fin (done vers done) ne réveille rien.
  delete from public.http_calls;
  update public.ai_jobs set status = 'done' where id = m;
  select count(*) into n from public.http_calls;
  if n <> 0 then raise exception 'ECHEC 6b : réveil sans changement d''état'; end if;

  -- 7. Une relance remet à zéro le droit de prévenir (sur la tâche mère).
  update public.ai_jobs set notified_at = now() where id = m;
  update public.ai_jobs set status = 'queued' where id = f1;
  select notified_at is null into ok from public.ai_jobs where id = m;
  if not ok then raise exception 'ECHEC 7 : notified_at non remis à zéro'; end if;

  -- 8. Une panne du réseau ne bloque jamais le travail de l'agent.
  perform set_config('test.casse', '1', false);
  update public.ai_jobs set status = 'prompting' where id = f1;
  update public.ai_jobs set status = 'done' where id = f1;
  select status = 'done' into ok from public.ai_jobs where id = f1;
  if not ok then raise exception 'ECHEC 8 : la panne a bloqué la mise à jour'; end if;
  perform set_config('test.casse', '0', false);

  -- 9. Le ménage retire les appareils qu'on ne voit plus depuis six mois.
  insert into public.push_tokens (token, user_id, seen_at) values ('ExponentPushToken[vieux123456789]', u1, now() - interval '200 days');
  insert into public.push_tokens (token, user_id) values ('ExponentPushToken[recent12345678]', u1);
  select public.purge_push_tokens() into n;
  if n <> 1 then raise exception 'ECHEC 9 : % jeton(s) purgé(s) au lieu de 1', n; end if;

  raise notice 'notifications push : 9 essais passés';
end $$;
