-- Notifications push (18/11) : prévenir la personne, app fermée, quand Kodi a
-- fini de ranger sa photo. Un jeton d'appareil (service Expo Push) par
-- téléphone, enregistré seulement après un « oui » aux notifications ; la
-- fonction `notifier` l'utilise quand la dernière pièce d'une photo est prête
-- ou a échoué. Les rappels du planning, eux, restent locaux (aucun serveur).

-- ---------------------------------------------------------------- jetons

create table public.push_tokens (
  token text primary key
    check (token ~ '^Expo(nent)?PushToken\[[^\]]{10,100}\]$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  -- Renouvelé à chaque lancement : le ménage de la nuit retire les appareils qu'on ne voit plus.
  seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);

-- Fermée au client : seules les deux fonctions ci-dessous et le service la touchent.
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public, anon, authenticated;

-- Un téléphone qui change de compte reprend son jeton : le jeton est à l'appareil, pas à la personne.
create function public.register_push_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = auth.uid(), platform = excluded.platform, seen_at = now();
end
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------- l'événement

-- Une photo = une tâche mère et ses tâches filles : on ne prévient qu'une fois,
-- quand toutes sont terminées. `notified_at` (sur la tâche mère) départage deux
-- tâches qui finissent en même temps.
alter table public.ai_jobs add column notified_at timestamptz;

create or replace function public.notifier_url()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select 'https://pxjlbtevrexlckhxskdn.supabase.co/functions/v1/notifier' $$;

-- Un réveil sans donnée de confiance, comme pour l'agent : la fonction relit tout elle-même.
-- Une panne d'envoi ne doit JAMAIS bloquer le travail de l'agent : toute erreur est avalée.
create or replace function public.ai_jobs_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  begin
    perform net.http_post(
      url := public.notifier_url(),
      body := jsonb_build_object('job_id', new.id),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'notifier : %', sqlerrm;
  end;
  return null;
end
$$;

-- Une tâche relancée à la main (réessayer) rouvre le droit de prévenir.
create or replace function public.ai_jobs_notify_reset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ai_jobs set notified_at = null where id = coalesce(new.parent_id, new.id);
  return null;
end
$$;

revoke all on function public.notifier_url() from public, anon, authenticated;
revoke all on function public.ai_jobs_notify() from public, anon, authenticated;
revoke all on function public.ai_jobs_notify_reset() from public, anon, authenticated;

create trigger ai_jobs_notify_on_end
  after update of status on public.ai_jobs
  for each row when (new.status in ('done', 'failed') and old.status is distinct from new.status)
  execute function public.ai_jobs_notify();

create trigger ai_jobs_notify_on_retry
  after update of status on public.ai_jobs
  for each row when (new.status = 'queued' and old.status in ('done', 'failed'))
  execute function public.ai_jobs_notify_reset();

-- ---------------------------------------------------------------- ménage

-- Conservation limitée : un appareil qu'on n'a pas vu depuis six mois perd son jeton.
create or replace function public.purge_push_tokens(older interval default '180 days')
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  delete from public.push_tokens where seen_at < now() - older;
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.purge_push_tokens(interval) from public, anon, authenticated;
grant execute on function public.purge_push_tokens(interval) to service_role;
