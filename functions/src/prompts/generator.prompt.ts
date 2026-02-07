// Prompt templates for content generation via Gemini Flash.
// Extracted and adapted from services/geminiService.ts:132-180

import { Type } from "@google/genai";
import { PlannerContext, ComplianceFeedback } from "../types/pipeline";

// ── Prompt Builder ──────────────────────────────────────────────────────────

export function buildGenerationPrompt(ctx: PlannerContext): string {
  let productContext = "";
  if (ctx.primaryProduct) {
    productContext += `Primary Product: ${ctx.primaryProduct.name} (${ctx.primaryProduct.brand}) - ${ctx.primaryProduct.description}.\n`;
    if (ctx.primaryProduct.features.length > 0) {
      productContext += `Key Features: ${ctx.primaryProduct.features.join(", ")}.\n`;
    }
    if (ctx.primaryProduct.marketingTags.length > 0) {
      productContext += `Marketing Tags: ${ctx.primaryProduct.marketingTags.join(", ")}.\n`;
    }
  } else {
    productContext += "Type: Brand/Idea Campaign (No specific primary product).\n";
  }

  if (ctx.secondaryProducts.length > 0) {
    productContext += `Secondary Products to mention: ${ctx.secondaryProducts.map((p) => p.name).join(", ")}.\n`;
  }

  let complianceBlock = "";
  if (ctx.complianceRule) {
    complianceBlock = `
    COMPLIANCE RULES (MANDATORY):
    Rule Name: ${ctx.complianceRule.name}
    Full Rule Text: ${ctx.complianceRule.ruleText}

    You MUST evaluate all generated content against these compliance rules. Reflect adherence in the complianceScore field.
    `;
  }

  const combinationList = ctx.combinations
    .map((c, i) => `${i + 1}. Channel: "${c.channel}", Audience: "${c.audience}"`)
    .join("\n    ");

  return `
    You are an expert marketing copywriter.

    ${productContext}
    ${complianceBlock}
    Campaign Context: ${ctx.campaign.context}

    Campaign Goal: ${ctx.campaign.description}
    Key Message: ${ctx.campaign.keyMessage}

    Task: Generate exactly ${ctx.combinations.length} marketing content items for these combinations:
    ${combinationList}

    IMPORTANT: The "channel" field in your output must EXACTLY match the channel names listed above.

    IMPORTANT for 'Video Storyboard' channel:
    - Instead of simple text, generate a 'storyboard' array with exactly 3 scenes.
    - Each scene must have: sceneNumber, imagePrompt (visual description), voiceover (script).
    - The top-level 'text' field should correspond to the full voiceover script.

    Return JSON array.
  `;
}

// ── Regeneration Prompt ─────────────────────────────────────────────────────

export function buildRegenerationPrompt(
  ctx: PlannerContext,
  originalText: string,
  channel: string,
  audience: string,
  feedback: ComplianceFeedback
): string {
  let complianceBlock = "";
  if (ctx.complianceRule) {
    complianceBlock = `
    COMPLIANCE RULES (MANDATORY):
    Rule Name: ${ctx.complianceRule.name}
    Full Rule Text: ${ctx.complianceRule.ruleText}
    `;
  }

  const violationsList = feedback.violations.map((v) => `- ${v}`).join("\n    ");

  return `
    You are an expert marketing copywriter revising content that failed compliance review.

    Channel: "${channel}"
    Audience: "${audience}"

    ${complianceBlock}

    PREVIOUS ATTEMPT (scored ${feedback.score}/100):
    "${originalText}"

    COMPLIANCE FEEDBACK:
    Violations:
    ${violationsList}
    ${feedback.suggestedFix ? `Suggested Fix: ${feedback.suggestedFix}` : ""}

    Task: Rewrite the content to address ALL violations while maintaining marketing effectiveness.
    The rewritten content must score above 80/100 on compliance.

    Return a single JSON object (not an array) with fields: channel, audience, text, complianceScore, riskLevel.
    For 'Video Storyboard' channel, also include a 'storyboard' array.
  `;
}

// ── Response Schema ─────────────────────────────────────────────────────────

export const GENERATION_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      channel: { type: Type.STRING },
      audience: { type: Type.STRING },
      text: { type: Type.STRING },
      complianceScore: { type: Type.NUMBER },
      riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
      storyboard: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sceneNumber: { type: Type.INTEGER },
            imagePrompt: { type: Type.STRING },
            voiceover: { type: Type.STRING },
          },
        },
      },
    },
    required: ["channel", "audience", "text", "complianceScore", "riskLevel"],
  },
};

export const REGENERATION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    channel: { type: Type.STRING },
    audience: { type: Type.STRING },
    text: { type: Type.STRING },
    complianceScore: { type: Type.NUMBER },
    riskLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
    storyboard: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneNumber: { type: Type.INTEGER },
          imagePrompt: { type: Type.STRING },
          voiceover: { type: Type.STRING },
        },
      },
    },
  },
  required: ["channel", "audience", "text", "complianceScore", "riskLevel"],
};
