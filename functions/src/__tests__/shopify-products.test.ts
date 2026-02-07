import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapShopifyToProduct, ShopifyProduct } from "../utils/shopify";

describe("Shopify Product Mapper", () => {
  const sampleShopifyProduct: ShopifyProduct = {
    id: 12345,
    title: "Test Widget",
    vendor: "WidgetCo",
    body_html: "<p>A <strong>great</strong> widget for testing.</p>",
    product_type: "Electronics",
    tags: "gadget, premium, bestseller",
    handle: "test-widget",
    variants: [
      { sku: "WDG-001", price: "29.99" },
      { sku: "WDG-002", price: "39.99" },
    ],
    images: [
      { src: "https://cdn.shopify.com/image1.jpg" },
      { src: "https://cdn.shopify.com/image2.jpg" },
    ],
  };

  it("maps Shopify product to internal Product shape", () => {
    const result = mapShopifyToProduct(sampleShopifyProduct, "user-123");

    expect(result.id).toBe("prod-shopify-12345");
    expect(result.userId).toBe("user-123");
    expect(result.name).toBe("Test Widget");
    expect(result.brand).toBe("WidgetCo");
    expect(result.description).toBe("A great widget for testing.");
    expect(result.category).toBe("Electronics");
    expect(result.marketingTags).toEqual(["gadget", "premium", "bestseller"]);
    expect(result.sku).toBe("WDG-001");
    expect(result.price).toBe(29.99);
    expect(result.imageUrl).toBe("https://cdn.shopify.com/image1.jpg");
    expect(result.features).toEqual([]);
    expect(result.complianceFiles).toEqual([]);
    expect(result.source).toBe("shopify");
    expect(result.shopifyProductId).toBe("12345");
    expect(result.shopifyHandle).toBe("test-widget");
    expect(result.lastSyncedAt).toBeDefined();
  });

  it("uses first variant for SKU and price", () => {
    const result = mapShopifyToProduct(sampleShopifyProduct, "user-123");
    expect(result.sku).toBe("WDG-001");
    expect(result.price).toBe(29.99);
  });

  it("uses first image for imageUrl", () => {
    const result = mapShopifyToProduct(sampleShopifyProduct, "user-123");
    expect(result.imageUrl).toBe("https://cdn.shopify.com/image1.jpg");
  });

  it("handles product with no variants", () => {
    const noVariants = { ...sampleShopifyProduct, variants: [] };
    const result = mapShopifyToProduct(noVariants, "user-123");
    expect(result.sku).toBe("");
    expect(result.price).toBe(0);
  });

  it("handles product with no images", () => {
    const noImages = { ...sampleShopifyProduct, images: [] };
    const result = mapShopifyToProduct(noImages, "user-123");
    expect(result.imageUrl).toBe("");
  });

  it("handles empty body_html", () => {
    const noBody = { ...sampleShopifyProduct, body_html: "" };
    const result = mapShopifyToProduct(noBody, "user-123");
    expect(result.description).toBe("");
  });

  it("handles empty tags", () => {
    const noTags = { ...sampleShopifyProduct, tags: "" };
    const result = mapShopifyToProduct(noTags, "user-123");
    expect(result.marketingTags).toEqual([]);
  });

  it("strips HTML from body_html", () => {
    const htmlBody = {
      ...sampleShopifyProduct,
      body_html: "<h1>Title</h1><p>Description with <a href='#'>link</a> and <br/> breaks.</p>",
    };
    const result = mapShopifyToProduct(htmlBody, "user-123");
    expect(result.description).toBe("TitleDescription with link and  breaks.");
  });

  it("generates deterministic IDs for idempotent import", () => {
    const result1 = mapShopifyToProduct(sampleShopifyProduct, "user-123");
    const result2 = mapShopifyToProduct(sampleShopifyProduct, "user-123");
    expect(result1.id).toBe(result2.id);
    expect(result1.id).toBe("prod-shopify-12345");
  });
});
