// Compliance evaluator agent: Evaluator-Optimizer pattern from Anthropic.
// Makes a separate Gemini Flash call per content item (not self-evaluation).
// Returns ComplianceResult[] with actionable feedback for the generator.

import { getGeminiClient } from "../utils/gemini";
import { updateContentDoc } from "../utils/firestore";
import {
  ComplianceResult,
  AgentResult,
  ContentDoc,
} from "../types/pipeline";
import {
  buildCompliancePrompt,
  COMPLIANCE_RESPONSE_SCHEMA,
} from "../prompts/compliance.prompt";

const MODEL = "gemini-3-flash-preview";

interface ComplianceRawResponse {
  score: number;
  pass: boolean;
  feedback: string;
  violations: string[];
  suggestedFix?: string;
}

export async function runComplianceCheck(
  contentDocs: ContentDoc[],
  ruleName: string,
  ruleText: string,
  retryAttempt: number
): Promise<AgentResult<ComplianceResult[]>> {
  try {
    const ai = getGeminiClient();
    const results: ComplianceResult[] = [];

    for (const doc of contentDocs) {
      const prompt = buildCompliancePrompt(
        doc.text,
        doc.channel,
        doc.audience,
        ruleText,
        ruleName
      );

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
          responseSchema: COMPLIANCE_RESPONSE_SCHEMA,
        },
      });

      const cleanText = (response.text || "{}")
        .replace(/```json\n?|```/g, "")
        .trim();

      let raw: ComplianceRawResponse;
      try {
        raw = JSON.parse(cleanText);
      } catch {
        // If parse fails for one item, mark it as needing review
        results.push({
          contentId: doc.id,
          score: 0,
          pass: false,
          feedback: "Failed to parse compliance evaluation response",
          violations: ["Evaluation parse error"],
        });

        // Persist parse failure to Firestore so frontend shows accurate state
        await updateContentDoc(doc.id, {
          complianceScore: 0,
          complianceDetails: {
            score: 0,
            violations: ["Evaluation parse error"],
            suggestions: [],
            retryAttempt,
          },
        });

        continue;
      }

      const score = Math.max(0, Math.min(100, Math.round(raw.score)));
      const pass = score >= 80;

      const result: ComplianceResult = {
        contentId: doc.id,
        score,
        pass,
        feedback: raw.feedback || "",
        violations: raw.violations || [],
        suggestedFix: raw.suggestedFix,
      };

      results.push(result);

      // Write complianceDetails to the content doc
      await updateContentDoc(doc.id, {
        complianceScore: score,
        complianceDetails: {
          score,
          violations: result.violations,
          suggestions: result.suggestedFix ? [result.suggestedFix] : [],
          suggestedFix: result.suggestedFix,
          retryAttempt,
        },
      });
    }

    return { success: true, data: results };
  } catch (error: any) {
    return {
      success: false,
      error: `Compliance check failed: ${error.message || String(error)}`,
    };
  }
}
