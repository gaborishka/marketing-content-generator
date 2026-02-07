// Generator agent: text generation via Gemini Flash.
// Builds prompts from PlannerContext, calls Gemini, writes content docs to Firestore.

import { getGeminiClient } from "../utils/gemini";
import { writeContentDoc, updateContentDoc } from "../utils/firestore";
import {
  PlannerContext,
  AgentResult,
  ContentDoc,
  SceneDoc,
  ComplianceFeedback,
} from "../types/pipeline";
import {
  buildGenerationPrompt,
  buildRegenerationPrompt,
  GENERATION_RESPONSE_SCHEMA,
  REGENERATION_RESPONSE_SCHEMA,
} from "../prompts/generator.prompt";

const MODEL = "gemini-3-flash-preview";

interface GeneratedItem {
  channel: string;
  audience: string;
  text: string;
  complianceScore: number;
  riskLevel: "low" | "medium" | "high";
  storyboard?: { sceneNumber: number; imagePrompt: string; voiceover: string }[];
}

// ── generateText ────────────────────────────────────────────────────────────

export async function generateText(
  ctx: PlannerContext,
  campaignId: string,
  userId: string,
  jobId: string
): Promise<AgentResult<ContentDoc[]>> {
  try {
    const prompt = buildGenerationPrompt(ctx);
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: GENERATION_RESPONSE_SCHEMA,
      },
    });

    const cleanText = (response.text || "[]")
      .replace(/```json\n?|```/g, "")
      .trim();

    let rawData: GeneratedItem[];
    try {
      rawData = JSON.parse(cleanText);
    } catch {
      return { success: false, error: "Failed to parse Gemini JSON response" };
    }

    if (!Array.isArray(rawData)) {
      return { success: false, error: "Gemini response is not an array" };
    }

    if (rawData.length === 0) {
      return { success: false, error: "Gemini returned empty content array" };
    }

    // Write content docs to Firestore
    const contentDocs: ContentDoc[] = [];
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const contentId = `gen-${jobId}-${Date.now()}-${i}`;

      let storyboard: SceneDoc[] | undefined;
      if (item.channel === "Video Storyboard" && item.storyboard) {
        storyboard = item.storyboard.map((scene) => ({
          sceneNumber: scene.sceneNumber,
          imagePrompt: scene.imagePrompt,
          voiceover: scene.voiceover,
          imageUrl: "",
        }));
      }

      const doc: ContentDoc = {
        id: contentId,
        campaignId,
        userId,
        channel: item.channel,
        audience: item.audience,
        text: item.text,
        imageUrl: "",
        complianceScore: item.complianceScore,
        status: "draft",
        riskLevel: item.riskLevel,
        x: 0,
        y: 0,
        storyboard,
        generationJobId: jobId,
      };

      await writeContentDoc(doc);
      contentDocs.push(doc);
    }

    return { success: true, data: contentDocs };
  } catch (error: any) {
    return {
      success: false,
      error: `Generator failed: ${error.message || String(error)}`,
    };
  }
}

// ── regenerateText ──────────────────────────────────────────────────────────

export async function regenerateText(
  ctx: PlannerContext,
  failedDoc: ContentDoc,
  feedback: ComplianceFeedback
): Promise<AgentResult<ContentDoc>> {
  try {
    const prompt = buildRegenerationPrompt(
      ctx,
      failedDoc.text,
      failedDoc.channel,
      failedDoc.audience,
      feedback
    );
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        responseSchema: REGENERATION_RESPONSE_SCHEMA,
      },
    });

    const cleanText = (response.text || "{}")
      .replace(/```json\n?|```/g, "")
      .trim();

    let item: GeneratedItem;
    try {
      item = JSON.parse(cleanText);
    } catch {
      return {
        success: false,
        error: "Failed to parse Gemini regeneration response",
      };
    }

    let storyboard: SceneDoc[] | undefined;
    if (item.channel === "Video Storyboard" && item.storyboard) {
      storyboard = item.storyboard.map((scene) => ({
        sceneNumber: scene.sceneNumber,
        imagePrompt: scene.imagePrompt,
        voiceover: scene.voiceover,
        imageUrl: "",
      }));
    }

    const updatedFields: Partial<ContentDoc> = {
      text: item.text,
      complianceScore: item.complianceScore,
      riskLevel: item.riskLevel,
    };
    if (storyboard) {
      updatedFields.storyboard = storyboard;
    }

    await updateContentDoc(failedDoc.id, updatedFields);

    const updatedDoc: ContentDoc = {
      ...failedDoc,
      ...updatedFields,
      storyboard: storyboard || failedDoc.storyboard,
    };

    return { success: true, data: updatedDoc };
  } catch (error: any) {
    return {
      success: false,
      error: `Regeneration failed: ${error.message || String(error)}`,
    };
  }
}
