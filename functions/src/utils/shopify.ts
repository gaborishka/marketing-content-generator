// Shopify API client, product mapper, and secrets for Cloud Functions.

import { defineSecret } from "firebase-functions/params";
import { ProductDoc } from "../types/pipeline";

export const SHOPIFY_CLIENT_ID = defineSecret("SHOPIFY_CLIENT_ID");
export const SHOPIFY_CLIENT_SECRET = defineSecret("SHOPIFY_CLIENT_SECRET");

// ── Shopify Admin REST API types ──────────────────────────────────────────

export interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string;
  body_html: string;
  product_type: string;
  tags: string;
  handle: string;
  variants: { sku: string; price: string }[];
  images: { src: string }[];
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface ShopifySingleProductResponse {
  product: ShopifyProduct;
}

export interface ShopifyPaginationParams {
  query?: string;
  limit?: number;
  pageInfo?: string;
}

export interface ShopifyProductsResult {
  products: ShopifyProduct[];
  nextPageInfo: string | null;
  hasMore: boolean;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────

function shopifyApiUrl(shopDomain: string, path: string): string {
  return `https://${shopDomain}/admin/api/2024-01/${path}`;
}

function parseLinkHeader(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
  return match ? match[1] : null;
}

export async function fetchShopifyProducts(
  shopDomain: string,
  accessToken: string,
  params: ShopifyPaginationParams = {}
): Promise<ShopifyProductsResult> {
  const limit = params.limit || 20;
  let url: string;

  if (params.pageInfo) {
    url = shopifyApiUrl(shopDomain, `products.json?limit=${limit}&page_info=${params.pageInfo}`);
  } else {
    const queryParts = [`limit=${limit}`];
    if (params.query) {
      queryParts.push(`title=${encodeURIComponent(params.query)}`);
    }
    url = shopifyApiUrl(shopDomain, `products.json?${queryParts.join("&")}`);
  }

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as ShopifyProductsResponse;
  const nextPageInfo = parseLinkHeader(res.headers.get("link"));

  return {
    products: data.products,
    nextPageInfo,
    hasMore: nextPageInfo !== null,
  };
}

export async function fetchShopifyProduct(
  shopDomain: string,
  accessToken: string,
  productId: string
): Promise<ShopifyProduct> {
  const url = shopifyApiUrl(shopDomain, `products/${productId}.json`);

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as ShopifySingleProductResponse;
  return data.product;
}

// ── Product mapper ────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function mapShopifyToProduct(
  sp: ShopifyProduct,
  userId: string
): Omit<ProductDoc, "features" | "complianceFiles"> & { features: string[]; complianceFiles: string[] } {
  return {
    id: `prod-shopify-${sp.id}`,
    userId,
    name: sp.title,
    brand: sp.vendor || "",
    description: stripHtml(sp.body_html || ""),
    category: sp.product_type || "",
    marketingTags: sp.tags ? sp.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    sku: sp.variants?.[0]?.sku || "",
    price: sp.variants?.[0]?.price ? parseFloat(sp.variants[0].price) : 0,
    imageUrl: sp.images?.[0]?.src || "",
    features: [],
    complianceFiles: [],
    source: "shopify" as const,
    shopifyProductId: String(sp.id),
    shopifyHandle: sp.handle,
    lastSyncedAt: new Date().toISOString(),
  };
}
