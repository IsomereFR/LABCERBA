-- Traçabilité des incidents (ISO 15189:2022 §6.8.2)
--
-- Jusqu'ici, « Retour à la normale » effaçait la ligne : l'incident clos ne
-- laissait aucune trace, alors que le laboratoire doit pouvoir prouver qu'il a
-- informé ses clients, quand, et pendant combien de temps.
--
-- Désormais la résolution est un horodatage, pas une suppression :
--   resolu_le is null  -> alerte active, visible en consultation
--   resolu_le non null -> incident clos, conservé dans l'historique
-- La suppression définitive reste possible, mais pour le seul cas d'une saisie
-- erronée.

alter table public.analyses_impactees
  add column if not exists resolu_le timestamptz;

-- Auteur de la publication, quand il est connu. Le portillon actuel utilise un
-- mot de passe partagé : la colonne reste vide tant que des comptes nommés ne
-- sont pas en place, mais l'historique est prêt à les accueillir.
alter table public.analyses_impactees
  add column if not exists publie_par text default '';

-- La consultation ne lit que les alertes actives : un index partiel suffit.
create index if not exists analyses_impactees_actives_idx
  on public.analyses_impactees (signale_le desc)
  where resolu_le is null;

comment on column public.analyses_impactees.resolu_le is
  'Horodatage du retour à la normale. NULL = alerte active.';

notify pgrst, 'reload schema';
