/**
 * Integration Layer — Barrel Export
 *
 * All integration adapters and the context assembler are exported from here.
 */

// Context assembly (the main entry point for content generation)
export { assembleGenerationContext, contextToPromptBlock } from './contextAssembler';

// Phase 1 Adapters
export { ShopifyAdapter, parseShopifyConfig } from './shopifyAdapter';
export { SlackAdapter, parseSlackConfig } from './slackAdapter';
export { CloudinaryAdapter, parseCloudinaryConfig, CHANNEL_TRANSFORMS } from './cloudinaryAdapter';
export { GA4Adapter, parseGA4Config } from './ga4Adapter';

// Types (re-export for convenience)
export type {
  IntegrationId,
  IntegrationCategory,
  IntegrationStatus,
  IntegrationConfig,
  BrandVoiceProfile,
  AudienceSegment,
  SEOContext,
  ContentPerformanceData,
  EnrichedProductData,
  GenerationContext,
  PublishingTarget,
  SlackApprovalRequest,
  CloudinaryAsset,
  IntegrationAdapter,
} from '../../types/integrations';
