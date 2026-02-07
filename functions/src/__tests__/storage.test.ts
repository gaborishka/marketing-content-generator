import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSave = vi.fn().mockResolvedValue(undefined);
const mockFile = vi.fn().mockReturnValue({ save: mockSave });
const mockBucket = vi.fn().mockReturnValue({
  name: "test-bucket.appspot.com",
  file: mockFile,
});

vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: mockBucket }),
}));

vi.mock("crypto", () => ({
  randomUUID: () => "test-uuid-1234",
}));

import { uploadImageToStorage } from "../utils/storage";

describe("uploadImageToStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads image and returns download URL", async () => {
    const imageData = Buffer.from("fake-image-data");
    const result = await uploadImageToStorage(
      "user-1",
      "content-1",
      imageData,
      "image/png"
    );

    expect(mockFile).toHaveBeenCalledWith("users/user-1/content/content-1/hero.png");
    expect(mockSave).toHaveBeenCalledWith(imageData, {
      metadata: {
        contentType: "image/png",
        metadata: { firebaseStorageDownloadTokens: "test-uuid-1234" },
      },
    });
    expect(result.downloadUrl).toContain("test-bucket.appspot.com");
    expect(result.downloadUrl).toContain("token=test-uuid-1234");
    expect(result.storagePath).toBe("users/user-1/content/content-1/hero.png");
  });

  it("uses custom filename when provided", async () => {
    const imageData = Buffer.from("fake-image-data");
    await uploadImageToStorage(
      "user-1",
      "content-1",
      imageData,
      "image/jpeg",
      "scene-1.jpg"
    );

    expect(mockFile).toHaveBeenCalledWith("users/user-1/content/content-1/scene-1.jpg");
  });
});
