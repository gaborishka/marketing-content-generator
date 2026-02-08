import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { GoogleGenAI, Type, VideoGenerationReferenceType } from "@google/genai";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
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

import { createJobIfNoActive, updateJobDoc } from "./utils/firestore";
import { runOrchestrator } from "./agents/orchestrator";
import {
  SHOPIFY_API_KEY as SHOPIFY_KEY,
  SHOPIFY_API_SECRET as SHOPIFY_SECRET,
  buildAuthUrl,
  exchangeCodeForToken,
  saveConnection,
  getConnection,
  deleteConnection,
  syncProductsToFirestore,
  sanitizeShop,
  verifyHmac,
} from "./utils/shopify";

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

// ── Shopify Integration ──────────────────────────────────────────────────────

import { onRequest } from "firebase-functions/v2/https";

const SHOPIFY_SCOPES = [
  "read_products",
  "read_product_images",
  "read_product_listings",
];

interface ShopifyAuthInput {
  shop: string;
  redirectUri: string;
}

// Returns the Shopify OAuth authorization URL for the user to visit.
export const shopifyGetAuthUrl = onCall(
  { timeoutSeconds: 10, memory: "256MiB", secrets: [SHOPIFY_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { shop, redirectUri } = request.data as ShopifyAuthInput;
    if (!shop || typeof shop !== "string") {
      throw new HttpsError("invalid-argument", "shop is required.");
    }
    if (!redirectUri || typeof redirectUri !== "string") {
      throw new HttpsError("invalid-argument", "redirectUri is required.");
    }

    try {
      // Generate a random nonce for CSRF protection
      const state = `${request.auth.uid}:${randomUUID()}`;

      // Store the state in Firestore so we can verify it on callback
      await getFirestore()
        .collection("shopifyOAuthStates")
        .doc(state)
        .set({
          userId: request.auth.uid,
          shop: sanitizeShop(shop),
          createdAt: new Date(),
          // Expire after 10 minutes
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

      const authUrl = buildAuthUrl(shop, redirectUri, state, SHOPIFY_SCOPES);

      return { authUrl, state };
    } catch (error: any) {
      console.error("shopifyGetAuthUrl error:", error);
      throw new HttpsError("internal", error.message || "Failed to generate auth URL.");
    }
  }
);

// HTTP endpoint that Shopify redirects to after the merchant approves.
// Exchanges the authorization code for an access token and stores the connection.
export const shopifyOAuthCallback = onRequest(
  {
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [SHOPIFY_KEY, SHOPIFY_SECRET],
    cors: true,
  },
  async (req, res) => {
    try {
      const { code, shop, state, hmac } = req.query as Record<string, string>;

      if (!code || !shop || !state) {
        res.status(400).json({ error: "Missing required query parameters." });
        return;
      }

      // Verify HMAC if present
      if (hmac) {
        const params = req.query as Record<string, string>;
        const valid = await verifyHmac(params, SHOPIFY_SECRET.value());
        if (!valid) {
          res.status(403).json({ error: "HMAC verification failed." });
          return;
        }
      }

      // Verify state exists and hasn't expired
      const stateDoc = await getFirestore()
        .collection("shopifyOAuthStates")
        .doc(state)
        .get();

      if (!stateDoc.exists) {
        res.status(400).json({ error: "Invalid or expired state parameter." });
        return;
      }

      const stateData = stateDoc.data()!;
      const expiresAt = stateData.expiresAt?.toDate?.() || stateData.expiresAt;
      if (new Date() > new Date(expiresAt)) {
        await stateDoc.ref.delete();
        res.status(400).json({ error: "OAuth state expired. Please try again." });
        return;
      }

      const userId = stateData.userId as string;

      // Exchange code for token
      const { accessToken, scope } = await exchangeCodeForToken(shop, code);

      // Save connection
      await saveConnection(userId, shop, accessToken, scope);

      // Clean up state doc
      await stateDoc.ref.delete();

      // Redirect back to the app's products page
      const appUrl =
        stateData.redirectOrigin ||
        req.headers.referer ||
        "/";
      // Redirect to the app with a success indicator
      const redirectUrl = `${appUrl}#/products?shopify=connected&shop=${encodeURIComponent(sanitizeShop(shop))}`;
      res.redirect(303, redirectUrl);
    } catch (error: any) {
      console.error("shopifyOAuthCallback error:", error);
      res.status(500).json({
        error: error.message || "OAuth callback failed.",
      });
    }
  }
);

// Exchange an authorization code for an access token (client-side callback flow).
// This is used when the frontend handles the Shopify redirect directly.
interface ShopifyExchangeTokenInput {
  shop: string;
  code: string;
  state: string;
}

export const shopifyExchangeToken = onCall(
  {
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [SHOPIFY_KEY, SHOPIFY_SECRET],
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { shop, code, state } = request.data as ShopifyExchangeTokenInput;
    if (!shop || !code || !state) {
      throw new HttpsError(
        "invalid-argument",
        "shop, code, and state are required."
      );
    }

    // Verify state
    const stateDoc = await getFirestore()
      .collection("shopifyOAuthStates")
      .doc(state)
      .get();

    if (!stateDoc.exists) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid or expired state parameter."
      );
    }

    const stateData = stateDoc.data()!;
    if (stateData.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "State does not match user.");
    }

    const expiresAt = stateData.expiresAt?.toDate?.() || stateData.expiresAt;
    if (new Date() > new Date(expiresAt)) {
      await stateDoc.ref.delete();
      throw new HttpsError(
        "deadline-exceeded",
        "OAuth state expired. Please try again."
      );
    }

    try {
      const { accessToken, scope } = await exchangeCodeForToken(shop, code);
      await saveConnection(request.auth.uid, shop, accessToken, scope);
      await stateDoc.ref.delete();

      return { success: true, shop: sanitizeShop(shop), scope };
    } catch (error: any) {
      console.error("shopifyExchangeToken error:", error);
      throw new HttpsError(
        "internal",
        error.message || "Failed to exchange token."
      );
    }
  }
);

// Get the current user's Shopify connection status.
export const shopifyGetConnection = onCall(
  { timeoutSeconds: 10, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const connection = await getConnection(request.auth.uid);
    if (!connection) {
      return { connected: false };
    }

    return {
      connected: true,
      shop: connection.shop,
      scope: connection.scope,
      lastSyncedAt: connection.lastSyncedAt?.toDate?.()?.toISOString() || null,
      productCount: connection.productCount || 0,
    };
  }
);

// Sync products from the connected Shopify store.
export const shopifySyncProducts = onCall(
  {
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [SHOPIFY_KEY],
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const connection = await getConnection(request.auth.uid);
    if (!connection) {
      throw new HttpsError(
        "failed-precondition",
        "No Shopify store connected. Please connect your store first."
      );
    }

    try {
      const result = await syncProductsToFirestore(
        request.auth.uid,
        connection.shop,
        connection.accessToken
      );
      return result;
    } catch (error: any) {
      console.error("shopifySyncProducts error:", error);
      throw new HttpsError(
        "internal",
        error.message || "Failed to sync products from Shopify."
      );
    }
  }
);

// Disconnect the Shopify store (removes access token but keeps synced products).
export const shopifyDisconnect = onCall(
  { timeoutSeconds: 10, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    await deleteConnection(request.auth.uid);
    return { success: true };
  }
);
