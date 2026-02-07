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
vi.mock("../agents/generator", () => ({
  generateText: (...args: any[]) => mockGenerateText(...args),
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
        progress: 70,
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
