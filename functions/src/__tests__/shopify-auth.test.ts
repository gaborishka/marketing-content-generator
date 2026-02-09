import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildShopifyAuthUrl,
  verifyShopifyHmac,
  isValidShopDomain,
  exchangeCodeForToken,
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

  describe("exchangeCodeForToken", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("sends form-encoded body with correct Content-Type", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok_123", scope: "read_products" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const result = await exchangeCodeForToken(
        "test.myshopify.com",
        "auth-code-xyz",
        "client-id",
        "client-secret"
      );

      expect(result.access_token).toBe("tok_123");
      expect(result.scope).toBe("read_products");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://test.myshopify.com/admin/oauth/access_token");
      expect(options?.headers).toEqual(
        expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" })
      );

      // Body should be form-encoded, not JSON
      const body = options?.body as string;
      const params = new URLSearchParams(body);
      expect(params.get("client_id")).toBe("client-id");
      expect(params.get("client_secret")).toBe("client-secret");
      expect(params.get("code")).toBe("auth-code-xyz");
    });

    it("throws on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Bad Request", { status: 400 })
      );

      await expect(
        exchangeCodeForToken("test.myshopify.com", "bad-code", "cid", "csecret")
      ).rejects.toThrow("Token exchange failed: 400");
    });
  });
});
