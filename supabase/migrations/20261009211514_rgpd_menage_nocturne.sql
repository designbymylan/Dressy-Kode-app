-- RGPD (09/10) : conservation limitée (art. 5.1.e). Chaque nuit, la
-- fonction `menage` applique les durées du registre (docs/rgpd/) :
-- conversations avec Kode, demandes de dessin, photos confiées à Kode après
-- 30 jours, exports après deux jours. L'appel ne transporte rien : c'est un
-- réveil, comme pour l'agent.
create or replace function public.menage_url()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select 'https://pxjlbtevrexlckhxskdn.supabase.co/functions/v1/menage' $$;
revoke all on function public.menage_url() from public, anon, authenticated;

select cron.schedule(
  'rgpd-menage',
  '41 3 * * *',
  $$ select net.http_post(url := public.menage_url(), body := '{}'::jsonb, timeout_milliseconds := 30000) $$
);
