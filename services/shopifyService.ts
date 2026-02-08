// Frontend service for Shopify integration.
// Calls Cloud Functions to manage Shopify OAuth and product sync.

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { ShopifyConnection } from '../types';

// ── Cloud Function callables ─────────────────────────────────────────────────

const getAuthUrlFn = httpsCallable<
  { shop: string; redirectUri: string },
  { authUrl: string; state: string }
>(functions, 'shopifyGetAuthUrl');

const exchangeTokenFn = httpsCallable<
  { shop: string; code: string; state: string },
  { success: boolean; shop: string; scope: string }
>(functions, 'shopifyExchangeToken');

const getConnectionFn = httpsCallable<
  void,
  { connected: boolean; shop?: string; scope?: string; lastSyncedAt?: string | null; productCount?: number }
>(functions, 'shopifyGetConnection');

const syncProductsFn = httpsCallable<
  void,
  { synced: number; created: number; updated: number; removed: number }
>(functions, 'shopifySyncProducts');

const disconnectFn = httpsCallable<void, { success: boolean }>(
  functions,
  'shopifyDisconnect'
);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the Shopify OAuth flow.
 * Returns the URL the user should be redirected to.
 */
export async function startShopifyAuth(shop: string): Promise<{ authUrl: string; state: string }> {
  // The redirect URI is the current app origin + callback path.
  // For the client-side flow, Shopify redirects back to the app,
  // and the app captures the code from the URL and calls exchangeToken.
  const redirectUri = `${window.location.origin}${window.location.pathname}#/products`;
  const result = await getAuthUrlFn({ shop, redirectUri });
  return result.data;
}

/**
 * Complete the OAuth flow by exchanging the authorization code for an access token.
 * Called after the user returns from Shopify with code & state query params.
 */
export async function completeShopifyAuth(
  shop: string,
  code: string,
  state: string
): Promise<{ shop: string; scope: string }> {
  const result = await exchangeTokenFn({ shop, code, state });
  return { shop: result.data.shop, scope: result.data.scope };
}

/**
 * Get the current Shopify connection status.
 */
export async function getShopifyConnection(): Promise<ShopifyConnection | null> {
  const result = await getConnectionFn();
  if (!result.data.connected) return null;
  return {
    shop: result.data.shop!,
    scope: result.data.scope!,
    lastSyncedAt: result.data.lastSyncedAt || undefined,
    productCount: result.data.productCount,
  };
}

/**
 * Sync products from the connected Shopify store.
 */
export async function syncShopifyProducts(): Promise<{
  synced: number;
  created: number;
  updated: number;
  removed: number;
}> {
  const result = await syncProductsFn();
  return result.data;
}

/**
 * Disconnect the Shopify store.
 */
export async function disconnectShopify(): Promise<void> {
  await disconnectFn();
}

/**
 * Parse Shopify OAuth callback parameters from the URL hash.
 * Returns null if no Shopify callback params are present.
 */
export function parseShopifyCallbackParams(): {
  code: string;
  shop: string;
  state: string;
} | null {
  const hash = window.location.hash;
  // Look for query params after the route path in the hash
  // e.g. #/products?code=xxx&shop=xxx&state=xxx
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return null;

  const params = new URLSearchParams(hash.slice(queryStart));
  const code = params.get('code');
  const shop = params.get('shop');
  const state = params.get('state');

  if (!code || !shop || !state) return null;

  return { code, shop, state };
}

/**
 * Clean up Shopify callback parameters from the URL hash
 * to avoid re-processing on page reload.
 */
export function clearShopifyCallbackParams(): void {
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  if (queryStart !== -1) {
    const cleanHash = hash.slice(0, queryStart);
    window.history.replaceState(null, '', cleanHash || '#/products');
  }
}
