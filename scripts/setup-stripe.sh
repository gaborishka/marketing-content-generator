#!/usr/bin/env bash
#
# Stripe Setup Script for MarketGen AI
# Run this once to create products/prices and configure secrets.
#
# Prerequisites:
#   - Stripe CLI installed (brew install stripe/stripe-cli/stripe)
#   - stripe login (authenticate with your Stripe account)
#   - Firebase CLI authenticated (firebase login)
#
set -euo pipefail

echo "=== MarketGen AI — Stripe Setup ==="
echo ""

# Step 1: Check Stripe CLI
if ! command -v stripe &>/dev/null; then
  echo "ERROR: Stripe CLI not installed. Run: brew install stripe/stripe-cli/stripe"
  exit 1
fi

# Step 2: Create Product and Prices
echo "Creating Stripe product: MarketGen AI Pro..."
PRODUCT_ID=$(stripe products create \
  --name="MarketGen AI Pro" \
  --description="Unlimited AI marketing content generation — 100 generations/day" \
  -d "metadata[app]=marketgen-ai" \
  --format=json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "  Product ID: $PRODUCT_ID"

echo "Creating monthly price ($29/month)..."
MONTHLY_PRICE_ID=$(stripe prices create \
  --product="$PRODUCT_ID" \
  --unit-amount=2900 \
  --currency=usd \
  -d "recurring[interval]=month" \
  --format=json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "  Monthly Price ID: $MONTHLY_PRICE_ID"

echo "Creating yearly price ($290/year)..."
YEARLY_PRICE_ID=$(stripe prices create \
  --product="$PRODUCT_ID" \
  --unit-amount=29000 \
  --currency=usd \
  -d "recurring[interval]=year" \
  --format=json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "  Yearly Price ID: $YEARLY_PRICE_ID"

echo ""
echo "=== IMPORTANT ==="
echo "Update the price IDs in functions/src/index.ts:"
echo "  STRIPE_PRICE_MONTHLY = \"$MONTHLY_PRICE_ID\""
echo "  STRIPE_PRICE_YEARLY  = \"$YEARLY_PRICE_ID\""
echo ""

# Step 3: Set Firebase Secrets
echo "Setting Firebase secrets..."
echo "You will be prompted to enter each secret value."
echo ""
echo "Enter your Stripe Secret Key (sk_test_... or sk_live_...):"
firebase functions:secrets:set STRIPE_SECRET_KEY

echo ""
echo "Enter your Stripe Webhook Secret (whsec_...):"
echo "(Get this from Step 4 below, or from Stripe Dashboard > Webhooks)"
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Update STRIPE_PRICE_MONTHLY and STRIPE_PRICE_YEARLY in functions/src/index.ts"
echo "  2. Start webhook forwarding:"
echo "     stripe listen --forward-to http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1/stripeWebhook"
echo "  3. Copy the webhook signing secret (whsec_...) from the listen output"
echo "  4. Start emulators: firebase emulators:start --only functions,firestore"
