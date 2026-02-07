/**
 * Context Assembler
 *
 * Collects enrichment data from all connected integrations and assembles
 * it into a single GenerationContext object. This context is then used
 * by geminiService.ts to build richer, more targeted prompts.
 *
 * The assembler checks which integrations are connected and pulls
 * relevant data for the given campaign, products, and audiences.
 */

import type {
  GenerationContext,
  BrandVoiceProfile,
  AudienceSegment,
  SEOContext,
  ContentPerformanceData,
  EnrichedProductData,
  IntegrationConfig,
} from '../../types/integrations';
import type { Campaign, Product } from '../../types';

/**
 * Assemble the full generation context from all connected integrations.
 *
 * This is the main entry point called before content generation.
 * It queries each connected integration adapter and merges results
 * into a unified GenerationContext.
 */
export async function assembleGenerationContext(
  campaign: Campaign,
  products: Product[],
  connectedIntegrations: IntegrationConfig[]
): Promise<GenerationContext> {
  const context: GenerationContext = {};

  const connected = (id: string) =>
    connectedIntegrations.some(i => i.id === id && i.status === 'connected');

  // --- Brand Voice (Frontify / Brandfolder) ---
  if (connected('frontify')) {
    context.brandVoice = await fetchBrandVoice(
      connectedIntegrations.find(i => i.id === 'frontify')!
    );
  }

  // --- Audience Segments (HubSpot / Segment) ---
  if (connected('hubspot')) {
    context.audienceSegments = await fetchAudienceSegments(
      connectedIntegrations.find(i => i.id === 'hubspot')!,
      campaign.targetAudiences
    );
  }

  // --- SEO Context (Semrush) ---
  if (connected('semrush')) {
    context.seoContext = await fetchSEOContext(
      connectedIntegrations.find(i => i.id === 'semrush')!,
      campaign.keyMessage
    );
  }

  // --- Performance History (GA4) ---
  if (connected('ga4')) {
    context.performanceHistory = await fetchPerformanceHistory(
      connectedIntegrations.find(i => i.id === 'ga4')!,
      campaign.id,
      campaign.channels
    );
  }

  // --- Enriched Product Data (Shopify / Akeneo) ---
  if (connected('shopify')) {
    context.enrichedProducts = await fetchEnrichedProducts(
      connectedIntegrations.find(i => i.id === 'shopify')!,
      products
    );
  }

  return context;
}

/**
 * Convert the GenerationContext into a prompt-friendly string block
 * that can be injected into the Gemini system prompt.
 */
export function contextToPromptBlock(ctx: GenerationContext): string {
  const blocks: string[] = [];

  if (ctx.brandVoice) {
    const bv = ctx.brandVoice;
    blocks.push(`
BRAND VOICE GUIDELINES (MANDATORY):
Brand: ${bv.brandName}
${bv.tagline ? `Tagline: ${bv.tagline}` : ''}
Tone: ${bv.toneOfVoice.join(', ')}
Writing Style: ${bv.writingStyle}
DO: ${bv.doRules.join('; ')}
DON'T: ${bv.dontRules.join('; ')}
${bv.vocabularyPreferred.length > 0 ? `Preferred Terms: ${bv.vocabularyPreferred.join(', ')}` : ''}
${bv.vocabularyBanned.length > 0 ? `Banned Terms: ${bv.vocabularyBanned.join(', ')}` : ''}
You MUST follow these brand voice guidelines for ALL generated content.
    `.trim());
  }

  if (ctx.audienceSegments && ctx.audienceSegments.length > 0) {
    const segmentDescriptions = ctx.audienceSegments.map(seg => {
      const parts = [`Segment: ${seg.name} (${seg.size} contacts)`];
      if (seg.demographics.jobTitles?.length) {
        parts.push(`  Job Titles: ${seg.demographics.jobTitles.join(', ')}`);
      }
      if (seg.demographics.industries?.length) {
        parts.push(`  Industries: ${seg.demographics.industries.join(', ')}`);
      }
      if (seg.behaviors.engagementLevel) {
        parts.push(`  Engagement: ${seg.behaviors.engagementLevel}`);
      }
      if (seg.behaviors.preferredChannels?.length) {
        parts.push(`  Preferred Channels: ${seg.behaviors.preferredChannels.join(', ')}`);
      }
      if (seg.painPoints?.length) {
        parts.push(`  Pain Points: ${seg.painPoints.join(', ')}`);
      }
      if (seg.buyingStage) {
        parts.push(`  Buying Stage: ${seg.buyingStage}`);
      }
      return parts.join('\n');
    });

    blocks.push(`
AUDIENCE INTELLIGENCE:
${segmentDescriptions.join('\n\n')}
Tailor content tone, complexity, and messaging to each segment's characteristics.
    `.trim());
  }

  if (ctx.seoContext) {
    const seo = ctx.seoContext;
    blocks.push(`
SEO OPTIMIZATION REQUIREMENTS:
Primary Keyword: "${seo.primaryKeyword}" (Volume: ${seo.searchVolume}, Difficulty: ${seo.keywordDifficulty}/100)
Secondary Keywords: ${seo.secondaryKeywords.join(', ')}
${seo.semanticTerms?.length ? `Related Terms to Include: ${seo.semanticTerms.join(', ')}` : ''}
${seo.recommendedWordCount ? `Recommended Word Count: ${seo.recommendedWordCount}` : ''}
Naturally incorporate these keywords. Do NOT keyword-stuff.
    `.trim());
  }

  if (ctx.performanceHistory && ctx.performanceHistory.length > 0) {
    const topPerformers = ctx.performanceHistory
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 3);

    blocks.push(`
PERFORMANCE INSIGHTS (from past campaigns):
${topPerformers.map(p =>
  `- ${p.channel} to ${p.audience}: ${(p.engagementRate * 100).toFixed(1)}% engagement, ${(p.ctr * 100).toFixed(1)}% CTR`
).join('\n')}
Learn from what worked: generate content that follows patterns of high-performing variants.
    `.trim());
  }

  if (ctx.enrichedProducts && ctx.enrichedProducts.length > 0) {
    const enrichments = ctx.enrichedProducts.map(ep => {
      const parts = [`Product ID: ${ep.productId} (via ${ep.source})`];
      if (ep.reviews) {
        parts.push(`  Reviews: ${ep.reviews.avgRating}/5 (${ep.reviews.totalReviews} reviews)`);
        if (ep.reviews.topQuote) {
          parts.push(`  Top Review: "${ep.reviews.topQuote}"`);
        }
      }
      if (ep.variants?.length) {
        parts.push(`  Variants: ${ep.variants.map(v => v.name).join(', ')}`);
      }
      if (ep.inventory) {
        parts.push(`  Stock: ${ep.inventory.inStock ? 'In Stock' : 'Out of Stock'}`);
      }
      return parts.join('\n');
    });

    blocks.push(`
ENRICHED PRODUCT DATA:
${enrichments.join('\n\n')}
Use review quotes and product details to make copy more specific and credible.
    `.trim());
  }

  return blocks.join('\n\n');
}

// ---------------------------------------------------------------------------
// Adapter stubs — each will be implemented in its own module
// ---------------------------------------------------------------------------

async function fetchBrandVoice(
  _config: IntegrationConfig
): Promise<BrandVoiceProfile | undefined> {
  // TODO: Implement Frontify GraphQL API call
  // GET brand guidelines → map to BrandVoiceProfile
  return undefined;
}

async function fetchAudienceSegments(
  _config: IntegrationConfig,
  _audienceNames: string[]
): Promise<AudienceSegment[]> {
  // TODO: Implement HubSpot v3 Segments API call
  // GET /crm/v3/lists → filter by audience names → map to AudienceSegment[]
  return [];
}

async function fetchSEOContext(
  _config: IntegrationConfig,
  _keyMessage: string
): Promise<SEOContext | undefined> {
  // TODO: Implement Semrush Keyword Magic Tool API call
  // GET keyword data for key message → map to SEOContext
  return undefined;
}

async function fetchPerformanceHistory(
  _config: IntegrationConfig,
  _campaignId: string,
  _channels: string[]
): Promise<ContentPerformanceData[]> {
  // TODO: Implement GA4 Data API call
  // GET campaign performance metrics → map to ContentPerformanceData[]
  return [];
}

async function fetchEnrichedProducts(
  _config: IntegrationConfig,
  _products: Product[]
): Promise<EnrichedProductData[]> {
  // TODO: Implement Shopify GraphQL API call
  // GET product data by SKU → map to EnrichedProductData[]
  return [];
}
