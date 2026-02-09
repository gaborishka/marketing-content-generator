// Direct Gemini API client for frontend use
// Replaces Cloud Functions for Gemini API calls

import { GoogleGenAI, Type } from "@google/genai";

// Get API key from environment variable
const getApiKey = (): string => {
  const apiKey = import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required. Add it to your .env.local file.");
  }
  return apiKey;
};

// Initialize Gemini client
let client: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = getApiKey();
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// ── Compliance Checking ────────────────────────────────────────────────────────

export interface ComplianceCheckResult {
  contentId: string;
  score: number;
  pass: boolean;
  feedback: string;
  violations: string[];
  suggestedFix?: string;
}

interface ComplianceRawResponse {
  score: number;
  pass: boolean;
  feedback: string;
  violations: string[];
  suggestedFix?: string;
}

// Compliance response schema using Gemini Type enum
const COMPLIANCE_RESPONSE_SCHEMA = {
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

function buildCompliancePrompt(
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

    Return a single JSON object with: score (number), pass (boolean), feedback (string), violations (string[]), suggestedFix (string, optional).
  `;
}

export async function checkContentCompliance(
  contentText: string,
  channel: string,
  audience: string,
  ruleText: string,
  ruleName: string
): Promise<ComplianceCheckResult> {
  const ai = getGeminiClient();
  const prompt = buildCompliancePrompt(contentText, channel, audience, ruleText, ruleName);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    } catch (parseError) {
      throw new Error("Failed to parse compliance evaluation response");
    }

    const score = Math.max(0, Math.min(100, Math.round(raw.score || 0)));
    const pass = score >= 80;

    return {
      contentId: "", // Will be set by caller
      score,
      pass,
      feedback: raw.feedback || "",
      violations: raw.violations || [],
      suggestedFix: raw.suggestedFix,
    };
  } catch (error: any) {
    console.error("Compliance check error:", error);
    throw new Error(`Compliance check failed: ${error.message || String(error)}`);
  }
}

// ── Batch Compliance Checking ───────────────────────────────────────────────────

export async function checkMultipleContentCompliance(
  items: Array<{ id: string; text: string; channel: string; audience: string }>,
  ruleText: string,
  ruleName: string
): Promise<ComplianceCheckResult[]> {
  // Check items in parallel (with reasonable concurrency limit)
  const BATCH_SIZE = 5;
  const results: ComplianceCheckResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(item =>
        checkContentCompliance(item.text, item.channel, item.audience, ruleText, ruleName)
          .then(result => ({ ...result, contentId: item.id }))
      )
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Handle failed checks
        const item = batch[batchResults.indexOf(result)];
        results.push({
          contentId: item.id,
          score: 0,
          pass: false,
          feedback: "Compliance evaluation failed for this item",
          violations: ["Evaluation API error"],
        });
      }
    }
  }

  return results;
}

// ── Content Generation (if needed) ─────────────────────────────────────────────

export async function generateContent(
  prompt: string,
  responseSchema?: any
): Promise<string> {
  const ai = getGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: responseSchema ? "application/json" : "text/plain",
        maxOutputTokens: 8192,
        responseSchema: responseSchema || undefined,
      },
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Content generation error:", error);
    throw new Error(`Content generation failed: ${error.message || String(error)}`);
  }
}

// ── Image Generation ─────────────────────────────────────────────────────────────

export async function generateImage(
  prompt: string,
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9"
): Promise<string> {
  const ai = getGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize: "1K",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data in response");
  } catch (error: any) {
    console.error("Image generation error:", error);
    throw new Error(`Image generation failed: ${error.message || String(error)}`);
  }
}

// ── Image-to-Image Conversion ────────────────────────────────────────────────────
// Modifies an existing image based on a text prompt (e.g., "change the color", "add text", etc.)

export async function generateImageFromImage(
  baseImageDataUrl: string,
  modificationPrompt: string,
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9"
): Promise<string> {
  console.log('[generateImageFromImage] Starting image-to-image conversion');
  console.log('[generateImageFromImage] Modification prompt:', modificationPrompt);
  console.log('[generateImageFromImage] Aspect ratio:', aspectRatio);
  console.log('[generateImageFromImage] Base image format:', baseImageDataUrl.substring(0, 50) + '...');

  const ai = getGeminiClient();

  try {
    // Parse the base64 data URL
    const base64Match = baseImageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      console.error('[generateImageFromImage] Invalid image data URL format');
      throw new Error("Invalid image data URL format");
    }

    const [, mimeType, base64Data] = base64Match;
    const validMimeType = mimeType === 'jpeg' ? 'image/jpeg' : `image/${mimeType}`;
    const imageSizeBytes = Math.round((base64Data.length * 3) / 4);
    console.log('[generateImageFromImage] Parsed image - MIME type:', validMimeType, 'Size:', `${(imageSizeBytes / 1024).toFixed(2)} KB`);

    // Build the prompt for image modification
    const fullPrompt = `Has to be added or changed: ${modificationPrompt}`;

    console.log('[generateImageFromImage] Sending request to Gemini API...');
    const startTime = Date.now();

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: validMimeType,
            },
          },
          { text: fullPrompt },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize: "1K",
        },
      },
    });

    const duration = Date.now() - startTime;
    console.log('[generateImageFromImage] Received response from Gemini API in', `${duration}ms`);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const resultSizeBytes = Math.round((part.inlineData.data.length * 3) / 4);
        console.log('[generateImageFromImage] ✅ Successfully converted image');
        console.log('[generateImageFromImage] Result - MIME type:', part.inlineData.mimeType, 'Size:', `${(resultSizeBytes / 1024).toFixed(2)} KB`);
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    console.error('[generateImageFromImage] ❌ No image data in response');
    throw new Error("No image data in response");
  } catch (error: any) {
    console.error('[generateImageFromImage] ❌ Image-to-image conversion error:', error);
    console.error('[generateImageFromImage] Error details:', {
      message: error.message,
      stack: error.stack,
      modificationPrompt,
      aspectRatio
    });
    throw new Error(`Image modification failed: ${error.message || String(error)}`);
  }
}

