import { describe, it, expect } from "vitest";
import {
  buildShopifyAuthUrl,
  verifyShopifyHmac,
  isValidShopDomain,
} from "../shopify/auth";

describe("Shopify Auth Helpers", () => {
  describe("isValidShopDomain", () => {
    it("accepts valid myshopify.com domains", () => {
      expect(isValidShopDomain("my-store.myshopify.com")).toBe(true);
      expect(isValidShopDomain("store123.myshopify.com")).toBe(true);
      expect(isValidShopDomain("a.myshopify.com")).toBe(true);
    });

    it("rejects invalid domains", () => {
      expect(isValidShopDomain("")).toBe(false);
      expect(isValidShopDomain("notshopify.com")).toBe(false);
      expect(isValidShopDomain("store.shopify.com")).toBe(false);
      expect(isValidShopDomain("-invalid.myshopify.com")).toBe(false);
      expect(isValidShopDomain("my store.myshopify.com")).toBe(false);
      expect(isValidShopDomain("store.myshopify.com.evil.com")).toBe(false);
    });
  });

  describe("buildShopifyAuthUrl", () => {
    it("builds correct OAuth URL", () => {
      const url = buildShopifyAuthUrl(
        "test-store.myshopify.com",
        "client123",
        "https://example.com/callback",
        "state-token-abc"
      );

      expect(url).toContain("https://test-store.myshopify.com/admin/oauth/authorize");
      expect(url).toContain("client_id=client123");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("state=state-token-abc");
      expect(url).toContain("scope=read_products");
    });
  });

  describe("verifyShopifyHmac", () => {
    it("returns false when hmac is missing", () => {
      expect(verifyShopifyHmac({ code: "abc", shop: "test.myshopify.com" }, "secret")).toBe(false);
    });

    it("returns false for invalid hmac", () => {
      expect(
        verifyShopifyHmac(
          { code: "abc", hmac: "invalid", shop: "test.myshopify.com", state: "xyz" },
          "secret"
        )
      ).toBe(false);
    });

    it("verifies valid hmac", () => {
      // Compute the expected HMAC for known inputs
      const crypto = require("crypto");
      const params = { code: "test-code", shop: "test.myshopify.com", state: "state123", timestamp: "1234567890" };
      const message = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
      const hmac = crypto.createHmac("sha256", "test-secret").update(message).digest("hex");

      expect(verifyShopifyHmac({ ...params, hmac }, "test-secret")).toBe(true);
    });
  });
});
