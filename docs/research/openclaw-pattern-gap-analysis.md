# OpenClaw → MarketGen: Pattern-by-Pattern Gap Analysis

**Date:** 2026-02-15
**Source:** OpenClaw architecture analysis (CodeWiki, official docs, DeepWiki, source)
**Goal:** Map every OpenClaw architectural pattern to MarketGen — what already works, what needs changing, what's irrelevant

---

## How to Read This Document

Each section maps an OpenClaw architectural pattern to its MarketGen equivalent.

- **KEEP** — we already have this, it works well
- **ADD** — we don't have this, need to build it
- **REFACTOR** — we have something similar but it needs evolution
- **SKIP** — OpenClaw pattern doesn't apply to our architecture

---

## 1. KEEP — Already Works Well

### 1.1 Deterministic Orchestrator ≈ OpenClaw's Lobster Runtime

**OpenClaw:** Created Lobster specifically because LLM-based orchestration is too expensive
and unpredictable. Lobster is a typed, deterministic pipeline engine that replaces
multi-turn LLM orchestration with a single-call runtime.

**MarketGen:** `orchestrator.ts` is already a deterministic code controller — no LLM calls.
Runs Planner → Generator → Compliance → Asset Manager in a hardcoded sequence with
typed results flowing between stages.

**Comparison:**
```
OpenClaw Lobster:    skill1 | llm_task --schema=X | skill2 | approval_gate
MarketGen Pipeline:  runPlanner() → generateText() → runComplianceCheck() → runAssetManager()
```

Same concept. Our orchestrator IS the Lobster equivalent for marketing content.
OpenClaw built Lobster to avoid the exact problem we already avoided by design.

**Verdict:** KEEP as-is. The linear deterministic pipeline is the right pattern.
Later evolution (Phase 0 in proposal) makes it config-driven, but the core pattern stays.

---

### 1.2 AgentResult<T> ≈ OpenClaw Tool Call Results

**OpenClaw:** Every tool call returns a JSON result that gets appended to conversation
history. Success/failure is implicit in the response content.

**MarketGen:** `AgentResult<T>` — `{ success: boolean, data?: T, error?: string }`.
Typed generic with explicit success discriminator.

**Verdict:** KEEP. Our pattern is actually stronger — typed generics + explicit
success flag. OpenClaw relies on the LLM to interpret tool results; we use code
to branch on `success`.

---

### 1.3 Firestore State Bus ≈ JSONL + SQLite

**OpenClaw:** All state in local files: sessions in JSONL, memory in Markdown, index in
SQLite. Single-user, single-machine.

**MarketGen:** Firestore for all state: campaigns, products, content, jobs, users.
Multi-tenant, real-time subscriptions, serverless.

**Why ours is better for our use case:**
- Multi-tenant by design (security rules per userId)
- Real-time subscriptions (onSnapshot) for progress updates
- No file system dependency (serverless)
- Automatic scaling

**Verdict:** KEEP. Firestore >> JSONL for SaaS.

---

### 1.4 Dynamic Prompt Builder ≈ System Prompt Builder

**OpenClaw:** Builds system prompt every run from sections: Tooling, Safety, Skills,
Self-Update, Workspace, Documentation, Runtime. Three modes: full, minimal, none.

**MarketGen:** `buildGenerationPrompt(ctx)` / `buildRegenerationPrompt(...)` /
`buildCompliancePrompt(...)` — pure functions that assemble prompts from
PlannerContext fields, compliance rules, channel/audience combinations.

**Same pattern, different domain.** OpenClaw builds prompts for a general assistant;
we build prompts for marketing content generation.

**Verdict:** KEEP. Extend later (Phase 3) with template injection from Firestore.

---

### 1.5 Progress Writer ≈ Session Event Streaming

**OpenClaw:** Streams events through WebSocket Gateway to channel adapters.
Real-time feedback during tool execution.

**MarketGen:** `ProgressWriter` writes phase/progress/status to Firestore job docs.
Frontend subscribes via `onSnapshot` for real-time updates.

```
OpenClaw:   Agent → WebSocket → Channel → User sees progress
MarketGen:  Agent → Firestore write → onSnapshot → UI updates
```

**Verdict:** KEEP. onSnapshot is the serverless equivalent of WebSocket streaming.

---

### 1.6 Evaluator-Optimizer Loop ≈ Agentic Loop

**OpenClaw's Agentic Loop:** Model proposes tool call → execute → append result →
model evaluates → repeat until `end_turn` or max turns (20).

**MarketGen Compliance Loop:** Generator produces content → Compliance agent scores
each item → items scoring < 80 get feedback → Generator regenerates with feedback →
re-check. Max 2 retries.

```
OpenClaw:   LLM → tool call → result → LLM → tool call → ... → end_turn
MarketGen:  Generate → Check → [Fail?] → Regenerate with feedback → Re-check → ...
```

**Same evaluator-optimizer pattern.** Ours is domain-specific and deterministic
(the orchestrator decides to retry, not the LLM).

**Verdict:** KEEP.

---

### 1.7 Quota Enforcement ≈ Tool Policy

**OpenClaw:** Three-tier command safety: safe binaries allowlist → persistent exec
approvals → dangerous pattern detection. Tool Policy is the hard stop.

**MarketGen:** `enforceQuotaAndIncrement()` — atomic Firestore transaction checking
daily limit + incrementing count. `HttpsError("resource-exhausted")` when exceeded.

**Different domain** (usage limits vs tool safety) but **same gating concept**.
Both are mandatory checks before any work begins.

**Verdict:** KEEP.

---

### 1.8 Auth Model

**OpenClaw:** DM pairing with approval codes. Single-user. Unknown senders get
pairing code; owner approves via CLI.

**MarketGen:** Firebase Auth with security rules. Multi-tenant. `request.auth.uid`
on every Cloud Function.

**Verdict:** KEEP. Firebase Auth is the standard for multi-tenant SaaS.
No pairing codes needed — users sign in with email/password/OAuth.

---

## 2. ADD — New Components Needed

### 2.1 Channel Adapters [NEW]

**OpenClaw pattern:** Every channel (WhatsApp, Telegram, Slack, etc.) implements
`ChannelPlugin` interface. Inbound messages are normalized into a unified **envelope
format** (sender metadata, chat context, timestamp). Libraries: Baileys, grammY,
discord.js, Bolt, signal-cli.

**MarketGen today:** Only web UI. No messenger integration.

**What to build:**

```typescript
// gateway/src/types.ts
interface MessageEnvelope {
  channelType: "slack" | "telegram" | "discord" | "webchat";
  channelAccountId: string;       // Bot/app ID within the platform
  senderId: string;               // Platform-specific sender ID
  firebaseUid?: string;           // Resolved after auth mapping
  chatId: string;                 // Conversation/channel/DM ID
  text: string;                   // Normalized message text
  attachments?: Attachment[];     // Images, files
  timestamp: Date;
  replyToMessageId?: string;
  metadata: Record<string, any>;  // Platform-specific extras
}

// gateway/src/adapters/adapter.ts
interface ChannelAdapter {
  readonly channelType: string;
  initialize(config: ChannelConfig): Promise<void>;
  onMessage(handler: (envelope: MessageEnvelope) => Promise<void>): void;
  sendMessage(chatId: string, response: AgentResponse): Promise<void>;
  shutdown(): Promise<void>;
}
```

**Start with:** Slack (Bolt SDK — enterprise), Telegram (grammY — easiest to demo).

**Key difference from OpenClaw:** OpenClaw normalizes for a general assistant.
Our envelopes carry marketing context (campaign references, content IDs, approval actions).

---

### 2.2 Intent Parser [NEW]

**OpenClaw pattern:** No explicit intent parser — the LLM naturally interprets user
messages in the agentic loop (multi-turn conversation with tool calls).

**MarketGen approach:** Single Gemini Flash call to classify into structured intents.
Marketing-specific, not general-purpose.

**Why different from OpenClaw:** OpenClaw's agentic loop costs 5-20+ LLM calls per
interaction (tool call cycles). For marketing commands that map to known actions,
a single classification call is 100x cheaper and faster.

```typescript
// gateway/src/intent.ts
type MarketingIntent =
  | { action: "generate"; campaignId: string; channels?: string[] }
  | { action: "approve"; contentIds: string[] }
  | { action: "reject"; contentId: string; reason: string }
  | { action: "revise"; contentId: string; feedback: string }
  | { action: "status"; campaignId?: string }
  | { action: "create_campaign"; description: string }
  | { action: "list"; entity: "campaigns" | "content" | "products" }
  | { action: "check_compliance"; target: string; ruleId: string }
  | { action: "help" }
  | { action: "unknown"; rawText: string };

async function parseIntent(text: string, userId: string): Promise<MarketingIntent> {
  // Single Gemini Flash call with structured output schema
  // Cost: ~0.001 cents per message
}
```

**Fallback for "unknown":** Forward to a conversational mode (like OpenClaw's
agentic loop) for freeform marketing questions. But 90%+ of interactions should
be classifiable intents.

---

### 2.3 Messenger Sessions [NEW]

**OpenClaw pattern:**
- Session scoping: `main` / `per-peer` / `per-channel-peer`
- JSONL transcripts: one line per message, append-only, crash-safe
- Identity links: cross-channel user merging
- Lifecycle: daily reset at 4 AM, idle reset, `/stop`, `/new`
- Context window guard: auto-compaction at ~80% of context window

**MarketGen approach:** Simpler. We need conversational context for messenger
interactions, but our conversations are shorter and more transactional.

```typescript
// Firestore: messengerSessions/{sessionId}
interface MessengerSession {
  userId: string;
  channelType: string;
  chatId: string;
  messages: SessionMessage[];      // Last N messages (ring buffer, max ~50)
  activeContext?: {
    campaignId?: string;           // "We're talking about this campaign"
    contentIds?: string[];         // "We're reviewing these items"
    lastAction?: string;           // "Last thing we did"
  };
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  expiresAt: Timestamp;            // Auto-cleanup after 24h idle
}
```

**What we DON'T need from OpenClaw:**
- Identity links — Firebase Auth handles identity (one UID across channels)
- JSONL transcripts — Firestore documents are simpler and cloud-native
- Context window guard — our sessions are short (max ~50 messages before natural reset)
- Auto-compaction — sessions expire after 24h idle instead

---

### 2.4 Agent Memory [NEW]

**OpenClaw pattern:**
- `MEMORY.md` — durable facts, decisions, preferences
- `memory/YYYY-MM-DD.md` — daily notes
- Hybrid search: 70% vector + 30% BM25 over all Markdown files
- SQLite index with embedding cache (LRU, 50K entries)
- File watcher with 1.5s debounce for re-indexing

**MarketGen approach:** Domain-specific memory. We don't need general-purpose
recall; we need marketing pattern recognition.

```typescript
// Firestore: agentMemory/{userId}/insights/{insightId}
interface AgentInsight {
  type: "compliance_pattern" | "successful_structure" | "audience_pref"
      | "channel_optimization" | "tone_preference";
  observation: string;            // "Pharma content fails compliance 73% of the time"
  evidence: {
    contentIds: string[];
    complianceScores: number[];
    jobIds: string[];
  };
  confidence: number;             // 0-1, increases with more evidence
  appliedCount: number;
  successRate: number;
  createdAt: Timestamp;
  lastAppliedAt: Timestamp;
}
```

**What we DON'T need from OpenClaw:**
- Vector search / BM25 — our insights are structured data, not free text
- SQLite index — Firestore queries are sufficient
- File watcher — Firestore triggers handle reactivity
- Daily notes — our "daily notes" are job completion records

**What we BORROW:**
- The concept of persistent memory that accumulates over time
- The idea of injecting relevant memory into prompts (OpenClaw loads MEMORY.md
  into system prompt; we inject matching insights into generation prompts)

---

### 2.5 Proactive Automation [NEW]

**OpenClaw pattern:**
- **Heartbeat:** Every N minutes, agent reads `HEARTBEAT.md`, evaluates conditions,
  responds `HEARTBEAT_OK` (silent) or messages user. Full LLM call each time.
  Cost: ~$5-30/day on Claude Opus.
- **Cron:** Three patterns (at, every, cron expression). Persisted in `~/.openclaw/cron/`.
  Isolated jobs run in fresh sessions.
- **Webhooks:** External events enter a session, process through agentic loop.
- **Hooks:** Internal events (command issued, agent start, gateway start).

**MarketGen approach:** Firebase-native, much cheaper.

```
OpenClaw Heartbeat (~$5-30/day):
  Every 30 min → full LLM call → evaluate HEARTBEAT.md → respond

MarketGen Condition Evaluator (~$0.01/day):
  Every 15 min → Cloud Function → Firestore queries → evaluate rules → notify if triggered
```

**Key insight:** OpenClaw uses the LLM to evaluate conditions because it's a
general-purpose assistant (the conditions could be anything). Our conditions are
**domain-specific and structured** — we can evaluate them with code, no LLM needed.

```typescript
// Firestore: conditionRules/{ruleId}
interface ConditionRule {
  id: string;
  userId: string;
  type: "deadline_approaching" | "compliance_drift" | "stale_content"
      | "missing_content" | "product_updated" | "quota_warning";
  enabled: boolean;
  params: {
    daysBeforeDeadline?: number;    // deadline_approaching
    maxDaysWithoutReview?: number;  // stale_content
    minComplianceScore?: number;    // compliance_drift
  };
  cooldownMinutes: number;
  notifyChannels: string[];         // ["slack", "email"]
  lastTriggeredAt?: Timestamp;
}
```

**Implementation:**
- `onSchedule("every 15 minutes")` Cloud Function for periodic checks
- `onDocumentUpdated("complianceRules/{ruleId}")` for instant reaction to rule changes
- `onDocumentCreated("products/{productId}")` for new product alerts
- Deduplication via `lastTriggeredAt` + `cooldownMinutes`

**What we DON'T need from OpenClaw:**
- HEARTBEAT.md file — our conditions are Firestore documents
- LLM evaluation — our conditions are structured rules evaluated with code
- Cron expression parser — Firebase Scheduler handles this
- Job persistence in filesystem — Firestore handles persistence

**What we BORROW:**
- The concept of periodic condition evaluation (Heartbeat)
- Silent pass-through when all conditions are OK
- Cooldown/deduplication to avoid alert fatigue

---

### 2.6 Notification Router [NEW]

**OpenClaw pattern:** Agent sends messages through channel adapters naturally.
The same channel that received the message is used for the response.

**MarketGen approach:** Separate notification system that routes alerts to
user-preferred channels.

```typescript
// gateway/src/notifications.ts
interface NotificationRouter {
  // Watch Firestore for events that need user notification
  startWatching(): void;

  // Route a notification to the user's preferred channels
  notify(userId: string, notification: Notification): Promise<void>;
}

interface Notification {
  type: "job_complete" | "job_failed" | "compliance_alert"
      | "deadline_warning" | "approval_needed" | "quota_warning";
  title: string;
  body: string;
  actionUrl?: string;              // Deep link to web UI
  data?: Record<string, any>;
}
```

**Watches:**
- `generationJobs` — status changes to "completed" or "failed"
- `notifications` — condition evaluator writes here when triggered
- `content` — compliance score drops below threshold

---

## 3. REFACTOR — Needs Evolution

### 3.1 Config-Driven Pipeline [REFACTOR orchestrator.ts]

**OpenClaw pattern:**
- Plugins register capabilities via `openclaw.plugin.json`
- Gateway hot-reloads configuration from `openclaw.json`
- Skills are selectively injected per-turn based on relevance
- Tool groups can be enabled/disabled per agent

**MarketGen today:** Hardcoded stage sequence in `orchestrator.ts`.

**Target:**

```typescript
// Functions read this from Firestore or default config
interface PipelineConfig {
  stages: StageConfig[];
}

interface StageConfig {
  id: string;
  type: "planner" | "generator" | "compliance" | "asset_manager"
      | "tone_adjuster" | "localization" | "ab_variant";
  enabled: boolean;
  order: number;
  condition?: "always" | "if_compliance_rule" | "if_time_budget";
  config?: Record<string, any>;
}

// Default config = exactly current behavior
const DEFAULT_PIPELINE: PipelineConfig = {
  stages: [
    { id: "planner", type: "planner", enabled: true, order: 1, condition: "always" },
    { id: "generator", type: "generator", enabled: true, order: 2, condition: "always" },
    { id: "compliance", type: "compliance", enabled: true, order: 3, condition: "if_compliance_rule" },
    { id: "assets", type: "asset_manager", enabled: true, order: 4, condition: "if_time_budget" },
  ],
};
```

**Change is minimal:** Same agents, same logic, just driven by config instead of
hardcoded sequence. This enables Phase 3 (agent proposes new stages).

---

### 3.2 Prompt Template Injection [REFACTOR generator.ts]

**OpenClaw pattern:**
- Skills are `SKILL.md` files with YAML frontmatter
- Skills are discovered from multiple sources and merged into a registry
- Per-session snapshots cache available skills
- Relevant skills injected into system prompts on-demand
- ClawHub: 5,705+ community skills, vector-based discovery, auto-install

**MarketGen approach:** Prompt templates stored in Firestore (not markdown files),
injected into generation prompts when they match channel/audience criteria.

```typescript
// Current: generator.ts line 40
const prompt = buildGenerationPrompt(ctx);

// After: inject matching templates
const templates = await getMatchingTemplates(ctx.combinations);
const prompt = buildGenerationPrompt(ctx, templates);  // templates add guidance sections
```

**In `buildGenerationPrompt`:**
```typescript
export function buildGenerationPrompt(ctx: PlannerContext, templates?: PromptTemplate[]): string {
  // ... existing prompt ...

  let templateGuidance = "";
  if (templates && templates.length > 0) {
    templateGuidance = `
    ADDITIONAL GUIDANCE (from learned templates):
    ${templates.map(t => `- ${t.name}: ${t.systemContext}\n  Tone: ${t.toneGuidance}`).join("\n    ")}
    `;
  }

  return `... ${templateGuidance} ...`;
}
```

**Key difference from OpenClaw:** OpenClaw skills are general tools (browser, cron, etc.).
Our templates are marketing-specific content guidance. But the injection pattern is identical.

---

## 4. SKIP — Not Applicable

### 4.1 Single Process Gateway Model → SKIP

**OpenClaw:** One Node.js process handles everything. Simplifies deployment and state.

**Why skip:** We're serverless. Cloud Functions scale per-request. Cloud Run for
the gateway gives us always-on + auto-scaling. Running everything in one process
would eliminate the benefits of serverless (per-request billing, auto-scaling,
zero-ops).

---

### 4.2 Lane Queue / Serial Execution → SKIP

**OpenClaw:** `enqueueCommandInLane()` serializes execution per session. Prevents
race conditions from concurrent messages to the same session.

**Why skip:** Cloud Functions are inherently isolated (one invocation = one
execution context). Our job lock mechanism (`createJobIfNoActive`) already
prevents concurrent generation for the same campaign.

---

### 4.3 Context Window Guard / Auto-Compaction → SKIP

**OpenClaw:** Monitors token count, triggers compaction at ~80% capacity. Splits
messages at midpoint, summarizes older half, preserves key facts.

**Why skip:** Our pipeline runs are short (max 540s) with focused prompts. No
long-running conversations that would approach context limits. The gateway's
messenger sessions would need this eventually, but with a 50-message ring buffer
and 24h expiry, we naturally avoid overflow.

---

### 4.4 Docker Sandboxing → SKIP

**OpenClaw:** Per-agent or per-session container isolation for tool execution.
Safe binaries allowlist, dangerous pattern detection.

**Why skip:** Cloud Functions run in Google's sandbox. Our agents don't execute
arbitrary code — they call Gemini API and write to Firestore. No exec surface
to sandbox.

---

### 4.5 Browser Automation / Accessibility Tree → SKIP

**OpenClaw:** Playwright-based browser control with accessibility tree snapshots
instead of screenshots (~100x fewer tokens).

**Why skip:** Not relevant. We generate marketing content, we don't navigate web pages.

---

### 4.6 Voice Mode → SKIP

**Why skip:** Marketing content management is text-based. Voice adds complexity
without clear value for the core use case.

---

### 4.7 Model Resolver with Fallback Chains → SKIP (for now)

**OpenClaw:** Auth profile rotation, cooldown/fallback chains, exponential backoff
across providers.

**Why skip:** We use Gemini Flash exclusively, via a single API key. If we add
multi-model support later (e.g., Claude for compliance, GPT for creative copy),
this pattern becomes relevant. For now, overkill.

---

### 4.8 Nix Plugin Integration → SKIP

**Why skip:** Development tooling concern, not relevant to our deployment model.

---

### 4.9 QMD Search Sidecar → SKIP

**Why skip:** Local-first search tool using Bun + node-llama-cpp. We use Firestore
queries. No local models needed.

---

## 5. Summary: Change Effort Matrix

### Components by status:

| # | Component | Status | OpenClaw Equivalent | Effort |
|---|-----------|--------|-------------------|--------|
| 1 | Deterministic orchestrator | **KEEP** | Lobster runtime | — |
| 2 | AgentResult<T> pattern | **KEEP** | Tool call results | — |
| 3 | Firestore state bus | **KEEP** | JSONL + SQLite | — |
| 4 | Dynamic prompt builder | **KEEP** | System prompt builder | — |
| 5 | Progress writer | **KEEP** | Session event streaming | — |
| 6 | Compliance retry loop | **KEEP** | Agentic loop | — |
| 7 | Quota enforcement | **KEEP** | Tool policy | — |
| 8 | Firebase Auth | **KEEP** | DM pairing | — |
| 9 | Channel adapters | **ADD** | ChannelPlugin interface | Medium |
| 10 | Intent parser | **ADD** | (implicit in agentic loop) | Low |
| 11 | Messenger sessions | **ADD** | Session management | Medium |
| 12 | Agent memory | **ADD** | MEMORY.md + hybrid search | Medium |
| 13 | Proactive evaluator | **ADD** | Heartbeat + Cron | Medium |
| 14 | Notification router | **ADD** | (built into channels) | Low |
| 15 | Config-driven pipeline | **REFACTOR** | Plugin config + hot-reload | Medium |
| 16 | Prompt template injection | **REFACTOR** | Skills system | Low |
| 17 | Single process model | **SKIP** | Gateway process | — |
| 18 | Lane queue | **SKIP** | Command queue | — |
| 19 | Context window guard | **SKIP** | Auto-compaction | — |
| 20 | Docker sandboxing | **SKIP** | Sandbox mode | — |
| 21 | Browser automation | **SKIP** | Playwright + a11y tree | — |
| 22 | Voice mode | **SKIP** | ElevenLabs integration | — |
| 23 | Model resolver | **SKIP** | Fallback chains | — |

**Score: 8 KEEP, 6 ADD, 2 REFACTOR, 7 SKIP**

Our foundation is solid. ~35% of OpenClaw's patterns already exist in MarketGen
in equivalent or stronger form. ~35% need to be built new. ~9% need refactoring.
~30% don't apply to our architecture.

---

## 6. Recommended Build Order

Based on dependencies and incremental value:

```
Phase 0 (Foundation):
  ├── 15. Config-driven pipeline (REFACTOR)    ← enables Phase 3
  ├── 12. Agent memory collection (ADD)         ← enables learning
  └── 16. Prompt template injection (REFACTOR)  ← enables self-extension

Phase 1 (Messenger Presence):
  ├── 9.  Channel adapters: Slack + Telegram (ADD)
  ├── 10. Intent parser (ADD)
  ├── 11. Messenger sessions (ADD)
  └── 14. Notification router (ADD)

Phase 2 (Proactive Intelligence):
  └── 13. Proactive condition evaluator (ADD)

Phase 3 (Self-Extension):
  ├── Agent proposes new prompt templates (uses 12 + 16)
  ├── Agent proposes new pipeline stages (uses 15)
  └── Human-in-the-loop approval workflow
```
