-- Fiche technique d'une pièce (27/10) : ce que la personne renseigne depuis la
-- fiche de la pièce (composition, motif, manches, longueur, particularités,
-- entretien, pays de fabrication, lieu et date d'achat, état, occasions).
-- Un seul objet JSON, nettoyé et borné par l'app ; la base ne garde que sa
-- forme et sa taille. Marque, taille, coupe, matière, saison et prix restent
-- dans leurs colonnes.

alter table public.garments
  add column fiche jsonb check (fiche is null or (jsonb_typeof(fiche) = 'object' and pg_column_size(fiche) <= 2000));
