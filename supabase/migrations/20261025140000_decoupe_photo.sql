-- Détourage des photos (25/10) : la pièce est découpée dans la photo de la
-- personne au lieu d'être redessinée. Ce qui s'ajoute :
--  * ce que la personne précise en envoyant sa photo (marque, taille, coupe,
--    matière, note) : ai_jobs.details, puis garments.brand / size / fit ;
--  * le « rendu incorrect » : report_garment() remet la découpe en file, deux
--    fois au plus (niveau 1 : modèle de segmentation plus fort ; niveau 2 :
--    seul cas où une image est générée) ;
--  * le journal de chaque découpe (méthode, contrôles, durées, coût en jetons)
--    dans ai_jobs.cutout, sans aucune donnée du corps ni de la photo.

alter table public.ai_jobs
  add column details jsonb,
  add column redo smallint not null default 0 check (redo between 0 and 2),
  add column cutout jsonb;

alter table public.garments
  add column brand text check (char_length(brand) <= 60),
  add column size text check (char_length(size) <= 20),
  add column fit text check (char_length(fit) <= 40),
  add column reports smallint not null default 0 check (reports between 0 and 2);

-- ---------------------------------------------------------------- précisions

-- Le client ne choisit que des champs connus, de longueur bornée ; le reste
-- appartient à l'agent. S'ajoute à ai_jobs_before_insert (même ordre
-- alphabétique : celui-ci passe après).
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

create trigger ai_jobs_clean_details
  before insert on public.ai_jobs
  for each row execute function public.ai_jobs_clean_details();

-- ---------------------------------------------------------------- rendu incorrect

-- Le compteur de reprises n'est modifiable que par report_garment().
create or replace function public.garments_keep_reports()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user = 'authenticated' then
    new.reports := old.reports;
  end if;
  return new;
end
$$;

create trigger garments_keep_reports
  before update on public.garments
  for each row execute function public.garments_keep_reports();

create table public.garment_reports (
  id uuid primary key default gen_random_uuid(),
  garment_id uuid not null references public.garments(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  -- 1 : la découpe reprend avec un modèle plus fort ; 2 : la pièce est redessinée.
  level smallint not null check (level between 1 and 2),
  -- Méthode et contrôles de l'image signalée (jamais la photo ni le corps).
  before jsonb,
  created_at timestamptz not null default now()
);
create index garment_reports_garment_idx on public.garment_reports (garment_id);
alter table public.garment_reports enable row level security;
create policy garment_reports_read_member on public.garment_reports
  for select to authenticated using (public.is_space_member(space_id));
revoke all on public.garment_reports from anon;
revoke insert, update, delete, truncate, references, trigger on public.garment_reports from authenticated;

-- « Ce n'est pas bien découpé » : la pièce repasse par l'agent, avec la photo
-- d'origine. Deux fois au plus ; la 2e redessine la pièce (seule génération).
create or replace function public.report_garment(target uuid)
returns smallint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g public.garments;
  j public.ai_jobs;
  next_level smallint;
begin
  select * into g from public.garments where id = target for update;
  if not found or not public.is_space_member(g.space_id) then
    raise exception 'Pièce introuvable.' using errcode = 'P0001';
  end if;
  if g.reports >= 2 then
    raise exception 'Cette pièce a déjà été reprise deux fois. Retire-la et ajoute-la avec une autre photo.'
      using errcode = 'P0001';
  end if;

  select * into j from public.ai_jobs where garment_id = target order by created_at desc limit 1 for update;
  if not found then
    raise exception 'Cette pièce n''a pas de photo à reprendre. Ajoute-la de nouveau avec une photo.'
      using errcode = 'P0001';
  end if;
  if j.status <> 'done' then
    raise exception 'Kodi reprend déjà cette pièce.' using errcode = 'P0001';
  end if;

  next_level := g.reports + 1;
  insert into public.garment_reports (garment_id, space_id, level, before)
  values (target, g.space_id, next_level, j.cutout - 'usage' - 'reperage');

  update public.garments set reports = next_level where id = target;
  update public.ai_jobs
  set status = 'queued', redo = next_level, runs = 0, error = null, claimed_at = null
  where id = j.id;
  return next_level;
end
$$;

revoke all on function public.report_garment(uuid) from public, anon;
grant execute on function public.report_garment(uuid) to authenticated;
