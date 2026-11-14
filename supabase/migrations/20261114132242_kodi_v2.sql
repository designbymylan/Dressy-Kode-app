-- Kodi v2 (13/11), décisions de l'utilisateur :
-- - répondre à la question que Kodi vient de poser est gratuit : la bulle
--   porte meta.gratuit et ne compte pas dans les questions du mois ;
-- - Sapologue (« atelier ») garde Kodi sans limite, dans un usage raisonnable
--   de 300 questions par mois, écrit dans les conditions (version 1.3) et
--   appliqué à partir du 15/12/2026, plus d'un mois après l'avis ;
-- - Kodi retient ce qu'on lui dit de ses goûts (souvenirs d'origine « dit »),
--   seulement avec l'accord « goûts » version 2 (vérifié par la fonction kode) ;
-- - le message de fin de quota dit « Kodi » et « Sapologue ».
-- Et le ménage du dépôt de déploiement (13/11), abandonné : le compartiment
-- public `depot` est retiré (vide), ses lignes du banc aussi.

-- Appliquée au projet sous la version 20261114132242 (exécutée depuis le SQL Editor
-- de Supabase, puis inscrite dans l'historique des migrations).
-- Le compartiment `depot` n'a pas pu être supprimé par SQL (Supabase l'interdit) : il est
-- vide et privé, à supprimer depuis Storage dans le tableau de bord.


alter table public.kodi_faits drop constraint kodi_faits_origine_check;
alter table public.kodi_faits add constraint kodi_faits_origine_check
  check (origine in ('aime', 'ecarte', 'dit'));
comment on column public.kodi_faits.origine is
  'aime : un cœur ; ecarte : une tenue écartée ; dit : ce que la personne a dit à Kodi de ses goûts (accord « goûts » v2), origine_id = sa question.';

-- ---------------------------------------------------------------- questions du mois

-- Une question gratuite (réponse à la question de Kodi) ne compte pas.
create or replace function public.kode_usage(target uuid)
returns table (used int, quota int)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    (
      select count(*)::int from public.kode_messages
      where space_id = target
        and author = 'user'
        and coalesce(meta->>'gratuit', '') = ''
        and created_at >= (date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')
    ),
    (select l.kode from public.plan_limits(public.space_plan(target)) l);
$$;

-- `peut_etre_gratuite` : faux pour une planification, qui n'est jamais la
-- réponse à une question de Kodi.
drop function public.kode_ask(uuid, text);
create function public.kode_ask(target uuid, question text, peut_etre_gratuite boolean default true)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  u record;
  derniere record;
  gratuit text;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('kode:' || target::text, 0));

  -- La dernière bulle de la conversation est une question de Kodi : y répondre est gratuit.
  if peut_etre_gratuite then
    select m.author, m.meta into derniere
    from public.kode_messages m
    where m.space_id = target and not m.archived
    order by m.created_at desc
    limit 1;
    if derniere.author = 'kode' and coalesce(btrim(derniere.meta->>'question'), '') <> '' then
      gratuit := 'reponse_question';
    end if;
  end if;

  if gratuit is null then
    select * into u from public.kode_usage(target);
    if u.quota is not null and u.used >= u.quota then
      raise exception 'Tu as posé tes % questions à Kodi ce mois-ci. Elles reviennent le 1er du mois, ou sans limite avec Sapologue.',
        u.quota
        using errcode = 'P0001', hint = 'quota';
    end if;
    -- Usage raisonnable de Sapologue (conditions 1.3), à partir du 15/12/2026.
    if u.quota is null
      and public.space_plan(target) = 'atelier'
      and now() >= timestamptz '2026-12-15 00:00:00 Europe/Paris'
      and u.used >= 300 then
      raise exception 'Tu as posé 300 questions à Kodi ce mois-ci, la limite d’un usage raisonnable. Elles reviennent le 1er du mois.'
        using errcode = 'P0001', hint = 'quota';
    end if;
  end if;

  insert into public.kode_messages (space_id, author, body, meta)
  values (
    target, 'user', left(btrim(question), 600),
    case when gratuit is null then '{}'::jsonb else jsonb_build_object('gratuit', gratuit) end
  )
  returning id into new_id;
  return new_id;
end
$$;
revoke all on function public.kode_ask(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.kode_ask(uuid, text, boolean) to service_role;

-- ---------------------------------------------------------------- dépôt retiré

delete from public.banc_ia where mode = 'depot';
alter table public.banc_ia drop constraint banc_ia_mode_check;
alter table public.banc_ia add constraint banc_ia_mode_check
  check (mode in ('sonde', 'decoupe', 'kodi', 'juge', 'verifier'));

-- Le compartiment est vide ; si Supabase refuse de l'effacer en SQL, il
-- devient au moins privé (on l'efface alors depuis le tableau de bord).
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'depot') then
    raise exception 'le compartiment depot n''est pas vide';
  end if;
  begin
    delete from storage.buckets where id = 'depot';
  exception when others then
    update storage.buckets set public = false where id = 'depot';
  end;
end
$$;
