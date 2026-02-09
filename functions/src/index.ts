import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { GoogleGenAI, Type, VideoGenerationReferenceType } from "@google/genai";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { join } from "path";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { GEMINI_API_KEY } from "./utils/gemini";
import { buildLandingPageSystemPrompt, parseLandingPageResponse, mapMessageToGeminiContent } from "./prompts/landingPage.prompt";
import {
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
  SHOPIFY_API_VERSION,
  ShopifyAuthError,
  fetchShopifyProducts as fetchShopifyProductsApi,
  fetchShopifyProduct,
  mapShopifyToProduct,
} from "./utils/shopify";
import {
  buildShopifyAuthUrl,
  verifyShopifyHmac,
  exchangeCodeForToken,
  isValidShopDomain,
} from "./shopify/auth";
import {
  getShopifyConnection,
  setShopifyConnection,
  deleteShopifyConnection,
  getShopifyProducts as getShopifyProductDocs,
  setProductDoc,
  deleteProductDoc,
} from "./utils/firestore";

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

// ── generateLandingPage ──────────────────────────────────────────────────────

interface GenerateLandingPageInput {
  conversationHistory: { role: string; content: string; images?: string[] }[];
  currentHtml?: string;
}

export const generateLandingPage = onCall(
  { timeoutSeconds: 120, memory: "1GiB", secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { conversationHistory, currentHtml } = request.data as GenerateLandingPageInput;
    if (!conversationHistory || conversationHistory.length === 0) {
      throw new HttpsError("invalid-argument", "conversationHistory is required.");
    }

    const ai = getAiClient();

    const contents = conversationHistory.map(mapMessageToGeminiContent);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: buildLandingPageSystemPrompt(currentHtml || undefined),
          maxOutputTokens: 32768,
        },
      });

      const text = response.text || "";
      return parseLandingPageResponse(text);
    } catch (error: any) {
      console.error("generateLandingPage error:", error);
      throw new HttpsError("internal", error.message || "Landing page generation failed.");
    }
  }
);

// ── generateCampaignContent ──────────────────────────────────────────────────
// Quick onCall trigger: validates input, creates a job doc, returns { jobId }.
// The actual pipeline runs asynchronously via processGenerationJob below.

import { createJobIfNoActive, updateJobDoc } from "./utils/firestore";
import { runOrchestrator } from "./agents/orchestrator";

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

// ── Shopify OAuth ──────────────────────────────────────────────────────────

const SHOPIFY_REDIRECT_PATH = "shopifyAuthCallback";

const SHOPIFY_INSTALL_URL = "https://admin.shopify.com/oauth/install_custom_app?client_id=64d2d6b17596adbfcdf39c6bbdd40e9c&no_redirect=true&signature=eyJleHBpcmVzX2F0IjoxNzcxMTQ3Mzg0LCJwZXJtYW5lbnRfZG9tYWluIjoiYWdvcnl4Lm15c2hvcGlmeS5jb20iLCJjbGllbnRfaWQiOiI2NGQyZDZiMTc1OTZhZGJmY2RmMzljNmJiZGQ0MGU5YyIsInB1cnBvc2UiOiJjdXN0b21fYXBwIiwibWVyY2hhbnRfb3JnYW5pemF0aW9uX2lkIjoxNTQxOTM4Njd9--ef43dcdbcace615af1320cdda5cd91625b1c8071";
const SHOPIFY_SHOP_DOMAIN = "agoryx.myshopify.com";

export const shopifyAuthInit = onCall(
  { timeoutSeconds: 10, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;

    // Store pending auth for user association on callback
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
    await getFirestore().collection("shopifyOAuthStates").doc(randomUUID()).set({
      userId,
      shopDomain: SHOPIFY_SHOP_DOMAIN,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt.toISOString(),
    });

    return { authUrl: SHOPIFY_INSTALL_URL };
  }
);

export const shopifyAuthCallback = onRequest(
  { timeoutSeconds: 30, memory: "256MiB", secrets: [SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET], cors: true },
  async (req, res) => {
    const query = req.query as Record<string, string>;
    const { code, state, shop } = query;

    // App launch redirect (no code) — re-initiate OAuth to get a code.
    // This happens when Shopify redirects to the callback for an already-installed
    // app (e.g. via custom install URL). The standard OAuth authorize endpoint
    // will return with a code even for installed apps.
    if (!code) {
      if (shop && isValidShopDomain(shop)) {
        // Look up the pending auth state to find the userId
        const pendingStates = await getFirestore()
          .collection("shopifyOAuthStates")
          .where("shopDomain", "==", shop)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        let userId: string | undefined;
        if (!pendingStates.empty) {
          userId = pendingStates.docs[0].data().userId as string;
        }

        if (!userId) {
          const configDoc = await getFirestore().collection("appConfig").doc("shopify").get();
          const frontendUrl = configDoc.exists ? configDoc.data()?.frontendUrl : null;
          const redirectBase = frontendUrl || "http://localhost:3000";
          res.redirect(`${redirectBase}/#/products?shopify=error&reason=no_pending_auth`);
          return;
        }

        // Generate a fresh state token and persist it
        const newState = randomUUID();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await getFirestore().collection("shopifyOAuthStates").doc(newState).set({
          userId,
          shopDomain: shop,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: expiresAt.toISOString(),
        });

        const redirectUri = `https://us-central1-${process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || ""}.cloudfunctions.net/${SHOPIFY_REDIRECT_PATH}`;
        const authUrl = buildShopifyAuthUrl(shop, SHOPIFY_CLIENT_ID.value(), redirectUri, newState);
        res.redirect(authUrl);
      } else {
        const configDoc = await getFirestore().collection("appConfig").doc("shopify").get();
        const frontendUrl = configDoc.exists ? configDoc.data()?.frontendUrl : null;
        const redirectBase = frontendUrl || "http://localhost:3000";
        res.redirect(`${redirectBase}/#/products`);
      }
      return;
    }

    if (!shop) {
      res.status(400).send("Missing required OAuth parameter: shop.");
      return;
    }

    // Verify HMAC
    if (!verifyShopifyHmac(query, SHOPIFY_CLIENT_SECRET.value())) {
      res.status(403).send("HMAC verification failed.");
      return;
    }

    let userId: string;
    let shopDomain: string;

    if (state) {
      // Standard OAuth flow: verify state token directly
      const stateRef = getFirestore().collection("shopifyOAuthStates").doc(state);
      const stateDoc = await stateRef.get();

      if (!stateDoc.exists) {
        res.status(403).send("Invalid or expired state token.");
        return;
      }

      const stateData = stateDoc.data()!;
      const expiresAt = new Date(stateData.expiresAt);
      if (expiresAt < new Date()) {
        await stateRef.delete();
        res.status(403).send("State token expired.");
        return;
      }

      await stateRef.delete();
      userId = stateData.userId as string;
      shopDomain = stateData.shopDomain as string;
    } else {
      // Custom app install flow: no state param, look up by shop domain
      const statesSnapshot = await getFirestore()
        .collection("shopifyOAuthStates")
        .where("shopDomain", "==", shop)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (statesSnapshot.empty) {
        res.status(403).send("No pending authorization found for this store. Please initiate connection from the app first.");
        return;
      }

      const pendingDoc = statesSnapshot.docs[0];
      const pendingData = pendingDoc.data();
      const expiresAt = new Date(pendingData.expiresAt);

      if (expiresAt < new Date()) {
        await pendingDoc.ref.delete();
        res.status(403).send("Authorization expired. Please try again from the app.");
        return;
      }

      await pendingDoc.ref.delete();
      userId = pendingData.userId as string;
      shopDomain = pendingData.shopDomain as string;
    }

    try {
      // Exchange code for access token
      const tokenResponse = await exchangeCodeForToken(
        shopDomain,
        code,
        SHOPIFY_CLIENT_ID.value(),
        SHOPIFY_CLIENT_SECRET.value()
      );

      // Fetch shop name
      let shopName: string | undefined;
      try {
        const shopRes = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
          headers: { "X-Shopify-Access-Token": tokenResponse.access_token },
        });
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          shopName = shopData.shop?.name;
        }
      } catch {
        // Non-critical — proceed without shop name
      }

      // Store connection
      await setShopifyConnection(userId, {
        userId,
        shopDomain,
        accessToken: tokenResponse.access_token,
        scope: tokenResponse.scope,
        installedAt: new Date().toISOString(),
        shopName,
      });

      // Redirect back to frontend app
      const configDoc = await getFirestore().collection("appConfig").doc("shopify").get();
      const frontendUrl = configDoc.exists ? configDoc.data()?.frontendUrl : null;
      const redirectBase = frontendUrl || "http://localhost:3000";
      res.redirect(`${redirectBase}/#/products?shopify=connected`);
    } catch (error: any) {
      console.error("shopifyAuthCallback error:", error);
      res.status(500).send("Failed to complete Shopify authentication.");
    }
  }
);

export const shopifyDisconnect = onCall(
  { timeoutSeconds: 10, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;
    await deleteShopifyConnection(userId);
    return { success: true };
  }
);

export const getShopifyConnectionStatus = onCall(
  { timeoutSeconds: 10, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;
    const conn = await getShopifyConnection(userId);

    if (!conn) {
      return { connected: false };
    }

    return {
      connected: true,
      shopDomain: conn.shopDomain,
      shopName: conn.shopName,
    };
  }
);

// ── Shopify Product Browsing & Import ──────────────────────────────────────

export const browseShopifyProducts = onCall(
  { timeoutSeconds: 30, memory: "256MiB", secrets: [SHOPIFY_CLIENT_ID], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;
    const conn = await getShopifyConnection(userId);
    if (!conn) {
      throw new HttpsError("failed-precondition", "No Shopify store connected.");
    }

    const { query, limit, pageInfo } = request.data as {
      query?: string;
      limit?: number;
      pageInfo?: string;
    };

    try {
      const result = await fetchShopifyProductsApi(conn.shopDomain, conn.accessToken, {
        query,
        limit: limit || 20,
        pageInfo,
      });

      // Map to Product shape for browsing (not persisted)
      const products = result.products.map((sp) => mapShopifyToProduct(sp, userId));

      return {
        products,
        nextPageInfo: result.nextPageInfo,
        hasMore: result.hasMore,
      };
    } catch (error: any) {
      if (error instanceof ShopifyAuthError) {
        throw new HttpsError("failed-precondition", "Shopify connection expired. Please reconnect your store.");
      }
      console.error("browseShopifyProducts error:", error);
      throw new HttpsError("internal", error.message || "Failed to fetch Shopify products.");
    }
  }
);

export const importShopifyProducts = onCall(
  { timeoutSeconds: 30, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;
    const conn = await getShopifyConnection(userId);
    if (!conn) {
      throw new HttpsError("failed-precondition", "No Shopify store connected.");
    }

    const { shopifyProductIds } = request.data as { shopifyProductIds: string[] };
    if (!shopifyProductIds || shopifyProductIds.length === 0) {
      throw new HttpsError("invalid-argument", "shopifyProductIds is required.");
    }

    if (shopifyProductIds.length > 50) {
      throw new HttpsError("invalid-argument", "Cannot import more than 50 products at once.");
    }

    let imported = 0;

    for (const spId of shopifyProductIds) {
      try {
        const shopifyProduct = await fetchShopifyProduct(conn.shopDomain, conn.accessToken, spId);
        const product = mapShopifyToProduct(shopifyProduct, userId);

        // Preserve user-edited fields if the product already exists
        const existingDoc = await getFirestore().collection("products").doc(product.id).get();
        if (existingDoc.exists) {
          const existing = existingDoc.data()!;
          product.features = existing.features?.length ? existing.features : product.features;
          product.complianceFiles = existing.complianceFiles?.length ? existing.complianceFiles : product.complianceFiles;
        }

        await setProductDoc(product as any);
        imported++;
      } catch (error: any) {
        if (error instanceof ShopifyAuthError) {
          throw new HttpsError("failed-precondition", "Shopify connection expired. Please reconnect your store.");
        }
        console.error(`Failed to import Shopify product ${spId}:`, error);
      }
    }

    return { imported };
  }
);

export const resyncShopifyProducts = onCall(
  { timeoutSeconds: 60, memory: "256MiB", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;
    const conn = await getShopifyConnection(userId);
    if (!conn) {
      throw new HttpsError("failed-precondition", "No Shopify store connected.");
    }

    const existingProducts = await getShopifyProductDocs(userId);
    let synced = 0;
    const failed: string[] = [];

    for (const existing of existingProducts) {
      if (!existing.shopifyProductId) {
        failed.push(existing.id);
        continue;
      }

      try {
        const shopifyProduct = await fetchShopifyProduct(
          conn.shopDomain,
          conn.accessToken,
          existing.shopifyProductId
        );
        const freshData = mapShopifyToProduct(shopifyProduct, userId);

        // Preserve user-edited fields
        freshData.features = existing.features?.length ? existing.features : freshData.features;
        freshData.complianceFiles = existing.complianceFiles?.length ? existing.complianceFiles : freshData.complianceFiles;

        await setProductDoc(freshData as any);
        synced++;
      } catch (error: any) {
        if (error instanceof ShopifyAuthError) {
          throw new HttpsError("failed-precondition", "Shopify connection expired. Please reconnect your store.");
        }
        console.error(`Failed to resync product ${existing.id}:`, error);
        failed.push(existing.id);
      }
    }

    return { synced, failed };
  }
);
