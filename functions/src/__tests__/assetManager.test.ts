import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateContent = vi.fn();
vi.mock("../utils/gemini", () => ({
  getGeminiClient: () => ({
    models: { generateContent: mockGenerateContent },
  }),
}));

const mockUploadImageToStorage = vi.fn();
vi.mock("../utils/storage", () => ({
  uploadImageToStorage: (...args: any[]) => mockUploadImageToStorage(...args),
}));

const mockUpdateContentDoc = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/firestore", () => ({
  updateContentDoc: (...args: any[]) => mockUpdateContentDoc(...args),
}));

import { runAssetManager, AssetManagerInput } from "../agents/assetManager";
import { ContentDoc } from "../types/pipeline";

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeContentDoc = (overrides: Partial<ContentDoc> = {}): ContentDoc => ({
  id: "content-1",
  campaignId: "camp-1",
  userId: "user-1",
  channel: "Twitter",
  audience: "Gen Z",
  text: "Summer vibes! Check out our latest collection.",
  imageUrl: "",
  complianceScore: 90,
  status: "draft",
  riskLevel: "low",
  x: 0,
  y: 0,
  generationJobId: "job-1",
  ...overrides,
});

const makeStoryboardDoc = (): ContentDoc =>
  makeContentDoc({
    id: "content-sb-1",
    channel: "Video Storyboard",
    storyboard: [
      { sceneNumber: 1, imagePrompt: "A sunny beach scene", voiceover: "Welcome to summer" },
      { sceneNumber: 2, imagePrompt: "Product close-up", voiceover: "Our newest line" },
      { sceneNumber: 3, imagePrompt: "Happy customers", voiceover: "Join thousands" },
    ],
  });

const geminiImageResponse = (data: string = "base64imagedata", mimeType: string = "image/png") => ({
  candidates: [
    {
      content: {
        parts: [{ inlineData: { data, mimeType } }],
      },
    },
  ],
});

const geminiNoImageResponse = () => ({
  candidates: [{ content: { parts: [{ text: "Sorry, I can't generate that image." }] } }],
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("runAssetManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns immediately for empty content docs", async () => {
    const result = await runAssetManager({ contentDocs: [], userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ totalImages: 0, successCount: 0, failureCount: 0 });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("generates hero image for regular content and updates Firestore", async () => {
    const doc = makeContentDoc();
    mockGenerateContent.mockResolvedValue(geminiImageResponse());
    mockUploadImageToStorage.mockResolvedValue({
      downloadUrl: "https://storage.example.com/hero.png",
      storagePath: "users/user-1/content/content-1/hero.png",
    });

    const result = await runAssetManager({ contentDocs: [doc], userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.successCount).toBe(1);
    expect(result.data!.failureCount).toBe(0);
    expect(result.data!.totalImages).toBe(1);

    // Verify Gemini was called with image model
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3-pro-image-preview",
      })
    );

    // Verify upload was called with correct params
    expect(mockUploadImageToStorage).toHaveBeenCalledWith(
      "user-1",
      "content-1",
      expect.any(Buffer),
      "image/png",
      "hero.png"
    );

    // Verify Firestore was updated with download URL
    expect(mockUpdateContentDoc).toHaveBeenCalledWith("content-1", {
      imageUrl: "https://storage.example.com/hero.png",
    });
  });

  it("generates scene images for video storyboard content", async () => {
    const doc = makeStoryboardDoc();
    mockGenerateContent.mockResolvedValue(geminiImageResponse());
    mockUploadImageToStorage.mockResolvedValue({
      downloadUrl: "https://storage.example.com/scene.png",
      storagePath: "users/user-1/content/content-sb-1/scene.png",
    });

    const result = await runAssetManager({ contentDocs: [doc], userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.successCount).toBe(1); // 1 doc succeeded
    expect(result.data!.totalImages).toBe(1); // 1 content doc

    // 3 Gemini calls for 3 scenes
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);

    // 3 uploads with scene filenames
    expect(mockUploadImageToStorage).toHaveBeenCalledWith(
      "user-1", "content-sb-1", expect.any(Buffer), "image/png", "scene-1.png"
    );
    expect(mockUploadImageToStorage).toHaveBeenCalledWith(
      "user-1", "content-sb-1", expect.any(Buffer), "image/png", "scene-2.png"
    );
    expect(mockUploadImageToStorage).toHaveBeenCalledWith(
      "user-1", "content-sb-1", expect.any(Buffer), "image/png", "scene-3.png"
    );

    // Firestore updated after each scene (3 times for storyboard updates)
    expect(mockUpdateContentDoc).toHaveBeenCalledTimes(3);
  });

  it("handles image generation failure gracefully (non-blocking)", async () => {
    const doc = makeContentDoc();
    mockGenerateContent.mockResolvedValue(geminiNoImageResponse());

    const result = await runAssetManager({ contentDocs: [doc], userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.successCount).toBe(0);
    expect(result.data!.failureCount).toBe(1);

    // No upload attempted when Gemini returns no image
    expect(mockUploadImageToStorage).not.toHaveBeenCalled();
    expect(mockUpdateContentDoc).not.toHaveBeenCalled();
  });

  it("handles upload failure gracefully (non-blocking)", async () => {
    const doc = makeContentDoc();
    mockGenerateContent.mockResolvedValue(geminiImageResponse());
    mockUploadImageToStorage.mockRejectedValue(new Error("Storage quota exceeded"));

    const result = await runAssetManager({ contentDocs: [doc], userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.failureCount).toBe(1);
  });

  it("processes multiple content docs with concurrency limit", async () => {
    const docs = [
      makeContentDoc({ id: "c-1" }),
      makeContentDoc({ id: "c-2" }),
      makeContentDoc({ id: "c-3" }),
      makeContentDoc({ id: "c-4" }),
    ];

    mockGenerateContent.mockResolvedValue(geminiImageResponse());
    mockUploadImageToStorage.mockResolvedValue({
      downloadUrl: "https://storage.example.com/img.png",
      storagePath: "path",
    });

    const result = await runAssetManager({ contentDocs: docs, userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.successCount).toBe(4);
    expect(result.data!.totalImages).toBe(4);

    // All 4 docs processed
    expect(mockGenerateContent).toHaveBeenCalledTimes(4);
    expect(mockUploadImageToStorage).toHaveBeenCalledTimes(4);
  });

  it("continues processing other docs when one fails", async () => {
    const docs = [
      makeContentDoc({ id: "c-1" }),
      makeContentDoc({ id: "c-2" }),
    ];

    // First doc: Gemini fails, second doc: Gemini succeeds
    mockGenerateContent
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce(geminiImageResponse());

    mockUploadImageToStorage.mockResolvedValue({
      downloadUrl: "https://storage.example.com/img.png",
      storagePath: "path",
    });

    const result = await runAssetManager({ contentDocs: docs, userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.successCount).toBe(1);
    expect(result.data!.failureCount).toBe(1);
  });

  it("handles storyboard with partial scene failures", async () => {
    const doc = makeStoryboardDoc();

    // Scene 1: success, Scene 2: failure, Scene 3: success
    mockGenerateContent
      .mockResolvedValueOnce(geminiImageResponse("scene1data"))
      .mockResolvedValueOnce(geminiNoImageResponse())
      .mockResolvedValueOnce(geminiImageResponse("scene3data"));

    mockUploadImageToStorage.mockResolvedValue({
      downloadUrl: "https://storage.example.com/scene.png",
      storagePath: "path",
    });

    const result = await runAssetManager({ contentDocs: [doc], userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.successCount).toBe(1); // doc-level success (at least one scene worked)

    // Only 2 uploads (scene 2 had no image data)
    expect(mockUploadImageToStorage).toHaveBeenCalledTimes(2);
    // 2 Firestore updates (one per successful scene)
    expect(mockUpdateContentDoc).toHaveBeenCalledTimes(2);
  });

  it("builds appropriate image prompts per channel", async () => {
    const instagramDoc = makeContentDoc({ id: "ig-1", channel: "Instagram" });
    const emailDoc = makeContentDoc({ id: "em-1", channel: "Email Newsletter" });

    mockGenerateContent.mockResolvedValue(geminiImageResponse());
    mockUploadImageToStorage.mockResolvedValue({
      downloadUrl: "https://storage.example.com/img.png",
      storagePath: "path",
    });

    await runAssetManager({ contentDocs: [instagramDoc, emailDoc], userId: "user-1" });

    // Instagram prompt should mention social media
    const instagramCall = mockGenerateContent.mock.calls[0][0];
    expect(instagramCall.contents.parts[0].text).toContain("social media");

    // Email prompt should mention email header
    const emailCall = mockGenerateContent.mock.calls[1][0];
    expect(emailCall.contents.parts[0].text).toContain("email header");
  });

  it("treats storyboard with no scenes as a failure", async () => {
    const doc = makeContentDoc({
      id: "sb-empty",
      channel: "Video Storyboard",
      storyboard: [],
    });

    const result = await runAssetManager({ contentDocs: [doc], userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.failureCount).toBe(1);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
