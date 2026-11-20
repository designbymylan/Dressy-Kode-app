insert into storage.objects (bucket_id, name, created_at) values
 ('garments', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-1111-4000-8000-000000000001/original.jpg', now() - interval '3 days'),
 ('garments', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-9999-4000-8000-000000000001/cutout.webp', now() - interval '3 days'),
 ('garments', 'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-8888-4000-8000-000000000001/original.jpg', now() - interval '1 hour'),
 ('garments', 'aaaaaaaa-0000-4000-8000-000000000001/job-ancien.png', now() - interval '90 days'),
 ('garments', 'bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-1111-4000-8000-000000000002/original.jpg', now() - interval '60 days');
update garments set status = 'archived', updated_at = now() - interval '40 days' where id = 'bbbbbbbb-1111-4000-8000-000000000002';
alter table garments disable trigger garments_touch;
update garments set updated_at = now() - interval '40 days' where id = 'bbbbbbbb-1111-4000-8000-000000000002';
select pg_temp.vrai((select array_agg(path order by path) from public.expired_files(500) where bucket = 'garments') = array[
  'aaaaaaaa-0000-4000-8000-000000000001/aaaaaaaa-9999-4000-8000-000000000001/cutout.webp',
  'bbbbbbbb-0000-4000-8000-000000000002/bbbbbbbb-1111-4000-8000-000000000002/original.jpg'
], 'ménage : pièce supprimée et original d''une pièce retirée depuis 30 jours ; ni pièce vivante, ni envoi en cours, ni ancien agent, ni détourage d''une pièce retirée');
