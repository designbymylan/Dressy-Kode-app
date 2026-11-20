-- Pipeline d'ajout de vêtements (spec du 20/11) : une photo, une pièce
-- détourée et étiquetée en moins de 10 s, sans aucune génération d'image.
--
-- Migration ADDITIVE : l'app et le site en place n'en voient rien (la bascule
-- vient après le banc d'essai). Les contraintes de la taxonomie sur les
-- colonnes déjà écrites par l'app actuelle (kind, colors) attendent la
-- bascule : l'app écrit encore ses propres types d'illustration.

-- taxonomie:debut (version 1, générée depuis supabase/functions/_shared/taxonomy.ts : ne pas modifier à la main)
create or replace function public.taxo_type_valide(cat text, kind text)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select (cat, kind) in (
    ('hauts', 'tshirt'),
    ('hauts', 'chemise'),
    ('hauts', 'blouse'),
    ('hauts', 'polo'),
    ('hauts', 'pull'),
    ('hauts', 'sweat'),
    ('hauts', 'capuche'),
    ('hauts', 'debardeur'),
    ('hauts', 'top'),
    ('bas', 'jean'),
    ('bas', 'pantalon'),
    ('bas', 'chino'),
    ('bas', 'jupe'),
    ('bas', 'jupeculotte'),
    ('bas', 'short'),
    ('bas', 'legging'),
    ('robes', 'robe'),
    ('robes', 'combinaison'),
    ('robes', 'salopette'),
    ('vestes', 'veste'),
    ('vestes', 'blazer'),
    ('vestes', 'manteau'),
    ('vestes', 'trench'),
    ('vestes', 'doudoune'),
    ('vestes', 'gilet'),
    ('chaussures', 'baskets'),
    ('chaussures', 'bottines'),
    ('chaussures', 'bottes'),
    ('chaussures', 'escarpins'),
    ('chaussures', 'sandales'),
    ('chaussures', 'mules'),
    ('chaussures', 'mocassins'),
    ('chaussures', 'derbies'),
    ('chaussures', 'ballerines'),
    ('sacs', 'sacamain'),
    ('sacs', 'bandouliere'),
    ('sacs', 'pochette'),
    ('sacs', 'cabas'),
    ('sacs', 'sacados'),
    ('bijoux', 'collier'),
    ('bijoux', 'boucles'),
    ('bijoux', 'bracelet'),
    ('bijoux', 'bague'),
    ('bijoux', 'montre'),
    ('bijoux', 'broche'),
    ('accessoires', 'ceinture'),
    ('accessoires', 'bandeau'),
    ('accessoires', 'pince'),
    ('accessoires', 'foulard'),
    ('accessoires', 'echarpe'),
    ('accessoires', 'chapeau'),
    ('accessoires', 'casquette'),
    ('accessoires', 'bonnet'),
    ('accessoires', 'lunettes'),
    ('accessoires', 'gants')
  ) $$;

create or replace function public.taxo_couleurs_valides(v text[])
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v <@ array['noir', 'anthracite', 'gris', 'blanc', 'creme', 'beige', 'camel', 'marron', 'bordeaux', 'rouge', 'orange', 'moutarde', 'jaune', 'olive', 'vert', 'marine', 'bleu', 'ciel', 'violet', 'rose', 'dore', 'argente']::text[] $$;

create or replace function public.taxo_matiere_valide(v text)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v in ('coton', 'denim', 'laine', 'maille', 'lin', 'soie', 'cuir', 'daim', 'velours', 'synthetique', 'metal', 'autre') $$;

create or replace function public.taxo_motif_valide(v text)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v in ('uni', 'rayures', 'carreaux', 'imprime', 'fleuri', 'pois', 'logo', 'graphique', 'texture', 'autre') $$;

create or replace function public.taxo_coupe_valide(v text)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v in ('ajustee', 'droite', 'ample', 'oversize', 'evasee', 'sans_objet') $$;

create or replace function public.taxo_saisons_valides(v text[])
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select cardinality(v) between 1 and 4 and v <@ array['printemps', 'ete', 'automne', 'hiver']::text[] $$;

create or replace function public.taxo_habillage_valide(v smallint)
returns boolean language sql immutable parallel safe
set search_path = pg_temp
as $$ select v in (1, 2, 3, 4, 5) $$;
-- taxonomie:fin

-- ---------------------------------------------------------------- pièces

-- L'état de traitement (spec : processing, ready, needs_retake, failed).
-- `status` existe déjà (active, archived, lent, laundry) : d'où pipeline_status.
-- Une pièce d'avant (ou saisie à la main) est « ready ».
alter table public.garments
  add column pipeline_status text not null default 'ready'
    check (pipeline_status in ('processing', 'ready', 'needs_retake', 'failed')),
  add column fail_reason text
    check (fail_reason in ('mask_too_small', 'mask_too_large', 'multiple_items', 'provider_error', 'unexpected')),
  -- La photo d'origine (JPEG 1024 px), privée, gardée tant que la pièce existe :
  -- elle sert à retraiter sans redemander la photo.
  add column original_path text check (char_length(original_path) <= 200),
  -- Matière fermée (avant : `material`, texte libre, gardé pour l'affichage).
  add column matiere text check (matiere is null or public.taxo_matiere_valide(matiere)),
  -- Plusieurs saisons ; l'ancienne `season` en est déduite (déclencheur plus bas).
  add column saisons text[] check (saisons is null or public.taxo_saisons_valides(saisons)),
  add column tags_confidence real check (tags_confidence between 0 and 1),
  add column width integer check (width between 1 and 4096),
  add column height integer check (height between 1 and 4096),
  add column attempts smallint not null default 0 check (attempts between 0 and 100),
  add column pipeline_version integer,
  -- « Tout ajouter » : une pièce prête mais pas encore validée a added_at vide.
  add column added_at timestamptz default now(),
  -- La fiche a été corrigée par la personne après le traitement (qualité de l'étiquetage).
  add column tags_corrected boolean not null default false,
  add constraint garments_fail_reason_etat
    check ((fail_reason is null) = (pipeline_status in ('processing', 'ready'))),
  add constraint garments_fiche_taxonomie check (
    fiche is null or (
      (fiche->>'motif' is null or public.taxo_motif_valide(fiche->>'motif'))
      and (fiche->>'coupe' is null or public.taxo_coupe_valide(fiche->>'coupe'))
      and (fiche->'habillage' is null or (jsonb_typeof(fiche->'habillage') = 'number'
        and public.taxo_habillage_valide((fiche->>'habillage')::smallint)))
    )
  );

update public.garments set added_at = created_at;

create index garments_space_created_idx on public.garments(space_id, created_at desc);
-- Les pièces en revue (prêtes, pas encore ajoutées) ou en cours.
create index garments_space_a_valider_idx on public.garments(space_id) where added_at is null;

-- ---------------------------------------------------------------- saisons

create or replace function public.taxo_saison_resumee(v text[])
returns text language sql immutable parallel safe
set search_path = pg_temp
as $$
  select case
    when coalesce(cardinality(v), 0) = 0 or cardinality(v) >= 3 or ('hiver' = any(v) and 'ete' = any(v)) then 'toute_annee'
    when 'hiver' = any(v) then 'hiver'
    when 'ete' = any(v) then 'ete'
    else 'mi_saison'
  end
$$;

create or replace function public.taxo_saisons_de(season text)
returns text[] language sql immutable parallel safe
set search_path = pg_temp
as $$
  select case season
    when 'hiver' then array['hiver']
    when 'ete' then array['ete']
    when 'mi_saison' then array['printemps', 'automne']
    else array['printemps', 'ete', 'automne', 'hiver']
  end
$$;

update public.garments set saisons = public.taxo_saisons_de(season) where season is not null;

-- ---------------------------------------------------------------- protections

/*
 * La fonction serveur (clé de service) écrit tout. Le client (app, site) ne
 * touche qu'à la fiche : l'état, la raison d'échec, la photo d'origine, les
 * tentatives, la version, la confiance et les dimensions sont au serveur
 * (spec : « privilèges par colonne » ; un déclencheur plutôt que des GRANT
 * par colonne pour ne rien casser chez les clients actuels, qui mettent à jour
 * `garments` librement).
 *
 * À l'insertion, le client crée une ligne « processing » dont la photo est
 * déjà envoyée dans <espace>/<pièce>/original.jpg, ou une pièce saisie à la
 * main (sans photo d'origine), prête d'emblée.
 */
create or replace function public.garments_pipeline()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- saisons ↔ season, dans les deux sens (l'app actuelle n'écrit que season)
  if tg_op = 'INSERT' then
    if new.saisons is not null then new.season := public.taxo_saison_resumee(new.saisons);
    elsif new.season is not null then new.saisons := public.taxo_saisons_de(new.season);
    end if;
  else
    if new.saisons is distinct from old.saisons and new.saisons is not null then
      new.season := public.taxo_saison_resumee(new.saisons);
    elsif new.season is distinct from old.season and new.season is not null then
      new.saisons := public.taxo_saisons_de(new.season);
    end if;
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.original_path is not null then
      if new.original_path <> new.space_id::text || '/' || new.id::text || '/original.jpg' then
        raise exception 'photo d''origine hors de son dossier' using errcode = '42501';
      end if;
      new.pipeline_status := 'processing';
      new.added_at := null;
    else
      new.pipeline_status := 'ready';
    end if;
    new.fail_reason := null;
    new.attempts := 0;
    new.pipeline_version := null;
    new.tags_confidence := null;
    new.width := null;
    new.height := null;
    new.tags_corrected := false;
    return new;
  end if;

  if new.pipeline_status is distinct from old.pipeline_status
    or new.fail_reason is distinct from old.fail_reason
    or new.original_path is distinct from old.original_path
    or new.attempts is distinct from old.attempts
    or new.pipeline_version is distinct from old.pipeline_version
    or new.tags_confidence is distinct from old.tags_confidence
    or new.width is distinct from old.width
    or new.height is distinct from old.height
    or new.tags_corrected is distinct from old.tags_corrected then
    raise exception 'colonnes tenues par le serveur' using errcode = '42501';
  end if;

  -- « Tout ajouter » : une seule fois, et seulement une pièce prête.
  if new.added_at is distinct from old.added_at then
    if old.added_at is not null or new.added_at is null or old.pipeline_status <> 'ready' then
      raise exception 'pièce pas prête à ajouter' using errcode = '42501';
    end if;
    new.added_at := now();
  end if;

  -- Une fiche corrigée après l'étiquetage : la mesure de sa qualité.
  if old.pipeline_version is not null and (
    new.category_id, new.kind, new.colors, new.matiere, new.saisons,
    new.fiche->'motif', new.fiche->'coupe', new.fiche->'habillage'
  ) is distinct from (
    old.category_id, old.kind, old.colors, old.matiere, old.saisons,
    old.fiche->'motif', old.fiche->'coupe', old.fiche->'habillage'
  ) then
    new.tags_corrected := true;
  end if;
  return new;
end
$$;

create trigger garments_pipeline before insert or update on public.garments
  for each row execute function public.garments_pipeline();

-- Le client suit ses pièces en direct (processing → ready) ; Realtime
-- applique la RLS de garments à chaque abonné.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'garments') then
    alter publication supabase_realtime add table public.garments;
  end if;
end
$$;

-- ---------------------------------------------------------------- stockage

/*
 * Compartiment `garments` : le client lit et supprime dans son espace, mais
 * n'y écrit que la photo d'origine (<espace>/<pièce>/original.jpg) ; le
 * détourage et la vignette sont écrits par le serveur. Les autres
 * compartiments gardent la règle d'avant.
 */
drop policy garments_objects_member on storage.objects;

create policy garments_objects_member on storage.objects
  for all to authenticated
  using (
    bucket_id = any (array['ai-generated', 'uploads'])
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = any (array['ai-generated', 'uploads'])
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
  );

create policy garments_lire on storage.objects
  for select to authenticated
  using (bucket_id = 'garments' and public.is_space_member(public.safe_uuid((storage.foldername(name))[1])));

create policy garments_supprimer on storage.objects
  for delete to authenticated
  using (bucket_id = 'garments' and public.is_space_member(public.safe_uuid((storage.foldername(name))[1])));

create policy garments_envoyer_original on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'garments'
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/original\.jpg$'
  );

create policy garments_remplacer_original on storage.objects
  for update to authenticated
  using (
    bucket_id = 'garments'
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/original\.jpg$'
  )
  with check (
    bucket_id = 'garments'
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/original\.jpg$'
  );

-- ---------------------------------------------------------------- journal

/*
 * Un traitement, une ligne (spec : durée de chaque étape, durée totale,
 * statut final, coût estimé, version). Fermée au client. `mode` sépare le
 * banc d'essai des vraies pièces ; `envoi_ms` est la part du téléphone
 * (prétraitement et envoi), mesurée par l'app.
 */
create table public.garment_runs (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid references public.garments(id) on delete set null,
  space_id uuid references public.spaces(id) on delete cascade,
  mode text not null default 'app' check (mode in ('app', 'banc')),
  pipeline_version integer not null,
  statut text not null check (statut in ('ready', 'needs_retake', 'failed')),
  fail_reason text,
  tentative smallint not null default 1,
  detoureur text,
  etiqueteur text,
  etiquetage_ok boolean,
  envoi_ms integer,
  telechargement_ms integer,
  detourage_ms integer,
  etiquetage_ms integer,
  controle_ms integer,
  ecriture_ms integer,
  total_ms integer not null,
  couverture real,
  plus_gros_morceau real,
  confiance real,
  cout_usd numeric(10, 6) not null default 0,
  detail jsonb check (detail is null or pg_column_size(detail) <= 4000),
  created_at timestamptz not null default now()
);
create index garment_runs_created_idx on public.garment_runs(created_at desc);
create index garment_runs_garment_idx on public.garment_runs(garment_id);
create index garment_runs_space_idx on public.garment_runs(space_id);
alter table public.garment_runs enable row level security;
revoke all on public.garment_runs from anon, authenticated;

/*
 * Les quatre indicateurs de la spec, sur 30 jours : durée de bout en bout
 * (médiane et p95, envoi du téléphone compris), part de pièces à reprendre
 * et en échec, coût moyen, part de fiches corrigées. Fermée au client :
 *   select * from pipeline_indicateurs;
 */
create view public.pipeline_indicateurs with (security_invoker = on) as
with r as (
  select * from public.garment_runs where created_at > now() - interval '30 days'
)
select
  r.mode,
  count(*) as traitements,
  round(percentile_cont(0.5) within group (order by coalesce(r.envoi_ms, 0) + r.total_ms)) as duree_mediane_ms,
  round(percentile_cont(0.95) within group (order by coalesce(r.envoi_ms, 0) + r.total_ms)) as duree_p95_ms,
  round(avg((r.statut = 'needs_retake')::int), 3) as part_a_reprendre,
  round(avg((r.statut = 'failed')::int), 3) as part_en_echec,
  round(avg(r.cout_usd), 5) as cout_moyen_usd,
  (select round(avg(g.tags_corrected::int), 3) from public.garments g
    where g.pipeline_version is not null and g.added_at is not null and g.created_at > now() - interval '30 days') as part_fiches_corrigees
from r
group by r.mode;
revoke all on public.pipeline_indicateurs from anon, authenticated;
