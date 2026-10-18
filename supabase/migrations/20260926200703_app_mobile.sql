-- L'app mobile (mobile/) : ce que son onboarding demande et que le schéma
-- n'avait pas encore. Tout est facultatif — colonnes nullables ou vides par
-- défaut — pour que le site web continue de fonctionner sans rien changer.

-- Tranche d'âge : adapter les conseils, jamais affichée.
alter table public.profiles
  add column age_range text check (age_range in ('15-17', '18-24', '25-34', '35-44', '45+'));

-- Le poids est facultatif et ne sert qu'aux coupes. La silhouette peut venir
-- de l'analyse de deux photos (supprimées après) ou d'un choix.
alter table public.silhouettes
  add column weight_kg smallint check (weight_kg between 30 and 300),
  add column shape_source text check (shape_source in ('photos', 'choix'));

-- Les couleurs à éviter (le champ `avoid` du site porte des coupes et des
-- motifs, pas des couleurs). « mixte » : l'app propose « un peu des deux ».
alter table public.style_profile
  add column avoid_colours text[] not null default '{}';
alter table public.style_profile drop constraint style_profile_gender_check;
alter table public.style_profile add constraint style_profile_gender_check
  check (gender in ('femme', 'homme', 'mixte', 'non_precise'));

-- La ville pour la météo du matin ; l'agenda n'est lu que s'il est relié.
alter table public.settings
  add column city text check (char_length(city) between 1 and 80),
  add column agenda_linked boolean not null default false;

-- L'illustration vectorielle de l'app : la coupe et la teinte. Le site garde
-- son image (image_path) ; l'app dessine la pièce quand il n'y en a pas.
alter table public.garments
  add column kind text check (kind ~ '^[a-z]{2,20}$'),
  add column tint text check (tint ~ '^#[0-9A-Fa-f]{6}$'),
  add column season text check (season in ('toute_annee', 'mi_saison', 'hiver', 'ete'));

-- Les ports par pièce viennent de la vue existante public.garment_stats
-- (wear_count, last_worn_on, cost_per_wear_cents).
