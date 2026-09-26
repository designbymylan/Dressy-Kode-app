-- Kode : la conversation avec le styliste.
--
-- Une ligne par bulle. Les questions comptent pour le quota mensuel ; les
-- réponses portent la tenue proposée (outfits, source 'kode'). Seule l'Edge
-- Function `kode` écrit ici : une réponse de Kode ne doit pas pouvoir être
-- fabriquée depuis le navigateur, ni une question passer sous le quota.

create table public.kode_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  author text not null check (author in ('user', 'kode')),
  body text not null,
  outfit_id uuid references public.outfits(id) on delete set null,
  -- Pour les réponses : pourquoi cette tenue, modèle, consommation.
  meta jsonb not null default '{}'::jsonb,
  -- « Nouvelle conversation » archive au lieu d'effacer : le quota se
  -- compte sur tout le mois, conversation effacée ou non.
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index kode_messages_space_idx on public.kode_messages (space_id, created_at);

alter table public.kode_messages enable row level security;

create policy kode_messages_select_member on public.kode_messages
  for select to authenticated using (public.is_space_member(space_id));

revoke all on public.kode_messages from anon;
revoke insert, update, delete, truncate, references, trigger on public.kode_messages from authenticated;

-- ---------------------------------------------------------------- quota

-- 20 questions par mois : l'offre gratuite de design/_projet/Offres.dc.html.
-- Un seul endroit à changer le jour où Stripe distingue les offres.
create or replace function public.kode_monthly_limit()
returns int
language sql
immutable
set search_path = pg_temp
as $$ select 20 $$;

-- Invoker : la RLS de kode_messages s'applique, un espace étranger compte 0.
-- Le mois se découpe à l'heure de Paris, pas à celle du serveur.
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
        and created_at >= (date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris')
    ),
    public.kode_monthly_limit();
$$;

revoke all on function public.kode_usage(uuid) from public, anon;
grant execute on function public.kode_usage(uuid) to authenticated, service_role;

-- Enregistre une question si le quota le permet. Le verrou empêche deux
-- questions envoyées en même temps de passer toutes les deux sur la dernière
-- place du mois.
create or replace function public.kode_ask(target uuid, question text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  n int;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('kode:' || target::text, 0));

  select u.used into n from public.kode_usage(target) u;
  if n >= public.kode_monthly_limit() then
    raise exception 'Tu as posé tes % questions à Kode ce mois-ci. Elles reviennent le 1er du mois.',
      public.kode_monthly_limit()
      using errcode = 'P0001', hint = 'quota';
  end if;

  insert into public.kode_messages (space_id, author, body)
  values (target, 'user', left(btrim(question), 600))
  returning id into new_id;
  return new_id;
end
$$;

revoke all on function public.kode_ask(uuid, text) from public, anon, authenticated;
grant execute on function public.kode_ask(uuid, text) to service_role;

-- « Nouvelle conversation » : archive la conversation en cours de son espace.
create or replace function public.kode_reset()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.kode_messages m
  set archived = true
  where not m.archived and public.is_space_member(m.space_id);
$$;

revoke all on function public.kode_reset() from public, anon;
grant execute on function public.kode_reset() to authenticated;
