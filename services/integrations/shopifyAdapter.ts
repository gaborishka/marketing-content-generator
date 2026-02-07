/**
 * Shopify Integration Adapter
 *
 * Connects to Shopify Storefront/Admin GraphQL API to pull rich product data
 * (variants, inventory, reviews, collections) into the generation pipeline.
 *
 * Setup: Requires a Shopify store domain and Storefront/Admin API access token.
 * Free access via Shopify Partner Program development stores.
 *
 * API: GraphQL (mandatory for new apps from April 2025)
 * Docs: https://shopify.dev/docs/api
 */

import type {
  IntegrationAdapter,
  IntegrationConfig,
  EnrichedProductData,
} from '../../types/integrations';
import type { Product } from '../../types';

interface ShopifyConfig {
  storeDomain: string;    // e.g., "my-store.myshopify.com"
  accessToken: string;    // Storefront or Admin API token
  apiVersion: string;     // e.g., "2025-04"
}

const SHOPIFY_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          descriptionHtml
          vendor
          productType
          tags
          variants(first: 10) {
            edges {
              node {
                title
                sku
                price {
                  amount
                  currencyCode
                }
                availableForSale
              }
            }
          }
          collections(first: 5) {
            edges {
              node {
                title
              }
            }
          }
          seo {
            title
            description
          }
          totalInventory
        }
      }
    }
  }
`;

export class ShopifyAdapter implements IntegrationAdapter<ShopifyConfig> {
  id = 'shopify' as const;
  category = 'pim' as const;

  async testConnection(config: ShopifyConfig): Promise<boolean> {
    try {
      const url = `https://${config.storeDomain}/api/${config.apiVersion}/graphql.json`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': config.accessToken,
        },
        body: JSON.stringify({
          query: '{ shop { name } }',
        }),
      });
      const data = await response.json();
      return !!data?.data?.shop?.name;
    } catch {
      return false;
    }
  }

  /**
   * Fetch enriched product data from Shopify for the given local products.
   * Matches by SKU to link Shopify products to local Product records.
   */
  async fetchProducts(
    config: ShopifyConfig,
    localProducts: Product[]
  ): Promise<EnrichedProductData[]> {
    const url = `https://${config.storeDomain}/api/${config.apiVersion}/graphql.json`;

    // Query Shopify for products matching our SKUs
    const skuQuery = localProducts.map(p => `sku:${p.sku}`).join(' OR ');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': config.accessToken,
      },
      body: JSON.stringify({
        query: SHOPIFY_PRODUCTS_QUERY,
        variables: { first: 50, query: skuQuery },
      }),
    });

    const data = await response.json();
    const shopifyProducts = data?.data?.products?.edges ?? [];

    return shopifyProducts.map((edge: any) => {
      const node = edge.node;
      const variants = node.variants.edges.map((v: any) => ({
        name: v.node.title,
        sku: v.node.sku,
        price: parseFloat(v.node.price.amount),
        available: v.node.availableForSale,
      }));

      // Find matching local product by SKU
      const matchingSku = variants.find((v: any) =>
        localProducts.some(lp => lp.sku === v.sku)
      );
      const localProduct = matchingSku
        ? localProducts.find(lp => lp.sku === matchingSku.sku)
        : undefined;

      return {
        productId: localProduct?.id ?? node.id,
        source: 'shopify' as const,
        variants,
        inventory: {
          inStock: node.totalInventory > 0,
          quantity: node.totalInventory,
        },
        seoTitle: node.seo?.title,
        seoDescription: node.seo?.description,
        collections: node.collections.edges.map((c: any) => c.node.title),
      };
    });
  }

  async sync(_config: ShopifyConfig): Promise<void> {
    // Full sync implementation: pull all products and update local store
    // TODO: Implement full catalog sync
  }

  async disconnect(): Promise<void> {
    // Clean up stored credentials
  }
}

export function parseShopifyConfig(integration: IntegrationConfig): ShopifyConfig {
  return {
    storeDomain: integration.credentials['storeDomain'] ?? '',
    accessToken: integration.credentials['accessToken'] ?? '',
    apiVersion: (integration.settings['apiVersion'] as string) ?? '2025-04',
  };
}
