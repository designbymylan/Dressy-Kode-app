-- Détourage par SAM 3 chez fal.ai (20/11) : chaque appel est noté dans
-- generation_log (fournisseur 'fal', type 'segmentation', 0,005 $), comme le
-- repérage et le dessin. Il ne prend rien au compteur de générations.
alter table public.generation_log drop constraint generation_log_provider_check;
alter table public.generation_log add constraint generation_log_provider_check
  check (provider = any (array['google'::text, 'anthropic'::text, 'fal'::text]));
comment on column public.generation_log.provider is 'google, anthropic ou fal (détourage SAM 3, depuis le 20/11)';
