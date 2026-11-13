-- Le dépôt de déploiement (13/11) : le code d'un commit y est posé, sous
-- un préfixe imprévisible, le temps que Supabase assemble la fonction qui
-- l'importe ; il est retiré aussitôt après. Public en lecture seulement
-- (l'assembleur de Supabase n'envoie pas de jeton) ; seule la fonction
-- `depot`, avec un jeton de banc_ia, y écrit.
-- Appliquée au projet sous la version 20261113213652.
insert into storage.buckets (id, name, public)
values ('depot', 'depot', true)
on conflict (id) do nothing;

alter table public.banc_ia drop constraint banc_ia_mode_check;
alter table public.banc_ia add constraint banc_ia_mode_check
  check (mode in ('sonde', 'decoupe', 'kodi', 'juge', 'verifier', 'depot'));
