# Shopify Catalog Integration - Setup Guide

This guide walks you through creating a Shopify app and configuring it to work with MarketGen AI for product catalog synchronization.

## Overview

The integration allows you to:
- Connect your Shopify store to MarketGen AI
- Sync your Shopify product catalog into the product library
- Use Shopify products in marketing campaigns
- Re-sync to pick up product changes from Shopify

**Architecture:** The integration uses Shopify's OAuth 2.0 flow with the Admin REST API. Products are synced server-side via Firebase Cloud Functions and stored in Firestore alongside manually created products.

---

## Step 1: Create a Shopify App

1. Go to [Shopify Partners](https://partners.shopify.com/) and log in (or create a free Partners account).

2. Navigate to **Apps** in the left sidebar, then click **Create app**.

3. Choose **Create app manually**.

4. Fill in the app details:
   - **App name**: `MarketGen AI` (or your preferred name)
   - **App URL**: Your deployed app URL (e.g., `https://your-project.web.app`)

5. Click **Create app**.

## Step 2: Configure App URLs

In your new app's settings, go to **App setup** and configure:

### App URL
```
https://your-project.web.app
```

### Allowed redirection URL(s)

Add both of these (one for the server-side callback, one for client-side):

```
https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/shopifyOAuthCallback
https://your-project.web.app/#/products
```

Replace `YOUR_PROJECT_ID` with your Firebase project ID and `us-central1` with your Cloud Functions region if different.

## Step 3: Required API Scopes

The integration needs read-only access to products. In your app's **Configuration** tab, under **API access scopes**, request these scopes:

| Scope | Purpose |
|-------|---------|
| `read_products` | Read product titles, descriptions, variants, pricing |
| `read_product_images` | Read product images for the catalog |
| `read_product_listings` | Read published product listings |

These are read-only scopes. The integration never writes to your Shopify store.

## Step 4: Get API Credentials

1. In the Shopify Partners dashboard, go to your app's **API credentials** page.

2. Note down:
   - **API key** (also called Client ID)
   - **API secret key** (also called Client secret)

You will need these in the next step.

## Step 5: Configure Firebase Secrets

Store the Shopify credentials as Firebase secrets (never commit them to code):

```bash
# Set the Shopify API key
firebase functions:secrets:set SHOPIFY_API_KEY
# Paste your API key when prompted

# Set the Shopify API secret
firebase functions:secrets:set SHOPIFY_API_SECRET
# Paste your API secret key when prompted
```

Verify they are set:
```bash
firebase functions:secrets:access SHOPIFY_API_KEY
firebase functions:secrets:access SHOPIFY_API_SECRET
```

## Step 6: Deploy Cloud Functions

Deploy the updated Cloud Functions that include the Shopify endpoints:

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

This deploys the following new functions:
- `shopifyGetAuthUrl` - Generates the OAuth authorization URL
- `shopifyOAuthCallback` - HTTP endpoint for Shopify's OAuth redirect
- `shopifyExchangeToken` - Client-side OAuth code exchange
- `shopifyGetConnection` - Returns current connection status
- `shopifySyncProducts` - Triggers product sync from Shopify
- `shopifyDisconnect` - Removes the Shopify connection

## Step 7: Update Firestore Security Rules

Add rules for the new `shopifyConnections` and `shopifyOAuthStates` collections. Add these to your `firestore.rules`:

```
match /shopifyConnections/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  // Write is handled by Cloud Functions (admin SDK), no client write needed
  allow write: if false;
}

match /shopifyOAuthStates/{stateId} {
  // Only Cloud Functions should read/write these
  allow read, write: if false;
}
```

Deploy the rules:
```bash
firebase deploy --only firestore:rules
```

## Step 8: Connect Your Store

1. Open MarketGen AI and navigate to **Products** in the sidebar.

2. Click the green **Connect Shopify** button.

3. Enter your Shopify store domain (e.g., `mystore.myshopify.com` or just `mystore`).

4. Click **Connect**. You will be redirected to Shopify.

5. On Shopify, review the permissions and click **Install app**.

6. You will be redirected back to MarketGen AI. The Shopify panel will show "Connected".

7. Click **Sync Products** to import your catalog.

---

## How the Sync Works

### Product Mapping

Shopify products are mapped to the MarketGen product format as follows:

| MarketGen Field | Shopify Source |
|----------------|----------------|
| `name` | `product.title` |
| `sku` | `variant[0].sku` (first variant) |
| `brand` | `product.vendor` |
| `category` | `product.product_type` |
| `description` | `product.body_html` (HTML stripped) |
| `price` | `variant[0].price` (first variant) |
| `imageUrl` | `product.image.src` (featured image) |
| `marketingTags` | `product.tags` (comma-separated → array) |
| `features` | Empty (add manually after sync) |
| `complianceFiles` | Empty (add manually after sync) |

### Sync Behavior

- **New products** in Shopify are created in your catalog (with `source: 'shopify'` tag).
- **Updated products** are refreshed with latest data from Shopify, but user-customized fields (`features`, `complianceFiles`) are preserved.
- **Deleted products** in Shopify are removed from your catalog on next sync.
- **Product IDs** use the format `shopify-{shopify_product_id}` to avoid collisions with manual products.

### After Syncing

Once products are synced, you can:
1. **Edit** any synced product to add features, compliance files, or adjust marketing tags.
2. **Use them in campaigns** — select Shopify products as primary or secondary products.
3. **Re-sync** anytime to pick up changes from Shopify (new products, price changes, etc.)
4. **Delete** individual synced products if you don't want them in your catalog.

---

## Shopify App Distribution

### Development Store

For testing, install the app on a [Shopify development store](https://help.shopify.com/en/partners/dashboard/managing-stores/development-stores) (free).

### Custom App (Single Store)

If the integration is only for your own store:
1. In your Shopify admin, go to **Settings > Apps and sales channels > Develop apps**.
2. Create a custom app with the same scopes.
3. Install it directly — no OAuth flow needed (you get a permanent access token).
4. Store the access token in Firestore manually or via a setup script.

### Public App (App Store)

To distribute via the Shopify App Store:
1. Complete the app listing in the Partners dashboard.
2. Add a privacy policy URL.
3. Submit for review.
4. Handle GDPR webhooks (customer data request, erasure, shop erasure).

---

## Troubleshooting

### "Invalid Shopify shop domain"
Ensure you're entering a valid `.myshopify.com` domain. The input accepts:
- `mystore` (auto-appends `.myshopify.com`)
- `mystore.myshopify.com`
- `https://mystore.myshopify.com`

### "OAuth state expired"
The authorization link expires after 10 minutes. Try connecting again.

### "Failed to sync products"
- Check that your Shopify access token hasn't been revoked.
- Verify the app still has `read_products` scope.
- Check Cloud Functions logs: `firebase functions:log --only shopifySyncProducts`

### Products not appearing after sync
After syncing, the products are written directly to Firestore by the Cloud Function. The frontend reloads from Firestore automatically. If products still don't appear, try refreshing the page.

### Access token security
The Shopify access token is stored in Firestore (in the `shopifyConnections` collection) and is only accessible by Cloud Functions via the admin SDK. Frontend clients cannot read the access token directly — the Firestore security rules block client reads of the `accessToken` field. The `shopifyGetConnection` Cloud Function returns connection metadata without exposing the token.

---

## Environment Variables Summary

| Variable | Where | Purpose |
|----------|-------|---------|
| `SHOPIFY_API_KEY` | Firebase Secret | Shopify app API key (Client ID) |
| `SHOPIFY_API_SECRET` | Firebase Secret | Shopify app API secret (Client secret) |

No frontend environment variables are needed — the integration is fully server-side.

---

## Files Changed

### New Files
- `functions/src/utils/shopify.ts` — Shopify API client, OAuth helpers, product sync logic
- `services/shopifyService.ts` — Frontend service calling Shopify Cloud Functions
- `functions/src/__tests__/shopify.test.ts` — Tests for shop sanitization and product mapping
- `docs/SHOPIFY_SETUP.md` — This guide

### Modified Files
- `types.ts` — Added `source`, `shopifyProductId`, `shopifyVariantId` to `Product`; added `ShopifyConnection` interface
- `functions/src/types/pipeline.ts` — Added `ShopifyConnectionDoc`, `ShopifyProduct`, `ShopifyVariant` types; extended `ProductDoc`
- `functions/src/index.ts` — Added 6 new Cloud Functions for Shopify OAuth and sync
- `components/ProductCatalog.tsx` — Added Shopify connect/sync UI panel, Shopify badge on product cards
- `App.tsx` — Added `onReloadProducts` callback for post-sync refresh
