-- Brief v6 (31/10) : offres, places de garde-robe, générations.
--
--   Découverte (sans abonnement) : 15 pièces, 4 générations offertes à vie
--   Fashion (capsule)            : 50 pièces, 50 générations par mois
--   Sapologue (atelier)          : 100 pièces, 100 générations par mois
--   Packs de places (boutique)   : petit +10 (1,99 €), moyen +30 (4,99 €)
--
-- Une génération = un appel à Nano Banana pour dessiner une pièce (« Image
-- propre », ou détourage impossible). Le détourage ordinaire n'en consomme
-- aucune. Une génération ratée ou refusée est rendue ; une image déjà en
-- cache est rendue sans appel ni décompte.
--
-- Les identifiants d'offre ne changent pas (`capsule` = Fashion, `atelier` =
-- Sapologue), ils vivent aussi chez Stripe. `couture` n'est plus vendue.

-- ---------------------------------------------------------------- offres

-- Mêmes valeurs que web/src/lib/plans.ts. null = sans limite.
create or replace function public.plan_limits(plan text)
returns table (pieces int, kode int)
language sql
immutable
set search_path = pg_temp
as $$
  select
    case plan when 'capsule' then 50 when 'atelier' then 100 when 'couture' then 100 else 15 end,
    case plan when 'capsule' then 30 when 'atelier' then null when 'couture' then null else 5 end;
$$;

-- Générations incluses par mois. La Découverte n'en a aucune ici : ses
-- quatre générations sont offertes une fois (source `trial`).
create or replace function public.plan_generations(plan text)
returns int
language sql
immutable
set search_path = pg_temp
as $$
  select case plan when 'capsule' then 50 when 'atelier' then 100 when 'couture' then 100 else 0 end;
$$;

-- Générations offertes à vie, entre 3 et 5 (constante FREE_GENERATION_QUOTA).
-- Jamais lisible depuis le client : seul le compteur restant l'est.
create or replace function public.free_generation_quota()
returns int
language sql
immutable
set search_path = pg_temp
as $$ select 4; $$;

revoke all on function public.plan_generations(text) from public, anon, authenticated;
revoke all on function public.free_generation_quota() from public, anon, authenticated;
grant execute on function public.plan_generations(text) to service_role;
grant execute on function public.free_generation_quota() to service_role;

-- ---------------------------------------------------------------- packs de places

create table public.place_packs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  pack text not null check (pack in ('petit', 'moyen')),
  places int not null check (places in (10, 30)),
  -- La session de paiement Stripe : le webhook peut arriver deux fois, le pack ne compte qu'une.
  stripe_session_id text not null unique,
  created_at timestamptz not null default now()
);
create index place_packs_space_idx on public.place_packs (space_id);

alter table public.place_packs enable row level security;
create policy place_packs_select_member on public.place_packs
  for select to authenticated using (public.is_space_member(space_id));
revoke all on public.place_packs from anon;
revoke insert, update, delete, truncate, references, trigger on public.place_packs from authenticated;

-- Combien de pièces l'espace peut ranger : l'offre, plus les packs (qui
-- s'ajoutent à la limite de l'offre, sans jamais la remplacer).
create or replace function public.piece_limit(target uuid)
returns int
language sql
stable
set search_path = public, pg_temp
as $$
  select l.pieces + coalesce((select sum(p.places)::int from public.place_packs p where p.space_id = target), 0)
  from public.plan_limits(public.space_plan(target)) l;
$$;

revoke all on function public.piece_limit(uuid) from public, anon;
grant execute on function public.piece_limit(uuid) to authenticated, service_role;

-- Les places restantes. Une demande de reprise d'une pièce (garment_id déjà
-- posé) ne compte pas deux fois : sa pièce est déjà comptée.
create or replace function public.pieces_left(target uuid)
returns int
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lim int;
  n int;
begin
  lim := public.piece_limit(pieces_left.target);
  if lim is null then return null; end if;

  perform pg_advisory_xact_lock(hashtextextended('pieces:' || pieces_left.target::text, 0));
  select
    (select count(*) from public.garments g where g.space_id = pieces_left.target and g.status <> 'archived')
    + (select count(*) from public.ai_jobs j
       where j.space_id = pieces_left.target and j.garment_id is null and j.status not in ('done', 'failed'))
  into n;
  return lim - n;
end
$$;

create or replace function public.garments_plan_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lim int;
begin
  if current_user = 'service_role' or (select auth.role()) = 'service_role' then
    return new;
  end if;
  if public.pieces_left(new.space_id) <= 0 then
    lim := public.piece_limit(new.space_id);
    raise exception 'Ton dressing est plein : % pièces avec ton offre actuelle.', lim
      using errcode = 'P0001', hint = 'pieces';
  end if;
  return new;
end
$$;

create or replace function public.ai_jobs_plan_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  lim int;
begin
  if public.pieces_left(new.space_id) <= 0 then
    lim := public.piece_limit(new.space_id);
    raise exception 'Ton dressing est plein : % pièces avec ton offre actuelle.', lim
      using errcode = 'P0001', hint = 'pieces';
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------- compteur de générations

create table public.generation_quota (
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('trial', 'subscription', 'pack')),
  remaining int not null check (remaining >= 0),
  period_start timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Offre et dotation de la période, pour suivre un changement d'offre en cours de mois.
  plan text not null default 'decouverte',
  granted int not null default 0,
  primary key (user_id, source)
);

alter table public.generation_quota enable row level security;
revoke all on public.generation_quota from anon, authenticated;

-- Une ligne par appel aux modèles : générations (décomptées ou non), repérage
-- (Anthropic) et segmentation (Google). Sert au suivi des coûts et du passage
-- de la Découverte à l'abonnement. Effacée avec le compte.
create table public.generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  job_id uuid,
  plan text not null,
  -- trial, subscription ou pack ; null quand l'appel ne consomme rien (repérage, cache).
  source text check (source in ('trial', 'subscription', 'pack')),
  provider text not null check (provider in ('google', 'anthropic')),
  kind text not null check (kind in ('dessin', 'segmentation', 'reperage')),
  cache_hit boolean not null default false,
  model text,
  status text not null check (status in ('en_cours', 'succes', 'echec', 'rejet')),
  -- Vrai quand l'appel a pris une génération au compteur (rendue si l'appel échoue).
  counted boolean not null default false,
  cost_estimate_usd numeric(10, 5) not null default 0,
  created_at timestamptz not null default now()
);
create index generation_log_user_idx on public.generation_log (user_id, created_at desc);
create index generation_log_month_idx on public.generation_log (created_at);

alter table public.generation_log enable row level security;
revoke all on public.generation_log from anon, authenticated;

-- Met le compteur de l'utilisateur à jour (remise à zéro du mois, changement
-- d'offre) et rend la ligne qui sert. Appelée avec le verrou déjà pris.
create or replace function public.generation_sync(p_user uuid, p_space uuid)
returns table (plan text, source text, remaining int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  pl text := public.space_plan(p_space);
  allowance int := public.plan_generations(pl);
  month_start timestamptz := (date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris');
  r public.generation_quota;
  free int := public.free_generation_quota();
begin
  if pl = 'decouverte' then
    -- Offertes une fois, jamais renouvelées.
    insert into public.generation_quota (user_id, source, remaining, plan, granted)
    values (p_user, 'trial', free, 'decouverte', free)
    on conflict (user_id, source) do nothing;
    select * into r from public.generation_quota q where q.user_id = p_user and q.source = 'trial';
    return query select pl, r.source, r.remaining;
    return;
  end if;

  select * into r from public.generation_quota q where q.user_id = p_user and q.source = 'subscription' for update;
  if not found then
    insert into public.generation_quota (user_id, source, remaining, period_start, plan, granted)
    values (p_user, 'subscription', allowance, month_start, pl, allowance)
    returning * into r;
  elsif r.period_start < month_start then
    -- Remise à zéro mensuelle, sans report.
    update public.generation_quota q
    set remaining = allowance, period_start = month_start, plan = pl, granted = allowance, updated_at = now()
    where q.user_id = p_user and q.source = 'subscription'
    returning * into r;
  elsif r.plan <> pl then
    update public.generation_quota q
    set remaining = case when allowance > q.granted then q.remaining + (allowance - q.granted) else least(q.remaining, allowance) end,
        plan = pl, granted = allowance, updated_at = now()
    where q.user_id = p_user and q.source = 'subscription'
    returning * into r;
  end if;
  return query select pl, r.source, r.remaining;
end
$$;

revoke all on function public.generation_sync(uuid, uuid) from public, anon, authenticated;
grant execute on function public.generation_sync(uuid, uuid) to service_role;

-- Ce que l'app affiche : l'offre et ce qui reste, rien d'autre. La dotation
-- de départ n'est jamais rendue.
create or replace function public.generation_status(p_space uuid)
returns table (plan text, remaining int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not public.is_space_member(p_space) then
    raise exception 'Espace introuvable.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('generation:' || me::text, 0));
  return query select s.plan, s.remaining from public.generation_sync(me, p_space) s;
end
$$;

revoke all on function public.generation_status(uuid) from public, anon;
grant execute on function public.generation_status(uuid) to authenticated, service_role;

-- Prend une génération avant l'appel au générateur. { ok: false } quand il n'en
-- reste plus : l'appelant ne contacte alors aucune API.
create or replace function public.generation_reserve(p_user uuid, p_space uuid, p_job uuid, p_model text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  log_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('generation:' || p_user::text, 0));
  select * into s from public.generation_sync(p_user, p_space);
  if s.remaining <= 0 then
    return jsonb_build_object('ok', false, 'plan', s.plan);
  end if;

  update public.generation_quota q
  set remaining = q.remaining - 1, updated_at = now()
  where q.user_id = p_user and q.source = s.source;

  insert into public.generation_log (user_id, space_id, job_id, plan, source, provider, kind, model, status, counted)
  values (p_user, p_space, p_job, s.plan, s.source, 'google', 'dessin', p_model, 'en_cours', true)
  returning id into log_id;

  return jsonb_build_object('ok', true, 'log_id', log_id, 'plan', s.plan, 'source', s.source, 'remaining', s.remaining - 1);
end
$$;

-- Clôt une génération. Réussie : elle reste décomptée. Ratée ou refusée : la
-- génération est rendue (une seule fois, même si l'appel est rejoué).
create or replace function public.generation_settle(p_log uuid, p_status text, p_cost numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l public.generation_log;
begin
  if p_status not in ('succes', 'echec', 'rejet') then
    raise exception 'statut inconnu';
  end if;
  select * into l from public.generation_log where id = p_log for update;
  if not found or l.status <> 'en_cours' then return; end if;

  update public.generation_log set status = p_status, cost_estimate_usd = coalesce(p_cost, 0) where id = p_log;

  if p_status <> 'succes' and l.counted then
    update public.generation_quota q
    set remaining = least(q.remaining + 1, greatest(q.granted, 1)),
        updated_at = now()
    where q.user_id = l.user_id and q.source = l.source;
  end if;
end
$$;

-- Note un appel qui ne prend rien au compteur : image en cache, repérage, segmentation.
create or replace function public.generation_note(
  p_user uuid, p_space uuid, p_job uuid, p_provider text, p_kind text,
  p_model text, p_status text, p_cache_hit boolean, p_cost numeric
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.generation_log (user_id, space_id, job_id, plan, provider, kind, cache_hit, model, status, cost_estimate_usd)
  values (p_user, p_space, p_job, public.space_plan(p_space), p_provider, p_kind, coalesce(p_cache_hit, false), p_model, p_status, coalesce(p_cost, 0));
$$;

revoke all on function public.generation_reserve(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.generation_settle(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.generation_note(uuid, uuid, uuid, text, text, text, text, boolean, numeric) from public, anon, authenticated;
grant execute on function public.generation_reserve(uuid, uuid, uuid, text) to service_role;
grant execute on function public.generation_settle(uuid, text, numeric) to service_role;
grant execute on function public.generation_note(uuid, uuid, uuid, text, text, text, text, boolean, numeric) to service_role;

-- ---------------------------------------------------------------- cache

-- Clé : (photo + pièce, modèle, version du prompt). Une image déjà dessinée
-- pour cette clé est rendue sans appel ni décompte. Par espace, effacée avec lui.
create table public.generation_cache (
  space_id uuid not null references public.spaces(id) on delete cascade,
  cache_key text not null,
  image_path text not null,
  created_at timestamptz not null default now(),
  primary key (space_id, cache_key)
);
alter table public.generation_cache enable row level security;
revoke all on public.generation_cache from anon, authenticated;

-- ---------------------------------------------------------------- « Image propre »

alter table public.ai_jobs add column clean boolean not null default false;

-- Le client ne pose jamais `clean` : seul request_clean_image() le fait.
create or replace function public.ai_jobs_clean_details()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  d jsonb := '{}'::jsonb;
  k text;
  lim constant jsonb := '{"brand":60,"size":20,"fit":40,"material":80,"note":280}';
begin
  new.redo := 0;
  new.clean := false;
  new.cutout := null;
  if new.details is not null and jsonb_typeof(new.details) = 'object' then
    for k in select jsonb_object_keys(lim) loop
      if nullif(btrim(new.details ->> k), '') is not null then
        d := d || jsonb_build_object(k, left(btrim(new.details ->> k), (lim ->> k)::int));
      end if;
    end loop;
  end if;
  new.details := nullif(d, '{}'::jsonb);
  return new;
end
$$;

-- « Image propre » : Kodi redessine la pièce à partir de sa photo. Refusé,
-- sans rien appeler, quand il ne reste aucune génération (hint = 'quota').
-- La génération est prise par l'agent au moment du dessin, et rendue si le
-- dessin échoue.
create or replace function public.request_clean_image(target uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := (select auth.uid());
  g public.garments;
  j public.ai_jobs;
  s record;
begin
  select * into g from public.garments where id = target for update;
  if me is null or not found or not public.is_space_member(g.space_id) then
    raise exception 'Pièce introuvable.' using errcode = 'P0001';
  end if;

  select * into j from public.ai_jobs where garment_id = target order by created_at desc limit 1 for update;
  if not found then
    raise exception 'Cette pièce n''a pas de photo à redessiner. Ajoute-la de nouveau avec une photo.'
      using errcode = 'P0001';
  end if;
  if j.status <> 'done' then
    raise exception 'Kodi travaille déjà sur cette pièce.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('generation:' || me::text, 0));
  select * into s from public.generation_sync(me, g.space_id);
  if s.remaining <= 0 then
    raise exception 'Tu as utilisé tes générations.' using errcode = 'P0001', hint = 'quota';
  end if;

  update public.ai_jobs
  set status = 'queued', clean = true, runs = 0, error = null, claimed_at = null, requested_by = me
  where id = j.id;
  return s.remaining;
end
$$;

revoke all on function public.request_clean_image(uuid) from public, anon;
grant execute on function public.request_clean_image(uuid) to authenticated;

-- ---------------------------------------------------------------- suivi (bêta)

-- Séparé par fournisseur : ce que coûtent Anthropic (repérage) et Google
-- (segmentation et dessin), mois par mois. Estimations, pas des factures.
create or replace view public.generation_costs as
select
  date_trunc('month', created_at) as mois,
  provider,
  kind,
  count(*) as appels,
  count(*) filter (where cache_hit) as depuis_le_cache,
  count(*) filter (where status = 'succes') as reussis,
  count(*) filter (where status = 'echec') as echecs,
  count(*) filter (where status = 'rejet') as rejets,
  round(sum(cost_estimate_usd), 4) as cout_usd
from public.generation_log
group by 1, 2, 3;

-- Les trois chiffres de la bêta : part des gratuites qui génèrent, nombre
-- moyen de générations par gratuite, passage à l'abonnement après épuisement.
create or replace view public.generation_free_funnel as
with free as (
  select q.user_id, q.remaining, q.granted,
         (select count(*) from public.generation_log l
          where l.user_id = q.user_id and l.counted and l.status = 'succes' and l.plan = 'decouverte') as faites
  from public.generation_quota q
  where q.source = 'trial'
), epuisees as (
  select f.* from free f where f.remaining = 0
)
select
  (select count(*) from free) as gratuites,
  (select count(*) from free where faites > 0) as gratuites_qui_generent,
  round((select count(*) filter (where faites > 0) from free)::numeric / nullif((select count(*) from free), 0), 3) as part_qui_genere,
  round((select avg(faites) from free), 2) as generations_moyennes,
  (select count(*) from epuisees) as epuisees,
  (select count(*) from epuisees e
   where exists (
     select 1 from public.space_members m join public.subscriptions s on s.space_id = m.space_id
     where m.profile_id = e.user_id
   )) as passees_a_labonnement,
  round((select count(*) from epuisees e
   where exists (
     select 1 from public.space_members m join public.subscriptions s on s.space_id = m.space_id
     where m.profile_id = e.user_id
   ))::numeric / nullif((select count(*) from epuisees), 0), 3) as taux_de_passage;

revoke all on public.generation_costs from anon, authenticated;
revoke all on public.generation_free_funnel from anon, authenticated;
grant select on public.generation_costs to service_role;
grant select on public.generation_free_funnel to service_role;

-- Ménage de la nuit : le journal des appels et le cache ne se gardent pas.
-- (Branché dans la fonction `menage`.)
create or replace function public.purge_generation(older_log interval, older_cache interval)
returns table (cache_paths text[], logs int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  paths text[];
  n int;
begin
  select coalesce(array_agg(image_path), '{}') into paths from public.generation_cache where created_at < now() - older_cache;
  delete from public.generation_cache where created_at < now() - older_cache;
  delete from public.generation_log where created_at < now() - older_log;
  get diagnostics n = row_count;
  return query select paths, n;
end
$$;

revoke all on function public.purge_generation(interval, interval) from public, anon, authenticated;
grant execute on function public.purge_generation(interval, interval) to service_role;
