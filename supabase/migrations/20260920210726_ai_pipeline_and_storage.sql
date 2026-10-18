-- Boucle de génération d'image : une ligne par demande, que le worker externe
-- fait avancer. Les deux prompts sont conservés — celui de l'utilisatrice et
-- celui réécrit par le modèle de texte — pour pouvoir rejouer et auditer.
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  user_input text not null,
  refined_prompt text,
  prompt_model text,
  image_model text,
  status text not null default 'queued'
    check (status in ('queued', 'prompting', 'generating', 'cutout', 'uploading', 'done', 'failed')),
  error text,
  attempts smallint not null default 0,
  garment_id uuid references public.garments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_jobs_space_idx on public.ai_jobs(space_id, created_at desc);
-- Index partiel : le worker ne scrute que la file d'attente.
create index ai_jobs_queue_idx on public.ai_jobs(created_at) where status = 'queued';

create table public.ai_images (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  storage_path text not null,
  has_alpha boolean not null default false,
  width integer,
  height integer,
  bytes integer,
  created_at timestamptz not null default now()
);
create index ai_images_job_idx on public.ai_images(job_id);

create function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end $$;

create trigger ai_jobs_touch before update on public.ai_jobs
  for each row execute function public.touch_updated_at();
create trigger garments_touch before update on public.garments
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();
create trigger silhouettes_touch before update on public.silhouettes
  for each row execute function public.touch_updated_at();

alter table public.ai_jobs enable row level security;
alter table public.ai_images enable row level security;

create policy ai_jobs_all_member on public.ai_jobs
  for all to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));

create policy ai_images_read_member on public.ai_images
  for select to authenticated using (public.is_space_member(space_id));

-- Buckets privés : une garde-robe ne doit jamais être servie par URL publique.
-- Convention de chemin « <space_id>/<fichier> », lue par les politiques.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('garments',     'garments',     false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('ai-generated', 'ai-generated', false, 10485760, array['image/png', 'image/webp']);

-- Un nom de fichier hors convention ne doit pas faire échouer la requête,
-- seulement refuser l'accès : d'où le cast protégé.
create function public.safe_uuid(t text)
returns uuid language plpgsql immutable
set search_path = pg_temp
as $$ begin return t::uuid; exception when others then return null; end $$;

create policy garments_objects_member on storage.objects
  for all to authenticated
  using (
    bucket_id in ('garments', 'ai-generated')
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id in ('garments', 'ai-generated')
    and public.is_space_member(public.safe_uuid((storage.foldername(name))[1]))
  );
