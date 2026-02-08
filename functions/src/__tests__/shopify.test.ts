import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock firebase-functions/params (defineSecret) ────────────────────────────
vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({
    value: () => `mock-${name}-value`,
  }),
}));

// ── Mock firebase-admin/firestore ────────────────────────────────────────────

const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockGet = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn();
const mockWhere = vi.fn();
const mockGetDocs = vi.fn();

const mockDocRef = {
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
  get: mockGet,
};

const mockBatch = {
  set: mockBatchSet,
  update: mockBatchUpdate,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
};

const mockCollection = vi.fn(() => ({
  doc: vi.fn(() => mockDocRef),
  where: mockWhere,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: mockCollection,
    batch: () => mockBatch,
  }),
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
  },
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import {
  sanitizeShop,
  mapShopifyProductToDoc,
} from "../utils/shopify";
import type { ShopifyProduct } from "../types/pipeline";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("sanitizeShop", () => {
  it("accepts full myshopify.com domain", () => {
    expect(sanitizeShop("mystore.myshopify.com")).toBe(
      "mystore.myshopify.com"
    );
  });

  it("adds .myshopify.com to bare store name", () => {
    expect(sanitizeShop("mystore")).toBe("mystore.myshopify.com");
  });

  it("strips https:// protocol", () => {
    expect(sanitizeShop("https://mystore.myshopify.com")).toBe(
      "mystore.myshopify.com"
    );
  });

  it("strips http:// protocol", () => {
    expect(sanitizeShop("http://mystore.myshopify.com")).toBe(
      "mystore.myshopify.com"
    );
  });

  it("strips trailing slashes and paths", () => {
    expect(sanitizeShop("mystore.myshopify.com/admin")).toBe(
      "mystore.myshopify.com"
    );
  });

  it("normalizes uppercase to lowercase", () => {
    expect(sanitizeShop("MyStore.myshopify.com")).toBe(
      "mystore.myshopify.com"
    );
  });

  it("trims whitespace", () => {
    expect(sanitizeShop("  mystore.myshopify.com  ")).toBe(
      "mystore.myshopify.com"
    );
  });

  it("rejects invalid domains", () => {
    expect(() => sanitizeShop("mystore.example.com")).toThrow(
      "Invalid Shopify shop domain"
    );
  });

  it("handles store names with hyphens", () => {
    expect(sanitizeShop("my-cool-store")).toBe(
      "my-cool-store.myshopify.com"
    );
  });
});

describe("mapShopifyProductToDoc", () => {
  const sampleShopifyProduct: ShopifyProduct = {
    id: 123456,
    title: "Test Widget",
    body_html: "<p>A <strong>great</strong> widget for testing.</p>",
    vendor: "Acme Corp",
    product_type: "Widgets",
    tags: "premium, best-seller, new-arrival",
    image: { src: "https://cdn.shopify.com/image1.jpg" },
    images: [
      { src: "https://cdn.shopify.com/image1.jpg" },
      { src: "https://cdn.shopify.com/image2.jpg" },
    ],
    variants: [
      {
        id: 789,
        product_id: 123456,
        title: "Default",
        sku: "TW-001",
        price: "29.99",
      },
      {
        id: 790,
        product_id: 123456,
        title: "Large",
        sku: "TW-002",
        price: "39.99",
      },
    ],
  };

  it("maps basic product fields correctly", () => {
    const doc = mapShopifyProductToDoc(sampleShopifyProduct, "user-1");

    expect(doc.id).toBe("shopify-123456");
    expect(doc.userId).toBe("user-1");
    expect(doc.name).toBe("Test Widget");
    expect(doc.brand).toBe("Acme Corp");
    expect(doc.category).toBe("Widgets");
    expect(doc.source).toBe("shopify");
    expect(doc.shopifyProductId).toBe("123456");
  });

  it("uses first variant for price and SKU", () => {
    const doc = mapShopifyProductToDoc(sampleShopifyProduct, "user-1");

    expect(doc.price).toBe(29.99);
    expect(doc.sku).toBe("TW-001");
    expect(doc.shopifyVariantId).toBe("789");
  });

  it("strips HTML from description", () => {
    const doc = mapShopifyProductToDoc(sampleShopifyProduct, "user-1");

    expect(doc.description).toBe("A great widget for testing.");
    expect(doc.description).not.toContain("<p>");
    expect(doc.description).not.toContain("<strong>");
  });

  it("parses comma-separated tags into marketingTags array", () => {
    const doc = mapShopifyProductToDoc(sampleShopifyProduct, "user-1");

    expect(doc.marketingTags).toEqual([
      "premium",
      "best-seller",
      "new-arrival",
    ]);
  });

  it("uses primary image URL", () => {
    const doc = mapShopifyProductToDoc(sampleShopifyProduct, "user-1");
    expect(doc.imageUrl).toBe("https://cdn.shopify.com/image1.jpg");
  });

  it("falls back to images array if no primary image", () => {
    const productNoImage: ShopifyProduct = {
      ...sampleShopifyProduct,
      image: undefined,
    };
    const doc = mapShopifyProductToDoc(productNoImage, "user-1");
    expect(doc.imageUrl).toBe("https://cdn.shopify.com/image1.jpg");
  });

  it("handles empty image gracefully", () => {
    const productNoImages: ShopifyProduct = {
      ...sampleShopifyProduct,
      image: undefined,
      images: [],
    };
    const doc = mapShopifyProductToDoc(productNoImages, "user-1");
    expect(doc.imageUrl).toBe("");
  });

  it("handles product with no variants", () => {
    const productNoVariants: ShopifyProduct = {
      ...sampleShopifyProduct,
      variants: [],
    };
    const doc = mapShopifyProductToDoc(productNoVariants, "user-1");
    expect(doc.sku).toBe("SHOP-123456");
    expect(doc.price).toBe(0);
    expect(doc.shopifyVariantId).toBeUndefined();
  });

  it("handles product with empty tags", () => {
    const productNoTags: ShopifyProduct = {
      ...sampleShopifyProduct,
      tags: "",
    };
    const doc = mapShopifyProductToDoc(productNoTags, "user-1");
    expect(doc.marketingTags).toEqual([]);
  });

  it("handles product with empty body_html", () => {
    const productNoDesc: ShopifyProduct = {
      ...sampleShopifyProduct,
      body_html: "",
    };
    const doc = mapShopifyProductToDoc(productNoDesc, "user-1");
    expect(doc.description).toBe("");
  });

  it("truncates long descriptions to 500 characters", () => {
    const longDescription = "<p>" + "a".repeat(600) + "</p>";
    const productLongDesc: ShopifyProduct = {
      ...sampleShopifyProduct,
      body_html: longDescription,
    };
    const doc = mapShopifyProductToDoc(productLongDesc, "user-1");
    expect(doc.description.length).toBeLessThanOrEqual(500);
  });

  it("sets features and complianceFiles to empty arrays", () => {
    const doc = mapShopifyProductToDoc(sampleShopifyProduct, "user-1");
    expect(doc.features).toEqual([]);
    expect(doc.complianceFiles).toEqual([]);
  });

  it("handles missing vendor gracefully", () => {
    const productNoVendor: ShopifyProduct = {
      ...sampleShopifyProduct,
      vendor: "",
    };
    const doc = mapShopifyProductToDoc(productNoVendor, "user-1");
    expect(doc.brand).toBe("");
  });

  it("handles missing product_type gracefully", () => {
    const productNoType: ShopifyProduct = {
      ...sampleShopifyProduct,
      product_type: "",
    };
    const doc = mapShopifyProductToDoc(productNoType, "user-1");
    expect(doc.category).toBe("Uncategorized");
  });
});
