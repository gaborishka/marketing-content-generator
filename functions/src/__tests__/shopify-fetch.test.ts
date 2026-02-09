import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase-functions/params before importing the module under test
vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ value: () => `mock-${name}` }),
}));

import {
  fetchShopifyProducts,
  fetchShopifyProduct,
  ShopifyAuthError,
  SHOPIFY_API_VERSION,
} from "../utils/shopify";

describe("Shopify Fetch Helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("SHOPIFY_API_VERSION", () => {
    it("exports 2025-01 as the API version", () => {
      expect(SHOPIFY_API_VERSION).toBe("2025-01");
    });
  });

  describe("401 — expired token detection", () => {
    it("throws ShopifyAuthError on 401 from fetchShopifyProducts", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 })
      );

      await expect(
        fetchShopifyProducts("test.myshopify.com", "bad-token")
      ).rejects.toThrow(ShopifyAuthError);
    });

    it("throws ShopifyAuthError on 401 from fetchShopifyProduct", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 })
      );

      await expect(
        fetchShopifyProduct("test.myshopify.com", "bad-token", "123")
      ).rejects.toThrow(ShopifyAuthError);
    });
  });

  describe("429 — rate limit retry", () => {
    it("retries on 429 and succeeds on subsequent attempt", async () => {
      const successBody = { products: [{ id: 1, title: "Widget", vendor: "", body_html: "", product_type: "", tags: "", handle: "w", variants: [], images: [] }] };

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "0.01" },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(successBody), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

      const result = await fetchShopifyProducts("test.myshopify.com", "token");
      expect(result.products).toHaveLength(1);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("throws after exceeding max retries on persistent 429", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Too Many Requests", {
          status: 429,
          headers: { "Retry-After": "0.01" },
        })
      );

      await expect(
        fetchShopifyProducts("test.myshopify.com", "token")
      ).rejects.toThrow(/rate limit exceeded/i);

      // 1 initial + 3 retries = 4 total
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe("API version in URLs", () => {
    it("uses SHOPIFY_API_VERSION in product list URL", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ products: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await fetchShopifyProducts("test.myshopify.com", "token");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(`/admin/api/${SHOPIFY_API_VERSION}/`);
    });

    it("uses SHOPIFY_API_VERSION in single product URL", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ product: { id: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await fetchShopifyProduct("test.myshopify.com", "token", "123");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(`/admin/api/${SHOPIFY_API_VERSION}/`);
    });
  });
});
