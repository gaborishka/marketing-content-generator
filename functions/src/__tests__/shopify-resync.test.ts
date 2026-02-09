import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firestore before imports
const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockWhere = vi.fn();

const mockDocRef = {
  get: mockGet,
  set: mockSet,
  delete: mockDelete,
};

const mockQuerySnap = {
  docs: [] as any[],
};

const mockCollectionRef = {
  doc: vi.fn().mockReturnValue(mockDocRef),
  where: mockWhere,
};

// Chain .where().where().get()
const mockWhereChain = {
  where: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(mockQuerySnap),
  }),
};
mockWhere.mockReturnValue(mockWhereChain);

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: vi.fn().mockReturnValue(mockCollectionRef) }),
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
  },
}));

import {
  getShopifyConnection,
  setShopifyConnection,
  deleteShopifyConnection,
  getShopifyProducts,
  setProductDoc,
  deleteProductDoc,
} from "../utils/firestore";

describe("Firestore Shopify Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the chain mocks
    mockWhere.mockReturnValue(mockWhereChain);
    mockWhereChain.where.mockReturnValue({
      get: vi.fn().mockResolvedValue(mockQuerySnap),
    });
  });

  describe("getShopifyConnection", () => {
    it("returns null when no connection exists", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const result = await getShopifyConnection("user-123");
      expect(result).toBeNull();
    });

    it("returns connection data when it exists", async () => {
      const connectionData = {
        userId: "user-123",
        shopDomain: "test.myshopify.com",
        accessToken: "token-abc",
        scope: "read_products",
        installedAt: "2024-01-01T00:00:00Z",
        shopName: "Test Store",
      };
      mockGet.mockResolvedValueOnce({ exists: true, data: () => connectionData });
      const result = await getShopifyConnection("user-123");
      expect(result).toEqual(connectionData);
    });
  });

  describe("setShopifyConnection", () => {
    it("writes connection data to Firestore", async () => {
      const data = {
        userId: "user-123",
        shopDomain: "test.myshopify.com",
        accessToken: "token",
        scope: "read_products",
        installedAt: "2024-01-01T00:00:00Z",
      };
      await setShopifyConnection("user-123", data);
      expect(mockSet).toHaveBeenCalledWith(data);
    });
  });

  describe("deleteShopifyConnection", () => {
    it("deletes connection document", async () => {
      await deleteShopifyConnection("user-123");
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("getShopifyProducts", () => {
    it("returns empty array when no Shopify products exist", async () => {
      const emptySnap = { docs: [] };
      mockWhereChain.where.mockReturnValueOnce({
        get: vi.fn().mockResolvedValue(emptySnap),
      });
      const result = await getShopifyProducts("user-123");
      expect(result).toEqual([]);
    });

    it("returns Shopify products for user", async () => {
      const productData = {
        name: "Test Product",
        source: "shopify",
        shopifyProductId: "12345",
      };
      const docSnap = {
        docs: [{ id: "prod-shopify-12345", data: () => productData }],
      };
      mockWhereChain.where.mockReturnValueOnce({
        get: vi.fn().mockResolvedValue(docSnap),
      });
      const result = await getShopifyProducts("user-123");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("prod-shopify-12345");
      expect(result[0].name).toBe("Test Product");
    });
  });

  describe("setProductDoc", () => {
    it("writes product to Firestore", async () => {
      const product = {
        id: "prod-shopify-123",
        userId: "user-123",
        name: "Test",
        sku: "",
        brand: "",
        category: "",
        description: "",
        price: 0,
        features: [],
        imageUrl: "",
        complianceFiles: [],
        marketingTags: [],
        source: "shopify" as const,
      };
      await setProductDoc(product);
      expect(mockSet).toHaveBeenCalledWith(product);
    });
  });

  describe("deleteProductDoc", () => {
    it("deletes product from Firestore", async () => {
      await deleteProductDoc("prod-shopify-123");
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
