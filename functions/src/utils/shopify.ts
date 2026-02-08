// Shopify API utilities for the backend Cloud Functions.

import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  ShopifyConnectionDoc,
  ShopifyProduct,
  ProductDoc,
} from "../types/pipeline";

// ── Secrets ──────────────────────────────────────────────────────────────────

export const SHOPIFY_API_KEY = defineSecret("SHOPIFY_API_KEY");
export const SHOPIFY_API_SECRET = defineSecret("SHOPIFY_API_SECRET");

const db = () => getFirestore();

// ── Shopify OAuth Helpers ────────────────────────────────────────────────────

const SHOPIFY_API_VERSION = "2024-10";

/**
 * Build the Shopify OAuth authorization URL.
 * The user will be redirected here to approve the app install.
 */
export function buildAuthUrl(
  shop: string,
  redirectUri: string,
  state: string,
  scopes: string[]
): string {
  const cleanShop = sanitizeShop(shop);
  const scopeStr = scopes.join(",");
  return (
    `https://${cleanShop}/admin/oauth/authorize` +
    `?client_id=${SHOPIFY_API_KEY.value()}` +
    `&scope=${scopeStr}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`
  );
}

/**
 * Exchange an authorization code for a permanent access token.
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<{ accessToken: string; scope: string }> {
  const cleanShop = sanitizeShop(shop);
  const url = `https://${cleanShop}/admin/oauth/access_token`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY.value(),
      client_secret: SHOPIFY_API_SECRET.value(),
      code,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify token exchange failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    scope: string;
  };
  return { accessToken: data.access_token, scope: data.scope };
}

// ── Connection CRUD ──────────────────────────────────────────────────────────

export async function saveConnection(
  userId: string,
  shop: string,
  accessToken: string,
  scope: string
): Promise<void> {
  await db()
    .collection("shopifyConnections")
    .doc(userId)
    .set({
      userId,
      shop: sanitizeShop(shop),
      accessToken,
      scope,
      installedAt: FieldValue.serverTimestamp(),
    } as Omit<ShopifyConnectionDoc, "installedAt"> & {
      installedAt: FirebaseFirestore.FieldValue;
    });
}

export async function getConnection(
  userId: string
): Promise<ShopifyConnectionDoc | null> {
  const doc = await db().collection("shopifyConnections").doc(userId).get();
  if (!doc.exists) return null;
  return doc.data() as ShopifyConnectionDoc;
}

export async function deleteConnection(userId: string): Promise<void> {
  await db().collection("shopifyConnections").doc(userId).delete();
}

// ── Product Sync ─────────────────────────────────────────────────────────────

/**
 * Fetch all products from a Shopify store using the Admin REST API.
 * Handles pagination automatically (limit 250 per page).
 */
export async function fetchShopifyProducts(
  shop: string,
  accessToken: string
): Promise<ShopifyProduct[]> {
  const cleanShop = sanitizeShop(shop);
  const allProducts: ShopifyProduct[] = [];
  let pageInfo: string | null = null;
  const limit = 250;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let url: string;
    if (pageInfo) {
      url =
        `https://${cleanShop}/admin/api/${SHOPIFY_API_VERSION}/products.json` +
        `?limit=${limit}&page_info=${pageInfo}`;
    } else {
      url =
        `https://${cleanShop}/admin/api/${SHOPIFY_API_VERSION}/products.json` +
        `?limit=${limit}&fields=id,title,body_html,vendor,product_type,tags,image,images,variants`;
    }

    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Shopify products fetch failed (${res.status}): ${body}`
      );
    }

    const data = (await res.json()) as { products: ShopifyProduct[] };
    allProducts.push(...data.products);

    // Check for next page via Link header
    const linkHeader = res.headers.get("link");
    const nextMatch = linkHeader?.match(
      /<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/
    );
    if (nextMatch) {
      pageInfo = nextMatch[1];
    } else {
      break;
    }
  }

  return allProducts;
}

/**
 * Convert a Shopify product into our ProductDoc format.
 * Creates one ProductDoc per product (using the first variant for price/SKU).
 */
export function mapShopifyProductToDoc(
  shopifyProduct: ShopifyProduct,
  userId: string
): ProductDoc {
  const firstVariant = shopifyProduct.variants?.[0];
  const imageUrl =
    shopifyProduct.image?.src ||
    shopifyProduct.images?.[0]?.src ||
    "";

  // Strip HTML tags from description
  const description = (shopifyProduct.body_html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Parse tags into array
  const tags = shopifyProduct.tags
    ? shopifyProduct.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  return {
    id: `shopify-${shopifyProduct.id}`,
    userId,
    name: shopifyProduct.title,
    sku: firstVariant?.sku || `SHOP-${shopifyProduct.id}`,
    brand: shopifyProduct.vendor || "",
    category: shopifyProduct.product_type || "Uncategorized",
    description: description.slice(0, 500),
    price: firstVariant ? parseFloat(firstVariant.price) : 0,
    features: [],
    imageUrl,
    complianceFiles: [],
    marketingTags: tags,
    source: "shopify",
    shopifyProductId: String(shopifyProduct.id),
    shopifyVariantId: firstVariant ? String(firstVariant.id) : undefined,
  };
}

/**
 * Sync products from Shopify into Firestore.
 * - New products are created
 * - Existing synced products are updated
 * - Products removed from Shopify are optionally cleaned up
 * Returns the count of synced products.
 */
export async function syncProductsToFirestore(
  userId: string,
  shop: string,
  accessToken: string
): Promise<{ synced: number; created: number; updated: number; removed: number }> {
  const shopifyProducts = await fetchShopifyProducts(shop, accessToken);
  const mapped = shopifyProducts.map((sp) =>
    mapShopifyProductToDoc(sp, userId)
  );

  // Get existing Shopify-sourced products for this user
  const existingSnap = await db()
    .collection("products")
    .where("userId", "==", userId)
    .where("source", "==", "shopify")
    .get();

  const existingMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  existingSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.shopifyProductId) {
      existingMap.set(data.shopifyProductId, doc);
    }
  });

  let created = 0;
  let updated = 0;

  // Batch write (Firestore allows 500 per batch)
  const BATCH_SIZE = 450;
  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = db().batch();
    const chunk = mapped.slice(i, i + BATCH_SIZE);

    for (const product of chunk) {
      const existingDoc = existingMap.get(product.shopifyProductId!);
      if (existingDoc) {
        // Update existing — preserve any local customizations to complianceFiles/features
        const existingData = existingDoc.data() as ProductDoc;
        batch.update(existingDoc.ref, {
          name: product.name,
          sku: product.sku,
          brand: product.brand,
          category: product.category,
          description: product.description,
          price: product.price,
          imageUrl: product.imageUrl,
          marketingTags: product.marketingTags,
          shopifyVariantId: product.shopifyVariantId,
          // Preserve user-customized fields
          features: existingData.features?.length
            ? existingData.features
            : product.features,
          complianceFiles: existingData.complianceFiles?.length
            ? existingData.complianceFiles
            : product.complianceFiles,
        });
        existingMap.delete(product.shopifyProductId!);
        updated++;
      } else {
        // Create new
        batch.set(db().collection("products").doc(product.id), product);
        created++;
      }
    }
    await batch.commit();
  }

  // Remove products that no longer exist in Shopify
  let removed = 0;
  if (existingMap.size > 0) {
    const removeBatch = db().batch();
    for (const [, doc] of existingMap) {
      removeBatch.delete(doc.ref);
      removed++;
    }
    await removeBatch.commit();
  }

  // Update connection doc with sync metadata
  await db()
    .collection("shopifyConnections")
    .doc(userId)
    .update({
      lastSyncedAt: FieldValue.serverTimestamp(),
      productCount: mapped.length,
    });

  return { synced: mapped.length, created, updated, removed };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitize a Shopify shop domain. Accepts "mystore", "mystore.myshopify.com",
 * or "https://mystore.myshopify.com" and normalizes to "mystore.myshopify.com".
 */
export function sanitizeShop(shop: string): string {
  let cleaned = shop.trim().toLowerCase();
  // Strip protocol
  cleaned = cleaned.replace(/^https?:\/\//, "");
  // Strip trailing slashes/paths
  cleaned = cleaned.split("/")[0];
  // Add .myshopify.com if missing
  if (!cleaned.includes(".")) {
    cleaned = `${cleaned}.myshopify.com`;
  }
  // Validate format
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleaned)) {
    throw new Error(
      `Invalid Shopify shop domain: "${shop}". Expected format: yourstore.myshopify.com`
    );
  }
  return cleaned;
}

/**
 * Verify an HMAC signature from Shopify (for OAuth callback validation).
 */
export async function verifyHmac(
  queryParams: Record<string, string>,
  secret: string
): Promise<boolean> {
  const { hmac, ...rest } = queryParams;
  if (!hmac) return false;

  // Sort params alphabetically and build the message
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");

  // Use Web Crypto API (available in Node 20+)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === hmac;
}
