import { describe, it, expect } from "vitest";
import { PlannerContext, ComplianceFeedback } from "../types/pipeline";
import {
  buildGenerationPrompt,
  buildRegenerationPrompt,
  GENERATION_RESPONSE_SCHEMA,
  REGENERATION_RESPONSE_SCHEMA,
} from "../prompts/generator.prompt";

const baseCtx: PlannerContext = {
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
    features: ["Fast", "Durable"],
    marketingTags: ["premium", "best-seller"],
  },
  secondaryProducts: [{ name: "Gadget Y", brand: "Acme" }],
  complianceRule: {
    name: "FTC Advertising",
    ruleText: "No unsubstantiated claims",
  },
  combinations: [
    { channel: "Twitter", audience: "Gen Z" },
    { channel: "Email Newsletter", audience: "Millennials" },
  ],
  existingCombinations: [],
};

describe("buildGenerationPrompt", () => {
  it("includes campaign context and key message", () => {
    const prompt = buildGenerationPrompt(baseCtx);
    expect(prompt).toContain("Annual summer promotion");
    expect(prompt).toContain("50% off everything");
    expect(prompt).toContain("Drive summer sales");
  });

  it("includes primary product details", () => {
    const prompt = buildGenerationPrompt(baseCtx);
    expect(prompt).toContain("Widget X");
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("A great widget");
    expect(prompt).toContain("Fast, Durable");
    expect(prompt).toContain("premium, best-seller");
  });

  it("includes secondary products", () => {
    const prompt = buildGenerationPrompt(baseCtx);
    expect(prompt).toContain("Gadget Y");
  });

  it("includes compliance rules when present", () => {
    const prompt = buildGenerationPrompt(baseCtx);
    expect(prompt).toContain("COMPLIANCE RULES (MANDATORY)");
    expect(prompt).toContain("FTC Advertising");
    expect(prompt).toContain("No unsubstantiated claims");
  });

  it("omits compliance block when no rule", () => {
    const ctx: PlannerContext = { ...baseCtx, complianceRule: undefined };
    const prompt = buildGenerationPrompt(ctx);
    expect(prompt).not.toContain("COMPLIANCE RULES (MANDATORY)");
  });

  it("includes all channel/audience combinations", () => {
    const prompt = buildGenerationPrompt(baseCtx);
    expect(prompt).toContain('Channel: "Twitter", Audience: "Gen Z"');
    expect(prompt).toContain('Channel: "Email Newsletter", Audience: "Millennials"');
    expect(prompt).toContain("Generate exactly 2 marketing content items");
  });

  it("handles brand campaign with no primary product", () => {
    const ctx: PlannerContext = { ...baseCtx, primaryProduct: undefined };
    const prompt = buildGenerationPrompt(ctx);
    expect(prompt).toContain("Brand/Idea Campaign");
    expect(prompt).not.toContain("Widget X");
  });

  it("includes Video Storyboard instructions", () => {
    const prompt = buildGenerationPrompt(baseCtx);
    expect(prompt).toContain("Video Storyboard");
    expect(prompt).toContain("storyboard");
    expect(prompt).toContain("sceneNumber");
  });
});

describe("buildRegenerationPrompt", () => {
  const feedback: ComplianceFeedback = {
    contentId: "c1",
    score: 65,
    violations: ["Unsubstantiated superlative", "Missing disclaimer"],
    suggestedFix: "Replace 'best in class' with 'industry-leading'",
  };

  it("includes the original text and score", () => {
    const prompt = buildRegenerationPrompt(
      baseCtx,
      "Buy the best widget ever!",
      "Twitter",
      "Gen Z",
      feedback
    );
    expect(prompt).toContain("Buy the best widget ever!");
    expect(prompt).toContain("scored 65/100");
  });

  it("includes violations", () => {
    const prompt = buildRegenerationPrompt(
      baseCtx,
      "text",
      "Twitter",
      "Gen Z",
      feedback
    );
    expect(prompt).toContain("Unsubstantiated superlative");
    expect(prompt).toContain("Missing disclaimer");
  });

  it("includes suggested fix", () => {
    const prompt = buildRegenerationPrompt(
      baseCtx,
      "text",
      "Twitter",
      "Gen Z",
      feedback
    );
    expect(prompt).toContain("Replace 'best in class' with 'industry-leading'");
  });

  it("includes compliance rules when present", () => {
    const prompt = buildRegenerationPrompt(
      baseCtx,
      "text",
      "Twitter",
      "Gen Z",
      feedback
    );
    expect(prompt).toContain("FTC Advertising");
  });

  it("includes channel and audience", () => {
    const prompt = buildRegenerationPrompt(
      baseCtx,
      "text",
      "Email Newsletter",
      "Millennials",
      feedback
    );
    expect(prompt).toContain('Channel: "Email Newsletter"');
    expect(prompt).toContain('Audience: "Millennials"');
  });
});

describe("Response Schemas", () => {
  it("GENERATION_RESPONSE_SCHEMA is an array type", () => {
    expect(GENERATION_RESPONSE_SCHEMA.type).toBe("ARRAY");
    expect(GENERATION_RESPONSE_SCHEMA.items.type).toBe("OBJECT");
  });

  it("GENERATION_RESPONSE_SCHEMA has required fields", () => {
    expect(GENERATION_RESPONSE_SCHEMA.items.required).toContain("channel");
    expect(GENERATION_RESPONSE_SCHEMA.items.required).toContain("audience");
    expect(GENERATION_RESPONSE_SCHEMA.items.required).toContain("text");
    expect(GENERATION_RESPONSE_SCHEMA.items.required).toContain("complianceScore");
    expect(GENERATION_RESPONSE_SCHEMA.items.required).toContain("riskLevel");
  });

  it("REGENERATION_RESPONSE_SCHEMA is an object type", () => {
    expect(REGENERATION_RESPONSE_SCHEMA.type).toBe("OBJECT");
  });
});
