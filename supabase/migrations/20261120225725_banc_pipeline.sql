-- Le banc d'essai accueille le pipeline d'ajout (spec du 20/11, étape 3) :
-- une photo de test par essai, passée par chaque détoureur, sans rien écrire
-- dans les dressings (fonction process-garment, mode « pipeline »).
alter table public.banc_ia drop constraint banc_ia_mode_check;
alter table public.banc_ia add constraint banc_ia_mode_check
  check (mode = any (array['sonde', 'decoupe', 'kodi', 'juge', 'verifier', 'pipeline']));
