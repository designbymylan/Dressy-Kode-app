-- Mes choix et mémoire de Kodi (23/10).
--
-- Trois choses, toutes adossées à l'accord « gouts » (« Kodi apprend de mes
-- choix », Réglages › Mes choix) :
-- - les cœurs : une pièce ou une tenue aimée, rangée dans « Mes choix » ;
-- - les souvenirs (table kodi_faits) : ce que la personne a aimé ou écarté,
--   en phrases, créées par trigger seulement avec l'accord en vigueur ; leur
--   vecteur (embedding) sert à retrouver les bons souvenirs pour chaque
--   question ;
-- - l'effacement : retirer l'accord vide les souvenirs, effacer un cœur ou
--   une tenue écartée efface le souvenir qui en vient.
--
-- Les cœurs restent des signets sans accord : la personne garde ses favoris
-- même si elle refuse que Kodi en tire une mémoire.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------- accord

alter table public.consents drop constraint consents_kind_check;
alter table public.consents add constraint consents_kind_check check (kind in ('silhouette', 'gouts'));

-- ---------------------------------------------------------------- cœurs

-- Un cœur vise une pièce OU une tenue : deux colonnes, une seule remplie.
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  garment_id uuid references public.garments(id) on delete cascade,
  outfit_id uuid references public.outfits(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(garment_id, outfit_id) = 1)
);
create unique index likes_garment_uniq on public.likes (space_id, garment_id) where garment_id is not null;
create unique index likes_outfit_uniq on public.likes (space_id, outfit_id) where outfit_id is not null;
create index likes_space_idx on public.likes (space_id, created_at desc);

alter table public.likes enable row level security;
revoke all on public.likes from anon;
revoke update, truncate, references, trigger on public.likes from authenticated;

create policy likes_select_member on public.likes
  for select to authenticated using (public.is_space_member(space_id));
-- La pièce ou la tenue doit appartenir à cet espace : la RLS de garments et
-- outfits fait le tri, une pièce d'un autre espace n'est pas visible.
create policy likes_insert_member on public.likes
  for insert to authenticated
  with check (
    public.is_space_member(space_id)
    and (garment_id is null or exists (select 1 from public.garments g where g.id = garment_id and g.space_id = likes.space_id))
    and (outfit_id is null or exists (select 1 from public.outfits o where o.id = outfit_id and o.space_id = likes.space_id))
  );
create policy likes_delete_member on public.likes
  for delete to authenticated using (public.is_space_member(space_id));

-- ---------------------------------------------------------------- souvenirs

create table public.kodi_faits (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  -- D'où vient le souvenir : un cœur (« aime ») ou une tenue écartée (« ecarte »).
  origine text not null check (origine in ('aime', 'ecarte')),
  -- La ligne d'origine (likes.id ou outfit_feedback.id) : sert à effacer le
  -- souvenir quand la ligne disparaît. Pas de clé étrangère : deux tables.
  origine_id uuid not null,
  texte text not null check (char_length(texte) between 1 and 400),
  -- Vecteur de 768 dimensions (embedding Gemini, réduit par l'API).
  embedding extensions.vector(768),
  created_at timestamptz not null default now()
);
create index kodi_faits_space_idx on public.kodi_faits (space_id, created_at desc);
create index kodi_faits_origine_idx on public.kodi_faits (origine_id);
create index kodi_faits_embedding_idx on public.kodi_faits using hnsw (embedding extensions.vector_cosine_ops);

alter table public.kodi_faits enable row level security;
revoke all on public.kodi_faits from anon;
-- Pas d'écriture directe : seuls les triggers (avec l'accord) et la fonction
-- Kodi (clé service, pour le vecteur) écrivent.
revoke insert, update, truncate, references, trigger on public.kodi_faits from authenticated;

create policy kodi_faits_select_member on public.kodi_faits
  for select to authenticated using (public.is_space_member(space_id));
-- Ce que Kodi retient se voit et s'efface, une ligne à la fois.
create policy kodi_faits_delete_member on public.kodi_faits
  for delete to authenticated using (public.is_space_member(space_id));

-- Les souvenirs les plus proches d'une question. Invoker : la RLS s'applique.
create or replace function public.match_kodi_faits(target uuid, query extensions.vector(768), n int default 8)
returns table (id uuid, texte text, origine text, similarite double precision)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select f.id, f.texte, f.origine, 1 - (f.embedding <=> query)
  from public.kodi_faits f
  where f.space_id = target and f.embedding is not null
  order by f.embedding <=> query
  limit least(n, 20);
$$;
revoke all on function public.match_kodi_faits(uuid, extensions.vector, int) from public, anon;
grant execute on function public.match_kodi_faits(uuid, extensions.vector, int) to authenticated, service_role;

-- ---------------------------------------------------------------- triggers

-- Un cœur devient un souvenir, seulement avec l'accord « gouts ».
create or replace function public.faits_depuis_likes()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  texte text;
begin
  if not public.has_consent(new.space_id, 'gouts') then return null; end if;

  if new.garment_id is not null then
    select 'Pièce aimée : ' || g.name
      || coalesce(' (' || nullif(concat_ws(', ', array_to_string(g.colors, ', '), g.material), '') || ')', '')
    into texte
    from public.garments g
    where g.id = new.garment_id;
  else
    select 'Tenue aimée « ' || coalesce(o.name, 'sans titre') || ' » : ' || coalesce(string_agg(g.name, ' + ' order by g.name), '')
    into texte
    from public.outfits o
    left join public.outfit_items oi on oi.outfit_id = o.id
    left join public.garments g on g.id = oi.garment_id
    where o.id = new.outfit_id
    group by o.id, o.name;
  end if;

  if texte is not null then
    insert into public.kodi_faits (space_id, origine, origine_id, texte)
    values (new.space_id, 'aime', new.id, left(texte, 400));
  end if;
  return null;
end
$$;
revoke all on function public.faits_depuis_likes() from public, anon, authenticated;
create trigger likes_faits after insert on public.likes
  for each row execute function public.faits_depuis_likes();

-- Une tenue écartée devient un souvenir, avec sa raison, avec l'accord.
-- Deux pièces au moins : une tenue sans pièce ne dit rien.
create or replace function public.faits_depuis_ecarts()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.has_consent(new.space_id, 'gouts') then return null; end if;

  insert into public.kodi_faits (space_id, origine, origine_id, texte)
  select
    new.space_id,
    'ecarte',
    new.id,
    left(
      'Tenue écartée (' || case new.reason
        when 'style' then 'pas son style'
        when 'couleurs' then 'les couleurs ne lui plaisaient pas ensemble'
        when 'confort' then 'pas à l’aise dedans'
        when 'meteo' then 'pas adaptée à la météo'
        when 'journee' then 'pas adaptée à sa journée'
        when 'piece' then 'une pièce ne lui allait pas'
        else 'sans raison donnée'
      end || ') : ' || string_agg(g.name, ' + ' order by g.name),
      400
    )
  from public.garments g
  where g.id = any (new.garment_ids)
  having count(*) >= 2;
  return null;
end
$$;
revoke all on function public.faits_depuis_ecarts() from public, anon, authenticated;
create trigger outfit_feedback_faits after insert on public.outfit_feedback
  for each row execute function public.faits_depuis_ecarts();

-- Effacer la ligne d'origine efface le souvenir (cœur retiré, tenue écartée
-- effacée par la nuit de conservation, pièce supprimée en cascade).
create or replace function public.faits_retires()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.kodi_faits where origine_id = old.id;
  return null;
end
$$;
revoke all on function public.faits_retires() from public, anon, authenticated;
create trigger likes_faits_retires after delete on public.likes
  for each row execute function public.faits_retires();
create trigger outfit_feedback_faits_retires after delete on public.outfit_feedback
  for each row execute function public.faits_retires();

-- Accord retiré : les souvenirs partent aussitôt. Les cœurs restent (ce sont
-- des favoris, pas une mémoire) ; la silhouette garde son comportement.
create or replace function public.consents_after_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.kind = 'silhouette' and not new.granted then
    update public.silhouettes
    set height_cm = null, weight_kg = null, shape = null, shape_source = null, measurements = '{}'::jsonb
    where space_id = new.space_id;
  end if;
  if new.kind = 'gouts' and not new.granted then
    delete from public.kodi_faits where space_id = new.space_id;
  end if;
  return null;
end
$$;

-- ---------------------------------------------------------------- conservation

-- Un an de souvenirs, pas plus (minimisation, RGPD art. 5.1.e). Les cœurs
-- ne vieillissent pas : ce sont des choix que la personne garde.
select cron.schedule(
  'kodi-faits-retention',
  '23 3 * * *',
  $$delete from public.kodi_faits where created_at < now() - interval '12 months'$$
);
