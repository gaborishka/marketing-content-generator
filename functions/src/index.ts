import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const getAiClient = () => new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });

// ── generateContent ──────────────────────────────────────────────────────────

export const generateContent = onCall(
  { timeoutSeconds: 120, memory: "512MiB", secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { prompt, responseSchema } = request.data;
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

    const { prompt } = request.data;
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
            aspectRatio: "16:9",
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

const resolveReferenceImage = async (entry: any) => {
  // Already has inline bytes — pass through
  if (entry.image?.imageBytes) return entry;

  const url: string | undefined = entry.imageUrl;
  if (!url) {
    throw new HttpsError("invalid-argument", "Reference image must have image.imageBytes or imageUrl.");
  }

  const res = await fetch(url);
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
    referenceType: entry.referenceType || "ASSET",
  };
};

// ── generateVideo ────────────────────────────────────────────────────────────

export const generateVideo = onCall(
  { timeoutSeconds: 540, memory: "2GiB", secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { referenceImages, prompt, contentId } = request.data;
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

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        throw new HttpsError("internal", "No video URI returned.");
      }

      // Download the video server-side using auth header (avoids key in URL/logs)
      const videoRes = await fetch(downloadLink, {
        headers: { "x-goog-api-key": GEMINI_API_KEY.value() },
      });
      if (!videoRes.ok) {
        throw new HttpsError("internal", `Failed to download video: ${videoRes.statusText}`);
      }

      const arrayBuffer = await videoRes.arrayBuffer();
      const videoBuffer = Buffer.from(arrayBuffer);
      const mimeType = videoRes.headers.get("content-type") || "video/mp4";

      // Upload to Firebase Storage
      const uid = request.auth!.uid;
      const filePath = `users/${uid}/content/${contentId}/video.mp4`;
      const bucket = getStorage().bucket();
      const file = bucket.file(filePath);
      const downloadToken = randomUUID();

      await file.save(videoBuffer, {
        metadata: {
          contentType: mimeType,
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
