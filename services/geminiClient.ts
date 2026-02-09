// Frontend service for Gemini API operations via Cloud Functions
// All API calls go through Cloud Functions to keep API keys secure

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { Type } from "@google/genai";

// ── Compliance Checking ────────────────────────────────────────────────────────

export interface ComplianceCheckResult {
  contentId: string;
  score: number;
  pass: boolean;
  feedback: string;
  violations: string[];
  suggestedFix?: string;
}

// Cloud Function reference for single content compliance check
const checkContentComplianceFn = httpsCallable<
  { contentText: string; channel: string; audience: string; ruleText: string; ruleName: string },
  ComplianceCheckResult
>(functions, 'checkContentCompliance');

export async function checkContentCompliance(
  contentText: string,
  channel: string,
  audience: string,
  ruleText: string,
  ruleName: string
): Promise<ComplianceCheckResult> {
  try {
    const result = await checkContentComplianceFn({
      contentText,
      channel,
      audience,
      ruleText,
      ruleName,
    });
    return result.data;
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
  console.log('[checkMultipleContentCompliance] Starting compliance check for', items.length, 'items');
  console.log('[checkMultipleContentCompliance] Rule:', ruleName);
  console.log('[checkMultipleContentCompliance] Items:', items.map(item => ({
    id: item.id,
    textPreview: item.text?.substring(0, 50) + '...',
    textLength: item.text?.length || 0,
    channel: item.channel,
    audience: item.audience,
  })));

  // Check items in parallel (with reasonable concurrency limit)
  const BATCH_SIZE = 5;
  const results: ComplianceCheckResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    console.log(`[checkMultipleContentCompliance] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, items ${i + 1}-${Math.min(i + BATCH_SIZE, items.length)}`);
    
    const batchResults = await Promise.allSettled(
      batch.map((item, index) => {
        console.log(`[checkMultipleContentCompliance] Checking item ${item.id}...`);
        return checkContentCompliance(item.text, item.channel, item.audience, ruleText, ruleName)
          .then(result => {
            console.log(`[checkMultipleContentCompliance] ✅ Item ${item.id} - Score: ${result.score}, Pass: ${result.pass}`);
            return { ...result, contentId: item.id };
          })
          .catch(error => {
            console.error(`[checkMultipleContentCompliance] ❌ Item ${item.id} failed:`, error);
            // Return error result that will be caught by Promise.allSettled
            throw { item, error };
          });
      })
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Handle failed checks - get the item from the batch using the index
        const item = batch[j];
        const error = result.reason?.error || result.reason;
        console.error(`[checkMultipleContentCompliance] ❌ Compliance check failed for item ${item.id}:`, error);
        results.push({
          contentId: item.id,
          score: 0,
          pass: false,
          feedback: `Compliance evaluation failed: ${error?.message || 'Unknown error'}`,
          violations: ["Evaluation API error"],
        });
      }
    }
  }

  console.log('[checkMultipleContentCompliance] Completed. Results:', results.length, 'items checked');
  return results;
}

// ── Content Generation (if needed) ─────────────────────────────────────────────

// Cloud Function reference for content generation
const generateContentFn = httpsCallable<
  { prompt: string; responseSchema?: any },
  { text: string }
>(functions, 'generateContent');

export async function generateContent(
  prompt: string,
  responseSchema?: any
): Promise<string> {
  try {
    const result = await generateContentFn({ prompt, responseSchema });
    return result.data.text || "";
  } catch (error: any) {
    console.error("Content generation error:", error);
    throw new Error(`Content generation failed: ${error.message || String(error)}`);
  }
}

// ── Image Generation ─────────────────────────────────────────────────────────────

// Cloud Function reference for image generation
const generateImageFn = httpsCallable<
  { prompt: string; aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" },
  { mimeType: string; data: string }
>(functions, 'generateImage');

export async function generateImage(
  prompt: string,
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9"
): Promise<string> {
  try {
    const result = await generateImageFn({ prompt, aspectRatio });
    return `data:${result.data.mimeType};base64,${result.data.data}`;
  } catch (error: any) {
    console.error("Image generation error:", error);
    throw new Error(`Image generation failed: ${error.message || String(error)}`);
  }
}

// Cloud Function reference for image-to-image conversion
const generateImageFromImageFn = httpsCallable<
  { baseImageData: string; mimeType: string; modificationPrompt: string; aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" },
  { mimeType: string; data: string }
>(functions, 'generateImageFromImage');

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

    console.log('[generateImageFromImage] Sending request to Cloud Function...');
    const startTime = Date.now();

    const result = await generateImageFromImageFn({
      baseImageData: base64Data,
      mimeType: validMimeType,
      modificationPrompt,
      aspectRatio,
    });

    const duration = Date.now() - startTime;
    console.log('[generateImageFromImage] Received response from Cloud Function in', `${duration}ms`);

    const resultSizeBytes = Math.round((result.data.data.length * 3) / 4);
    console.log('[generateImageFromImage] ✅ Successfully converted image');
    console.log('[generateImageFromImage] Result - MIME type:', result.data.mimeType, 'Size:', `${(resultSizeBytes / 1024).toFixed(2)} KB`);
    
    return `data:${result.data.mimeType};base64,${result.data.data}`;
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

