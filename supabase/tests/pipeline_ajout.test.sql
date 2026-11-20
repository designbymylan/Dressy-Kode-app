-- Essais de la migration pipeline_ajout (spec du 20/11) : RLS et Storage entre
-- deux personnes, colonnes tenues par le serveur, « Tout ajouter », saisons,
-- taxonomie. Chaque bloc lève ECHEC s'il trouve une faille.
--   bash tools/test-pipeline.sh

create function pg_temp.doit_echouer(sql text, nom text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ECHEC : % aurait dû être refusé', nom;
exception when others then
  if sqlerrm like 'ECHEC%' then raise; end if;
  raise notice 'ok   refusé : % (%)', nom, left(sqlerrm, 70);
end $$;
create function pg_temp.vrai(cond boolean, nom text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ECHEC : %', nom; end if;
  raise notice 'ok   %', nom;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

-- ---- reprise des données d'avant
select pg_temp.vrai((select pipeline_status = 'ready' and added_at is not null and saisons = '{hiver}' from garments where name = 'Pull marine'), 'pièce d''avant : prête, ajoutée, saisons déduites');
select pg_temp.vrai((select saisons = '{printemps,ete,automne,hiver}' from garments where name = 'Jean brut'), 'toute l''année : quatre saisons');

-- ---- personne A
set role authenticated;
select set_config('test.uid', 'a0000000-0000-4000-8000-000000000001', false);

select pg_temp.vrai((select count(*) = 1 from garments), 'RLS : A ne voit que sa pièce');
select pg_temp.vrai((select count(*) = 0 from garments where space_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 'RLS : A ne lit rien de B');
update garments set name = 'piraté' where id = 'bbbbbbbb-1111-4000-8000-000000000002';
select pg_temp.doit_echouer($$insert into garments (space_id, category_id, name) values ('bbbbbbbb-0000-4000-8000-000000000002', 'hauts', 'x')$$, 'A crée une pièce chez B');

-- Création d'une ligne « processing » : la photo est dans son dossier.
insert into garments (id, space_id, category_id, name, original_path, pipeline_status, attempts, added_at)
values ('aaaaaaaa-2222-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hauts', 'Pièce', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-2222-4000-8000-000000000001/original.jpg', 'ready', 9, now());
select pg_temp.vrai((select pipeline_status = 'processing' and attempts = 0 and added_at is null from garments where id = 'aaaaaaaa-2222-4000-8000-000000000001'),
  'insertion : processing forcé, tentatives à zéro, pas encore ajoutée');
select pg_temp.doit_echouer($$insert into garments (id, space_id, category_id, name, original_path) values ('aaaaaaaa-3333-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'hauts', 'x', 'bbbbbbbb-0000-4000-8000-000000000002/x/original.jpg')$$,
  'photo d''origine hors de son dossier');

-- Colonnes tenues par le serveur
select pg_temp.doit_echouer($$update garments set pipeline_status = 'ready' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, 'le client passe sa pièce en ready');
select pg_temp.doit_echouer($$update garments set tags_confidence = 1 where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, 'le client écrit la confiance');
select pg_temp.doit_echouer($$update garments set original_path = 'autre' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, 'le client change la photo d''origine');
select pg_temp.doit_echouer($$update garments set added_at = now() where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, '« Tout ajouter » sur une pièce en cours');

-- ---- le serveur termine le traitement
reset role;
update garments set pipeline_status = 'ready', pipeline_version = 1, tags_confidence = 0.86, kind = 'pull', category_id = 'hauts',
  colors = '{marine}', matiere = 'laine', saisons = '{automne,hiver}', fiche = '{"motif":"uni","coupe":"droite","habillage":2}', width = 800, height = 900
where id = 'aaaaaaaa-2222-4000-8000-000000000001';
select pg_temp.vrai((select season = 'hiver' from garments where id = 'aaaaaaaa-2222-4000-8000-000000000001'), 'saisons → ancienne saison');
select pg_temp.doit_echouer($$update garments set pipeline_status = 'needs_retake' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, 'à reprendre sans raison');
select pg_temp.doit_echouer($$update garments set matiere = 'denim brut' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, 'matière hors taxonomie');
select pg_temp.doit_echouer($$update garments set saisons = '{mi_saison}' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, 'saison hors taxonomie');
select pg_temp.doit_echouer($$update garments set fiche = '{"motif":"camouflage"}' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, 'motif hors taxonomie');
select pg_temp.doit_echouer($$update garments set fiche = '{"habillage":9}' where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, 'habillage hors taxonomie');
select pg_temp.vrai(public.taxo_type_valide('hauts', 'pull') and not public.taxo_type_valide('hauts', 'jean') and not public.taxo_type_valide('vestes', 'bomber'), 'types par catégorie');

-- ---- A corrige puis ajoute
set role authenticated;
select pg_temp.vrai((select tags_corrected = false from garments where id = 'aaaaaaaa-2222-4000-8000-000000000001'), 'fiche pas encore corrigée');
update garments set name = 'Mon pull' where id = 'aaaaaaaa-2222-4000-8000-000000000001';
select pg_temp.vrai((select tags_corrected = false from garments where id = 'aaaaaaaa-2222-4000-8000-000000000001'), 'un nouveau nom n''est pas une correction de fiche');
update garments set saisons = '{hiver}' where id = 'aaaaaaaa-2222-4000-8000-000000000001';
select pg_temp.vrai((select tags_corrected and season = 'hiver' from garments where id = 'aaaaaaaa-2222-4000-8000-000000000001'), 'saisons corrigées : fiche marquée corrigée');
update garments set added_at = '2000-01-01' where id = 'aaaaaaaa-2222-4000-8000-000000000001';
select pg_temp.vrai((select added_at > now() - interval '1 minute' from garments where id = 'aaaaaaaa-2222-4000-8000-000000000001'), '« Tout ajouter » : date du serveur');
select pg_temp.doit_echouer($$update garments set added_at = now() where id = 'aaaaaaaa-2222-4000-8000-000000000001'$$, '« Tout ajouter » deux fois');
update garments set season = 'ete' where id = 'aaaaaaaa-1111-4000-8000-000000000001';
select pg_temp.vrai((select saisons = '{ete}' from garments where id = 'aaaaaaaa-1111-4000-8000-000000000001'), 'l''app actuelle écrit season : saisons suivent');

-- Une pièce saisie à la main (sans photo) : prête et ajoutée d'emblée, comme avant.
insert into garments (space_id, category_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'bas', 'Jupe noire');
select pg_temp.vrai((select pipeline_status = 'ready' and added_at is not null from garments where name = 'Jupe noire'), 'saisie à la main : prête et ajoutée');

-- ---- Storage
insert into storage.objects (bucket_id, name) values ('garments', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-2222-4000-8000-000000000001/original.jpg');
select pg_temp.vrai(true, 'Storage : A envoie sa photo d''origine');
select pg_temp.doit_echouer($$insert into storage.objects (bucket_id, name) values ('garments', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-2222-4000-8000-000000000001/cutout.webp')$$, 'Storage : le client écrit le détourage');
select pg_temp.doit_echouer($$insert into storage.objects (bucket_id, name) values ('garments', 'bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-1111-4000-8000-000000000002/original.jpg')$$, 'Storage : A écrit chez B');
insert into storage.objects (bucket_id, name) values ('uploads', 'aaaaaaaa-0000-4000-8000-000000000001/photo.jpg');
select pg_temp.vrai(true, 'Storage : uploads inchangé pour l''app actuelle');
reset role;
insert into storage.objects (bucket_id, name) values ('garments', 'bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-1111-4000-8000-000000000002/cutout.webp');
set role authenticated;
select pg_temp.vrai((select count(*) = 0 from storage.objects where name like 'bbbbbbbb%'), 'Storage : A ne lit rien de B');
delete from storage.objects where name like 'bbbbbbbb%';
reset role;
select pg_temp.vrai((select count(*) = 1 from storage.objects where name like 'bbbbbbbb%'), 'Storage : A ne supprime rien de B');
select pg_temp.vrai((select name = 'Jean brut' from garments where id = 'bbbbbbbb-1111-4000-8000-000000000002'), 'RLS : la pièce de B n''a pas été modifiée par A');

-- ---- journal et indicateurs fermés au client
insert into garment_runs (space_id, pipeline_version, statut, total_ms, envoi_ms, cout_usd) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 1, 'ready', 4000, 1500, 0.004),
  ('aaaaaaaa-0000-4000-8000-000000000001', 1, 'needs_retake', 3000, 1500, 0.004);
select pg_temp.vrai((select traitements = 2 and part_a_reprendre = 0.5 and part_fiches_corrigees = 1 from pipeline_indicateurs where mode = 'app'), 'indicateurs');
set role authenticated;
select pg_temp.doit_echouer($$select * from garment_runs$$, 'le client lit le journal');
select pg_temp.doit_echouer($$select * from pipeline_indicateurs$$, 'le client lit les indicateurs');
reset role;
select pg_temp.vrai((select count(*) = 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'garments'), 'Realtime : garments publiée');
