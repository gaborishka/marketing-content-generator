# Fix Shopify Integration

## Context

The Shopify integration on the `feat/shopify` branch fails when connecting a store and importing products. After comparing the implementation against official Shopify OAuth and Admin API documentation, I identified several bugs — most critically in the OAuth token exchange and the auth flow URL construction — plus reliability gaps in API versioning and rate limiting.

## Critical Bugs (Connection Failures)

### 1. Token exchange uses wrong Content-Type
**File:** `functions/src/shopify/auth.ts:59-67`

The `exchangeCodeForToken()` sends `application/json` but Shopify's `/admin/oauth/access_token` endpoint requires `application/x-www-form-urlencoded`. This causes the token exchange to fail silently or return an error, breaking the entire OAuth flow.

**Fix:** Change Content-Type to `application/x-www-form-urlencoded` and encode body with `URLSearchParams`.

### 2. shopifyAuthInit sends user to install URL without redirect_uri or state
**File:** `functions/src/index.ts:435-441` (uncommitted change)

The current uncommitted code changed the auth URL from `buildShopifyAuthUrl()` (which includes `redirect_uri`, `state`, `scope`) to a bare install URL:
```
https://admin.shopify.com/store/{handle}/oauth/install?client_id={id}
```
This URL has no `redirect_uri`, no `state`, and no `scope`. Shopify will use whatever redirect URL is configured in the Partner Dashboard, and the callback won't have a `state` param — forcing it into the fragile "lookup by shopDomain" fallback path. If the Partner Dashboard redirect URL doesn't match the Cloud Function URL, the flow breaks entirely.

**Fix:** Revert to using `buildShopifyAuthUrl()` with the properly constructed redirect URI. The `/oauth/install` URL is only needed for the initial "Install" button on custom distribution apps, but the standard `/oauth/authorize` endpoint works for both installed and uninstalled apps.

### 3. Callback re-auth passes empty state
**File:** `functions/src/index.ts:455-463`

When the callback receives a request without `code` (app launch redirect), it re-initiates OAuth with `state || ""`. An empty state means the callback's state-verification branch won't find a matching Firestore doc.

**Fix:** Generate a new state token and store it in Firestore before redirecting, like `shopifyAuthInit` does.

## Reliability Issues

### 4. Shopify API version outdated
**Files:** `functions/src/utils/shopify.ts:46`, `functions/src/index.ts:549`

Uses `2024-01` which is approaching end-of-support. Shopify supports each version for 12 months, and `2024-01` deprecates Q1 2025.

**Fix:** Extract a shared `SHOPIFY_API_VERSION = "2025-01"` constant used by all endpoints.

### 5. No rate limit handling
**File:** `functions/src/utils/shopify.ts`

The `fetchShopifyProducts` and `fetchShopifyProduct` functions don't handle HTTP 429 responses. The import/resync loops make sequential requests with no backoff — a store with 50+ products will likely hit Shopify's leaky-bucket rate limit (40 requests / 2 per second refill).

**Fix:** Add a `fetchWithRetry()` wrapper that checks `X-Shopify-Shop-Api-Call-Limit` headers for proactive throttling and retries on 429 with exponential backoff.

### 6. No token validity check before API calls
**Files:** `functions/src/index.ts` (browseShopifyProducts, importShopifyProducts, resyncShopifyProducts)

If the stored access token is revoked or expired, every API call fails with no user-facing recovery path. The user sees generic errors with no hint that reconnection is needed.

**Fix:** Catch 401 responses from Shopify API and throw a specific `HttpsError("failed-precondition", "Shopify connection expired. Please reconnect.")` so the frontend can prompt re-authentication.

## Tasks

### Critical fixes (auth flow)
- [x] Fix token exchange Content-Type to `application/x-www-form-urlencoded` (`auth.ts:59-67`)
- [x] Fix `shopifyAuthInit` to use `buildShopifyAuthUrl()` with redirect_uri and state (`index.ts:435-441`)
- [x] Fix callback re-auth flow to generate fresh state token instead of passing empty string (`index.ts:455-463`)

### Reliability improvements
- [x] Update Shopify API version from `2024-01` to `2025-01` (`utils/shopify.ts:46`, `index.ts:549`)
- [x] Add rate-limit-aware fetch wrapper with 429 retry + exponential backoff (`utils/shopify.ts`)
- [x] Detect 401 expired tokens and surface reconnection error to frontend (`utils/shopify.ts`, `index.ts`)

### Testing
- [x] Update token exchange test to verify form-encoded body (`shopify-auth.test.ts`)
- [x] Add tests for 429 retry behavior (`shopify-fetch.test.ts`)
- [x] Add tests for 401 detection (`shopify-fetch.test.ts`)
- [x] Run full test suite — 164 tests pass (16 files)
- [x] Verify TypeScript builds — compiles cleanly

## Files Modified
| File | Changes |
|------|---------|
| `functions/src/shopify/auth.ts` | Fixed token exchange: `application/x-www-form-urlencoded` + `URLSearchParams` body + `Accept: application/json` header |
| `functions/src/utils/shopify.ts` | Added `SHOPIFY_API_VERSION` constant (`2025-01`), `ShopifyAuthError` class, `fetchWithRetry()` wrapper (429 backoff, 401 detection, proactive throttle via `X-Shopify-Shop-Api-Call-Limit`) |
| `functions/src/index.ts` | Restored `buildShopifyAuthUrl()` in `shopifyAuthInit`; callback re-auth generates fresh state token; shop.json uses version constant; `browseShopifyProducts`/`importShopifyProducts`/`resyncShopifyProducts` catch `ShopifyAuthError` → `HttpsError("failed-precondition")` |
| `functions/src/__tests__/shopify-auth.test.ts` | Added `exchangeCodeForToken` tests: form-encoded body verification, error on non-OK response |
| `functions/src/__tests__/shopify-fetch.test.ts` | **New file.** Tests for: 401 → `ShopifyAuthError`, 429 retry + max retry exhaustion, API version in URLs |

## Remaining Manual Verification
- [ ] Deploy to Firebase and test full OAuth redirect flow against a real Shopify store
- [ ] Verify product browse and import with a connected store
