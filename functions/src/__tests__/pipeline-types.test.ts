import { describe, it, expect } from "vitest";
import type {
  PlannerContext,
  ComplianceResult,
  AgentResult,
  JobStatus,
  ContentDoc,
  JobPhase,
  ComplianceFeedback,
} from "../types/pipeline";

describe("Pipeline Types", () => {
  it("PlannerContext can be constructed with all fields", () => {
    const ctx: PlannerContext = {
      campaign: {
        name: "Test Campaign",
        description: "A test",
        keyMessage: "Buy now",
        context: "Summer sale",
      },
      primaryProduct: {
        name: "Widget",
        brand: "Acme",
        description: "A widget",
        features: ["fast", "durable"],
        marketingTags: ["best seller"],
      },
      secondaryProducts: [{ name: "Gadget", brand: "Acme" }],
      complianceRule: { name: "FDA", ruleText: "No false claims" },
      combinations: [{ channel: "Twitter", audience: "Gen Z" }],
      existingCombinations: [],
    };
    expect(ctx.campaign.name).toBe("Test Campaign");
    expect(ctx.combinations).toHaveLength(1);
  });

  it("PlannerContext works without optional fields", () => {
    const ctx: PlannerContext = {
      campaign: {
        name: "Brand Campaign",
        description: "Awareness",
        keyMessage: "Know us",
        context: "",
      },
      secondaryProducts: [],
      combinations: [],
      existingCombinations: [],
    };
    expect(ctx.primaryProduct).toBeUndefined();
    expect(ctx.complianceRule).toBeUndefined();
  });

  it("ComplianceResult has all required fields", () => {
    const result: ComplianceResult = {
      contentId: "c1",
      score: 85,
      pass: true,
      feedback: "Good content",
      violations: [],
    };
    expect(result.pass).toBe(true);
    expect(result.suggestedFix).toBeUndefined();
  });

  it("ComplianceResult with violations", () => {
    const result: ComplianceResult = {
      contentId: "c2",
      score: 60,
      pass: false,
      feedback: "Claims need substantiation",
      violations: ["Unsubstantiated superlative"],
      suggestedFix: "Replace 'best' with 'leading'",
    };
    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(1);
  });

  it("AgentResult wraps success data", () => {
    const result: AgentResult<string[]> = {
      success: true,
      data: ["content-1", "content-2"],
    };
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it("AgentResult wraps failure", () => {
    const result: AgentResult<never> = {
      success: false,
      error: "API timeout",
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe("API timeout");
  });

  it("JobPhase covers all expected statuses", () => {
    const phases: JobPhase[] = [
      "pending",
      "planning",
      "generating",
      "compliance_check",
      "retrying",
      "generating_images",
      "completed",
      "failed",
    ];
    expect(phases).toHaveLength(8);
  });

  it("ContentDoc includes pipeline extension fields", () => {
    const doc: ContentDoc = {
      id: "c1",
      campaignId: "camp1",
      userId: "user1",
      channel: "Twitter",
      audience: "Gen Z",
      text: "Check this out!",
      imageUrl: "",
      complianceScore: 90,
      status: "draft",
      riskLevel: "low",
      x: 0,
      y: 0,
      generationJobId: "job-123",
      complianceDetails: {
        score: 90,
        violations: [],
        suggestions: [],
        retryAttempt: 0,
      },
    };
    expect(doc.generationJobId).toBe("job-123");
    expect(doc.complianceDetails?.retryAttempt).toBe(0);
  });

  it("ComplianceFeedback carries violation data for regeneration", () => {
    const feedback: ComplianceFeedback = {
      contentId: "c1",
      score: 65,
      violations: ["Missing disclaimer"],
      suggestedFix: "Add FDA disclaimer at end",
    };
    expect(feedback.violations).toHaveLength(1);
  });
});
