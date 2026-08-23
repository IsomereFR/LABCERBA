#!/usr/bin/env bash
# Crée le projet Supabase en région UE (Frankfurt / eu-central-1),
# applique la migration `analyses_impactees` et affiche les clés d'API.
#
# Prérequis :
#   export SUPABASE_ACCESS_TOKEN=sbp_...      # https://supabase.com/dashboard/account/tokens
#   export SUPABASE_DB_PASSWORD='...'         # mot de passe Postgres à définir
# Optionnel :
#   export SUPABASE_ORG_ID=...                # sinon : 1re organisation du compte
#   export SUPABASE_PROJECT_NAME=labcerba
#
# Usage : ./scripts/setup-supabase.sh

set -euo pipefail

API="https://api.supabase.com/v1"
REGION="eu-central-1"                     # Frankfurt — UE / RGPD
PROJECT_NAME="${SUPABASE_PROJECT_NAME:-labcerba}"
MIGRATION="$(dirname "$0")/../supabase/migrations/20260823090000_analyses_impactees.sql"

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN manquant (https://supabase.com/dashboard/account/tokens)}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD manquant (mot de passe Postgres à définir)}"

api() { # api METHOD PATH [BODY]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -sS -X "$method" "$API$path" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
  fi
}

jqr() { node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    let j;try{j=JSON.parse(s)}catch(e){console.error("Réponse non-JSON:",s);process.exit(1)}
    if(j&&j.message&&!Array.isArray(j)){console.error("Erreur API:",j.message);process.exit(1)}
    const f=new Function("d","return "+process.argv[1]);
    const r=f(j);console.log(typeof r==="string"?r:JSON.stringify(r));
  })' "$1"; }

# --- 1. Organisation -----------------------------------------------------
ORG_ID="${SUPABASE_ORG_ID:-}"
if [ -z "$ORG_ID" ]; then
  ORG_ID="$(api GET /organizations | jqr 'd[0].id')"
  echo "→ Organisation : $ORG_ID"
fi

# --- 2. Création du projet en région UE -----------------------------------
echo "→ Création du projet « $PROJECT_NAME » en $REGION (Frankfurt, UE)…"
BODY=$(node -e 'console.log(JSON.stringify({
  name: process.argv[1], organization_id: process.argv[2],
  region: process.argv[3], db_pass: process.argv[4]
}))' "$PROJECT_NAME" "$ORG_ID" "$REGION" "$SUPABASE_DB_PASSWORD")
REF="$(api POST /projects "$BODY" | jqr 'd.id')"
echo "→ Project ref : $REF"

# --- 3. Attente de la disponibilité --------------------------------------
echo -n "→ Provisionnement"
for _ in $(seq 1 60); do
  STATUS="$(api GET "/projects/$REF" | jqr 'd.status')"
  [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
  echo -n "."
  sleep 10
done
echo " [$STATUS]"
[ "$STATUS" = "ACTIVE_HEALTHY" ] || { echo "Projet non prêt, réessaie l'étape SQL plus tard."; exit 1; }

# --- 4. Migration SQL ------------------------------------------------------
echo "→ Application de la migration…"
SQL_BODY="$(node -e '
  const fs=require("fs");
  console.log(JSON.stringify({query: fs.readFileSync(process.argv[1],"utf8")}))' "$MIGRATION")"
api POST "/projects/$REF/database/query" "$SQL_BODY" >/dev/null
echo "  table public.analyses_impactees + RLS + realtime : OK"

# --- 5. Clés d'API ---------------------------------------------------------
echo "→ Récupération des clés…"
KEYS="$(api GET "/projects/$REF/api-keys?reveal=true")"
ANON="$(echo "$KEYS" | jqr 'd.find(k=>k.name==="anon"||k.name==="publishable").api_key')"
SERVICE="$(echo "$KEYS" | jqr 'd.find(k=>k.name==="service_role"||k.name==="secret").api_key')"

cat <<OUT

────────────────────────────────────────────────────────────
  Project URL   : https://$REF.supabase.co
  Région        : $REGION (Frankfurt — UE)
  anon key      : $ANON
  service_role  : $SERVICE   ← SECRET, jamais côté navigateur
────────────────────────────────────────────────────────────

À reporter dans .env (voir .env.example) :

NEXT_PUBLIC_SUPABASE_URL=https://$REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
OUT
