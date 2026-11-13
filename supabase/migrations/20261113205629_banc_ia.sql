-- Le banc d'essai de l'IA (13/11) : sondes de l'intermédiaire, essais de
-- découpe, scénarios de Kodi. Une ligne = un essai. Fermée au client : seuls
-- la clé service et l'éditeur (SQL) y écrivent. Un essai ne part que si
-- l'appel porte le jeton dont l'empreinte (sha256) est dans la ligne
-- (fonction banc-ia).
-- Appliquée au projet sous la version 20261113205629.
create table public.banc_ia (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mode text not null check (mode in ('sonde', 'decoupe', 'kodi', 'juge')),
  libelle text not null default '' check (char_length(libelle) <= 120),
  params jsonb not null default '{}'::jsonb,
  jeton_sha256 text not null check (jeton_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error text,
  cost_usd numeric(10, 5)
);
create index banc_ia_created_idx on public.banc_ia (created_at desc);

alter table public.banc_ia enable row level security;
revoke all on public.banc_ia from anon, authenticated;

-- Les images de test (jamais une photo d'utilisateur), privées.
insert into storage.buckets (id, name, public)
values ('banc', 'banc', false)
on conflict (id) do nothing;
