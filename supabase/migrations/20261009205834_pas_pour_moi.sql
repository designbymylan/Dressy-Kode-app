-- « Pas pour moi » (09/10) : une tenue écartée et sa raison. Kode les lit
-- (trois derniers mois, vingt au plus) pour ne pas les reproposer et tenir
-- compte de la raison. Gardées six mois, puis effacées chaque nuit.
create table public.outfit_feedback (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  garment_ids uuid[] not null check (cardinality(garment_ids) between 1 and 12),
  reason text not null check (reason in ('style', 'couleurs', 'confort', 'meteo', 'journee', 'piece', 'sans')),
  target_ids uuid[] not null default '{}' check (cardinality(target_ids) <= 12),
  created_at timestamptz not null default now()
);
create index outfit_feedback_space_idx on public.outfit_feedback (space_id, created_at desc);

alter table public.outfit_feedback enable row level security;
revoke all on public.outfit_feedback from anon;
revoke update, truncate, references, trigger on public.outfit_feedback from authenticated;

create policy outfit_feedback_select_member on public.outfit_feedback
  for select to authenticated using (public.is_space_member(space_id));
create policy outfit_feedback_insert_member on public.outfit_feedback
  for insert to authenticated with check (public.is_space_member(space_id));
create policy outfit_feedback_delete_member on public.outfit_feedback
  for delete to authenticated using (public.is_space_member(space_id));

-- Six mois de mémoire, pas plus (minimisation, RGPD art. 5.1.e).
select cron.schedule(
  'outfit-feedback-retention',
  '17 3 * * *',
  $$delete from public.outfit_feedback where created_at < now() - interval '6 months'$$
);
