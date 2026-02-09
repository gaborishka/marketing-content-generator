import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { Product } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ShopifyStatus {
  connected: boolean;
  shopDomain?: string;
  shopName?: string;
}

export interface ShopifyBrowseResult {
  products: Product[];
  nextPageInfo: string | null;
  hasMore: boolean;
}

export interface ShopifyImportResult {
  imported: number;
}

export interface ShopifyResyncResult {
  synced: number;
  failed: string[];
}

// ── Cloud Function references ────────────────────────────────────────────────

const getStatusFn = httpsCallable<void, ShopifyStatus>(functions, 'getShopifyConnectionStatus');
const authInitFn = httpsCallable<void, { authUrl: string }>(functions, 'shopifyAuthInit');
const disconnectFn = httpsCallable<void, { success: boolean }>(functions, 'shopifyDisconnect');
const browseFn = httpsCallable<
  { query?: string; limit?: number; pageInfo?: string },
  ShopifyBrowseResult
>(functions, 'browseShopifyProducts');
const importFn = httpsCallable<{ shopifyProductIds: string[] }, ShopifyImportResult>(functions, 'importShopifyProducts');
const resyncFn = httpsCallable<void, ShopifyResyncResult>(functions, 'resyncShopifyProducts');

// ── Service functions ────────────────────────────────────────────────────────

export async function getShopifyStatus(): Promise<ShopifyStatus> {
  const result = await getStatusFn();
  return result.data;
}

export async function startShopifyAuth(): Promise<{ authUrl: string }> {
  const result = await authInitFn();
  return result.data;
}

export async function disconnectShopify(): Promise<void> {
  await disconnectFn();
}

export async function browseShopifyProducts(
  query?: string,
  limit?: number,
  pageInfo?: string
): Promise<ShopifyBrowseResult> {
  const result = await browseFn({ query, limit, pageInfo });
  return result.data;
}

export async function importShopifyProducts(shopifyProductIds: string[]): Promise<ShopifyImportResult> {
  const result = await importFn({ shopifyProductIds });
  return result.data;
}

export async function resyncShopifyProducts(): Promise<ShopifyResyncResult> {
  const result = await resyncFn();
  return result.data;
}
