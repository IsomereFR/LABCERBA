-- Table des analyses impactées (indisponibilité / anomalie / retard)
-- Projet Supabase : région UE — Frankfurt (eu-central-1)

create table if not exists public.analyses_impactees (
  id uuid primary key default gen_random_uuid(),
  analyse text not null,
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

-- Realtime : diffusion des INSERT/UPDATE/DELETE aux clients abonnés
do $$
begin
  alter publication supabase_realtime add table public.analyses_impactees;
exception
  when duplicate_object then null;
end
$$;

-- Payload complet (valeurs avant/après) pour les UPDATE/DELETE en realtime
alter table public.analyses_impactees replica identity full;
