import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdateFn = vi.fn().mockResolvedValue(undefined);
const mockWhere = vi.fn();

const mockDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdateFn,
};

const mockQuerySnap = {
  docs: [] as any[],
};

const mockCollectionRef = {
  doc: vi.fn().mockReturnValue(mockDocRef),
  where: mockWhere,
};

// Chain .where().where().get()
mockWhere.mockReturnValue({
  where: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(mockQuerySnap),
  }),
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: vi.fn().mockReturnValue(mockCollectionRef) }),
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
  },
}));

import {
  getCampaign,
  getProduct,
  getProducts,
  getComplianceRule,
  getContentForCampaign,
  writeContentDoc,
  updateContentDoc,
  updateJobDoc,
} from "../utils/firestore";

describe("Firestore Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCampaign", () => {
    it("returns null when document does not exist", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const result = await getCampaign("nonexistent");
      expect(result).toBeNull();
    });

    it("returns campaign doc with id when document exists", async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        id: "camp-1",
        data: () => ({ name: "Test Campaign", userId: "u1" }),
      });
      const result = await getCampaign("camp-1");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("camp-1");
      expect(result!.name).toBe("Test Campaign");
    });
  });

  describe("getProduct", () => {
    it("returns null when product does not exist", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const result = await getProduct("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getProducts", () => {
    it("returns empty array for empty input", async () => {
      const result = await getProducts([]);
      expect(result).toEqual([]);
    });
  });

  describe("getComplianceRule", () => {
    it("returns null when rule does not exist", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const result = await getComplianceRule("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("writeContentDoc", () => {
    it("calls set on the content doc", async () => {
      const content = {
        id: "c1",
        campaignId: "camp1",
        userId: "u1",
        channel: "Twitter",
        audience: "Gen Z",
        text: "Hello!",
        imageUrl: "",
        complianceScore: 90,
        status: "draft" as const,
        riskLevel: "low" as const,
        x: 0,
        y: 0,
      };
      await writeContentDoc(content);
      expect(mockSet).toHaveBeenCalledWith(content);
    });
  });

  describe("updateJobDoc", () => {
    it("updates job doc with server timestamp", async () => {
      await updateJobDoc("job-1", { status: "generating", progress: 50 });
      expect(mockUpdateFn).toHaveBeenCalledWith({
        status: "generating",
        progress: 50,
        updatedAt: "SERVER_TIMESTAMP",
      });
    });
  });
});
