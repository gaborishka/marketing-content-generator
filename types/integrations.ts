/**
 * Integration Types for MarketGen AI
 *
 * Defines the interfaces for all external integrations that feed context
 * into the content generation pipeline and distribute generated content.
 */

// ---------------------------------------------------------------------------
// Integration Registry & Configuration
// ---------------------------------------------------------------------------

export type IntegrationId =
  | 'shopify'
  | 'hubspot'
  | 'cloudinary'
  | 'slack'
  | 'ga4'
  | 'mailchimp'
  | 'buffer'
  | 'mixpanel'
  | 'frontify'
  | 'google-ads'
  | 'meta-business'
  | 'semrush';

export type IntegrationCategory =
  | 'pim'          // Product Information Management
  | 'crm'          // CRM & Customer Data
  | 'dam'          // Digital Asset Management
  | 'collaboration'// Team Collaboration
  | 'analytics'    // Analytics & Performance
  | 'publishing'   // Marketing Platform Publishing
  | 'brand'        // Brand Voice & Guidelines
  | 'seo';         // SEO & Content Optimization

export type IntegrationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface IntegrationConfig {
  id: IntegrationId;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  credentials: Record<string, string>; // Stored encrypted — API keys, tokens, etc.
  settings: Record<string, unknown>;   // Integration-specific settings
  lastSyncedAt?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// CONTEXT LAYER — Integrations that enrich Gemini prompts
// ---------------------------------------------------------------------------

/**
 * Brand Voice (Frontify / Brandfolder)
 * Structured brand guidelines injected into every Gemini prompt.
 */
export interface BrandVoiceProfile {
  brandName: string;
  toneOfVoice: string[];           // e.g., ["professional", "empathetic", "authoritative"]
  writingStyle: string;            // Freeform description of writing style
  doRules: string[];               // "Always use active voice", "Address reader directly"
  dontRules: string[];             // "Never use jargon", "Avoid superlatives"
  vocabularyPreferred: string[];   // Approved terms
  vocabularyBanned: string[];      // Blacklisted terms
  colorPalette?: { name: string; hex: string }[];
  typography?: { role: string; fontFamily: string; weight: string }[];
  logoUrl?: string;
  tagline?: string;
}

/**
 * Audience Segment (HubSpot / Segment)
 * Rich audience data for personalized content generation.
 */
export interface AudienceSegment {
  id: string;
  name: string;                    // e.g., "CFOs at Enterprise Accounts"
  source: 'hubspot' | 'segment' | 'manual';
  size: number;                    // Number of contacts in segment
  demographics: {
    ageRange?: string;
    gender?: string;
    location?: string[];
    jobTitles?: string[];
    industries?: string[];
    companySize?: string;
  };
  behaviors: {
    engagementLevel?: 'cold' | 'warm' | 'hot';
    lastInteraction?: string;
    preferredChannels?: string[];
    contentPreferences?: string[];  // "prefers short-form", "responds to data", etc.
  };
  painPoints?: string[];
  buyingStage?: 'awareness' | 'consideration' | 'decision' | 'retention';
}

/**
 * SEO Context (Semrush / Ahrefs)
 * Keyword and competitive data for SEO-optimized content.
 */
export interface SEOContext {
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchVolume: number;
  keywordDifficulty: number;       // 0-100
  competitorInsights?: string[];   // Top-ranking content summaries
  recommendedWordCount?: number;
  semanticTerms?: string[];        // Related terms to include for topical coverage
}

/**
 * Performance Feedback (GA4 / Mixpanel)
 * Historical content performance data fed back into generation.
 */
export interface ContentPerformanceData {
  contentId: string;
  channel: string;
  audience: string;
  impressions: number;
  clicks: number;
  ctr: number;                     // Click-through rate
  conversions: number;
  engagementRate: number;
  avgTimeOnContent?: number;       // Seconds
  sentiment?: 'positive' | 'neutral' | 'negative';
  topPerformingVariant?: string;   // ID of best-performing variant
}

/**
 * Enriched Product (Shopify / Akeneo)
 * Extended product data beyond the base Product type.
 */
export interface EnrichedProductData {
  productId: string;               // Maps to Product.id
  source: 'shopify' | 'akeneo' | 'manual';
  variants?: { name: string; sku: string; price: number; available: boolean }[];
  inventory?: { inStock: boolean; quantity: number };
  reviews?: { avgRating: number; totalReviews: number; topQuote?: string };
  seoTitle?: string;
  seoDescription?: string;
  collections?: string[];          // Product collections/categories from source
  customAttributes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// OUTPUT LAYER — Integrations that distribute generated content
// ---------------------------------------------------------------------------

/**
 * Publishing Target configuration for distributing content.
 */
export interface PublishingTarget {
  integrationId: IntegrationId;
  channel: string;                 // Maps to GeneratedContent.channel
  destinationId?: string;          // e.g., Mailchimp list ID, Buffer profile ID
  destinationName?: string;        // Human-readable name
  scheduledAt?: string;            // ISO date for scheduled publishing
  publishedAt?: string;
  publishedUrl?: string;           // URL of published content
  status: 'pending' | 'scheduled' | 'published' | 'failed';
  errorMessage?: string;
}

/**
 * Slack Approval Request
 */
export interface SlackApprovalRequest {
  contentId: string;
  campaignId: string;
  slackChannelId: string;
  slackMessageTs?: string;         // Slack message timestamp (acts as ID)
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decision?: 'approved' | 'rejected' | 'changes_requested';
  feedback?: string;
}

/**
 * Cloudinary Asset
 */
export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  transformations?: Record<string, string>[]; // Channel-specific transforms
  tags?: string[];
  folder?: string;
}

// ---------------------------------------------------------------------------
// Aggregated Generation Context
// ---------------------------------------------------------------------------

/**
 * The unified context object assembled from all integrations
 * and passed to geminiService.generateMarketingContent().
 *
 * This is the key interface: it collects all enrichment data
 * from connected integrations into a single object that the
 * prompt builder can use.
 */
export interface GenerationContext {
  brandVoice?: BrandVoiceProfile;
  audienceSegments?: AudienceSegment[];
  seoContext?: SEOContext;
  performanceHistory?: ContentPerformanceData[];
  enrichedProducts?: EnrichedProductData[];
}

// ---------------------------------------------------------------------------
// Integration Service Interface
// ---------------------------------------------------------------------------

/**
 * Every integration adapter implements this interface.
 * Adapters are responsible for fetching data from external APIs
 * and normalizing it into our internal types.
 */
export interface IntegrationAdapter<TConfig = Record<string, unknown>> {
  id: IntegrationId;
  category: IntegrationCategory;

  /** Test the connection with current credentials */
  testConnection(config: TConfig): Promise<boolean>;

  /** Pull data from the external service */
  sync(config: TConfig): Promise<void>;

  /** Disconnect and clean up */
  disconnect(): Promise<void>;
}
