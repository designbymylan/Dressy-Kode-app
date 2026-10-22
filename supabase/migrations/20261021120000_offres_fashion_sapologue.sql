-- Offres du 21/10 : Fashion et Sapologue (web/src/lib/plans.ts).
--
-- Les identifiants ne changent pas, ils vivent aussi chez Stripe (clés de
-- prix dressy_<offre>_<période>) : `capsule` porte Fashion, `atelier`
-- porte Sapologue. Couture n'est plus vendue ; ses limites restent pour un
-- abonnement qui existerait encore (il n'y en avait aucun au 21/10).
--
--   Découverte (sans abonnement) : 30 pièces, 5 questions à Kodi par mois
--   Fashion (capsule)            : 120 pièces, 30 questions par mois
--   Sapologue (atelier)          : sans limite, sans limite
--
-- À appliquer avant de mettre en ligne le site qui affiche ces offres, et
-- avant de relancer tools/stripe-setup.mjs (nouveaux prix de Sapologue).

create or replace function public.plan_limits(plan text)
returns table (pieces int, kode int)
language sql
immutable
set search_path = pg_temp
as $$
  select
    case plan when 'capsule' then 120 when 'atelier' then null when 'couture' then null else 30 end,
    case plan when 'capsule' then 30 when 'atelier' then null when 'couture' then null else 5 end;
$$;
