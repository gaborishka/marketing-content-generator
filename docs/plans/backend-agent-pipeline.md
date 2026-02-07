# Plan: Move Orchestration to Backend with Agent Pipeline

## Context

Currently the content generation flow is orchestrated on the frontend (`geminiService.ts` builds prompts, calls Cloud Functions one-by-one, manages the async image loop via callbacks). The backend has 3 stateless Cloud Functions (`generateContent`, `generateImage`, `generateVideo`) that are thin wrappers around the Gemini SDK with no inter-function communication.

**Goal:** Move all orchestration to the backend with a multi-agent architecture following Anthropic's Orchestrator-Workers + Evaluator-Optimizer patterns. The frontend should call one endpoint and receive realtime updates via Firestore.

---

## Technology Decision: Custom Lightweight Pipeline (No Framework)

**No LangChain, no Google ADK. Plain TypeScript + @google/genai.**

- **LangChain/LangGraph**: Heavy abstractions, 50+ transitive deps, cold start penalty. The pipeline is **deterministic** — no LLM decides which agent to call — so graph-based routing adds complexity without value. We'd use <5% of the library.
- **Google ADK**: Requires **Node.js 24.13+** — Firebase Functions only supports Node 20. Would force Cloud Run migration. Very new (Dec 2025).
- **Custom**: Already using `@google/genai` directly — zero new dependencies. Full control over retries, timeouts, costs. No framework lock-in; can adopt ADK later when Node 24+ reaches Firebase.

---

## Architecture Pattern: Hybrid of Anthropic's Patterns

From [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents):
- **Orchestrator-Workers** — orchestrator delegates to planner, generator, asset manager
- **Evaluator-Optimizer loop** — compliance agent evaluates → rejects → generator refines

From [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents):
- Each agent gets **minimal, focused context** — not the full campaign dump (prevents context rot)
- Clear, non-overlapping agent boundaries — each agent has one job
- Structured output schemas constrain each agent's response format

From [Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system):
- Clear delegation with objective, output format, and boundaries per agent
- Parallel execution for image generation
- Progress reporting via Firestore (realtime UX)

---

## System Diagram

```
FE: single call                          Firebase Cloud Functions
─────────────────                    ──────────────────────────────────

generateCampaignContent() ──────────► ORCHESTRATOR (code-based controller)
                                      Controls flow, retries, progress, state
  ◄── { jobId } returned instantly         │
                                     ┌─────┴──────────────┐
  onSnapshot(generationJobs/{jobId}) │                     │
  onSnapshot(content where campaign) ▼                     ▼
                                ┌──────────┐    ┌───────────────────┐
                                │ PLANNER  │    │  Future agents    │
                                │ (code +  │    │  plug in here     │
                                │ optional │    └───────────────────┘
                                │ LLM)     │
                                └────┬─────┘
                                     │ PlannerContext
                                     ▼
                                ┌──────────────────┐
                                │    GENERATOR     │
                                │ (Gemini Flash)   │◄───── feedback ──┐
                                │ Text gen only    │  with specific   │
                                └────┬─────────────┘  violations      │
                                     │ content items                  │
                                     ▼                                │
                                ┌──────────────────┐                  │
                                │   COMPLIANCE     │ score < 80%      │
                                │ (Gemini Flash)   │──────────────────┘
                                │ Separate eval    │  (max 2 retries)
                                └────┬─────────────┘
                                     │ score >= 80% ✓
                                     ▼
                                ┌──────────────────┐
                                │  ASSET MANAGER   │
                                │ (code, no LLM)   │
                                │ Images parallel  │
                                │ Upload → Storage │
                                │ Persist → FS     │
                                └──────────────────┘
```

---

## Trigger + Processor Split

`onCall` functions block until return. A 2-minute pipeline would mean the FE waits 2 minutes for the HTTP response. Solution:

- **`generateCampaignContent`** (onCall, 30s timeout) — validates input, creates job doc in Firestore, returns `{ jobId }` instantly (~1s)
- **`processGenerationJob`** (onDocumentCreated trigger on `generationJobs/{jobId}`, 540s timeout) — runs the full agent pipeline

Frontend subscribes to Firestore for realtime progress and content updates.

---

## Agent Specifications

### 1. Orchestrator (`functions/src/agents/orchestrator.ts`) — Code, not LLM

Per Anthropic: *"Start with workflows (deterministic), upgrade to agents (dynamic) only when simpler solutions fall short."*

The orchestrator is pure code because the flow is deterministic — there's no decision about which agents to call. It always runs: Planner → Generator → Compliance → (retry?) → Asset Manager.

**Responsibilities:**
- Receive job data (campaignId, userId) from Firestore trigger
- Call agents in sequence, pass typed results between them
- Manage the compliance retry loop (max 2 iterations)
- Write progress to Firestore at each stage
- Track timeout budget — skip image gen if <120s remains
- Handle errors: write partial results, mark job as failed only on unrecoverable errors

**Future upgrade path:** If dynamic routing is needed later (e.g., "should I generate storyboards or static images for this channel?"), swap the code orchestrator for an LLM orchestrator with tool-calling.

### 2. Planner (`functions/src/agents/planner.ts`) — Code + Optional LLM Summarization

Per Anthropic Context Engineering: *"Find the smallest possible set of high-signal tokens that maximize the desired outcome."*

**Input:** `{ campaignId, userId }`
**Output:** `PlannerContext` — assembled, minimal context for downstream agents

**Steps:**
1. Fetch campaign from Firestore
2. Fetch primary product + secondary products
3. Fetch compliance rule (if `campaign.complianceRuleId` set)
4. Fetch existing content for this campaign (deduplication)
5. [Optional LLM] If product descriptions are very long, summarize to key marketing attributes
6. Build channel × audience combinations (cap at 6, skip existing combos)
7. Return structured `PlannerContext`

```typescript
interface PlannerContext {
  campaign: { name: string; description: string; keyMessage: string; context: string };
  primaryProduct?: { name: string; brand: string; description: string; features: string[]; marketingTags: string[] };
  secondaryProducts: { name: string; brand: string }[];
  complianceRule?: { name: string; ruleText: string };
  combinations: { channel: string; audience: string }[];
  existingCombinations: { channel: string; audience: string }[];
}
```

**Key design:** Planner distills exactly what downstream agents need — no campaign IDs, dates, budgets, or other irrelevant fields. Per Anthropic: *"Each new token depletes the attention budget."*

### 3. Generator (`functions/src/agents/generator.ts`) — LLM (Gemini Flash for text)

**Input:** `PlannerContext` + optional `ComplianceFeedback[]`
**Output:** Content items written to Firestore

**`generateText()`:**
- Build focused prompt from `PlannerContext` (NOT the raw campaign object)
- Call Gemini `gemini-3-flash-preview` with structured JSON schema
- Parse response, write content docs to Firestore collection

**`regenerateText()`:**
- For compliance-failed items only
- Injects specific violations + suggestedFix into the prompt
- "Previous attempt scored 65/100. Feedback: [specific issues]. Please revise."

Prompt templates live in `functions/src/prompts/generator.prompt.ts` — separated from logic.

### 4. Compliance Evaluator (`functions/src/agents/compliance.ts`) — LLM (Gemini Flash)

Anthropic's **Evaluator-Optimizer** pattern applied directly. *"One LLM generates, another evaluates and provides feedback in a loop."*

**Input:** Content item IDs + ComplianceRule
**Output:** `ComplianceResult[]` per item

For each content item, makes a **separate focused Gemini call**:
```
"Evaluate this [channel] content against these compliance rules: [ruleText]"
"Content: [text]"
→ Return: { score, pass, violations[], suggestedFix }
```

```typescript
interface ComplianceResult {
  contentId: string;
  score: number;           // 0-100
  pass: boolean;           // score >= 80
  feedback: string;        // "The claim 'best in class' lacks substantiation..."
  violations: string[];    // ["Unsubstantiated superlative", "Missing disclaimer"]
  suggestedFix?: string;   // "Replace 'best in class' with 'industry-leading'..."
}
```

Prompt template in `functions/src/prompts/compliance.prompt.ts`.

### 5. Asset Manager (`functions/src/agents/assetManager.ts`) — Code, no LLM

**Input:** Content item IDs from Firestore
**Output:** Images uploaded to Storage, content docs updated with URLs

**Steps:**
1. For each content item (parallel, `Promise.allSettled` with concurrency limit of 3):
   - Regular channels: generate 1 hero image via Gemini `gemini-3-pro-image-preview`
   - Video Storyboard: generate 3 scene images
   - Upload base64 → Firebase Storage (`users/{uid}/content/{contentId}/`)
   - Update Firestore content doc with Storage download URL
2. Each completed image is immediately visible to frontend via Firestore listener
3. Image failures are non-blocking — content item remains valid with empty `imageUrl`

---

## Firestore Structure

```
/generationJobs/{jobId}
  userId: string
  campaignId: string
  status: 'pending' | 'planning' | 'generating' | 'compliance_check' | 'retrying' |
          'generating_images' | 'completed' | 'failed'
  progress: number (0-100)
  phase: string                // "Gathering context...", "Generating copy...", etc.
  contentIds: string[]
  itemsCompleted: number
  itemsTotal: number
  retryCount: number
  error?: string
  createdAt, updatedAt, completedAt

/content/{contentId}  (existing collection — extended)
  ... all existing fields (text, channel, audience, imageUrl, etc.) ...
  generationJobId: string      // NEW: back-reference to job
  complianceDetails?: {        // NEW: from compliance agent
    score: number
    violations: string[]
    suggestions: string[]
    suggestedFix?: string
    retryAttempt: number
  }
```

---

## File Structure

### Backend
```
functions/src/
  index.ts                        # Cloud Function exports (2 new + existing 3)
  agents/
    orchestrator.ts               # Pipeline controller (pure TS control flow)
    planner.ts                    # Context assembly from Firestore
    generator.ts                  # Text generation via Gemini Flash
    compliance.ts                 # Evaluator-optimizer via Gemini Flash
    assetManager.ts               # Image generation + Storage upload
  prompts/
    generator.prompt.ts           # Prompt templates for text generation
    compliance.prompt.ts          # Prompt templates for compliance evaluation
  types/
    pipeline.ts                   # PlannerContext, ComplianceResult, AgentResult, JobStatus
  utils/
    gemini.ts                     # Gemini client singleton
    firestore.ts                  # Firestore read/write helpers
    storage.ts                    # Firebase Storage upload helpers
    timeout.ts                    # Timeout budget utility
    progress.ts                   # Firestore progress writer
```

### Frontend
```
services/
  orchestrationService.ts         # NEW: startGeneration() + subscribeToJob() + subscribeToContent()
  geminiService.ts                # SIMPLIFIED: remove generateMarketingContent, keep generateVideoFromStoryboard
components/
  CampaignDetail.tsx              # MODIFIED: handleGenerateMore calls orchestrationService instead
```

---

## Key Source to Reuse

| What | Current Location | Reuse In |
|------|-----------------|----------|
| Context building (products, compliance block) | `services/geminiService.ts:84-154` | `agents/planner.ts` |
| Prompt construction + response schema | `services/geminiService.ts:132-180` | `prompts/generator.prompt.ts` |
| Image generation call | `services/geminiService.ts:28-58` | `agents/assetManager.ts` |
| Gemini client factory | `functions/src/index.ts:43` | `utils/gemini.ts` |
| Storage upload pattern | `functions/src/index.ts:236-251` | `utils/storage.ts` |

---

## Anti-Patterns to Avoid (from Anthropic articles)

- **Don't make the orchestrator an LLM** — the flow is deterministic, an LLM deciding "call planner next" wastes tokens
- **Don't share full context between agents** — Planner distills context; Compliance only sees content + rules
- **Don't spawn unbounded retries** — cap at 2 compliance retries
- **Don't add LangChain/ADK yet** — "Start simple, add complexity only when simpler solutions fall short"

---

## Cost Estimate

- Current (FE orchestrated): ~8K tokens (1 text gen call)
- With compliance loop: ~16K tokens worst case (text + 2 compliance evals + 1 retry)
- Acceptable given the value of compliance-validated marketing content

---

## Implementation Phases

### Phase 1: Foundation — Types, Utilities, Infrastructure

- [x] Create `functions/src/types/pipeline.ts` — `PlannerContext`, `AgentResult<T>`, `ComplianceResult`, `JobStatus` interfaces
- [x] Create `functions/src/utils/gemini.ts` — Gemini client singleton (extract from `functions/src/index.ts:43`)
- [x] Create `functions/src/utils/firestore.ts` — helpers for reading campaign/products/rules, writing content docs
- [x] Create `functions/src/utils/storage.ts` — image upload to Firebase Storage (extract pattern from `functions/src/index.ts:236-251`)
- [x] Create `functions/src/utils/timeout.ts` — time-budget checker for long-running pipeline
- [x] Create `functions/src/utils/progress.ts` — Firestore progress writer for job status updates
- [x] Update `firestore.rules` — add `generationJobs` collection (read-only for auth owner, no client writes)
- [x] Update `types.ts` (frontend) — extend `GeneratedContent` with `generationJobId`, `complianceDetails`

### Phase 2: Planner + Generator Agents

- [x] Create `functions/src/prompts/generator.prompt.ts` — prompt templates extracted from `services/geminiService.ts:132-180`
- [x] Create `functions/src/agents/planner.ts` — context assembly from Firestore (extract logic from `services/geminiService.ts:84-154`)
  - [x] Fetch campaign, products, compliance rule from Firestore
  - [x] Fetch existing content for deduplication
  - [x] Build channel × audience combinations (cap at 6, skip existing combos)
  - [x] Return typed `PlannerContext` with minimal, focused context
- [x] Create `functions/src/agents/generator.ts` — text generation via Gemini Flash
  - [x] `generateText()` — build prompt from PlannerContext, call Gemini, parse JSON, write content docs to Firestore
  - [x] Structured JSON schema for response (channel, audience, text, complianceScore, riskLevel, storyboard)
- [x] Verify: planner reads correct data, generator produces content docs in Firestore

### Phase 3: Orchestrator + Cloud Function Entry Points

- [x] Create `functions/src/agents/orchestrator.ts` — pipeline controller (plan → generate)
  - [x] Sequential agent flow: call planner, pass PlannerContext to generator
  - [x] Progress updates to job doc at each stage
  - [x] Error handling: write partial results, mark job as failed on unrecoverable errors
  - [x] Timeout budget management (check remaining time before each stage)
- [x] Update `functions/src/index.ts` — add 2 new function exports:
  - [x] `generateCampaignContent` (onCall, 30s) — validate input, create job doc, return `{ jobId }`
  - [x] `processGenerationJob` (onDocumentCreated on `generationJobs/{jobId}`, 540s) — invoke orchestrator
- [x] Keep existing `generateContent`, `generateImage`, `generateVideo` functions for backward compat
- [x] Build and deploy: `cd functions && npm run build`
- [x] Test with emulator: `firebase emulators:start --only functions,firestore`

### Phase 4: Compliance Evaluator-Optimizer Loop

- [ ] Create `functions/src/prompts/compliance.prompt.ts` — evaluation prompt template (separate from generation)
- [ ] Create `functions/src/agents/compliance.ts` — compliance evaluator
  - [ ] Separate Gemini Flash call per content item (not self-evaluation)
  - [ ] Structured output: score, pass/fail, violations[], suggestedFix
  - [ ] Return `ComplianceResult[]` with actionable feedback
- [ ] Add `regenerateText()` to `generator.ts`
  - [ ] Accept ComplianceFeedback[] parameter
  - [ ] Inject specific violations + suggestedFix into the regeneration prompt
  - [ ] Only regenerate failed items (not the full batch)
- [ ] Wire compliance loop into orchestrator
  - [ ] After text generation: run compliance check
  - [ ] If any item scores < 80%: call `regenerateText()` with feedback
  - [ ] Max 2 retries per item, then accept with best score achieved
  - [ ] Update progress/phase in job doc for each loop iteration
- [ ] Add `complianceDetails` field to content docs in Firestore
- [ ] Test: create strict compliance rule, verify items are regenerated with feedback

### Phase 5: Asset Manager — Server-Side Image Generation

- [ ] Create `functions/src/agents/assetManager.ts`
  - [ ] Read content items from Firestore
  - [ ] Generate images in parallel (`Promise.allSettled`, concurrency limit of 3)
  - [ ] Regular channels: 1 hero image via Gemini `gemini-3-pro-image-preview`
  - [ ] Video Storyboard: 3 scene images per storyboard
  - [ ] Upload base64 → Firebase Storage (`users/{uid}/content/{contentId}/`)
  - [ ] Update each Firestore content doc with Storage download URL immediately
  - [ ] Non-blocking failures: content item remains valid with empty `imageUrl`
- [ ] Wire asset manager into orchestrator (after compliance loop)
  - [ ] Check timeout budget: skip image gen if <120s remains
  - [ ] Update progress per completed image
- [ ] Test: verify images appear one-by-one via Firestore listener

### Phase 6: Frontend Integration

- [ ] Create `services/orchestrationService.ts`
  - [ ] `startGeneration(campaignId)` — call `generateCampaignContent`, return jobId
  - [ ] `subscribeToJob(jobId, callback)` — Firestore onSnapshot for progress/status
  - [ ] `subscribeToContent(campaignId, callback)` — Firestore onSnapshot for content updates
- [ ] Modify `components/CampaignDetail.tsx`
  - [ ] Replace `handleGenerateMore` to call `startGeneration` instead of direct `generateMarketingContent`
  - [ ] Subscribe to job doc for progress bar/status display
  - [ ] Subscribe to content collection — replace placeholder-then-fill pattern with Firestore-driven updates
  - [ ] Handle job states: show progress during generation, error message on failure
- [ ] Test E2E: click "Generate New Variants" →
  - [ ] jobId returned instantly (not blocking on pipeline)
  - [ ] Progress updates appear in real-time
  - [ ] Content cards appear as text is generated
  - [ ] Images fill in one-by-one via Asset Manager
  - [ ] Compliance scores reflect separate evaluation (not self-reported)

### Phase 7: Cleanup + Future-Proofing

- [ ] Simplify `services/geminiService.ts` — remove `generateMarketingContent` + `mockGeneration` (keep `generateVideoFromStoryboard`)
- [ ] Remove `onImageUpdate` callback pattern from frontend
- [ ] Add Firestore composite index for `content` queries by `campaignId` + `userId`
- [ ] Add Firestore composite index for `generationJobs` queries by `campaignId` + `userId`
- [ ] Test error recovery: simulate Gemini API failure → verify job marked as failed with error
- [ ] Test timeout: generate with many items → verify image phase skipped if <120s remains
- [ ] Document agent registry pattern for future agents (A/B testing, localization, tone adjustment)

---

## Verification Checklist

- [ ] `cd functions && npm run build` — compiles without errors
- [ ] `firebase emulators:start --only functions,firestore` — emulator starts successfully
- [ ] Generate content → jobId returned in <2s
- [ ] Firestore job doc updates in real-time (status, progress, phase)
- [ ] Content docs appear in Firestore as text is generated
- [ ] Images upload to Storage and URLs appear in content docs
- [ ] Compliance loop: strict rule → items <80% regenerated with feedback
- [ ] Compliance loop: max 2 retries respected, remaining items flagged
- [ ] Error recovery: API failure → job status = 'failed' with error message
- [ ] Timeout safety: long generation → image phase skipped if <120s remains
- [ ] Existing `generateContent`, `generateImage`, `generateVideo` functions still work
- [ ] Video generation (user-initiated via VideoStoryboardModal) unaffected
