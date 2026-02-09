// Asset Manager agent: server-side image generation + Firebase Storage upload.
// Pure code — no LLM orchestration. Generates images via Gemini, uploads to Storage,
// updates Firestore content docs with download URLs.

import { getGeminiClient } from "../utils/gemini";
import { uploadImageToStorage } from "../utils/storage";
import { updateContentDoc } from "../utils/firestore";
import { AgentResult, ContentDoc, ImageAspectRatio, SceneDoc, getAspectRatioForChannel } from "../types/pipeline";

const IMAGE_MODEL = "gemini-3-pro-image-preview";
const CONCURRENCY_LIMIT = 3;

export interface AssetManagerInput {
  contentDocs: ContentDoc[];
  userId: string;
}

export interface AssetManagerResult {
  totalImages: number;
  successCount: number;
  failureCount: number;
}

// ── Generate a single image from a prompt ───────────────────────────────────

async function generateImage(prompt: string, aspectRatio: ImageAspectRatio = "16:9"): Promise<{ data: string; mimeType: string } | null> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio,
        imageSize: "1K",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData && part.inlineData.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  return null;
}

// ── Build an image prompt from a content doc ────────────────────────────────

function buildImagePrompt(doc: ContentDoc): string {
  const channelHint = doc.channel.toLowerCase().includes("instagram")
    ? "vibrant, eye-catching social media"
    : doc.channel.toLowerCase().includes("email")
      ? "professional email header"
      : doc.channel.toLowerCase().includes("twitter")
        ? "bold social media graphic"
        : "marketing";

  return `Create a ${channelHint} image for this marketing content: "${doc.text.slice(0, 200)}". Style: modern, professional, high quality.`;
}

// ── Process a single regular content item (1 hero image) ────────────────────

async function processRegularContent(
  doc: ContentDoc,
  userId: string
): Promise<boolean> {
  try {
    const prompt = buildImagePrompt(doc);
    const aspectRatio = getAspectRatioForChannel(doc.channel);
    const imageResult = await generateImage(prompt, aspectRatio);

    if (!imageResult) {
      return false;
    }

    // Try to upload to Storage, but fallback to base64 if Storage fails
    try {
      const imageBuffer = Buffer.from(imageResult.data, "base64");
      const { downloadUrl } = await uploadImageToStorage(
        userId,
        doc.id,
        imageBuffer,
        imageResult.mimeType,
        "hero.png"
      );

      await updateContentDoc(doc.id, { imageUrl: downloadUrl });
    } catch (storageError: any) {
      // Fallback: use base64 data URL (like AI chat does)
      // This works even when Storage emulator isn't running or has auth issues
      console.warn(`[AssetManager] Storage upload failed for content ${doc.id}, using base64 fallback:`, storageError.message);
      const base64Url = `data:${imageResult.mimeType};base64,${imageResult.data}`;
      await updateContentDoc(doc.id, { imageUrl: base64Url });
    }
    
    return true;
  } catch (error: any) {
    console.error(`[AssetManager] Failed to process regular content ${doc.id}:`, error);
    return false;
  }
}

// ── Process a video storyboard content item (scene images) ──────────────────

async function processStoryboardContent(
  doc: ContentDoc,
  userId: string
): Promise<boolean> {
  if (!doc.storyboard || doc.storyboard.length === 0) {
    return false;
  }

  let anySuccess = false;
  const updatedScenes: SceneDoc[] = [...doc.storyboard];
  const aspectRatio = getAspectRatioForChannel(doc.channel);

  for (let i = 0; i < doc.storyboard.length; i++) {
    const scene = doc.storyboard[i];

    try {
      const imageResult = await generateImage(scene.imagePrompt, aspectRatio);
      if (!imageResult) continue;

      const imageBuffer = Buffer.from(imageResult.data, "base64");
      const { downloadUrl } = await uploadImageToStorage(
        userId,
        doc.id,
        imageBuffer,
        imageResult.mimeType,
        `scene-${scene.sceneNumber}.png`
      );

      updatedScenes[i] = { ...scene, imageUrl: downloadUrl };
      anySuccess = true;

      // Update Firestore immediately so frontend sees each scene as it completes
      await updateContentDoc(doc.id, { storyboard: updatedScenes });
    } catch (error) {
      // Scene image failure is non-blocking — continue with remaining scenes
      console.error(`Failed to generate scene ${scene.sceneNumber} for ${doc.id}:`, error);
    }
  }

  return anySuccess;
}

// ── Process a single content doc (dispatches to regular or storyboard) ──────

async function processContentDoc(
  doc: ContentDoc,
  userId: string
): Promise<boolean> {
  try {
    if (doc.channel === "Video Storyboard" && doc.storyboard) {
      return await processStoryboardContent(doc, userId);
    }
    return await processRegularContent(doc, userId);
  } catch (error) {
    // Image failure is non-blocking — content item remains valid with empty imageUrl
    console.error(`Asset processing failed for ${doc.id}:`, error);
    return false;
  }
}

// ── Run asset manager with concurrency-limited parallel execution ───────────

export async function runAssetManager(
  input: AssetManagerInput
): Promise<AgentResult<AssetManagerResult>> {
  const { contentDocs, userId } = input;

  if (contentDocs.length === 0) {
    return {
      success: true,
      data: { totalImages: 0, successCount: 0, failureCount: 0 },
    };
  }

  let successCount = 0;
  let failureCount = 0;
  const totalImages = contentDocs.length;

  // Process in batches with concurrency limit
  for (let i = 0; i < contentDocs.length; i += CONCURRENCY_LIMIT) {
    const batch = contentDocs.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.allSettled(
      batch.map((doc) => processContentDoc(doc, userId))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        successCount++;
      } else {
        failureCount++;
      }
    }
  }

  return {
    success: true,
    data: { totalImages, successCount, failureCount },
  };
}
