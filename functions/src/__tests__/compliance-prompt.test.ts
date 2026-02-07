import { describe, it, expect } from "vitest";
import {
  buildCompliancePrompt,
  COMPLIANCE_RESPONSE_SCHEMA,
} from "../prompts/compliance.prompt";

describe("buildCompliancePrompt", () => {
  it("includes the rule name and full rule text", () => {
    const prompt = buildCompliancePrompt(
      "Buy the best widget!",
      "Twitter",
      "Gen Z",
      "No unsubstantiated claims allowed",
      "FTC Advertising"
    );
    expect(prompt).toContain("FTC Advertising");
    expect(prompt).toContain("No unsubstantiated claims allowed");
  });

  it("includes the content text", () => {
    const prompt = buildCompliancePrompt(
      "Amazing deal - 50% off!",
      "Email Newsletter",
      "Millennials",
      "Must include disclaimer",
      "Promo Rules"
    );
    expect(prompt).toContain("Amazing deal - 50% off!");
  });

  it("includes channel and audience", () => {
    const prompt = buildCompliancePrompt(
      "Content here",
      "Instagram",
      "Professionals",
      "Rule text",
      "Rule name"
    );
    expect(prompt).toContain('Channel: "Instagram"');
    expect(prompt).toContain('Audience: "Professionals"');
  });

  it("includes scoring guide", () => {
    const prompt = buildCompliancePrompt(
      "Content",
      "Twitter",
      "Gen Z",
      "Rules",
      "Name"
    );
    expect(prompt).toContain("90-100");
    expect(prompt).toContain("Fully compliant");
    expect(prompt).toContain("0-39");
  });

  it("asks for JSON object output", () => {
    const prompt = buildCompliancePrompt(
      "Content",
      "Twitter",
      "Gen Z",
      "Rules",
      "Name"
    );
    expect(prompt).toContain("JSON object");
  });
});

describe("COMPLIANCE_RESPONSE_SCHEMA", () => {
  it("is an object type", () => {
    expect(COMPLIANCE_RESPONSE_SCHEMA.type).toBe("OBJECT");
  });

  it("has required fields", () => {
    expect(COMPLIANCE_RESPONSE_SCHEMA.required).toContain("score");
    expect(COMPLIANCE_RESPONSE_SCHEMA.required).toContain("pass");
    expect(COMPLIANCE_RESPONSE_SCHEMA.required).toContain("feedback");
    expect(COMPLIANCE_RESPONSE_SCHEMA.required).toContain("violations");
  });

  it("has suggestedFix as optional", () => {
    expect(COMPLIANCE_RESPONSE_SCHEMA.properties.suggestedFix).toBeDefined();
    expect(COMPLIANCE_RESPONSE_SCHEMA.required).not.toContain("suggestedFix");
  });

  it("violations is an array of strings", () => {
    expect(COMPLIANCE_RESPONSE_SCHEMA.properties.violations.type).toBe("ARRAY");
    expect(COMPLIANCE_RESPONSE_SCHEMA.properties.violations.items.type).toBe("STRING");
  });
});
