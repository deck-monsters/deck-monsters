#!/usr/bin/env bash
# scripts/setup-local.sh
#
# Bootstrap a full local Deck Monsters environment:
# - install dependencies
# - ensure a container runtime is available (Docker first, Podman fallback)
# - start/reset local Supabase
# - write .env.local files
# - build engine
# - optionally seed a local auth user for quick sign-in testing
#
# Usage:
#   bash scripts/setup-local.sh
#   bash scripts/setup-local.sh --runtime docker
#   bash scripts/setup-local.sh --runtime podman
#   bash scripts/setup-local.sh --skip-seed-user
#   bash scripts/setup-local.sh --dry-run

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RUNTIME_MODE="auto"
SKIP_INSTALL=0
SKIP_SEED_USER=0
DRY_RUN=0
SEED_USER_EMAIL="${LOCAL_TEST_USER_EMAIL:-localtester@example.com}"
SEED_USER_PASSWORD="${LOCAL_TEST_USER_PASSWORD:-deck-monsters-local}"
CONTAINER_RUNTIME=""
NEEDS_PODMAN_DOCKER_HOST=0

print_help() {
  cat <<'EOF'
Deck Monsters local setup bootstrap

Options:
  --runtime <auto|docker|podman>   Select preferred runtime (default: auto)
  --skip-install                   Skip installing missing system runtime dependencies
  --skip-seed-user                 Skip creating/upserting local auth test user
  --seed-user-email <email>        Test user email (default: localtester@example.com)
  --seed-user-password <password>  Test user password (default: deck-monsters-local)
  --dry-run                        Print commands without executing
  -h, --help                       Show this help
EOF
}

log() {
  printf '==> %s\n' "$1"
}

warn() {
  printf 'WARNING: %s\n' "$1" >&2
}

die() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run() {
  if ((DRY_RUN)); then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi
  "$@"
}

run_pipe_yes() {
  if ((DRY_RUN)); then
    printf '[dry-run] echo "y" | %s\n' "$*"
    return 0
  fi
  echo "y" | "$@"
}

ensure_sudo_available() {
  if [[ "${EUID}" -eq 0 ]]; then
    return 0
  fi
  has_cmd sudo || die "This step needs root privileges. Re-run with sudo or install runtime manually."
}

apt_install() {
  ensure_sudo_available
  if [[ "${EUID}" -eq 0 ]]; then
    run apt-get update
    run apt-get install -y "$@"
  else
    run sudo apt-get update
    run sudo apt-get install -y "$@"
  fi
}

dnf_install() {
  ensure_sudo_available
  if [[ "${EUID}" -eq 0 ]]; then
    run dnf install -y "$@"
  else
    run sudo dnf install -y "$@"
  fi
}

brew_install() {
  has_cmd brew || die "Homebrew is required for this install path."
  run brew install "$@"
}

install_runtime_dependencies() {
  case "$1" in
    docker)
      log "Installing Docker runtime prerequisites"
      if has_cmd apt-get; then
        apt_install docker.io docker-compose-plugin
      elif has_cmd dnf; then
        dnf_install docker docker-compose-plugin
      elif has_cmd brew; then
        if [[ "$(uname -s)" == "Darwin" ]]; then
          run brew install --cask docker
        else
          brew_install docker docker-compose
        fi
      else
        die "Unable to auto-install Docker on this OS. Install Docker Desktop/Engine manually, then re-run."
      fi
      ;;
    podman)
      log "Installing Podman runtime prerequisites"
      if has_cmd apt-get; then
        apt_install podman podman-docker slirp4netns uidmap
      elif has_cmd dnf; then
        dnf_install podman podman-docker
      elif has_cmd brew; then
        brew_install podman
      else
        die "Unable to auto-install Podman on this OS. Install Podman manually, then re-run."
      fi
      ;;
    *)
      die "Unknown runtime '$1'"
      ;;
  esac
}

try_start_docker_daemon() {
  if has_cmd systemctl; then
    if [[ "${EUID}" -eq 0 ]]; then
      run systemctl enable --now docker || true
    elif has_cmd sudo; then
      run sudo systemctl enable --now docker || true
    fi
  elif has_cmd service; then
    if [[ "${EUID}" -eq 0 ]]; then
      run service docker start || true
    elif has_cmd sudo; then
      run sudo service docker start || true
    fi
  fi
}

docker_ready() {
  has_cmd docker && docker info >/dev/null 2>&1
}

ensure_docker_runtime() {
  if docker_ready; then
    CONTAINER_RUNTIME="docker"
    return 0
  fi

  if has_cmd docker; then
    log "Docker CLI found but daemon unavailable; attempting to start daemon"
    try_start_docker_daemon
  elif ((SKIP_INSTALL)); then
    return 1
  else
    install_runtime_dependencies docker
    try_start_docker_daemon
  fi

  if ((DRY_RUN)); then
    warn "Dry-run: assuming Docker would be available after install/start steps."
    CONTAINER_RUNTIME="docker"
    return 0
  fi

  if docker_ready; then
    CONTAINER_RUNTIME="docker"
    return 0
  fi
  return 1
}

ensure_podman_service() {
  if ((DRY_RUN)); then
    if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
      export XDG_RUNTIME_DIR="/run/user/$(id -u)"
    fi
    local podman_socket="${XDG_RUNTIME_DIR}/podman/podman.sock"
    export DOCKER_HOST="unix://${podman_socket}"
    NEEDS_PODMAN_DOCKER_HOST=1
    printf '[dry-run] would start podman socket: %s\n' "${DOCKER_HOST}"
    return 0
  fi

  has_cmd podman || return 1
  podman info >/dev/null 2>&1 || return 1

  if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
    export XDG_RUNTIME_DIR="/run/user/$(id -u)"
  fi
  local podman_socket="${XDG_RUNTIME_DIR}/podman/podman.sock"

  if [[ ! -S "$podman_socket" ]]; then
    mkdir -p "$(dirname "$podman_socket")"
    if ((DRY_RUN)); then
      printf '[dry-run] nohup podman system service --time=0 "unix://%s" >/tmp/podman-system-service.log 2>&1 &\n' "$podman_socket"
    else
      nohup podman system service --time=0 "unix://${podman_socket}" >/tmp/podman-system-service.log 2>&1 &
      sleep 1
    fi
  fi

  export DOCKER_HOST="unix://${podman_socket}"
  NEEDS_PODMAN_DOCKER_HOST=1
  return 0
}

ensure_podman_runtime() {
  if has_cmd docker && docker info >/dev/null 2>&1; then
    CONTAINER_RUNTIME="docker"
    return 0
  fi

  if ! has_cmd podman && (( ! SKIP_INSTALL )); then
    install_runtime_dependencies podman
  fi
  if ((DRY_RUN)); then
    ensure_podman_service || return 1
    CONTAINER_RUNTIME="podman"
    return 0
  fi
  has_cmd podman || return 1

  ensure_podman_service || return 1
  if has_cmd docker; then
    if docker info >/dev/null 2>&1; then
      CONTAINER_RUNTIME="podman"
      return 0
    fi
  else
    warn "'docker' CLI not found. Install podman-docker or Docker CLI shim for Supabase compatibility."
    return 1
  fi
  return 1
}

ensure_container_runtime() {
  log "Ensuring a supported container runtime is available"

  case "$RUNTIME_MODE" in
    docker)
      ensure_docker_runtime || die "Docker runtime unavailable. Install/start Docker and retry."
      ;;
    podman)
      ensure_podman_runtime || die "Podman runtime unavailable for Supabase. Install podman-docker or choose --runtime docker."
      ;;
    auto)
      if ensure_docker_runtime; then
        :
      elif ensure_podman_runtime; then
        :
      else
        die "No working container runtime found. Install Docker Desktop/Engine (recommended) or Podman+podman-docker."
      fi
      ;;
    *)
      die "Invalid --runtime value: $RUNTIME_MODE"
      ;;
  esac
}

extract_json_value() {
  local key="$1"
  local json="$2"
  printf '%s\n' "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*":\s*"//;s/"$//'
}

seed_local_user() {
  ((SKIP_SEED_USER)) && return 0

  log "Seeding local auth user (${SEED_USER_EMAIL})"

  local payload
  payload=$(printf '{"email":"%s","password":"%s"}' "$SEED_USER_EMAIL" "$SEED_USER_PASSWORD")

  if ((DRY_RUN)); then
    printf '[dry-run] curl -sS -X POST "http://localhost:54321/auth/v1/signup" ...\n'
    return 0
  fi

  has_cmd curl || die "curl is required to seed local auth users."

  # Auth API needs the JWT anon key (not the publishable key) for apikey header
  local api_key="${ANON_KEY:-$BEST_PUBLISHABLE}"
  local response
  response=$(
    curl -sS -X POST "http://localhost:54321/auth/v1/signup" \
      -H "apikey: ${api_key}" \
      -H "Content-Type: application/json" \
      -d "$payload"
  ) || die "Failed to call local Supabase auth signup endpoint."

  if [[ "$response" == *'"access_token"'* ]]; then
    printf '    Created user: %s\n' "$SEED_USER_EMAIL"
    return 0
  fi

  if [[ "$response" == *'User already registered'* ]]; then
    printf '    User already exists: %s\n' "$SEED_USER_EMAIL"
    return 0
  fi

  warn "Unexpected signup response. You may need to create the test account manually."
  printf '    response: %s\n' "$response"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runtime)
      shift
      [[ $# -gt 0 ]] || die "--runtime requires a value"
      RUNTIME_MODE="$1"
      ;;
    --skip-install)
      SKIP_INSTALL=1
      ;;
    --skip-seed-user)
      SKIP_SEED_USER=1
      ;;
    --seed-user-email)
      shift
      [[ $# -gt 0 ]] || die "--seed-user-email requires a value"
      SEED_USER_EMAIL="$1"
      ;;
    --seed-user-password)
      shift
      [[ $# -gt 0 ]] || die "--seed-user-password requires a value"
      SEED_USER_PASSWORD="$1"
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      die "Unknown option: $1 (run with --help for usage)"
      ;;
  esac
  shift
done

has_cmd pnpm || die "pnpm is required."
has_cmd npx || die "npx is required."

log "Installing dependencies"
run pnpm install

ensure_container_runtime
printf '    runtime: %s\n' "$CONTAINER_RUNTIME"
if ((NEEDS_PODMAN_DOCKER_HOST)); then
  printf '    DOCKER_HOST: %s\n' "${DOCKER_HOST}"
fi

log "Starting local Supabase stack"
if ((DRY_RUN)); then
  printf '[dry-run] npx supabase status\n'
  printf '[dry-run] npx supabase start\n'
else
  if npx supabase status &>/dev/null; then
    printf '    Already running — skipping supabase start\n'
  else
    run npx supabase start
  fi
fi

log "Applying migrations (db reset)"
run_pipe_yes npx supabase db reset

log "Reading local Supabase credentials"
if ((DRY_RUN)); then
  STATUS='{"API_URL":"http://localhost:54321","ANON_KEY":"eyJexample-anon","SERVICE_ROLE_KEY":"eyJexample-service","PUBLISHABLE_KEY":"sb_publishable_example","SECRET_KEY":"sb_secret_example","DB_URL":"postgresql://postgres:postgres@127.0.0.1:54322/postgres"}'
else
  STATUS="$(npx supabase status --output json 2>/dev/null)"
fi

ANON_KEY="$(extract_json_value "ANON_KEY" "$STATUS")"
SERVICE_ROLE_KEY="$(extract_json_value "SERVICE_ROLE_KEY" "$STATUS")"
PUBLISHABLE_KEY="$(extract_json_value "PUBLISHABLE_KEY" "$STATUS")"
SECRET_KEY="$(extract_json_value "SECRET_KEY" "$STATUS")"

# Use publishable key when available, fall back to anon key for older CLI versions
BEST_PUBLISHABLE="${PUBLISHABLE_KEY:-$ANON_KEY}"
BEST_SECRET="${SECRET_KEY:-$SERVICE_ROLE_KEY}"

if [[ -z "${BEST_PUBLISHABLE}" || -z "${SERVICE_ROLE_KEY}" ]]; then
  printf 'Supabase status JSON:\n%s\n' "$STATUS" >&2
  die "Could not extract keys from 'supabase status --output json'."
fi

printf '    publishable key:  %s...\n' "${BEST_PUBLISHABLE:0:30}"
printf '    service_role key: %s...\n' "${SERVICE_ROLE_KEY:0:20}"

log "Writing .env.local files"
if ((DRY_RUN)); then
  printf '[dry-run] write %s\n' ".env.local"
  printf '[dry-run] write %s\n' "packages/server/.env.local"
  printf '[dry-run] write %s\n' "apps/web/.env.local"
  if ((NEEDS_PODMAN_DOCKER_HOST)); then
    printf '[dry-run] write %s\n' ".env.local.runtime"
  fi
else
API_URL="$(extract_json_value "API_URL" "$STATUS")"
DB_URL="$(extract_json_value "DB_URL" "$STATUS")"
API_URL="${API_URL:-http://127.0.0.1:54321}"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

cat > .env.local <<EOF
DATABASE_URL=${DB_URL}
SUPABASE_URL=${API_URL}
SUPABASE_PUBLISHABLE_KEY=${BEST_PUBLISHABLE}
SUPABASE_SECRET_KEY=${BEST_SECRET}
CONNECTOR_SERVICE_TOKEN=dev-service-token
EOF

cat > packages/server/.env.local <<EOF
DATABASE_URL=${DB_URL}
SUPABASE_URL=${API_URL}
SUPABASE_PUBLISHABLE_KEY=${BEST_PUBLISHABLE}
SUPABASE_SECRET_KEY=${BEST_SECRET}
CONNECTOR_SERVICE_TOKEN=dev-service-token
EOF

cat > apps/web/.env.local <<EOF
VITE_SUPABASE_URL=${API_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${BEST_PUBLISHABLE}
VITE_SERVER_URL=
EOF

if ((NEEDS_PODMAN_DOCKER_HOST)); then
  cat > .env.local.runtime <<EOF
# Source this file before running supabase commands when using Podman.
DOCKER_HOST=${DOCKER_HOST}
EOF
fi
fi

seed_local_user

log "Building engine"
run pnpm --filter @deck-monsters/engine build

echo ""
echo "========================================="
echo "  Local environment ready!"
echo "========================================="
echo ""
echo "  Supabase Studio:  http://localhost:54323"
echo "  Test user email:  ${SEED_USER_EMAIL}"
if ((SKIP_SEED_USER)); then
  echo "  Test user status: skipped (--skip-seed-user)"
else
  echo "  Test user password: ${SEED_USER_PASSWORD}"
fi
echo ""
if ((NEEDS_PODMAN_DOCKER_HOST)); then
  echo "  Podman mode detected. Run this before supabase commands in new shells:"
  echo "    source .env.local.runtime"
  echo ""
fi
echo "  Start the API server (terminal 1):"
echo "    pnpm --filter @deck-monsters/server dev"
echo ""
echo "  Start the web app (terminal 2):"
echo "    pnpm --filter @deck-monsters/web dev"
echo "    -> http://localhost:5173"
echo ""
echo "  To stop Supabase later:"
echo "    npx supabase stop"
echo ""
echo "  To re-apply migrations after pulling new ones:"
echo "    npx supabase db reset"
echo "========================================="
