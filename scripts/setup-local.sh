#!/usr/bin/env bash
# scripts/setup-local.sh
#
# Fully autonomous local dev environment setup.
# Requires: Docker Desktop running, pnpm, npx (supabase CLI via npx).
#
# Usage:
#   bash scripts/setup-local.sh
#
# Re-running is safe: supabase start is skipped when already up,
# db reset wipes and recreates the DB, and .env.local files are overwritten.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Installing dependencies"
pnpm install

echo ""
echo "==> Starting local Supabase stack (Docker required)"
if npx supabase status &>/dev/null; then
  echo "    Already running — skipping supabase start"
else
  npx supabase start
fi

echo ""
echo "==> Applying migrations (db reset)"
# Pass 'y' on stdin in case the CLI asks for confirmation
echo "y" | npx supabase db reset

echo ""
echo "==> Reading local Supabase credentials"
STATUS=$(npx supabase status 2>/dev/null)

ANON_KEY=$(echo "$STATUS" | grep "anon key" | grep -oE 'eyJ[A-Za-z0-9._-]+')
SERVICE_KEY=$(echo "$STATUS" | grep "service_role key" | grep -oE 'eyJ[A-Za-z0-9._-]+')

if [[ -z "$ANON_KEY" || -z "$SERVICE_KEY" ]]; then
  echo "ERROR: Could not extract keys from 'supabase status'. Output was:"
  echo "$STATUS"
  exit 1
fi

echo "    anon key:         ${ANON_KEY:0:20}..."
echo "    service_role key: ${SERVICE_KEY:0:20}..."

echo ""
echo "==> Writing packages/server/.env.local"
cat > packages/server/.env.local <<EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
SUPABASE_SECRET_KEY=${SERVICE_KEY}
CONNECTOR_SERVICE_TOKEN=dev-service-token
EOF

echo "==> Writing apps/web/.env.local"
cat > apps/web/.env.local <<EOF
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SERVER_URL=
EOF

echo ""
echo "==> Building engine"
pnpm --filter engine build

echo ""
echo "========================================="
echo "  Local environment ready!"
echo "========================================="
echo ""
echo "  Supabase Studio:  http://localhost:54323"
echo ""
echo "  Start the API server (terminal 1):"
echo "    pnpm --filter @deck-monsters/server dev"
echo ""
echo "  Start the web app (terminal 2):"
echo "    pnpm --filter @deck-monsters/web dev"
echo "    → http://localhost:5173"
echo ""
echo "  To stop Supabase later:"
echo "    npx supabase stop"
echo ""
echo "  To re-apply migrations after pulling new ones:"
echo "    npx supabase db reset"
echo "========================================="
