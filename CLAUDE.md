# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MarketGen AI — an enterprise AI marketing content generator built with React + TypeScript. It uses Google Gemini APIs to generate marketing copy, images, and video storyboards for multi-channel campaigns. Originally scaffolded from Google AI Studio.

## Commands

- `npm run dev` — start dev server on port 3000
- `npm run build` — production build via Vite
- `npm run preview` — preview production build
- `cd functions && npm test` — run Vitest tests for Cloud Functions agents/utils
- `cd functions && npm run build` — compile Cloud Functions TypeScript
- `firebase emulators:start --only functions,firestore` — start local emulators (Functions :5001, Firestore :8080)

No linter or formatter is configured.

## Architecture

**Frontend:** Flat file structure — all source files are at the root or one level deep. No `src/` directory.

**Backend (`functions/src/`):**
```
functions/src/
  index.ts                          # Cloud Function exports
  agents/                           # Pipeline agents
    orchestrator.ts, planner.ts, generator.ts, compliance.ts, assetManager.ts
  prompts/                          # Prompt templates (separated from agent logic)
    generator.prompt.ts, compliance.prompt.ts
  types/
    pipeline.ts                     # PlannerContext, AgentResult<T>, ComplianceResult, ContentDoc, JobStatus, UserProfileDoc, DailyUsageDoc, TIER_LIMITS
  utils/
    gemini.ts, firestore.ts, storage.ts, timeout.ts, progress.ts, billing.ts
  __tests__/                        # Vitest tests for all agents and utils
```

### Entry & Routing

- `index.tsx` — React 19 entry point, mounts `<App />`
- `App.tsx` — top-level state owner and router (HashRouter). All application state (products, campaigns, content) lives here as `useState` hooks. Seeds IndexedDB with mock data on first load if empty.
- Routes: `/` (Dashboard), `/campaigns` (list), `/campaigns/new` (generator wizard), `/campaigns/:id` (canvas workspace), `/products` (catalog), `/settings` (billing & usage)

### State & Persistence

- **All state flows top-down from App.tsx** — no context providers or state management library. Components receive data and callbacks as props.
- `services/storageService.ts` — IndexedDB wrapper (`MarketGenDB`) with three object stores: `products`, `campaigns`, `content`. Simple `getAll`, `put`, `clear` API.
- State updates in App.tsx write to both React state and IndexedDB in parallel (fire-and-forget DB writes).
- **Firestore collections** (server-side, used by backend agent pipeline):
  - `campaigns`, `products`, `content`, `complianceRules` — user-scoped documents (read/write by auth owner)
  - `generationJobs` — pipeline job tracking. Read-only for auth owner; created/updated only by Cloud Functions.
  - `content` extended with `generationJobId` and `complianceDetails` fields for pipeline back-references.
  - Composite indexes on `content` and `generationJobs` for `campaignId` + `userId` queries (see `firestore.indexes.json`).
  - `users/{uid}` — user profile (tier, Stripe customer/subscription IDs). Read-only for auth owner; created/updated only by Cloud Functions.
  - `users/{uid}/usage/{YYYY-MM-DD}` — daily generation count. Read-only for auth owner; incremented by Cloud Functions.
  - `stripeEvents/{eventId}` — webhook idempotency records. No client access.

### AI Service Layer

- `services/geminiService.ts` — client-side Gemini interactions for standalone use:
  - `generateImage()` — single image generation via Cloud Function `generateImage`. Falls back to picsum.photos placeholder URLs.
  - `generateVideoFromStoryboard()` — video generation via Cloud Function `generateVideo` with polling loop.
- `services/orchestrationService.ts` — frontend integration with backend agent pipeline:
  - `startGeneration(campaignId)` — calls `generateCampaignContent` Cloud Function, returns jobId.
  - `subscribeToJob(jobId, callback)` — Firestore onSnapshot for real-time job progress.
  - `subscribeToContent(campaignId, callback)` — Firestore onSnapshot for content doc updates.
- Content generation (text + images + compliance) is fully handled by the backend agent pipeline.
- `services/stripeService.ts` — frontend billing integration:
  - `fetchUserProfileAndUsage()` — calls `getUserProfileAndUsage` Cloud Function
  - `openCheckout(interval?)` — calls `createCheckoutSession`, redirects to Stripe Checkout
  - `openBillingPortal()` — calls `createPortalSession`, redirects to Stripe Customer Portal

### Backend Agent Pipeline

Content generation is orchestrated server-side via a multi-agent pipeline in Cloud Functions:

- **Trigger/Processor split** — `generateCampaignContent` (onCall, 30s) creates a job doc and returns `{ jobId }` instantly. `processGenerationJob` (onDocumentCreated on `generationJobs/{jobId}`, 540s) runs the full pipeline.
- **Orchestrator** (`functions/src/agents/orchestrator.ts`) — deterministic code controller, not LLM-based. Runs: Planner -> Generator -> Compliance -> (retry?) -> Asset Manager.
- **Planner** (`functions/src/agents/planner.ts`) — assembles minimal PlannerContext from Firestore (campaign, products, compliance rule, existing content).
- **Generator** (`functions/src/agents/generator.ts`) — text generation via Gemini Flash with structured JSON output. Writes content docs to Firestore.
- **Compliance** (`functions/src/agents/compliance.ts`) — evaluator-optimizer loop. Separate Gemini call per item. Failed items (score < 80) trigger regeneration, max 2 retries.
- **Asset Manager** (`functions/src/agents/assetManager.ts`) — parallel image generation via Gemini, uploads to Firebase Storage, updates Firestore content docs. Skipped if < 120s budget remains.
- **Prompt templates** live in `functions/src/prompts/` (separated from agent logic).
- **Pipeline types** defined in `functions/src/types/pipeline.ts`.

### Cloud Functions (`functions/src/index.ts`)

Exported Cloud Functions (Firebase Functions v2):
- `generateContent` (onCall, 120s) — single Gemini text generation call (legacy, kept for backward compat)
- `generateImage` (onCall, 120s) — single Gemini image generation call
- `generateVideo` (onCall, 540s) — Veo video generation with polling + Storage upload
- `generateCampaignContent` (onCall, 30s) — pipeline trigger: validates input, creates job doc, returns `{ jobId }`
- `processGenerationJob` (onDocumentCreated, 540s) — pipeline processor: runs full agent orchestrator
- `getUserProfileAndUsage` (onCall, 10s) — returns user tier, subscription status, and daily usage count
- `createCheckoutSession` (onCall, 30s) — creates Stripe Checkout session, returns URL for redirect
- `createPortalSession` (onCall, 30s) — creates Stripe Customer Portal session, returns URL
- `stripeWebhook` (onRequest, 30s) — Stripe webhook handler for subscription lifecycle events (uses Stripe signature verification, not Firebase Auth)

All onCall functions require authentication. `stripeWebhook` uses `onRequest` with Stripe signature verification instead of Firebase Auth. Generation functions use `GEMINI_API_KEY` via `defineSecret`. Stripe functions use `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` via `defineSecret` (in `utils/billing.ts`).

### Billing & Quota Enforcement

- `enforceQuota(uid, email, displayName)` helper in `index.ts` — called at the start of every generation function. Lazily creates user profile via `getOrCreateUserProfile`, then checks daily quota via `checkQuota`. Throws `HttpsError("resource-exhausted")` when limit exceeded.
- Optimistic increment: `incrementUsage` is called before generation work starts to prevent race conditions from concurrent requests.
- Free tier: 10 generations/day. Pro tier: 100 generations/day. Limits defined in `TIER_LIMITS` constant.
- `stripeWebhook` handles subscription lifecycle (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`). Uses `stripeEvents` collection for idempotency. `users` collection is server-write-only to prevent client-side tier manipulation.

### API Keys & Secrets

- The Gemini API key comes from `GEMINI_API_KEY` in `.env.local`
- Vite config injects it as `process.env.API_KEY` and `process.env.GEMINI_API_KEY` at build time
- Also supports AI Studio runtime key selection via `window.aistudio` (shows key connect screen if not available)
- Server-side: `defineSecret("GEMINI_API_KEY")` in `functions/src/utils/gemini.ts`, shared by all Cloud Functions
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` via `defineSecret` in `functions/src/utils/billing.ts`, used by Stripe Cloud Functions
- Set Stripe secrets via: `firebase functions:secrets:set STRIPE_SECRET_KEY` and `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`

### Key Components

- `components/Layout.tsx` — sidebar + header shell with react-router navigation
- `components/ContentGenerator.tsx` — 2-step campaign creation wizard (scope selection -> strategy config -> generate)
- `components/CampaignDetail.tsx` — campaign workspace with left sidebar controls (context, products, audiences, channels) and canvas area. Calls backend pipeline via `startGeneration()` and subscribes to Firestore for real-time updates.
- `components/CanvasBoard.tsx` — infinite canvas with pan/zoom, card drag, multi-select. Renders SVG connection lines between cards.
- `components/CanvasCard.tsx` — content card with channel-specific styling, compliance badge, image/storyboard preview
- `components/VideoStoryboardModal.tsx` — modal for video storyboard review and Veo video generation
- `components/Settings.tsx` — billing/subscription management page with plan comparison, usage stats, Stripe Checkout/Portal integration

### Styling

- Tailwind CSS loaded via CDN script tag in `index.html` (not PostCSS/build-integrated)
- Inter font from Google Fonts
- Path alias `@/*` maps to project root (configured in both `tsconfig.json` and `vite.config.ts`)

### Type System

- `types.ts` — all shared interfaces: `Product`, `Campaign`, `GeneratedContent`, `Scene`, `DashboardMetrics`, `ChartData`, `UserTier`, `UserProfile`, `UsageInfo`, `TIER_LIMITS`
- `GeneratedContent` has canvas positioning fields (`x`, `y`, `width`) and optional video fields (`storyboard`, `videoUrl`, `videoStatus`)
- `GeneratedContent` extended with `generationJobId?: string` and `complianceDetails?` for pipeline integration
- Campaign supports both product-focused and brand/idea campaigns (`primaryProductId` is optional)
- `functions/src/types/pipeline.ts` — backend pipeline types: `PlannerContext`, `AgentResult<T>`, `ComplianceResult`, `ContentDoc`, `JobStatus`

### Dependencies

- **Frontend:** React 19, react-router-dom 7, recharts (dashboard charts), lucide-react (icons), @google/genai (Gemini SDK)
- **Backend (functions/):** firebase-admin, firebase-functions v6, @google/genai (Gemini SDK), stripe (billing), vitest (dev)
- `index.html` contains an importmap pointing to esm.sh CDN — this is for the AI Studio sandbox runtime, not used during local Vite dev

### Testing

- `cd functions && npm test` — runs `vitest run` for backend agent tests
- Tests live in `functions/src/__tests__/*.test.ts`
- Test config: `functions/vitest.config.ts`
- Mocking pattern: `vi.mock("../utils/gemini")`, `vi.mock("../utils/firestore")` etc. to isolate agents from Firebase/Gemini SDK
- No frontend test runner is configured

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
