#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# MarketGen AI — Firebase Setup Script
#
# Usage:
#   ./scripts/setup-firebase.sh                    # Full setup (first time)
#   ./scripts/setup-firebase.sh deploy             # Deploy functions + rules only
#   ./scripts/setup-firebase.sh cors               # Update CORS config only
#   ./scripts/setup-firebase.sh secret <KEY>       # Set Gemini API key
#   ./scripts/setup-firebase.sh rules              # Deploy security rules only
#   ./scripts/setup-firebase.sh functions          # Deploy Cloud Functions only
#   ./scripts/setup-firebase.sh auth               # Login to Firebase + gcloud
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── Read project ID from .env.local ─────────────────────────────────────────

get_project_id() {
  if [[ -f .env.local ]]; then
    local bucket
    bucket=$(grep VITE_FIREBASE_STORAGE_BUCKET .env.local | cut -d= -f2 | tr -d ' "'"'"'')
    echo "${bucket%%.*}"
  else
    err ".env.local not found. Copy .env.local.example and fill in your Firebase config."
    exit 1
  fi
}

PROJECT_ID=$(get_project_id)
BUCKET=$(grep VITE_FIREBASE_STORAGE_BUCKET .env.local | cut -d= -f2 | tr -d ' "'"'"'')
FIREBASE="npx firebase-tools"

info "Project ID: $PROJECT_ID"
info "Storage bucket: $BUCKET"

# ─── Step 1: Check prerequisites ─────────────────────────────────────────────

check_prerequisites() {
  info "Checking prerequisites..."

  if ! command -v node &>/dev/null; then
    err "Node.js is not installed. Install it from https://nodejs.org"
    exit 1
  fi
  ok "Node.js $(node -v)"

  if ! command -v npm &>/dev/null; then
    err "npm is not installed."
    exit 1
  fi
  ok "npm $(npm -v)"

  if ! command -v gsutil &>/dev/null; then
    warn "gsutil not found. Installing Google Cloud SDK..."
    if command -v brew &>/dev/null; then
      brew install --cask google-cloud-sdk
    else
      err "Install Google Cloud SDK manually: https://cloud.google.com/sdk/docs/install"
      exit 1
    fi
  fi
  ok "gsutil available"
  ok "Firebase CLI (via npx firebase-tools)"
}

# ─── Step 2: Authenticate ────────────────────────────────────────────────────

check_firebase_auth() {
  if $FIREBASE projects:list 2>/dev/null | grep -q "$PROJECT_ID"; then
    ok "Firebase authenticated"
    return 0
  fi
  return 1
}

check_gcloud_auth() {
  if gcloud config get project 2>/dev/null | grep -q "$PROJECT_ID"; then
    ok "gcloud authenticated (project: $PROJECT_ID)"
    return 0
  fi
  return 1
}

ensure_auth() {
  local need_login=false

  info "Checking Firebase authentication..."
  if ! check_firebase_auth; then
    need_login=true
  fi

  info "Checking gcloud authentication..."
  if ! check_gcloud_auth; then
    # Try setting the project silently
    gcloud config set project "$PROJECT_ID" 2>/dev/null || true
    if ! check_gcloud_auth; then
      need_login=true
    fi
  fi

  if [[ "$need_login" == "true" ]]; then
    err "Authentication required. Run these commands first, then re-run this script:"
    echo ""
    echo "    npx firebase-tools login"
    echo "    gcloud auth login"
    echo "    gcloud config set project $PROJECT_ID"
    echo ""
    echo "  Then re-run:  npm run setup"
    exit 1
  fi
}

do_login() {
  info "Logging in to Firebase..."
  $FIREBASE login
  info "Logging in to gcloud..."
  gcloud auth login
  gcloud config set project "$PROJECT_ID"
  ok "Authenticated"
}

# ─── Step 3: Install dependencies ────────────────────────────────────────────

install_deps() {
  info "Installing root dependencies..."
  npm install

  info "Installing Cloud Functions dependencies..."
  (cd functions && npm install)

  ok "All dependencies installed"
}

# ─── Step 4: Set Gemini API key ──────────────────────────────────────────────

set_secret() {
  local api_key="${1:-}"

  if [[ -z "$api_key" ]]; then
    # Try reading from .env.local (legacy key, may still be there)
    api_key=$(grep -E '^GEMINI_API_KEY=' .env.local 2>/dev/null | cut -d= -f2 | tr -d ' "'"'"'' || true)
  fi

  if [[ -z "$api_key" ]]; then
    err "Gemini API key required."
    echo ""
    echo "  Usage:  npm run deploy:secret -- <YOUR_GEMINI_API_KEY>"
    echo "  Get one at: https://aistudio.google.com/apikey"
    exit 1
  fi

  info "Setting GEMINI_API_KEY secret for Cloud Functions..."
  echo "$api_key" | $FIREBASE functions:secrets:set GEMINI_API_KEY --project "$PROJECT_ID" --data-file -
  ok "Secret set"
}

# ─── Step 5: Configure CORS ─────────────────────────────────────────────────

setup_cors() {
  info "Applying CORS config to Storage bucket gs://$BUCKET ..."

  if ! gsutil cors set cors.json "gs://$BUCKET"; then
    err "Failed to set CORS. Make sure:"
    err "  1. You're on the Blaze plan (Firebase Console → Upgrade)"
    err "  2. Storage has been initialized (Firebase Console → Storage → Get started)"
    err "  3. The bucket name '$BUCKET' is correct"
    exit 1
  fi

  ok "CORS configured"
}

# ─── Step 6: Deploy security rules ──────────────────────────────────────────

deploy_rules() {
  info "Deploying Firestore and Storage security rules..."
  $FIREBASE deploy --only firestore:rules,storage --project "$PROJECT_ID"
  ok "Security rules deployed"
}

# ─── Step 7: Deploy Cloud Functions ──────────────────────────────────────────

deploy_functions() {
  info "Building Cloud Functions..."
  (cd functions && npm run build)

  info "Deploying Cloud Functions..."
  $FIREBASE deploy --only functions --project "$PROJECT_ID"
  ok "Cloud Functions deployed"
}

# ─── Step 8: Verify ─────────────────────────────────────────────────────────

verify() {
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Setup complete!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo "  Deployed to project: $PROJECT_ID"
  echo "  Storage bucket:      gs://$BUCKET"
  echo ""
  echo "  Next steps:"
  echo "    1. Enable Auth providers in Firebase Console:"
  echo "       → Authentication → Sign-in method → Enable Email/Password + Google"
  echo "    2. Run the dev server:"
  echo "       npm run dev"
  echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────

COMMAND="${1:-full}"
shift || true

case "$COMMAND" in
  full)
    check_prerequisites
    ensure_auth
    install_deps
    set_secret "$@"
    setup_cors
    deploy_rules
    deploy_functions
    verify
    ;;
  deploy)
    deploy_rules
    deploy_functions
    ;;
  cors)
    setup_cors
    ;;
  secret)
    set_secret "$@"
    ;;
  rules)
    deploy_rules
    ;;
  functions)
    deploy_functions
    ;;
  auth)
    do_login
    ;;
  *)
    echo "Usage: $0 {full|deploy|cors|secret|rules|functions|auth}"
    echo ""
    echo "  full               Full setup (default, run this first time)"
    echo "  deploy             Deploy functions + rules"
    echo "  cors               Update CORS config only"
    echo "  secret <API_KEY>   Set Gemini API key"
    echo "  rules              Deploy security rules only"
    echo "  functions          Deploy Cloud Functions only"
    echo "  auth               Login to Firebase + gcloud (interactive)"
    exit 1
    ;;
esac
