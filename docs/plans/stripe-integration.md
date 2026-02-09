# Stripe Integration & User Management Plan

## Context

MarketGen AI needs tiered user management with usage limits. Currently: Firebase Auth is fully set up, user data is already scoped by `userId` in Firestore, but there's no billing, no usage tracking, and no rate limiting. Users can generate unlimited content. The `feat/stripe` branch is ready for this work.

**Goal:** Free users get 10 generations/day, Pro users ($29/mo) get 100/day. Each button click (campaign generation, image, video, landing page) = 1 count regardless of how many items the pipeline produces internally.

---

## Tasks

### Phase 1: Types & Backend Utilities

- [x] **1.1 Add user/billing types to `types.ts`** (frontend)
  - `UserTier`, `UserProfile`, `UsageInfo`, `TIER_LIMITS` constant

- [x] **1.2 Add user/billing types to `functions/src/types/pipeline.ts`** (backend)
  - `UserTier`, `UserProfileDoc`, `DailyUsageDoc`, `TIER_LIMITS` constant

- [x] **1.3 Create `functions/src/utils/billing.ts`**
  - `getOrCreateUserProfile(uid, email, displayName)` — lazy profile creation in `users/{uid}`
  - `getUserProfile(uid)` — read profile
  - `updateUserProfile(uid, fields)` — partial update
  - `getDailyUsage(uid)` — read `users/{uid}/usage/{YYYY-MM-DD}`
  - `incrementUsage(uid)` — atomic `FieldValue.increment(1)`
  - `checkQuota(uid)` — returns `{ allowed, current, limit, tier }`
  - `findUidByCustomerId(customerId)` — reverse lookup for webhooks
  - Export `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` via `defineSecret`

- [x] **1.4 Install Stripe dependency** — `cd functions && npm install stripe`

### Phase 2: Quota Enforcement in Cloud Functions

- [ ] **2.1 Add `enforceQuota` helper to `functions/src/index.ts`**
  - Calls `getOrCreateUserProfile` (lazy user doc creation) then `checkQuota`
  - Throws `HttpsError("resource-exhausted", ...)` with upgrade message for free users

- [ ] **2.2 Add quota guard to all 5 generation functions**
  - `generateCampaignContent` — add `enforceQuota` + `incrementUsage` after auth check
  - `generateContent` — same
  - `generateImage` — same
  - `generateVideo` — same
  - `generateLandingPage` — same
  - Each call = 1 count (increment before work starts to prevent race conditions)

- [ ] **2.3 Add `getUserProfileAndUsage` Cloud Function** (onCall, 10s)
  - Returns `{ tier, stripeSubscriptionStatus, generationCount, limit }`
  - Called by frontend on auth to display tier/usage in sidebar

### Phase 3: Stripe Cloud Functions

- [ ] **3.1 Add `createCheckoutSession` Cloud Function** (onCall)
  - Creates/reuses Stripe customer (stores `stripeCustomerId` in user profile)
  - Creates Stripe Checkout session for Pro subscription ($29/mo or $290/yr)
  - Returns `{ sessionId, url }` — frontend redirects to Stripe

- [ ] **3.2 Add `createPortalSession` Cloud Function** (onCall)
  - Creates Stripe Customer Portal session for managing subscription
  - Returns `{ url }` — frontend redirects

- [ ] **3.3 Add `stripeWebhook` Cloud Function** (onRequest — NOT onCall)
  - Verifies Stripe webhook signature via `req.rawBody`
  - Idempotency via `stripeEvents/{eventId}` collection
  - Handles events:
    - `checkout.session.completed` → set tier to `pro`, store subscription ID
    - `customer.subscription.updated` → sync tier based on status (`active` → pro, `past_due`/`canceled`/`unpaid` → free). This implicitly handles payment failures without needing a separate `invoice.payment_failed` handler.
    - `customer.subscription.deleted` → downgrade to `free`

### Phase 4: Firestore Security Rules

- [ ] **4.1 Update `firestore.rules`**
  - `users/{userId}` — read-only for owner (writes only via Cloud Functions)
  - `users/{userId}/usage/{date}` — read-only for owner
  - `stripeEvents/{eventId}` — no client access

### Phase 5: Frontend — Services & State

- [ ] **5.1 Create `services/stripeService.ts`**
  - `fetchUserProfileAndUsage()` — calls `getUserProfileAndUsage` Cloud Function
  - `openCheckout(priceId?)` — calls `createCheckoutSession`, redirects to Stripe
  - `openBillingPortal()` — calls `createPortalSession`, redirects to portal

- [ ] **5.2 Add usage state to `App.tsx`**
  - `useState<UsageInfo | null>(null)` for `usageInfo`
  - `useEffect` to fetch profile+usage after auth
  - `refreshUsage` callback
  - Pass `usageInfo` + `refreshUsage` to Layout, CampaignDetail, Settings

### Phase 6: Frontend — UI Components

- [ ] **6.1 Update `components/Layout.tsx`**
  - Accept `usageInfo` prop
  - Show tier badge (FREE / PRO) in sidebar user section
  - Show usage bar: `{count}/{limit} generations today` with color-coded progress bar
  - Replace "Marketer Admin" label with dynamic tier

- [ ] **6.2 Update `components/CampaignDetail.tsx`**
  - Accept `usageInfo` and `onRefreshUsage` props
  - Client-side quota pre-check before generation (server also enforces)
  - Handle `resource-exhausted` error with upgrade prompt
  - Call `onRefreshUsage` after generation starts

- [ ] **6.3 Create `components/Settings.tsx`**
  - Current plan display (Free/Pro with feature comparison)
  - Usage stats with progress bar
  - "Upgrade to Pro" button for free users → calls `openCheckout()`
  - "Manage Billing" button for pro users → calls `openBillingPortal()`
  - Handle `?billing=success` and `?billing=canceled` URL params (post-redirect toast)

- [ ] **6.4 Register Settings route in `App.tsx`**
  - Add `<Route path="/settings">` (sidebar link already exists at `/settings`)

### Phase 7: Stripe CLI Setup & Products

- [ ] **7.1 Install Stripe CLI** (if not installed) — `brew install stripe/stripe-cli/stripe`

- [ ] **7.2 Create Stripe products and prices**
  - Product: "MarketGen AI Pro"
  - Monthly price: $29/month
  - Yearly price: $290/year (~17% savings)

- [ ] **7.3 Set Firebase secrets**
  - `firebase functions:secrets:set STRIPE_SECRET_KEY`
  - `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`

- [ ] **7.4 Configure local webhook forwarding**
  - `stripe listen --forward-to http://127.0.0.1:5001/{PROJECT}/us-central1/stripeWebhook`

### Phase 8: Tests

- [ ] **8.1 Create `functions/src/__tests__/billing.test.ts`**
  - Test `checkQuota` (under/over limit, free/pro tiers)
  - Test `incrementUsage` (atomic increment)
  - Test `getOrCreateUserProfile` (create + idempotent)

---

## Files to Modify

| File | Changes |
|------|---------|
| `types.ts` | Add `UserTier`, `UserProfile`, `UsageInfo`, `TIER_LIMITS` |
| `functions/src/types/pipeline.ts` | Add `UserProfileDoc`, `DailyUsageDoc`, `TIER_LIMITS` |
| `functions/src/utils/billing.ts` | **NEW** — profile/usage/quota helpers + Stripe secrets |
| `functions/src/index.ts` | Add quota guards to 5 functions + 3 new Stripe functions + `getUserProfileAndUsage` |
| `functions/package.json` | Add `stripe` dependency |
| `firestore.rules` | Add rules for `users`, `usage`, `stripeEvents` |
| `services/stripeService.ts` | **NEW** — frontend Stripe/billing service |
| `App.tsx` | Add `usageInfo` state, fetch on auth, pass to components, add Settings route |
| `components/Layout.tsx` | Add tier badge + usage bar in sidebar |
| `components/CampaignDetail.tsx` | Add quota pre-check + error handling |
| `components/Settings.tsx` | **NEW** — billing/subscription management page |
| `functions/src/__tests__/billing.test.ts` | **NEW** — billing utils tests |

## Key Design Decisions

- **Usage subcollection `users/{uid}/usage/{YYYY-MM-DD}`** — one doc per day, atomic increment, no need to scan history
- **Optimistic increment** — count before work starts to prevent race conditions on button spam
- **`users` collection is server-write-only** — prevents client-side tier manipulation
- **`stripeWebhook` uses `onRequest`** (not `onCall`) — Stripe sends raw HTTP with signature header
- **Idempotent webhooks** — `stripeEvents` collection prevents duplicate processing
- **Price IDs as constants** in Cloud Functions code (not dynamic config)

## Verification

1. `cd functions && npm test` — billing utils tests pass
2. `cd functions && npm run build` — Cloud Functions compile
3. `npm run build` — frontend compiles
4. Start emulators + Stripe CLI listener, test:
   - New user gets `free` tier, usage shows 0/10
   - Generate content → usage increments to 1/10
   - Generate 10 times → 11th attempt blocked with upgrade message
   - Click "Upgrade" → redirected to Stripe Checkout
   - Complete test checkout → webhook fires → tier updates to `pro`, limit shows 100
   - "Manage Billing" → opens Stripe Customer Portal
   - Cancel subscription → webhook fires → tier reverts to `free`
