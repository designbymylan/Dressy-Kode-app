-- Lignes déjà là quand la migration s'applique : le rattrapage des découpes par contraste.
insert into public.ai_jobs (id, status, garment_id, redo, cutout, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'done', gen_random_uuid(), 0, '{"methode":"contraste"}', '2026-11-18'),
  ('00000000-0000-0000-0000-0000000000a2', 'done', gen_random_uuid(), 0, '{"methode":"generation"}', '2026-11-18'),
  ('00000000-0000-0000-0000-0000000000a3', 'done', gen_random_uuid(), 0, '{"methode":"contraste"}', '2026-11-10'),
  ('00000000-0000-0000-0000-0000000000a4', 'done', gen_random_uuid(), 1, '{"methode":"contraste"}', '2026-11-18'),
  ('00000000-0000-0000-0000-0000000000a5', 'done', null, 0, '{"methode":"contraste"}', '2026-11-18');
