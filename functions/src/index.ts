import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { GoogleGenAI, Type, VideoGenerationReferenceType } from "@google/genai";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import { join } from "path";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { GEMINI_API_KEY } from "./utils/gemini";

initializeApp();

// ── Input interfaces for Cloud Function request.data ─────────────────────────

interface GenerateContentInput {
  prompt: string;
  responseSchema?: {
    type: Type;
    items?: Record<string, unknown>;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface GenerateImageInput {
  prompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
}

interface ReferenceImageEntry {
  image?: { imageBytes: string; mimeType: string };
  imageUrl?: string;
  referenceType?: VideoGenerationReferenceType;
}

interface GenerateVideoInput {
  referenceImages: ReferenceImageEntry[];
  prompt?: string;
  contentId: string;
}

const getAiClient = () => new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

// ── generateContent ──────────────────────────────────────────────────────────

export const generateContent = onCall(
  { timeoutSeconds: 120, memory: "512MiB", secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { prompt, responseSchema } = request.data as GenerateContentInput;
    if (!prompt) {
      throw new HttpsError("invalid-argument", "prompt is required.");
    }

    const ai = getAiClient();

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: responseSchema || undefined,
        },
      });

      return { text: response.text || "" };
    } catch (error: any) {
      console.error("generateContent error:", error);
      throw new HttpsError("internal", error.message || "Content generation failed.");
    }
  }
);

// ── generateImage ────────────────────────────────────────────────────────────

export const generateImage = onCall(
  { timeoutSeconds: 120, memory: "1GiB", secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { prompt, aspectRatio } = request.data as GenerateImageInput;
    if (!prompt) {
      throw new HttpsError("invalid-argument", "prompt is required.");
    }

    const ai = getAiClient();

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || "16:9",
            imageSize: "1K",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          };
        }
      }

      throw new HttpsError("internal", "No image data in response.");
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error("generateImage error:", error);
      throw new HttpsError("internal", error.message || "Image generation failed.");
    }
  }
);

// ── resolveReferenceImage ────────────────────────────────────────────────────
// Resolve a reference image entry from the client. If it already contains
// inline imageBytes it is returned as-is. If it contains an imageUrl the
// image is fetched server-side (avoids a server→client→server round-trip for
// images that are already in Firebase Storage or on the web).

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_HOSTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
];

const resolveReferenceImage = async (entry: ReferenceImageEntry) => {
  // Already has inline bytes — pass through
  if (entry.image?.imageBytes) return entry;

  const url: string | undefined = entry.imageUrl;
  if (!url) {
    throw new HttpsError("invalid-argument", "Reference image must have image.imageBytes or imageUrl.");
  }

  // Validate URL: only allow HTTPS to known hosts (prevent SSRF)
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpsError("invalid-argument", "Invalid image URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "Image URL must use HTTPS.");
  }
  if (!ALLOWED_IMAGE_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    throw new HttpsError("invalid-argument", `Image URL host not allowed: ${parsed.hostname}`);
  }

  const res = await fetch(url, { redirect: "error" });
  if (!res.ok) {
    throw new HttpsError("internal", `Failed to fetch reference image: ${res.statusText}`);
  }

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_IMAGE_SIZE) {
    throw new HttpsError(
      "invalid-argument",
      `Image too large (${Math.round(arrayBuf.byteLength / 1024 / 1024)}MB). Max ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`
    );
  }

  const mimeType = res.headers.get("content-type") || "image/png";
  const imageBytes = Buffer.from(arrayBuf).toString("base64");

  return {
    image: { imageBytes, mimeType },
    referenceType: entry.referenceType || VideoGenerationReferenceType.ASSET,
  };
};

// ── generateVideo ────────────────────────────────────────────────────────────

export const generateVideo = onCall(
  { timeoutSeconds: 540, memory: "2GiB", secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { referenceImages, prompt, contentId } = request.data as GenerateVideoInput;
    if (!referenceImages || referenceImages.length === 0) {
      throw new HttpsError("invalid-argument", "referenceImages is required.");
    }
    if (!contentId || typeof contentId !== "string") {
      throw new HttpsError("invalid-argument", "contentId is required.");
    }

    // Resolve any URL-based reference images server-side
    const resolvedImages = await Promise.all(referenceImages.map(resolveReferenceImage));

    const ai = getAiClient();
    const startTime = Date.now();
    // Leave 30s safety margin before the 540s Cloud Functions timeout
    const maxPollMs = (540 - 30) * 1000;

    try {
      let operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: prompt || "A cinematic commercial video. Smooth transitions between scenes. High quality, 4k.",
        config: {
          numberOfVideos: 1,
          referenceImages: resolvedImages,
          resolution: "720p",
          aspectRatio: "16:9",
        },
      });

      // Poll for completion with timeout guard
      while (!operation.done) {
        if (Date.now() - startTime > maxPollMs) {
          throw new HttpsError(
            "deadline-exceeded",
            "Video generation timed out. The video may still be processing — try again later."
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      if (operation.error) {
        throw new HttpsError(
          "internal",
          `Video generation failed: ${operation.error.message || "Unknown error"}`
        );
      }

      const generatedVideo = operation.response?.generatedVideos?.[0];
      if (!generatedVideo) {
        console.error("generateVideo: empty response.", JSON.stringify(operation.response));
        throw new HttpsError("internal", "No video in response.");
      }

      // Download via SDK (handles Gemini API auth automatically)
      const tmpPath = join(tmpdir(), `video-${contentId}-${Date.now()}.mp4`);
      await ai.files.download({ file: generatedVideo, downloadPath: tmpPath });

      const videoBuffer = await readFile(tmpPath);
      // Clean up temp file (fire-and-forget)
      unlink(tmpPath).catch(() => {});

      // Upload to Firebase Storage
      const uid = request.auth!.uid;
      const filePath = `users/${uid}/content/${contentId}/video.mp4`;
      const bucket = getStorage().bucket();
      const file = bucket.file(filePath);
      const downloadToken = randomUUID();

      await file.save(videoBuffer, {
        metadata: {
          contentType: "video/mp4",
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      });

      // Construct Firebase download URL
      const encodedPath = encodeURIComponent(filePath);
      const videoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

      return { videoUrl };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error("generateVideo error:", error);
      throw new HttpsError("internal", error.message || "Video generation failed.");
    }
  }
);

// ── generateCampaignContent ──────────────────────────────────────────────────
// Quick onCall trigger: validates input, creates a job doc, returns { jobId }.
// The actual pipeline runs asynchronously via processGenerationJob below.

import { createJobIfNoActive, updateJobDoc, getContentForCampaign, getComplianceRule, getCampaignsForUser } from "./utils/firestore";
import { runOrchestrator } from "./agents/orchestrator";
import { runComplianceCheck } from "./agents/compliance";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { ComplianceResult, ComplianceRuleDoc } from "./types/pipeline";

interface GenerateCampaignInput {
  campaignId: string;
}

export const generateCampaignContent = onCall(
  { timeoutSeconds: 30, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { campaignId } = request.data as GenerateCampaignInput;
    if (!campaignId || typeof campaignId !== "string") {
      throw new HttpsError("invalid-argument", "campaignId is required.");
    }

    const jobId = `job-${randomUUID()}`;
    const userId = request.auth.uid;

    try {
      // Atomically check for active jobs and create in a single transaction
      await createJobIfNoActive(jobId, {
        userId,
        campaignId,
        status: "pending",
        progress: 0,
        phase: "Queued",
        contentIds: [],
        itemsCompleted: 0,
        itemsTotal: 0,
        retryCount: 0,
      });

      return { jobId };
    } catch (error: any) {
      if (error.message === "ACTIVE_JOB_EXISTS") {
        throw new HttpsError("already-exists", "A generation job is already running for this campaign.");
      }
      console.error("generateCampaignContent error:", error);
      throw new HttpsError("internal", error.message || "Failed to create generation job.");
    }
  }
);

// ── processGenerationJob ─────────────────────────────────────────────────────
// Firestore trigger: runs the full agent pipeline when a job doc is created.

export const processGenerationJob = onDocumentCreated(
  {
    document: "generationJobs/{jobId}",
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [GEMINI_API_KEY],
  },
  async (event) => {
    const snap = event.data;
    const jobId = event.params.jobId;

    if (!snap) {
      console.error("processGenerationJob: no snapshot data");
      try { await updateJobDoc(jobId, { status: "failed", phase: "Failed", error: "No snapshot data" }); } catch {}
      return;
    }

    const data = snap.data();
    const campaignId = data.campaignId as string;
    const userId = data.userId as string;

    if (!campaignId || !userId) {
      console.error("processGenerationJob: missing campaignId or userId in job doc");
      try { await updateJobDoc(jobId, { status: "failed", phase: "Failed", error: "Missing campaignId or userId" }); } catch {}
      return;
    }

    try {
      const result = await runOrchestrator({
        campaignId,
        userId,
        jobId,
        maxSeconds: 540,
      });

      if (!result.success) {
        console.error(`Pipeline failed for job ${jobId}:`, result.error);
      }
    } catch (error: any) {
      console.error(`Unhandled pipeline error for job ${jobId}:`, error);
      try {
        await updateJobDoc(jobId, { status: "failed", phase: "Failed", error: "Content generation failed. Please try again." });
      } catch {
        console.error(`Failed to mark job ${jobId} as failed after unhandled error`);
      }
      // Note: clearJobLock is handled by the orchestrator's finally block
    }
  }
);

// ── checkCompliance ──────────────────────────────────────────────────────────
// Standalone compliance checking for existing content items or campaigns

interface CheckComplianceInput {
  contentIds?: string[];      // Specific content items to check (optional)
  campaignId?: string;         // Check all content in a campaign (optional)
  ruleId: string;              // Compliance rule to check against
}

export const checkCompliance = onCall(
  { timeoutSeconds: 300, memory: "512MiB", secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { contentIds, campaignId, ruleId } = request.data as CheckComplianceInput;
    const userId = request.auth.uid;

    // Validate input
    if (!ruleId || typeof ruleId !== "string") {
      throw new HttpsError("invalid-argument", "ruleId is required.");
    }

    if (!contentIds && !campaignId) {
      throw new HttpsError("invalid-argument", "Either contentIds or campaignId must be provided.");
    }

    if (contentIds && campaignId) {
      throw new HttpsError("invalid-argument", "Provide either contentIds or campaignId, not both.");
    }

    try {
      // Fetch compliance rule
      const rule = await getComplianceRule(ruleId);
      if (!rule) {
        throw new HttpsError("not-found", "Compliance rule not found.");
      }

      if (rule.userId !== userId) {
        throw new HttpsError("permission-denied", "You don't have access to this compliance rule.");
      }

      // Fetch content items
      let contentDocs: any[] = [];

      if (contentIds) {
        // Fetch specific content items
        const db = getFirestore();
        const contentRef = db.collection("content");
        
        for (const contentId of contentIds) {
          const doc = await contentRef.doc(contentId).get();
          if (doc.exists) {
            const data = doc.data();
            if (data?.userId === userId) {
              contentDocs.push({ id: doc.id, ...data });
            }
          }
        }

        if (contentDocs.length === 0) {
          throw new HttpsError("not-found", "No accessible content items found.");
        }
      } else if (campaignId) {
        // Fetch all content for campaign
        contentDocs = await getContentForCampaign(campaignId, userId);
        
        if (contentDocs.length === 0) {
          throw new HttpsError("not-found", "No content found for this campaign.");
        }
      }

      // Run compliance check
      const result = await runComplianceCheck(
        contentDocs,
        rule.name,
        rule.ruleText,
        0 // retryAttempt = 0 for standalone checks
      );

      if (!result.success) {
        throw new HttpsError("internal", result.error || "Compliance check failed.");
      }

      // Return summary
      const passed = result.data?.filter(r => r.pass).length || 0;
      const failed = result.data?.filter(r => !r.pass).length || 0;
      const total = result.data?.length || 0;

      return {
        success: true,
        total,
        passed,
        failed,
        results: result.data,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("checkCompliance error:", error);
      throw new HttpsError("internal", error.message || "Failed to check compliance.");
    }
  }
);

// ── analyzeCampaignsCompliance ─────────────────────────────────────────────────
// Analyzes all campaigns against selected compliance rules and stores results

interface AnalyzeCampaignsInput {
  ruleIds: string[];  // Array of compliance rule IDs to check against
}

interface CampaignAnalysisResult {
  campaignId: string;
  campaignName: string;
  ruleId: string;
  ruleName: string;
  totalContent: number;
  passed: number;
  failed: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  results: any[];
  analyzedAt: string;
}

export const analyzeCampaignsCompliance = onCall(
  { timeoutSeconds: 600, memory: "1GiB", secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { ruleIds } = request.data as AnalyzeCampaignsInput;
    const userId = request.auth.uid;

    if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
      throw new HttpsError("invalid-argument", "ruleIds array is required.");
    }

    try {
      // Fetch all campaigns for user
      const campaigns = await getCampaignsForUser(userId);
      
      if (campaigns.length === 0) {
        return {
          success: true,
          results: [],
          message: "No campaigns found to analyze.",
        };
      }

      // Fetch all compliance rules
      const rules = await Promise.all(
        ruleIds.map(ruleId => getComplianceRule(ruleId))
      );

      const validRules = rules.filter((rule): rule is ComplianceRuleDoc => 
        rule !== null && rule.userId === userId
      );

      if (validRules.length === 0) {
        throw new HttpsError("not-found", "No valid compliance rules found.");
      }

      const analysisResults: CampaignAnalysisResult[] = [];
      const db = getFirestore();
      const analyticsRef = db.collection("campaignComplianceAnalytics");

      // Analyze each campaign against each rule
      for (const campaign of campaigns) {
        // Get all content for this campaign
        const contentDocs = await getContentForCampaign(campaign.id, userId);
        
        if (contentDocs.length === 0) {
          // Skip campaigns with no content
          continue;
        }

        for (const rule of validRules) {
          if (!rule) continue; // Skip null rules
          
          // Run compliance check
          const complianceResult = await runComplianceCheck(
            contentDocs,
            rule.name,
            rule.ruleText,
            0
          );

          if (!complianceResult.success || !complianceResult.data) {
            continue;
          }

          const results = complianceResult.data;
          const passed = results.filter((r: any) => r.pass).length;
          const failed = results.filter((r: any) => !r.pass).length;
          const scores = results.map((r: any) => r.score);
          const averageScore = scores.length > 0 
            ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
            : 0;
          const minScore = scores.length > 0 ? Math.min(...scores) : 0;
          const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

          const analysis: CampaignAnalysisResult = {
            campaignId: campaign.id,
            campaignName: campaign.name,
            ruleId: rule.id,
            ruleName: rule.name,
            totalContent: results.length,
            passed,
            failed,
            averageScore,
            minScore,
            maxScore,
            results,
            analyzedAt: new Date().toISOString(),
          };

          analysisResults.push(analysis);

          // Store result in Firestore
          const docId = `${campaign.id}_${rule.id}_${Date.now()}`;
          await analyticsRef.doc(docId).set({
            userId,
            ...analysis,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // Calculate summary statistics
      const totalCampaigns = new Set(analysisResults.map(r => r.campaignId)).size;
      const totalContent = analysisResults.reduce((sum, r) => sum + r.totalContent, 0);
      const totalPassed = analysisResults.reduce((sum, r) => sum + r.passed, 0);
      const totalFailed = analysisResults.reduce((sum, r) => sum + r.failed, 0);
      const overallAverage = analysisResults.length > 0
        ? Math.round(analysisResults.reduce((sum, r) => sum + r.averageScore, 0) / analysisResults.length)
        : 0;

      return {
        success: true,
        summary: {
          totalCampaigns,
          totalRules: validRules.length,
          totalContent,
          totalPassed,
          totalFailed,
          overallAverage,
        },
        results: analysisResults,
      };
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      console.error("analyzeCampaignsCompliance error:", error);
      throw new HttpsError("internal", error.message || "Failed to analyze campaigns.");
    }
  }
);
