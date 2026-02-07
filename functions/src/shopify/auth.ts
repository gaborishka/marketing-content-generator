// Shopify OAuth helpers: URL building, HMAC verification, code exchange.

import { createHmac } from "crypto";

// ── URL building ──────────────────────────────────────────────────────────

const SHOPIFY_SCOPE = "read_products";

export function buildShopifyAuthUrl(
  shopDomain: string,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPE,
    redirect_uri: redirectUri,
    state,
    grant_options: "",
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

// ── HMAC verification ─────────────────────────────────────────────────────

export function verifyShopifyHmac(
  query: Record<string, string>,
  clientSecret: string
): boolean {
  const hmac = query.hmac;
  if (!hmac) return false;

  // Build message from all query params except hmac, sorted alphabetically
  const entries = Object.entries(query)
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b));

  const message = entries.map(([k, v]) => `${k}=${v}`).join("&");
  const computed = createHmac("sha256", clientSecret).update(message).digest("hex");

  return computed === hmac;
}

// ── Code exchange ─────────────────────────────────────────────────────────

export interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
}

export async function exchangeCodeForToken(
  shopDomain: string,
  code: string,
  clientId: string,
  clientSecret: string
): Promise<ShopifyTokenResponse> {
  const url = `https://${shopDomain}/admin/oauth/access_token`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as ShopifyTokenResponse;
}

// ── Domain validation ─────────────────────────────────────────────────────

export function isValidShopDomain(domain: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(domain);
}
