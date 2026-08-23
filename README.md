# LABCERBA — Suivi de production · maquette de proposition

Publication en temps réel des analyses spécialisées impactées (indisponibilité,
anomalie, retard) chez un laboratoire sous-traitant, à destination de ses
laboratoires clients. Voir le PRD pour le contexte (ISO 15189:2022 §6.8.2).

> **Maquette de proposition** · document de travail non officiel · ne reflète
> pas l'état réel de la production Cerba. Proposition non sollicitée : Cerba
> n'est engagé par aucun élément de ce dépôt.

## Les deux URL

| Page | URL | Rôle |
|---|---|---|
| **Consultation** | `/` | Lecture seule, temps réel. Phase proposition : protégée par `DEMO_PASSWORD`. |
| **Administration** | `/admin` | Ajout / modification / suppression, protégée par `ADMIN_PASSWORD` (vérifié côté serveur à chaque écriture). |

L'administration s'appuie sur le **catalogue complet des analyses**
(`lib/catalogue-analyses.ts`, fichier généré depuis l'export CSV
`catalogue_exams_fr` du 23/08/2026 — 2 755 lignes ramenées à 2 222 libellés
uniques « Titre · Sous-titre », avec le délai de rendu habituel issu de la
colonne « Délai moyen ») : sélection par liste alphabétique avec index
A–Z et recherche insensible aux accents, saisie libre possible pour une
analyse hors catalogue. La consultation dispose du même moteur de recherche :
lorsqu'une analyse recherchée n'est pas impactée, la page le dit explicitement
plutôt que d'afficher une liste vide. Le délai se saisit soit comme **date de retour à la
normale** (calendrier), soit comme **délai approximatif** (suggestions
contextualisées au statut), avec commentaire libre et aperçu en direct du
rendu exact en consultation.

En production, diffuser l'**alias stable** Vercel (ex.
`https://<projet>.vercel.app/` et `https://<projet>.vercel.app/admin`), jamais
l'URL de build propre à un déploiement.

## Pile

- **Next.js App Router** (TypeScript) sur Vercel, fonctions en région UE (`fra1`, cf. `vercel.json`).
- **Supabase** (Postgres + Realtime + RLS), région UE (Francfort).
- Aucune dépendance CDN au runtime : pile de polices système (les familles
  réelles de Cerba n'ont pas été extraites, voir `designtokens.md` du dossier
  de conception).

## Lancement local

```bash
npm install
cp .env.local.example .env.local   # puis compléter les valeurs
npm run dev                        # http://localhost:3000
```

Base de données : appliquer `supabase/migrations/20260823090000_analyses_impactees.sql`
(SQL Editor ou `psql`), puis, pour la démonstration,
`supabase/seed.sql` — **données entièrement fictives et signalées comme telles**.

## Variables d'environnement

Toutes listées dans [`.env.local.example`](.env.local.example) :

| Variable | Portée | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + serveur | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + serveur | clé publishable, protégée par RLS (SELECT seul) |
| `SUPABASE_SERVICE_ROLE_KEY` | **serveur uniquement** | écritures via `/api/entrees` — jamais `NEXT_PUBLIC_`, jamais commitée |
| `ADMIN_PASSWORD` | serveur | mot de passe de `/admin`, revérifié à chaque écriture (401 sinon) |
| `DEMO_PASSWORD` | serveur | verrou de la consultation, phase proposition — **supprimer la variable pour rendre la page publique** (`lib/demo-lock.ts`) |

## Déploiement Vercel

1. Importer le dépôt dans Vercel (framework détecté : Next.js).
2. Renseigner les cinq variables ci-dessus (Project Settings → Environment
   Variables). `vercel.json` fixe déjà la région `fra1`.
3. Déployer. Vérifier ensuite :
   - `/` demande le mot de passe de démonstration, puis affiche la liste ;
   - une publication depuis `/admin` apparaît en consultation en < 2 s sans rechargement ;
   - l'en-tête `X-Robots-Tag: noindex, nofollow` est présent.

## Architecture de sécurité

- Le navigateur n'utilise que la clé anon (`NEXT_PUBLIC_*`) ; la RLS n'autorise
  que le SELECT → aucune écriture possible côté client.
- Toute écriture passe par `app/api/entrees/route.ts` (POST / PATCH / DELETE)
  avec la clé service role, côté serveur uniquement.
- L'écran de mot de passe de `/admin` n'est qu'un portillon : la protection
  réelle est la revérification d'`ADMIN_PASSWORD` par la route serveur à
  chaque requête.
- Le verrou de démonstration de la consultation est isolé dans
  `lib/demo-lock.ts` : cookie httpOnly posé par `/api/acces` après
  vérification serveur.

## Garde-fous obligatoires (PRD §5.1)

Non négociables tant que Cerba n'a pas validé le projet :

- **Bandeau permanent** en tête de toutes les pages : « Maquette de
  proposition · document de travail non officiel · ne reflète pas l'état réel
  de la production Cerba » (`app/layout.tsx`, non masquable).
- **Données de démonstration fictives** et explicitement signalées comme
  telles (`supabase/seed.sql`).
- **`noindex, nofollow`** sur toutes les pages (metadata + en-tête HTTP
  `X-Robots-Tag`, `next.config.mjs`).
- **Consultation également protégée** par mot de passe (`DEMO_PASSWORD`) tant
  que le projet n'est pas validé : aucune page publique aux couleurs de Cerba.
- **Aucune diffusion de l'URL** hors du cercle de la proposition.
- **Retrait immédiat** sur simple demande de Cerba.

## Branding — état des sources

Les valeurs visuelles proviennent du fichier de tokens (`designtokens.md` du
dossier de conception) : **aucune n'a pu être extraite du site Cerba**, ce sont
les valeurs de repli du brief, signalées comme telles en commentaire dans
`app/globals.css`. Le logo officiel a été fourni par le client et est intégré
tel quel (`public/logo-cerba.png`, affiché par `app/components/LogoSlot.tsx`) :
il n'est ni redessiné, ni recoloré, ni recomposé. Le motif « coup de pinceau »
n'est toujours pas inventé (emplacement commenté). Les couleurs des trois statuts sont des
couleurs **fonctionnelles provisoires hors charte**, toujours accompagnées
d'un libellé texte (accessibilité daltonisme). Le motif identitaire des titres
(un unique fragment en gras) est appliqué via `app/components/CerbaTitle.tsx`.

## Modèle de données

`public.analyses_impactees` — voir
[`supabase/migrations/20260823090000_analyses_impactees.sql`](supabase/migrations/20260823090000_analyses_impactees.sql).

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `analyse` | text | obligatoire — **à écrire `"analyse"` en SQL** : mot réservé PostgreSQL (orthographe britannique d'`ANALYZE`). Sans guillemets, `syntax error at or near "analyse"`. Le nom stocké reste `analyse`, et PostgREST/supabase-js l'échappe seul : aucun code applicatif n'est concerné. |
| `statut` | text | `indisponible` \| `anomalie` \| `retard` (CHECK) |
| `delai` | text | optionnel, `''` par défaut |
| `commentaire` | text | optionnel, `''` par défaut |
| `signale_le` | timestamptz | `now()` à la création |
| `maj_le` | timestamptz | positionné par la route serveur à chaque modification |
| `resolu_le` | timestamptz | `NULL` = alerte active ; horodaté au retour à la normale |
| `publie_par` | text | auteur, vide tant que les comptes nommés n'existent pas |

### Traçabilité des incidents

« Retour à la normale » **n'efface pas** l'entrée : il horodate `resolu_le`.
L'alerte sort de la consultation et rejoint l'onglet *Historique* de `/admin`,
avec sa durée — le laboratoire peut ainsi prouver qu'il a informé ses clients,
quand et pendant combien de temps (ISO 15189:2022 §6.8.2). La suppression
définitive reste disponible, mais pour les seules saisies erronées. Un incident
clos peut être rouvert depuis l'historique.

Migration correspondante :
[`20260823140000_tracabilite_resolution.sql`](supabase/migrations/20260823140000_tracabilite_resolution.sql)
— additive et idempotente, elle n'altère aucune donnée existante.

**RLS activée**, seule policy : `lecture_publique` (SELECT). **Realtime** : la
table est dans la publication `supabase_realtime` avec `replica identity full`.

Création du projet Supabase (région **Frankfurt / `eu-central-1`**, non
modifiable après création) : `./scripts/setup-supabase.sh` ou dashboard — voir
les commentaires du script.
