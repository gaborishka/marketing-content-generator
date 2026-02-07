/**
 * Google Analytics 4 Integration Adapter
 *
 * Two-way integration:
 * 1. OUTBOUND: Track content events via GA4 Measurement Protocol (content_generated,
 *    content_published, etc.) — simple HTTP POST, no SDK needed.
 * 2. INBOUND: Pull performance data via GA4 Data API to feed back into Gemini prompts
 *    for data-informed content generation.
 *
 * Setup: Requires GA4 Measurement ID and API Secret (for Measurement Protocol),
 * plus a service account or OAuth for the Data API.
 * Completely free — GA4 standard is free with no per-call charges.
 *
 * API: HTTP POST (Measurement Protocol) + REST (Data API v1beta)
 * Docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

import type {
  IntegrationAdapter,
  IntegrationConfig,
  ContentPerformanceData,
} from '../../types/integrations';
import type { GeneratedContent, Campaign } from '../../types';

interface GA4Config {
  measurementId: string;   // G-XXXXXXXXXX
  apiSecret: string;       // Measurement Protocol API secret
  propertyId?: string;     // GA4 property ID for Data API queries
}

/**
 * Custom events tracked in GA4 for the content lifecycle.
 */
type ContentEvent =
  | 'content_generated'
  | 'content_approved'
  | 'content_rejected'
  | 'content_published'
  | 'campaign_created'
  | 'campaign_completed';

export class GA4Adapter implements IntegrationAdapter<GA4Config> {
  id = 'ga4' as const;
  category = 'analytics' as const;

  async testConnection(config: GA4Config): Promise<boolean> {
    try {
      // Send a validation event to Measurement Protocol debug endpoint
      const response = await fetch(
        `https://www.google-analytics.com/debug/mp/collect?measurement_id=${config.measurementId}&api_secret=${config.apiSecret}`,
        {
          method: 'POST',
          body: JSON.stringify({
            client_id: 'test_connection',
            events: [{ name: 'test_event', params: {} }],
          }),
        }
      );
      const data = await response.json();
      // Debug endpoint returns validation messages — no errors means success
      return !data.validationMessages?.some((m: any) => m.validationCode === 'INVALID');
    } catch {
      return false;
    }
  }

  /**
   * Track a content lifecycle event in GA4.
   * Uses the Measurement Protocol — single HTTP POST, no SDK.
   */
  async trackEvent(
    config: GA4Config,
    eventName: ContentEvent,
    content: GeneratedContent,
    campaign: Campaign,
    userId?: string
  ): Promise<void> {
    const payload = {
      client_id: userId ?? 'anonymous',
      user_id: userId,
      events: [{
        name: eventName,
        params: {
          content_id: content.id,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          channel: content.channel,
          audience: content.audience,
          compliance_score: content.complianceScore,
          risk_level: content.riskLevel,
          content_status: content.status,
        },
      }],
    };

    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${config.measurementId}&api_secret=${config.apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  /**
   * Track a batch of content generation events.
   * Called after generateMarketingContent() completes.
   */
  async trackContentGenerated(
    config: GA4Config,
    contentItems: GeneratedContent[],
    campaign: Campaign,
    userId?: string
  ): Promise<void> {
    // GA4 Measurement Protocol supports up to 25 events per request
    const batchSize = 25;
    for (let i = 0; i < contentItems.length; i += batchSize) {
      const batch = contentItems.slice(i, i + batchSize);
      const payload = {
        client_id: userId ?? 'anonymous',
        user_id: userId,
        events: batch.map(content => ({
          name: 'content_generated' as const,
          params: {
            content_id: content.id,
            campaign_id: campaign.id,
            channel: content.channel,
            audience: content.audience,
            compliance_score: content.complianceScore,
            risk_level: content.riskLevel,
          },
        })),
      };

      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${config.measurementId}&api_secret=${config.apiSecret}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
    }
  }

  /**
   * Fetch content performance data from GA4 Data API.
   * Requires OAuth or service account credentials (not just Measurement Protocol secret).
   *
   * This data is fed back into GenerationContext.performanceHistory
   * to inform future content generation.
   */
  async fetchPerformanceData(
    config: GA4Config,
    campaignId: string,
    _channels: string[],
    _accessToken: string
  ): Promise<ContentPerformanceData[]> {
    if (!config.propertyId) return [];

    // GA4 Data API v1beta runReport
    // TODO: Implement with proper OAuth token management
    // The query would filter by campaign_id custom dimension and
    // return metrics like eventCount, engagementRate, etc.
    //
    // POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
    // {
    //   "dimensions": [{ "name": "customEvent:channel" }, { "name": "customEvent:audience" }],
    //   "metrics": [{ "name": "eventCount" }, { "name": "engagementRate" }],
    //   "dimensionFilter": {
    //     "filter": {
    //       "fieldName": "customEvent:campaign_id",
    //       "stringFilter": { "value": campaignId }
    //     }
    //   },
    //   "dateRanges": [{ "startDate": "30daysAgo", "endDate": "today" }]
    // }

    console.log(`GA4: Would fetch performance data for campaign ${campaignId}`);
    return [];
  }

  async sync(_config: GA4Config): Promise<void> {
    // GA4 sync happens via event tracking (outbound) and periodic data pulls (inbound)
  }

  async disconnect(): Promise<void> {
    // Clean up credentials
  }
}

export function parseGA4Config(integration: IntegrationConfig): GA4Config {
  return {
    measurementId: integration.credentials['measurementId'] ?? '',
    apiSecret: integration.credentials['apiSecret'] ?? '',
    propertyId: integration.credentials['propertyId'],
  };
}
