-- Audit du 07/11 : un index sous chaque clé étrangère signalée par le
-- conseiller Supabase. Sans lui, supprimer une pièce, une tenue ou un compte
-- parcourt toute la table liée (suppressions en cascade), et « Image propre »
-- ou « Rendu incorrect » cherchent la dernière demande d'une pièce sans index.
create index if not exists ai_images_space_idx on public.ai_images (space_id);
create index if not exists ai_jobs_garment_idx on public.ai_jobs (garment_id, created_at desc);
create index if not exists ai_jobs_requested_by_idx on public.ai_jobs (requested_by);
create index if not exists consents_profile_idx on public.consents (profile_id);
create index if not exists events_outfit_idx on public.events (outfit_id);
create index if not exists garment_reports_space_idx on public.garment_reports (space_id);
create index if not exists garments_category_idx on public.garments (category_id);
create index if not exists generation_log_space_idx on public.generation_log (space_id);
create index if not exists kode_messages_outfit_idx on public.kode_messages (outfit_id);
create index if not exists likes_garment_idx on public.likes (garment_id);
create index if not exists likes_outfit_idx on public.likes (outfit_id);
create index if not exists loans_counterpart_profile_idx on public.loans (counterpart_profile_id);
create index if not exists outfit_items_garment_idx on public.outfit_items (garment_id);
create index if not exists planned_days_outfit_idx on public.planned_days (outfit_id);
