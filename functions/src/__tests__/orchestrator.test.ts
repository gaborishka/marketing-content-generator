import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockSetPhase = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockComplete = vi.fn().mockResolvedValue(undefined);
const mockFail = vi.fn().mockResolvedValue(undefined);

vi.mock("../utils/progress", () => ({
  ProgressWriter: class {
    constructor() {}
    setPhase = mockSetPhase;
    update = mockUpdate;
    complete = mockComplete;
    fail = mockFail;
  },
}));

const mockRunPlanner = vi.fn();
vi.mock("../agents/planner", () => ({
  runPlanner: (...args: any[]) => mockRunPlanner(...args),
}));

const mockGenerateText = vi.fn();
const mockRegenerateText = vi.fn();
vi.mock("../agents/generator", () => ({
  generateText: (...args: any[]) => mockGenerateText(...args),
  regenerateText: (...args: any[]) => mockRegenerateText(...args),
}));

const mockRunComplianceCheck = vi.fn();
vi.mock("../agents/compliance", () => ({
  runComplianceCheck: (...args: any[]) => mockRunComplianceCheck(...args),
}));

const mockRunAssetManager = vi.fn().mockResolvedValue({
  success: true,
  data: { totalImages: 0, successCount: 0, failureCount: 0 },
});
vi.mock("../agents/assetManager", () => ({
  runAssetManager: (...args: any[]) => mockRunAssetManager(...args),
}));

import { runOrchestrator, OrchestratorInput } from "../agents/orchestrator";
import { PlannerContext, ContentDoc } from "../types/pipeline";

// ── Fixtures ────────────────────────────────────────────────────────────────

const baseInput: OrchestratorInput = {
  campaignId: "camp-1",
  userId: "user-1",
  jobId: "job-1",
  maxSeconds: 540,
};

const plannerContext: PlannerContext = {
  campaign: {
    name: "Summer Sale",
    description: "Drive summer sales",
    keyMessage: "50% off",
    context: "Annual promo",
  },
  primaryProduct: {
    name: "Widget X",
    brand: "Acme",
    description: "A great widget",
    features: ["Fast"],
    marketingTags: ["premium"],
  },
  secondaryProducts: [],
  combinations: [
    { channel: "Twitter", audience: "Gen Z" },
    { channel: "Email Newsletter", audience: "Millennials" },
  ],
  existingCombinations: [],
};

const plannerContextWithCompliance: PlannerContext = {
  ...plannerContext,
  complianceRule: {
    name: "FTC Advertising",
    ruleText: "No unsubstantiated claims",
  },
};

const contentDocs: ContentDoc[] = [
  {
    id: "gen-job-1-1",
    campaignId: "camp-1",
    userId: "user-1",
    channel: "Twitter",
    audience: "Gen Z",
    text: "Summer vibes!",
    imageUrl: "",
    complianceScore: 90,
    status: "draft",
    riskLevel: "low",
    x: 0,
    y: 0,
    generationJobId: "job-1",
  },
  {
    id: "gen-job-1-2",
    campaignId: "camp-1",
    userId: "user-1",
    channel: "Email Newsletter",
    audience: "Millennials",
    text: "Save 50%",
    imageUrl: "",
    complianceScore: 85,
    status: "draft",
    riskLevel: "low",
    x: 0,
    y: 0,
    generationJobId: "job-1",
  },
];

describe("runOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs planner then generator and completes successfully", async () => {
    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(true);
    expect(result.contentIds).toEqual(["gen-job-1-1", "gen-job-1-2"]);

    // Planner called with correct args
    expect(mockRunPlanner).toHaveBeenCalledWith("camp-1", "user-1");

    // Generator called with planner context
    expect(mockGenerateText).toHaveBeenCalledWith(
      plannerContext,
      "camp-1",
      "user-1",
      "job-1"
    );

    // Progress updates in correct order
    expect(mockSetPhase).toHaveBeenCalledWith("planning", "Gathering context...", 10);
    expect(mockSetPhase).toHaveBeenCalledWith("generating", "Generating copy...", 30);
    expect(mockComplete).toHaveBeenCalledWith(["gen-job-1-1", "gen-job-1-2"]);
  });

  it("skips compliance when no compliance rule in planner context", async () => {
    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    await runOrchestrator(baseInput);

    expect(mockRunComplianceCheck).not.toHaveBeenCalled();
    expect(mockRegenerateText).not.toHaveBeenCalled();
  });

  it("fails when planner returns error", async () => {
    mockRunPlanner.mockResolvedValue({
      success: false,
      error: "Campaign not found",
    });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Campaign not found");
    expect(mockFail).toHaveBeenCalledWith("Campaign not found");
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("fails when planner returns no data", async () => {
    mockRunPlanner.mockResolvedValue({ success: true });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Planner returned no data");
    expect(mockFail).toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("fails when generator returns error", async () => {
    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({
      success: false,
      error: "Gemini rate limit",
    });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Gemini rate limit");
    expect(mockFail).toHaveBeenCalledWith("Gemini rate limit");
  });

  it("fails when generator returns no data", async () => {
    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({ success: true });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Generator returned no data");
    expect(mockFail).toHaveBeenCalled();
  });

  it("handles unexpected exceptions and writes failure to job doc", async () => {
    mockRunPlanner.mockRejectedValue(new Error("Firestore connection lost"));

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Firestore connection lost");
    expect(mockFail).toHaveBeenCalledWith("Firestore connection lost");
  });

  it("fails gracefully when timeout is already expired", async () => {
    const expiredInput: OrchestratorInput = {
      ...baseInput,
      maxSeconds: 0, // already expired (safety margin makes it negative)
    };

    const result = await runOrchestrator(expiredInput);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Timeout");
    expect(mockFail).toHaveBeenCalled();
    expect(mockRunPlanner).not.toHaveBeenCalled();
  });

  it("updates itemsTotal from planner context", async () => {
    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    await runOrchestrator(baseInput);

    // After planning, should update with items total
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        itemsTotal: 2,
        progress: 25,
      })
    );

    // After generation, should update with completed count
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        contentIds: ["gen-job-1-1", "gen-job-1-2"],
        itemsCompleted: 2,
        progress: 50,
      })
    );
  });

  it("handles progress write failure without masking original error", async () => {
    mockRunPlanner.mockRejectedValue(new Error("Original error"));
    mockFail.mockRejectedValue(new Error("Progress write failed"));

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Original error");
  });
});

// ── Compliance Loop Tests ───────────────────────────────────────────────────

describe("runOrchestrator - compliance loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs compliance check when complianceRule is present", async () => {
    mockRunPlanner.mockResolvedValue({
      success: true,
      data: plannerContextWithCompliance,
    });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });
    mockRunComplianceCheck.mockResolvedValue({
      success: true,
      data: [
        { contentId: "gen-job-1-1", score: 92, pass: true, feedback: "Good", violations: [] },
        { contentId: "gen-job-1-2", score: 88, pass: true, feedback: "Good", violations: [] },
      ],
    });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(true);
    expect(mockRunComplianceCheck).toHaveBeenCalledWith(
      contentDocs,
      "FTC Advertising",
      "No unsubstantiated claims",
      0
    );
    expect(mockSetPhase).toHaveBeenCalledWith(
      "compliance_check",
      "Checking compliance...",
      55
    );
  });

  it("retries failed items with regenerateText", async () => {
    mockRunPlanner.mockResolvedValue({
      success: true,
      data: plannerContextWithCompliance,
    });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    // First compliance check: one item fails
    mockRunComplianceCheck.mockResolvedValueOnce({
      success: true,
      data: [
        {
          contentId: "gen-job-1-1",
          score: 55,
          pass: false,
          feedback: "Unsubstantiated claim",
          violations: ["Superlative without evidence"],
          suggestedFix: "Remove superlative",
        },
        { contentId: "gen-job-1-2", score: 92, pass: true, feedback: "Good", violations: [] },
      ],
    });

    // Regeneration succeeds
    const regeneratedDoc: ContentDoc = {
      ...contentDocs[0],
      text: "Revised content",
      complianceScore: 90,
    };
    mockRegenerateText.mockResolvedValue({
      success: true,
      data: regeneratedDoc,
    });

    // Second compliance check: all pass
    mockRunComplianceCheck.mockResolvedValueOnce({
      success: true,
      data: [
        { contentId: "gen-job-1-1", score: 90, pass: true, feedback: "Improved", violations: [] },
        { contentId: "gen-job-1-2", score: 92, pass: true, feedback: "Good", violations: [] },
      ],
    });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(true);
    expect(mockRunComplianceCheck).toHaveBeenCalledTimes(2);
    expect(mockRegenerateText).toHaveBeenCalledTimes(1);
    expect(mockRegenerateText).toHaveBeenCalledWith(
      plannerContextWithCompliance,
      contentDocs[0],
      {
        contentId: "gen-job-1-1",
        score: 55,
        violations: ["Superlative without evidence"],
        suggestedFix: "Remove superlative",
      }
    );

    // Should have updated progress with retry status
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "retrying",
        retryCount: 1,
      })
    );
  });

  it("caps retries at MAX_COMPLIANCE_RETRIES (2)", async () => {
    mockRunPlanner.mockResolvedValue({
      success: true,
      data: plannerContextWithCompliance,
    });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    // All compliance checks return failures
    const failureResult = {
      success: true,
      data: [
        {
          contentId: "gen-job-1-1",
          score: 50,
          pass: false,
          feedback: "Still failing",
          violations: ["Persistent issue"],
          suggestedFix: "Try harder",
        },
        { contentId: "gen-job-1-2", score: 92, pass: true, feedback: "Good", violations: [] },
      ],
    };

    mockRunComplianceCheck
      .mockResolvedValueOnce(failureResult)  // initial check
      .mockResolvedValueOnce(failureResult)  // after retry 1
      .mockResolvedValueOnce(failureResult); // after retry 2

    const regeneratedDoc: ContentDoc = {
      ...contentDocs[0],
      text: "Revised again",
      complianceScore: 55,
    };
    mockRegenerateText.mockResolvedValue({
      success: true,
      data: regeneratedDoc,
    });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(true);
    // 3 compliance checks: initial + 2 after retries
    expect(mockRunComplianceCheck).toHaveBeenCalledTimes(3);
    // 2 regenerations (max retries)
    expect(mockRegenerateText).toHaveBeenCalledTimes(2);
  });

  it("continues without compliance if compliance check fails", async () => {
    mockRunPlanner.mockResolvedValue({
      success: true,
      data: plannerContextWithCompliance,
    });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });
    mockRunComplianceCheck.mockResolvedValue({
      success: false,
      error: "Gemini API error",
    });

    const result = await runOrchestrator(baseInput);

    // Should still succeed — compliance failure is non-blocking
    expect(result.success).toBe(true);
    expect(mockRegenerateText).not.toHaveBeenCalled();
  });

  it("handles regeneration failure gracefully", async () => {
    mockRunPlanner.mockResolvedValue({
      success: true,
      data: plannerContextWithCompliance,
    });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    mockRunComplianceCheck
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            contentId: "gen-job-1-1",
            score: 50,
            pass: false,
            feedback: "Bad",
            violations: ["Issue"],
          },
          { contentId: "gen-job-1-2", score: 92, pass: true, feedback: "OK", violations: [] },
        ],
      })
      // After failed regen, compliance runs again with original docs
      .mockResolvedValueOnce({
        success: true,
        data: [
          { contentId: "gen-job-1-1", score: 50, pass: false, feedback: "Still bad", violations: ["Issue"] },
          { contentId: "gen-job-1-2", score: 92, pass: true, feedback: "OK", violations: [] },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          { contentId: "gen-job-1-1", score: 50, pass: false, feedback: "Still bad", violations: ["Issue"] },
          { contentId: "gen-job-1-2", score: 92, pass: true, feedback: "OK", violations: [] },
        ],
      });

    // Regeneration fails
    mockRegenerateText.mockResolvedValue({
      success: false,
      error: "Regeneration failed",
    });

    const result = await runOrchestrator(baseInput);

    // Should still succeed overall — regen failure doesn't block the pipeline
    expect(result.success).toBe(true);
  });

  it("stops compliance loop early when all items pass after retry", async () => {
    mockRunPlanner.mockResolvedValue({
      success: true,
      data: plannerContextWithCompliance,
    });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    // First check: failure
    mockRunComplianceCheck.mockResolvedValueOnce({
      success: true,
      data: [
        {
          contentId: "gen-job-1-1",
          score: 60,
          pass: false,
          feedback: "Bad",
          violations: ["Issue"],
        },
        { contentId: "gen-job-1-2", score: 88, pass: true, feedback: "Good", violations: [] },
      ],
    });

    const regeneratedDoc: ContentDoc = {
      ...contentDocs[0],
      text: "Fixed content",
      complianceScore: 95,
    };
    mockRegenerateText.mockResolvedValue({ success: true, data: regeneratedDoc });

    // Second check: all pass now
    mockRunComplianceCheck.mockResolvedValueOnce({
      success: true,
      data: [
        { contentId: "gen-job-1-1", score: 95, pass: true, feedback: "Fixed", violations: [] },
        { contentId: "gen-job-1-2", score: 88, pass: true, feedback: "Good", violations: [] },
      ],
    });

    await runOrchestrator(baseInput);

    // Only 2 compliance checks (not 3), because all passed after first retry
    expect(mockRunComplianceCheck).toHaveBeenCalledTimes(2);
    expect(mockRegenerateText).toHaveBeenCalledTimes(1);
  });

  it("writes compliance review complete progress after loop", async () => {
    mockRunPlanner.mockResolvedValue({
      success: true,
      data: plannerContextWithCompliance,
    });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });
    mockRunComplianceCheck.mockResolvedValue({
      success: true,
      data: [
        { contentId: "gen-job-1-1", score: 90, pass: true, feedback: "Good", violations: [] },
        { contentId: "gen-job-1-2", score: 88, pass: true, feedback: "Good", violations: [] },
      ],
    });
    mockRunAssetManager.mockResolvedValue({
      success: true,
      data: { totalImages: 2, successCount: 2, failureCount: 0 },
    });

    await runOrchestrator(baseInput);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "compliance_check",
        phase: "Compliance review complete",
        progress: 70,
      })
    );
  });
});

// ── Asset Manager Integration Tests ─────────────────────────────────────────

describe("runOrchestrator - asset manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs asset manager after text generation when budget allows", async () => {
    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });
    mockRunAssetManager.mockResolvedValue({
      success: true,
      data: { totalImages: 2, successCount: 2, failureCount: 0 },
    });

    const result = await runOrchestrator(baseInput);

    expect(result.success).toBe(true);
    expect(mockRunAssetManager).toHaveBeenCalledWith({
      contentDocs,
      userId: "user-1",
    });

    // Progress updates for image generation
    expect(mockSetPhase).toHaveBeenCalledWith(
      "generating_images",
      "Generating images...",
      75
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "generating_images",
        phase: "Images complete (2/2)",
        progress: 95,
      })
    );
  });

  it("skips asset manager when timeout budget is insufficient (<120s)", async () => {
    // Use a very tight maxSeconds so that after planning + generation,
    // the budget won't have 120s remaining
    const tightInput: OrchestratorInput = {
      ...baseInput,
      maxSeconds: 60, // 60s total - 30s safety = 30s budget, not enough for 120s image gen
    };

    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    const result = await runOrchestrator(tightInput);

    expect(result.success).toBe(true);
    expect(mockRunAssetManager).not.toHaveBeenCalled();
    // Should still complete successfully
    expect(mockComplete).toHaveBeenCalledWith(["gen-job-1-1", "gen-job-1-2"]);
  });

  it("completes successfully even when asset manager fails", async () => {
    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });
    mockRunAssetManager.mockResolvedValue({
      success: false,
      error: "All images failed",
    });

    const result = await runOrchestrator(baseInput);

    // Asset manager failure is non-blocking
    expect(result.success).toBe(true);
    expect(mockComplete).toHaveBeenCalled();
  });

  it("passes updated content docs to asset manager after compliance retries", async () => {
    mockRunPlanner.mockResolvedValue({
      success: true,
      data: plannerContextWithCompliance,
    });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });

    // Compliance: first item fails
    mockRunComplianceCheck.mockResolvedValueOnce({
      success: true,
      data: [
        {
          contentId: "gen-job-1-1",
          score: 50,
          pass: false,
          feedback: "Bad",
          violations: ["Issue"],
          suggestedFix: "Fix it",
        },
        { contentId: "gen-job-1-2", score: 90, pass: true, feedback: "Good", violations: [] },
      ],
    });

    const regeneratedDoc: ContentDoc = {
      ...contentDocs[0],
      text: "Revised content",
      complianceScore: 90,
    };
    mockRegenerateText.mockResolvedValue({ success: true, data: regeneratedDoc });

    // Second compliance check: all pass
    mockRunComplianceCheck.mockResolvedValueOnce({
      success: true,
      data: [
        { contentId: "gen-job-1-1", score: 90, pass: true, feedback: "Fixed", violations: [] },
        { contentId: "gen-job-1-2", score: 90, pass: true, feedback: "Good", violations: [] },
      ],
    });

    mockRunAssetManager.mockResolvedValue({
      success: true,
      data: { totalImages: 2, successCount: 2, failureCount: 0 },
    });

    await runOrchestrator(baseInput);

    // Asset manager should receive the updated contentDocs (with regenerated doc)
    const assetCall = mockRunAssetManager.mock.calls[0][0];
    expect(assetCall.contentDocs[0].text).toBe("Revised content");
  });

  it("reports partial image success in progress update", async () => {
    mockRunPlanner.mockResolvedValue({ success: true, data: plannerContext });
    mockGenerateText.mockResolvedValue({ success: true, data: contentDocs });
    mockRunAssetManager.mockResolvedValue({
      success: true,
      data: { totalImages: 2, successCount: 1, failureCount: 1 },
    });

    await runOrchestrator(baseInput);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "Images complete (1/2)",
        progress: 95,
      })
    );
  });
});
