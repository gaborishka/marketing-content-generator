// Prompt templates for compliance evaluation via Gemini Flash.
// Separate from generation prompts — the evaluator sees content + rules only.

import { Type } from "@google/genai";

// ── Compliance Evaluation Prompt ────────────────────────────────────────────

export function buildCompliancePrompt(
  contentText: string,
  channel: string,
  audience: string,
  ruleText: string,
  ruleName: string
): string {
  return `
    You are a strict compliance evaluator for marketing content.

    COMPLIANCE RULE: "${ruleName}"
    Full Rule Text:
    ${ruleText}

    CONTENT TO EVALUATE:
    Channel: "${channel}"
    Target Audience: "${audience}"
    Content: "${contentText}"

    Task: Evaluate the above marketing content against the compliance rule.

    Scoring Guide:
    - 90-100: Fully compliant, no issues
    - 80-89: Minor issues that don't materially affect compliance
    - 60-79: Moderate violations that need revision
    - 40-59: Significant violations
    - 0-39: Major violations, content is non-compliant

    For each violation found, provide:
    1. A clear description of the violation
    2. The specific part of the rule being violated

    If violations are found, provide a concrete suggested fix that addresses ALL violations.

    Return a single JSON object.
  `;
}

// ── Compliance Response Schema ──────────────────────────────────────────────

export const COMPLIANCE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    pass: { type: Type.BOOLEAN },
    feedback: { type: Type.STRING },
    violations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    suggestedFix: { type: Type.STRING },
  },
  required: ["score", "pass", "feedback", "violations"],
};
