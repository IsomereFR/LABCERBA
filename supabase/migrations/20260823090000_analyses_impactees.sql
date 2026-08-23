-- Table des analyses impactées (indisponibilité / anomalie / retard)
-- Projet Supabase : région UE — Frankfurt (eu-central-1)

-- « analyse » est un MOT RÉSERVÉ PostgreSQL (orthographe britannique
-- d'ANALYZE, catégorie « reserved » de pg_get_keywords). Sans guillemets,
-- la création de la table échoue avec « syntax error at or near "analyse" ».
-- Les guillemets ne changent pas le nom stocké : la colonne s'appelle bien
-- analyse en minuscules, et PostgREST (supabase-js) l'échappe de lui-même.
create table if not exists public.analyses_impactees (
  id uuid primary key default gen_random_uuid(),
  "analyse" text not null,
  statut text not null check (statut in ('indisponible','anomalie','retard')),
  delai text default '',
  commentaire text default '',
  signale_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

-- RLS : lecture publique, écriture réservée au service_role (qui contourne RLS)
alter table public.analyses_impactees enable row level security;

drop policy if exists "lecture_publique" on public.analyses_impactees;
create policy "lecture_publique"
  on public.analyses_impactees
  for select
  using (true);

-- Payload complet (valeurs avant/après) pour les UPDATE/DELETE en realtime
alter table public.analyses_impactees replica identity full;

-- Realtime : diffusion des INSERT/UPDATE/DELETE aux clients abonnés.
-- Placé en dernier et tolérant à l'échec : la publication supabase_realtime
-- n'existe que sur Supabase, et l'éditeur SQL exécute tout dans une seule
-- transaction — sans ce filet, son absence annulerait la création de la table.
do $$
begin
  alter publication supabase_realtime add table public.analyses_impactees;
exception
  when duplicate_object then null;  -- table déjà publiée
  when undefined_object then null;  -- publication absente (Postgres non Supabase)
end
$$;

-- Rafraîchit le cache de schéma de PostgREST, sinon la table reste invisible
-- de l'API pendant quelques secondes (« Could not find the table ... »).
notify pgrst, 'reload schema';
