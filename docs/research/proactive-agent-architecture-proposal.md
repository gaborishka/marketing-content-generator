# Proactive Self-Extending Marketing Agent — Architectural Proposal

**Date:** 2026-02-15
**Status:** Proposal / RFC
**Prerequisite:** [OpenClaw Integration Analysis](./openclaw-integration-analysis.md)

---

## Executive Summary

Inspired by OpenClaw's philosophy — not its code — this document proposes evolving
MarketGen from a "tool you use" into an **agent that works for you**: accessible
through messaging platforms, proactive about campaign opportunities, and capable
of extending its own capabilities through configuration (not code generation).

Three pillars:
1. **Messenger presence** — the agent lives where marketing teams already work
2. **Proactive intelligence** — the agent acts without being asked
3. **Self-extension** — the agent learns and builds new capabilities over time

---

## Pillar 1: Messenger-Accessible Agent

### Why this matters for marketing teams

Marketing managers don't live in custom web UIs — they live in Slack, Teams,
and WhatsApp. The friction of switching to a separate tool kills adoption.
An agent that meets them where they already are changes the dynamic:

- "Your campaign copy is ready for review" → arrives in Slack
- Reply "approve" or "make the tone more casual" → inline
- "Generate 3 more Instagram posts for the summer collection" → from WhatsApp
- "Campaign X deadline is tomorrow, content isn't generated yet" → proactive alert

### Architecture

```
                    ┌─────────────┐
                    │  Cloud Run   │  (always-on, lightweight)
                    │  Gateway     │
                    │              │
   Slack ──────────►│  Intent      │──────► Cloud Functions
   Telegram ───────►│  Parser      │        (existing pipeline)
   WhatsApp ───────►│              │
   Discord ────────►│  Notification│◄────── Firestore onSnapshot
   Web UI ─────────►│  Router      │        (job updates, deadlines)
                    └─────────────┘
```

### Components

**1. Gateway Service (Cloud Run)**

A single lightweight Node.js/TypeScript service running on Cloud Run (min 1 instance,
~$5-15/mo). Why Cloud Run, not Cloud Functions:
- Messaging APIs require persistent WebSocket/long-polling connections
- Cloud Functions are ephemeral (max 540s) — can't maintain channel connections
- Cloud Run gives always-on + auto-scaling + serverless billing model

```typescript
// Conceptual structure
interface GatewayConfig {
  channels: ChannelConfig[];     // Slack, Telegram, etc.
  intentParser: IntentParser;    // NLP to extract action + params
  actionRouter: ActionRouter;    // Maps intents to Cloud Functions
  notificationRouter: NotifRouter; // Routes alerts to correct channels
}
```

**2. Intent Parser**

Single Gemini Flash call to classify incoming messages into structured intents:

```typescript
type MarketingIntent =
  | { action: "generate"; campaignId: string; channels?: string[] }
  | { action: "approve"; contentIds: string[] }
  | { action: "revise"; contentId: string; feedback: string }
  | { action: "status"; campaignId?: string }
  | { action: "create_campaign"; description: string }
  | { action: "check_compliance"; contentIds: string[]; ruleId: string }
  | { action: "list_campaigns" }
  | { action: "unknown"; rawText: string };
```

Cost: ~0.001 cents per message with Gemini Flash. Negligible.

**3. Channel Adapters**

Each channel is a thin adapter that:
- Receives messages from the platform API
- Forwards to intent parser
- Renders structured responses into platform-native format
- Handles auth (maps platform user → Firebase UID)

Start with **Slack** (highest enterprise adoption) and **Telegram** (easiest API,
great for demos). Add more later.

**4. Notification Router**

Firestore `onSnapshot` listeners that watch for:
- Job completion → "Your content for Campaign X is ready"
- Job failure → "Generation failed for Campaign X: [error]"
- Compliance alerts → "3 items failed compliance check"
- Deadline proximity → "Campaign X deadline in 48h, no content generated"

Routes notifications to the user's preferred channel.

### What we reuse from current architecture

- **All existing Cloud Functions** — Gateway calls them via Firebase SDK, no changes
- **Auth model** — Channel adapters map platform users to Firebase UIDs
- **Firestore** — Gateway reads/watches same collections the web UI uses
- **Pipeline** — The existing orchestrator runs exactly as-is

### What's new

| Component | Effort | Risk |
|-----------|--------|------|
| Cloud Run gateway service | Medium | Low — well-understood pattern |
| Slack adapter | Low | Low — Bolt SDK is mature |
| Telegram adapter | Low | Low — grammY is mature |
| Intent parser (Gemini) | Low | Low — single LLM call |
| Notification router | Medium | Low — Firestore onSnapshot |
| Channel ↔ Firebase UID mapping | Medium | Medium — auth token exchange |

---

## Pillar 2: Proactive Intelligence

### Proactive agent use cases for marketing

Unlike OpenClaw's personal assistant proactivity (check email, check weather),
marketing proactivity is **domain-specific business logic**:

| Trigger | Agent Action | Value |
|---------|-------------|-------|
| Campaign deadline in 48h | Check if content exists; if not, notify + offer to generate | Prevents missed deadlines |
| Compliance rule updated | Re-check all existing content against new rule | Ensures ongoing compliance |
| Content generated 7+ days ago, no approval | Remind user to review | Reduces stale content |
| New product added | Suggest campaign creation | Drives content coverage |
| All content for campaign approved | Suggest publishing / next steps | Accelerates workflow |
| Daily usage approaching limit | Warn before generation fails | Better UX |
| Shopify product updated | Flag outdated content | Keeps content fresh |

### Implementation: Condition Engine

```
Firebase Scheduled Function (every 15 min)
  └─ evaluateConditions(userId)
       ├─ Load user's campaigns, content, rules, products
       ├─ Evaluate each condition rule
       ├─ For triggered conditions:
       │    ├─ Deduplicate (don't re-alert within cooldown)
       │    ├─ Write to `notifications` collection
       │    └─ Send via Notification Router (messenger channels)
       └─ Log evaluation for observability
```

**Condition rules** are stored in Firestore, not hardcoded:

```typescript
interface ConditionRule {
  id: string;
  type: "deadline_approaching" | "compliance_drift" | "stale_content"
      | "missing_content" | "product_updated" | "quota_warning"
      | "custom";
  enabled: boolean;
  params: Record<string, any>;  // e.g., { daysBeforeDeadline: 2 }
  cooldownMinutes: number;       // Don't re-alert within this window
  channels: string[];            // Which messenger channels to notify
}
```

### Why Firebase Scheduled Functions (not OpenClaw's Heartbeat)

- Runs within existing Firebase infrastructure (no new servers)
- Scales per-user (one function invocation evaluates one user's conditions)
- Costs nearly nothing (~$0.01/month for 15-min intervals)
- Integrates natively with Firestore security model
- No persistent daemon to manage

For event-driven triggers (compliance rule changed, product updated), use
**Firestore onWrite triggers** instead of polling — instant reaction, zero delay.

---

## Pillar 3: Self-Extending Agent

This is the most ambitious pillar. The idea: **the agent can create new capabilities
for itself, with human approval.**

### Critical design decision: Configuration, not Code

An agent that writes arbitrary TypeScript and deploys it = security nightmare +
reliability nightmare. Instead, the agent extends itself through **structured
configuration documents** in Firestore that the pipeline engine interprets at
runtime.

```
┌──────────────────────────────────────────────────────┐
│                  SAFE EXTENSION ZONE                  │
│                                                       │
│  ✅ New prompt templates (Firestore docs)            │
│  ✅ New content type definitions (JSON schemas)      │
│  ✅ New compliance rules (structured text)           │
│  ✅ New condition rules (config documents)           │
│  ✅ Pipeline stage composition (ordered configs)     │
│  ✅ Audience/channel definitions (user data)         │
│                                                       │
├──────────────────────────────────────────────────────┤
│                  UNSAFE — NOT ALLOWED                  │
│                                                       │
│  ❌ Runtime code generation (.ts files)              │
│  ❌ Arbitrary function execution                     │
│  ❌ Infrastructure changes                           │
│  ❌ Security rule modifications                      │
│  ❌ Direct Firestore admin operations                │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### What the agent can learn and create

**A. New Prompt Templates**

The agent notices that compliance keeps failing on pharmaceutical content.
It analyzes past failures, identifies patterns, and creates a new prompt template:

```typescript
// Stored in Firestore: promptTemplates/{templateId}
interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  createdBy: "system" | "agent" | "user";
  approvedBy?: string;           // userId who approved
  status: "draft" | "approved" | "active";
  targetChannels?: string[];     // null = all channels
  targetAudiences?: string[];    // null = all audiences
  systemContext: string;         // Injected into generation prompt
  toneGuidance: string;
  structureHints: string;
  compliancePreRules: string[];  // Pre-baked compliance constraints
  createdAt: string;
  usageCount: number;
  avgComplianceScore: number;    // Tracked over time
}
```

The generator agent checks for matching templates before generation and injects
their guidance into the prompt. The agent creates templates; humans approve them.

**B. New Content Types**

The agent notices users frequently ask for "LinkedIn carousel" but the system
only supports "LinkedIn Post". It proposes a new content type:

```typescript
// Stored in Firestore: contentTypes/{typeId}
interface ContentTypeDefinition {
  id: string;
  name: string;                   // "LinkedIn Carousel"
  channel: string;                // "LinkedIn"
  format: "single" | "carousel" | "thread" | "story";
  fields: ContentField[];         // What fields to generate
  imageAspectRatio: ImageAspectRatio;
  imageCount: number;             // Carousels need multiple images
  maxTextLength: number;
  promptHints: string;            // How to instruct the LLM
  status: "proposed" | "approved" | "active";
  proposedBy: "agent" | "user";
}
```

**C. Pipeline Stage Composition**

Instead of hardcoded orchestrator stages, introduce a configurable pipeline:

```typescript
// Stored in Firestore: pipelineConfigs/{configId}
interface PipelineConfig {
  id: string;
  name: string;
  stages: PipelineStage[];
  status: "draft" | "active";
}

interface PipelineStage {
  id: string;
  type: "planner" | "generator" | "compliance" | "asset_manager"
      | "tone_adjuster" | "localization" | "ab_variant";
  order: number;
  enabled: boolean;
  config: Record<string, any>;    // Stage-specific params
  condition?: string;             // When to run: "always", "if_compliance_rule", etc.
}
```

The orchestrator becomes **configuration-driven**: it reads the pipeline config
from Firestore, instantiates the appropriate agents in order, and executes them.
The agent can propose adding a new stage; the human approves.

**D. Agent Memory (Cross-Job Learning)**

```typescript
// Stored in Firestore: agentMemory/{userId}/insights/{insightId}
interface AgentInsight {
  id: string;
  type: "compliance_pattern" | "successful_structure" | "audience_preference"
      | "channel_optimization" | "failure_pattern";
  observation: string;           // What the agent noticed
  evidence: string[];            // Content IDs that support this
  confidence: number;            // 0-1
  appliedCount: number;          // How many times this insight was used
  successRate: number;           // Did it improve outcomes?
  createdAt: string;
  lastAppliedAt: string;
}
```

After each generation job, the agent evaluates: what worked? what didn't?
Insights are accumulated and injected into future prompts as additional context.

### Self-Extension Workflow

```
1. Agent detects pattern
   (e.g., "Pharmaceutical content fails compliance 73% of the time")

2. Agent proposes extension
   → Creates PromptTemplate doc with status: "draft"
   → Notifies user via messenger: "I noticed pharma content frequently fails
     compliance. I've created a specialized template that pre-incorporates
     FDA advertising guidelines. Want to review and activate it?"

3. Human reviews and approves
   → User reviews in web UI or replies "approve" in Slack
   → Status changes to "approved" → "active"

4. Agent uses the extension
   → Next pharma content generation uses the new template
   → Agent tracks outcomes (compliance scores, user edits)
   → Confidence score adjusts over time

5. Agent iterates
   → If the template improves scores, confidence goes up
   → If not, agent proposes modifications or retires the template
```

### Guardrails

1. **Human-in-the-loop** — every agent-proposed extension requires explicit approval
2. **Audit trail** — all proposals, approvals, and modifications logged
3. **Rollback** — any extension can be deactivated instantly (status → "disabled")
4. **Rate limiting** — agent can propose max N extensions per day
5. **Sandbox testing** — new templates can be tested on past content before activation
6. **No code execution** — extensions are data/config only, interpreted by existing code

---

## Implementation Roadmap

### Phase 0: Foundation (2-3 weeks)

Minimal changes to enable everything that follows.

**0.1 Configuration-driven orchestrator**

Refactor `orchestrator.ts` to read pipeline stages from a config object instead
of hardcoded sequence. Start with the same stages, just configurable:

```typescript
// Before: hardcoded stages
await runPlanner(campaignId, userId);
await generateText(plannerContext, ...);
await runComplianceCheck(contentDocs, ...);
await runAssetManager({ contentDocs, userId });

// After: config-driven
const stages = getDefaultPipelineStages(); // Same stages, from config
for (const stage of stages) {
  if (stage.condition && !evaluateCondition(stage.condition, context)) continue;
  const result = await executeStage(stage, context);
  context = mergeResult(context, result);
}
```

**0.2 Agent Memory collection**

Add `agentMemory` Firestore collection. After each job, write a brief evaluation:
what combinations worked, compliance scores, generation time.

**0.3 Notification collection + basic email**

Add `notifications` collection. Start with email notifications (Firebase
Extensions has a Send Email trigger). Messenger channels come in Phase 1.

### Phase 1: Messenger Presence (3-4 weeks)

**1.1** Deploy Cloud Run gateway with Slack adapter
**1.2** Intent parser (Gemini Flash)
**1.3** Action router → existing Cloud Functions
**1.4** Notification router (Firestore → Slack)
**1.5** Telegram adapter (stretch)

### Phase 2: Proactive Intelligence (2-3 weeks)

**2.1** `conditionRules` Firestore collection
**2.2** Scheduled Function (every 15 min) for condition evaluation
**2.3** Firestore onWrite triggers for instant reactions
**2.4** Condition rule management in Settings UI
**2.5** Cooldown/deduplication logic

### Phase 3: Self-Extension (4-6 weeks)

**3.1** `promptTemplates` collection + template injection in generator
**3.2** `contentTypes` collection + dynamic content type support
**3.3** Agent insight accumulation (post-job analysis)
**3.4** Proposal engine (agent proposes extensions based on patterns)
**3.5** Approval workflow (web UI + messenger approve/reject)
**3.6** Template effectiveness tracking

---

## What changes vs. what stays

### Stays exactly the same
- All existing Cloud Functions (no changes)
- Frontend web UI (additive only)
- Firestore security rules model
- Auth model (Firebase Auth)
- Billing/quota system
- Gemini SDK integration

### Gets extended
- Orchestrator (config-driven stages, same behavior)
- Generator (optional template injection, same core logic)
- Firestore collections (new: notifications, agentMemory, promptTemplates, conditionRules)

### New infrastructure
- Cloud Run gateway service (Pillar 1)
- Scheduled Function for conditions (Pillar 2)
- Agent insight writer (Pillar 3)

---

## Cost Analysis

| Component | Monthly Cost (estimated) |
|-----------|------------------------|
| Cloud Run gateway (min 1 instance) | $5-15 |
| Scheduled Function (every 15 min, ~2880 invocations) | < $1 |
| Gemini Flash for intent parsing (~1000 msgs/mo) | < $0.50 |
| Firestore reads for condition evaluation | < $1 |
| Firestore writes for memory/notifications | < $0.50 |
| **Total additional cost** | **~$8-18/month** |

This is negligible compared to the Gemini API costs for content generation.

---

## Risk Analysis

| Risk | Mitigation |
|------|-----------|
| Messenger API rate limits | Batch notifications, respect platform limits |
| Intent parsing errors | Fallback to "I don't understand, here's what I can do" |
| Self-extension quality | Human approval gate, sandbox testing, rollback |
| Increased Firestore reads | Efficient queries, caching in Cloud Run |
| Gateway availability | Cloud Run auto-restart, health checks |
| Agent proposes bad templates | Effectiveness tracking auto-disables low-performers |

---

## Conclusion

OpenClaw's **idea** — an AI that lives in your messengers, acts proactively,
and grows its own capabilities — is exactly right for a marketing platform.
But the **implementation** should be native to our Firebase/serverless stack:

- **Cloud Run** for messaging presence (not OpenClaw's Gateway)
- **Firebase Scheduled Functions** for proactivity (not OpenClaw's Heartbeat)
- **Firestore configuration documents** for self-extension (not runtime code generation)

The result: MarketGen transforms from a content generation tool into a
**marketing AI teammate** that learns, suggests, and acts — all within the
existing architecture's guardrails.
