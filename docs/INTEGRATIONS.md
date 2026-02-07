# MarketGen AI — Integration Architecture

## Overview

This document outlines the integration strategy for MarketGen AI. Integrations are organized into three layers based on how they connect to the content generation pipeline.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CONTEXT LAYER                      │
│  Shopify/Akeneo ──► Product Data                    │
│  Frontify ────────► Brand Voice & Guidelines         │
│  HubSpot/Segment ─► Audience Segments & Personas    │
│  Semrush ─────────► Keywords & SEO Rules            │
│  GA4 Feedback ────► Past Performance Insights        │
└─────────────┬───────────────────────────────────────┘
              │ Assembled via contextAssembler.ts
              │ Injected into Gemini prompt
              ▼
┌─────────────────────────────────────────────────────┐
│          geminiService.ts → generateMarketingContent │
│          (Gemini 3 Flash / Pro / Veo 3.1)           │
└─────────────┬───────────────────────────────────────┘
              │ Generated content
              ▼
┌─────────────────────────────────────────────────────┐
│                  OUTPUT LAYER                         │
│  Cloudinary ──────► Image/Video storage & transforms │
│  Slack ───────────► Approval workflows               │
│  Mailchimp ───────► Email campaign publishing        │
│  Buffer ──────────► Social media scheduling          │
│  Google Ads ──────► Ad campaign creation             │
│  Meta Business ───► Facebook/Instagram publishing    │
└─────────────────────────────────────────────────────┘
              │ Performance data flows back
              ▼
┌─────────────────────────────────────────────────────┐
│               ANALYTICS LAYER                        │
│  GA4 ─────────────► Content performance tracking     │
│  Mixpanel ────────► Product usage analytics          │
└─────────────────────────────────────────────────────┘
```

## How Context Flows Into Generation

The `contextAssembler.ts` module collects data from all connected integrations and produces a `GenerationContext` object. This is then converted to a prompt block via `contextToPromptBlock()` and injected into the Gemini prompt alongside the existing product/campaign context.

**Before integrations (current):**
```
Prompt = Product description + Campaign context + Key message + Compliance rules
```

**After integrations:**
```
Prompt = Product description + Enriched product data (Shopify)
       + Brand voice guidelines (Frontify)
       + Audience intelligence (HubSpot)
       + SEO keywords (Semrush)
       + Performance insights (GA4)
       + Campaign context + Key message + Compliance rules
```

## Phase 1 — High Impact, Low Effort

### Cloudinary (DAM)
- **Purpose:** Store and transform generated images/videos; replace Firebase Storage for asset delivery
- **API:** REST Upload API + URL-based transforms (no API call for resize/crop)
- **Key feature:** `CHANNEL_TRANSFORMS` map provides automatic image sizing per channel (Instagram 1080x1080, LinkedIn 1200x628, etc.)
- **Free tier:** 25 credits/month
- **Files:** `services/integrations/cloudinaryAdapter.ts`

### Google Analytics 4 (Analytics)
- **Purpose:** Track content lifecycle events (generated, approved, published) and pull performance data back for generation context
- **API:** Measurement Protocol (HTTP POST) + Data API v1beta
- **Key feature:** Performance feedback loop — past campaign metrics inform future content generation
- **Free tier:** Completely free
- **Files:** `services/integrations/ga4Adapter.ts`

### Shopify (PIM)
- **Purpose:** Pull rich product data (variants, inventory, reviews, SEO) to enrich Gemini prompts
- **API:** GraphQL (mandatory since April 2025)
- **Key feature:** Product matching by SKU links Shopify catalog to local Product records
- **Free tier:** Partner Program development stores are free
- **Files:** `services/integrations/shopifyAdapter.ts`

### Slack (Collaboration)
- **Purpose:** Content approval workflows with rich message previews and interactive buttons
- **API:** Web API (REST) + Events API for incoming interactions
- **Key feature:** Approve/Reject/Request Changes buttons with content preview in Slack
- **Free tier:** Bot functionality works on free Slack tier
- **Files:** `services/integrations/slackAdapter.ts`

## Phase 2 — High Impact, Medium Effort

### HubSpot (CRM)
- **Purpose:** Pull audience segments with demographic/firmographic data for personalized prompts
- **API:** REST v3 (Segments API, Contacts API)
- **Free tier:** Free CRM with basic segmentation
- **Note:** v1 Lists API sunsets April 30, 2026; build on v3

### Mailchimp (Email Publishing)
- **Purpose:** Create and send email campaigns from generated content
- **API:** REST Marketing API
- **Free tier:** 500 contacts, 1,000 sends/month

### Buffer (Social Publishing)
- **Purpose:** Schedule generated social posts across 10+ platforms
- **API:** REST
- **Free tier:** 3 channels

### Mixpanel (Product Analytics)
- **Purpose:** Track user behavior within the MarketGen app itself
- **API:** JavaScript SDK (`mixpanel.track()`)
- **Free tier:** 1M events/month

## Phase 3 — Strategic

### Frontify (Brand Voice)
- **Purpose:** Structured brand guidelines (tone, colors, typography, do/don't rules) injected into every prompt
- **API:** GraphQL + React Brand SDK
- **No free tier** (dev sandbox available)

### Google Ads (Ad Publishing)
- **Purpose:** Create ad campaigns from generated copy
- **API:** REST v22 + MCP Server for AI-native interaction
- **Free API** (pay only for ad spend)

### Meta Business Suite (Social Ads)
- **Purpose:** Publish to Facebook/Instagram, create ad campaigns
- **API:** Marketing API + Graph API
- **Free API** (app review required)

### Semrush (SEO)
- **Purpose:** Keyword data and content templates for SEO-optimized generation
- **API:** REST + MCP
- **Starts at $499.95/month**

## File Structure

```
types/
  integrations.ts          # All integration type definitions

services/integrations/
  index.ts                 # Barrel export
  contextAssembler.ts      # Assembles GenerationContext from all integrations
  shopifyAdapter.ts        # Shopify GraphQL product data
  slackAdapter.ts          # Slack approval workflows
  cloudinaryAdapter.ts     # Cloudinary image/video management
  ga4Adapter.ts            # GA4 event tracking + performance data
```

## Key Types

- `IntegrationConfig` — Stored per-user config (credentials, status, settings)
- `GenerationContext` — Unified context assembled from all integrations
- `BrandVoiceProfile` — Brand guidelines structure (Frontify)
- `AudienceSegment` — Rich audience data (HubSpot/Segment)
- `SEOContext` — Keyword and competitive data (Semrush)
- `ContentPerformanceData` — Historical metrics (GA4)
- `EnrichedProductData` — Extended product info (Shopify)
- `PublishingTarget` — Output distribution config
- `SlackApprovalRequest` — Approval workflow state
- `CloudinaryAsset` — Managed asset metadata
