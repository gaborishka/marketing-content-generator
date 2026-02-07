import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateContent = vi.fn();
const mockUpdateContentDoc = vi.fn().mockResolvedValue(undefined);

vi.mock("../utils/gemini", () => ({
  getGeminiClient: () => ({
    models: {
      generateContent: mockGenerateContent,
    },
  }),
}));

vi.mock("../utils/firestore", () => ({
  updateContentDoc: (...args: any[]) => mockUpdateContentDoc(...args),
}));

import { runComplianceCheck } from "../agents/compliance";
import { ContentDoc } from "../types/pipeline";

// ── Fixtures ────────────────────────────────────────────────────────────────

const contentDocs: ContentDoc[] = [
  {
    id: "content-1",
    campaignId: "camp-1",
    userId: "user-1",
    channel: "Twitter",
    audience: "Gen Z",
    text: "Buy the best widget ever!",
    imageUrl: "",
    complianceScore: 90,
    status: "draft",
    riskLevel: "low",
    x: 0,
    y: 0,
    generationJobId: "job-1",
  },
  {
    id: "content-2",
    campaignId: "camp-1",
    userId: "user-1",
    channel: "Email Newsletter",
    audience: "Millennials",
    text: "Save big with our industry-leading product",
    imageUrl: "",
    complianceScore: 85,
    status: "draft",
    riskLevel: "low",
    x: 0,
    y: 0,
    generationJobId: "job-1",
  },
];

const passingResponse = {
  score: 92,
  pass: true,
  feedback: "Content is compliant",
  violations: [],
};

const failingResponse = {
  score: 55,
  pass: false,
  feedback: "The claim 'best widget ever' lacks substantiation",
  violations: ["Unsubstantiated superlative"],
  suggestedFix: "Replace 'best widget ever' with 'industry-leading widget'",
};

describe("runComplianceCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("evaluates each content item and returns results", async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(failingResponse) })
      .mockResolvedValueOnce({ text: JSON.stringify(passingResponse) });

    const result = await runComplianceCheck(
      contentDocs,
      "FTC Advertising",
      "No unsubstantiated claims",
      0
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);

    // First item fails
    expect(result.data![0].contentId).toBe("content-1");
    expect(result.data![0].score).toBe(55);
    expect(result.data![0].pass).toBe(false);
    expect(result.data![0].violations).toContain("Unsubstantiated superlative");
    expect(result.data![0].suggestedFix).toContain("industry-leading");

    // Second item passes
    expect(result.data![1].contentId).toBe("content-2");
    expect(result.data![1].score).toBe(92);
    expect(result.data![1].pass).toBe(true);
    expect(result.data![1].violations).toHaveLength(0);
  });

  it("writes complianceDetails to each content doc", async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify(failingResponse) })
      .mockResolvedValueOnce({ text: JSON.stringify(passingResponse) });

    await runComplianceCheck(
      contentDocs,
      "FTC Advertising",
      "No unsubstantiated claims",
      0
    );

    expect(mockUpdateContentDoc).toHaveBeenCalledTimes(2);

    // First call updates content-1 with failing details
    expect(mockUpdateContentDoc).toHaveBeenCalledWith("content-1", {
      complianceScore: 55,
      complianceDetails: {
        score: 55,
        violations: ["Unsubstantiated superlative"],
        suggestions: ["Unsubstantiated superlative"],
        suggestedFix: "Replace 'best widget ever' with 'industry-leading widget'",
        retryAttempt: 0,
      },
    });

    // Second call updates content-2 with passing details
    expect(mockUpdateContentDoc).toHaveBeenCalledWith("content-2", {
      complianceScore: 92,
      complianceDetails: {
        score: 92,
        violations: [],
        suggestions: [],
        suggestedFix: undefined,
        retryAttempt: 0,
      },
    });
  });

  it("clamps score to 0-100 range", async () => {
    const overScore = { ...passingResponse, score: 150 };
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(overScore),
    });

    const result = await runComplianceCheck(
      [contentDocs[0]],
      "Rule",
      "Rule text",
      0
    );

    expect(result.data![0].score).toBe(100);
  });

  it("clamps negative scores to 0", async () => {
    const negativeScore = { ...failingResponse, score: -10 };
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(negativeScore),
    });

    const result = await runComplianceCheck(
      [contentDocs[0]],
      "Rule",
      "Rule text",
      0
    );

    expect(result.data![0].score).toBe(0);
    expect(result.data![0].pass).toBe(false);
  });

  it("enforces pass threshold at 80", async () => {
    const borderline = { ...passingResponse, score: 79 };
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(borderline),
    });

    const result = await runComplianceCheck(
      [contentDocs[0]],
      "Rule",
      "Rule text",
      0
    );

    expect(result.data![0].score).toBe(79);
    expect(result.data![0].pass).toBe(false);
  });

  it("passes at exactly 80", async () => {
    const atThreshold = { ...passingResponse, score: 80 };
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(atThreshold),
    });

    const result = await runComplianceCheck(
      [contentDocs[0]],
      "Rule",
      "Rule text",
      0
    );

    expect(result.data![0].score).toBe(80);
    expect(result.data![0].pass).toBe(true);
  });

  it("handles JSON parse failure for individual items gracefully", async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: "not valid json" })
      .mockResolvedValueOnce({ text: JSON.stringify(passingResponse) });

    const result = await runComplianceCheck(
      contentDocs,
      "Rule",
      "Rule text",
      0
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);

    // First item has parse error fallback
    expect(result.data![0].score).toBe(0);
    expect(result.data![0].pass).toBe(false);
    expect(result.data![0].feedback).toContain("parse");

    // Second item evaluated normally
    expect(result.data![1].score).toBe(92);
    expect(result.data![1].pass).toBe(true);
  });

  it("returns error when Gemini API throws", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Rate limit exceeded"));

    const result = await runComplianceCheck(
      contentDocs,
      "Rule",
      "Rule text",
      0
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Compliance check failed");
    expect(result.error).toContain("Rate limit exceeded");
  });

  it("strips markdown code fences from response", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "```json\n" + JSON.stringify(passingResponse) + "\n```",
    });

    const result = await runComplianceCheck(
      [contentDocs[0]],
      "Rule",
      "Rule text",
      0
    );

    expect(result.success).toBe(true);
    expect(result.data![0].score).toBe(92);
  });

  it("tracks retryAttempt in complianceDetails", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(passingResponse),
    });

    await runComplianceCheck(
      [contentDocs[0]],
      "Rule",
      "Rule text",
      2
    );

    expect(mockUpdateContentDoc).toHaveBeenCalledWith(
      "content-1",
      expect.objectContaining({
        complianceDetails: expect.objectContaining({
          retryAttempt: 2,
        }),
      })
    );
  });

  it("handles empty response text", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });

    const result = await runComplianceCheck(
      [contentDocs[0]],
      "Rule",
      "Rule text",
      0
    );

    // Empty text parses as "{}" which gives score 0
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});
