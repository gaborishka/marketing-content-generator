import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateContent = vi.fn();
const mockWriteContentDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateContentDoc = vi.fn().mockResolvedValue(undefined);

vi.mock("../utils/gemini", () => ({
  getGeminiClient: () => ({
    models: {
      generateContent: mockGenerateContent,
    },
  }),
}));

vi.mock("../utils/firestore", () => ({
  writeContentDoc: (...args: any[]) => mockWriteContentDoc(...args),
  updateContentDoc: (...args: any[]) => mockUpdateContentDoc(...args),
}));

import { generateText, regenerateText } from "../agents/generator";
import { PlannerContext, ContentDoc, ComplianceFeedback } from "../types/pipeline";

// ── Fixtures ────────────────────────────────────────────────────────────────

const ctx: PlannerContext = {
  campaign: {
    name: "Summer Sale",
    description: "Drive summer sales",
    keyMessage: "50% off everything",
    context: "Annual summer promotion",
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

const geminiResponse = [
  {
    channel: "Twitter",
    audience: "Gen Z",
    text: "Summer vibes with Widget X!",
    complianceScore: 90,
    riskLevel: "low",
  },
  {
    channel: "Email Newsletter",
    audience: "Millennials",
    text: "Save 50% on Widget X this summer",
    complianceScore: 85,
    riskLevel: "low",
  },
];

describe("generateText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates content docs and writes them to Firestore", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(geminiResponse),
    });

    const result = await generateText(ctx, "camp-1", "user-1", "job-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0].channel).toBe("Twitter");
    expect(result.data![0].audience).toBe("Gen Z");
    expect(result.data![0].text).toBe("Summer vibes with Widget X!");
    expect(result.data![0].campaignId).toBe("camp-1");
    expect(result.data![0].userId).toBe("user-1");
    expect(result.data![0].generationJobId).toBe("job-1");
    expect(result.data![0].status).toBe("draft");
    expect(result.data![0].imageUrl).toBe("");
    expect(mockWriteContentDoc).toHaveBeenCalledTimes(2);
  });

  it("handles video storyboard channel with scenes", async () => {
    const storyboardResponse = [
      {
        channel: "Video Storyboard",
        audience: "Gen Z",
        text: "Full voiceover script",
        complianceScore: 88,
        riskLevel: "low",
        storyboard: [
          { sceneNumber: 1, imagePrompt: "Product hero shot", voiceover: "Introducing Widget X" },
          { sceneNumber: 2, imagePrompt: "Features montage", voiceover: "Fast and durable" },
          { sceneNumber: 3, imagePrompt: "Call to action", voiceover: "Get yours today" },
        ],
      },
    ];

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(storyboardResponse),
    });

    const storyboardCtx = {
      ...ctx,
      combinations: [{ channel: "Video Storyboard", audience: "Gen Z" }],
    };

    const result = await generateText(storyboardCtx, "camp-1", "user-1", "job-1");

    expect(result.success).toBe(true);
    expect(result.data![0].storyboard).toHaveLength(3);
    expect(result.data![0].storyboard![0].sceneNumber).toBe(1);
    expect(result.data![0].storyboard![0].imageUrl).toBe("");
  });

  it("returns error on JSON parse failure", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "not valid json",
    });

    const result = await generateText(ctx, "camp-1", "user-1", "job-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("parse");
  });

  it("returns error when response is not an array", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ channel: "Twitter" }),
    });

    const result = await generateText(ctx, "camp-1", "user-1", "job-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not an array");
  });

  it("strips markdown code fences from response", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "```json\n" + JSON.stringify(geminiResponse) + "\n```",
    });

    const result = await generateText(ctx, "camp-1", "user-1", "job-1");

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it("handles Gemini API errors gracefully", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Rate limit exceeded"));

    const result = await generateText(ctx, "camp-1", "user-1", "job-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Generator failed");
    expect(result.error).toContain("Rate limit exceeded");
  });

  it("handles empty response text", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });

    const result = await generateText(ctx, "camp-1", "user-1", "job-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Gemini returned empty content array");
  });
});

describe("regenerateText", () => {
  const failedDoc: ContentDoc = {
    id: "gen-job1-123-0",
    campaignId: "camp-1",
    userId: "user-1",
    channel: "Twitter",
    audience: "Gen Z",
    text: "Buy the best widget ever!",
    imageUrl: "",
    complianceScore: 65,
    status: "draft",
    riskLevel: "medium",
    x: 0,
    y: 0,
    generationJobId: "job-1",
  };

  const feedback: ComplianceFeedback = {
    contentId: "gen-job1-123-0",
    score: 65,
    violations: ["Unsubstantiated superlative"],
    suggestedFix: "Replace 'best' with 'industry-leading'",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("regenerates and updates the content doc", async () => {
    const regeneratedItem = {
      channel: "Twitter",
      audience: "Gen Z",
      text: "Discover the industry-leading Widget X!",
      complianceScore: 92,
      riskLevel: "low",
    };

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(regeneratedItem),
    });

    const result = await regenerateText(ctx, failedDoc, feedback);

    expect(result.success).toBe(true);
    expect(result.data!.text).toBe("Discover the industry-leading Widget X!");
    expect(result.data!.complianceScore).toBe(92);
    expect(result.data!.id).toBe(failedDoc.id); // preserves original ID
    expect(result.data!.campaignId).toBe("camp-1");
    expect(mockUpdateContentDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateContentDoc).toHaveBeenCalledWith(failedDoc.id, expect.objectContaining({
      text: "Discover the industry-leading Widget X!",
      complianceScore: 92,
      riskLevel: "low",
    }));
  });

  it("returns error on parse failure", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "invalid",
    });

    const result = await regenerateText(ctx, failedDoc, feedback);

    expect(result.success).toBe(false);
    expect(result.error).toContain("parse");
  });

  it("handles Gemini API errors gracefully", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Service unavailable"));

    const result = await regenerateText(ctx, failedDoc, feedback);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Regeneration failed");
  });
});
