# LABCERBA — base Supabase (UE)

Suivi des analyses impactées (indisponibilité, anomalie, retard), avec lecture
publique et diffusion temps réel.

Les données de santé impliquent un hébergement dans l'Union européenne : le
projet doit être créé en région **Frankfurt / `eu-central-1`**. La région d'un
projet Supabase ne peut pas être modifiée après création — en cas d'erreur, il
faut recréer le projet.

## 1. Créer le projet

### Option A — script automatisé

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...        # dashboard > Account > Access Tokens
export SUPABASE_DB_PASSWORD='mot-de-passe-postgres'
./scripts/setup-supabase.sh
```

Le script crée le projet en `eu-central-1`, applique la migration et affiche
Project URL, `anon` key et `service_role` key.

### Option B — dashboard

1. https://supabase.com/dashboard → **New project**
2. Region : **Central EU (Frankfurt)** — `eu-central-1`
3. Définir le mot de passe Postgres, créer le projet.

## 2. Appliquer le schéma

SQL Editor → coller le contenu de
[`supabase/migrations/20260823090000_analyses_impactees.sql`](supabase/migrations/20260823090000_analyses_impactees.sql) → **Run**.

Ou en ligne de commande :

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260823090000_analyses_impactees.sql
```

Le script est idempotent (`if not exists`, `drop policy if exists`) : il peut
être rejoué sans erreur.

## 3. Récupérer les clés

**Project Settings > API** :

| Élément | Où l'utiliser |
|---|---|
| Project URL | client et serveur |
| `anon` (publishable) | navigateur — protégée par RLS |
| `service_role` (secret) | serveur uniquement — **contourne RLS** |

Reporter dans un `.env` local, sur le modèle de [`.env.example`](.env.example).
`.env` est ignoré par git ; la clé `service_role` ne doit jamais être commitée
ni envoyée au navigateur.

## Modèle de données

`public.analyses_impactees`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `analyse` | text | libellé de l'analyse, obligatoire |
| `statut` | text | `indisponible` \| `anomalie` \| `retard` (CHECK) |
| `delai` | text | délai annoncé, `''` par défaut |
| `commentaire` | text | `''` par défaut |
| `signale_le` | timestamptz | `now()` |
| `maj_le` | timestamptz | `now()` |

**RLS activée.** Seule la policy `lecture_publique` existe : `SELECT` autorisé
pour tous, aucune écriture possible avec la clé `anon`. Les insertions et mises
à jour passent par la clé `service_role` (qui contourne RLS) depuis un contexte
serveur.

**Realtime** : la table est ajoutée à la publication `supabase_realtime`, avec
`replica identity full` pour que les `UPDATE`/`DELETE` transportent les valeurs
complètes.

```js
supabase
  .channel('analyses')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'analyses_impactees' },
      payload => console.log(payload))
  .subscribe()
```

`maj_le` n'est pas mis à jour automatiquement : il faut le positionner à chaque
écriture, ou ajouter un trigger `before update`.
