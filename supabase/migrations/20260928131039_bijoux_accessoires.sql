-- Bijoux et accessoires : une vraie catégorie pour les bijoux, et un emplacement
-- « bijou » dans les tenues (plusieurs par tenue, comme les accessoires).
insert into public.categories (id, label, sort, shelf)
values ('bijoux', 'Bijoux', 65, true)
on conflict (id) do update set label = excluded.label, sort = excluded.sort, shelf = excluded.shelf;

alter table public.outfit_items drop constraint if exists outfit_items_slot_check;
alter table public.outfit_items add constraint outfit_items_slot_check
  check (slot = any (array['haut','bas','robe','veste','chaussures','sac','accessoire','bijou']));

-- Une tenue garde l'ordre dans lequel ses pièces ont été posées.
alter table public.outfit_items add column if not exists position smallint not null default 0;
