/**
 * Slack Integration Adapter
 *
 * Sends generated content to Slack for approval workflows.
 * Uses Slack Web API to post rich messages with interactive buttons.
 *
 * Flow:
 * 1. Content generated → Send preview to Slack channel with Approve/Reject buttons
 * 2. Reviewer clicks button → Slack webhook fires → App updates content status
 * 3. Feedback flows back into the campaign workspace
 *
 * Setup: Requires a Slack Bot Token (xoxb-...) with chat:write, reactions:read scopes.
 * Free tier supports all needed bot functionality.
 *
 * API: REST (Web API) + Events API for incoming interactions
 * Docs: https://docs.slack.dev/
 * Blueprint: https://api.slack.com/best-practices/blueprints/approval-workflows
 */

import type {
  IntegrationAdapter,
  IntegrationConfig,
  SlackApprovalRequest,
} from '../../types/integrations';
import type { GeneratedContent, Campaign } from '../../types';

interface SlackConfig {
  botToken: string;        // xoxb-...
  defaultChannelId: string; // Channel ID for approval messages
  webhookUrl?: string;      // Incoming webhook for notifications
}

export class SlackAdapter implements IntegrationAdapter<SlackConfig> {
  id = 'slack' as const;
  category = 'collaboration' as const;

  async testConnection(config: SlackConfig): Promise<boolean> {
    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.botToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }

  /**
   * Send a content item to Slack for approval review.
   * Posts a rich message with the content preview and interactive buttons.
   */
  async sendForApproval(
    config: SlackConfig,
    content: GeneratedContent,
    campaign: Campaign
  ): Promise<SlackApprovalRequest> {
    const blocks = this.buildApprovalBlocks(content, campaign);

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: config.defaultChannelId,
        text: `New content for review: ${campaign.name} — ${content.channel}`,
        blocks,
      }),
    });

    const data = await response.json();

    return {
      contentId: content.id,
      campaignId: campaign.id,
      slackChannelId: config.defaultChannelId,
      slackMessageTs: data.ts,
      requestedBy: 'system',
      requestedAt: new Date().toISOString(),
    };
  }

  /**
   * Send batch of content items for approval.
   */
  async sendBatchForApproval(
    config: SlackConfig,
    contentItems: GeneratedContent[],
    campaign: Campaign
  ): Promise<SlackApprovalRequest[]> {
    const requests: SlackApprovalRequest[] = [];
    for (const content of contentItems) {
      const request = await this.sendForApproval(config, content, campaign);
      requests.push(request);
    }
    return requests;
  }

  private buildApprovalBlocks(content: GeneratedContent, campaign: Campaign): object[] {
    const riskEmoji = content.riskLevel === 'low' ? ':white_check_mark:'
      : content.riskLevel === 'medium' ? ':warning:'
      : ':red_circle:';

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Content Review: ${campaign.name}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Channel:*\n${content.channel}` },
          { type: 'mrkdwn', text: `*Audience:*\n${content.audience}` },
          { type: 'mrkdwn', text: `*Compliance:*\n${content.complianceScore}/100` },
          { type: 'mrkdwn', text: `*Risk:* ${riskEmoji} ${content.riskLevel}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: content.text.length > 2000
            ? content.text.substring(0, 2000) + '...'
            : content.text,
        },
      },
      ...(content.imageUrl ? [{
        type: 'image',
        image_url: content.imageUrl,
        alt_text: `Marketing image for ${content.channel}`,
      }] : []),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            action_id: `approve_content_${content.id}`,
            value: content.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            style: 'danger',
            action_id: `reject_content_${content.id}`,
            value: content.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Request Changes' },
            action_id: `changes_content_${content.id}`,
            value: content.id,
          },
        ],
      },
    ];
  }

  async sync(_config: SlackConfig): Promise<void> {
    // Sync is handled via Events API / webhooks, not polling
  }

  async disconnect(): Promise<void> {
    // Revoke bot token if needed
  }
}

export function parseSlackConfig(integration: IntegrationConfig): SlackConfig {
  return {
    botToken: integration.credentials['botToken'] ?? '',
    defaultChannelId: integration.credentials['channelId'] ?? '',
    webhookUrl: integration.credentials['webhookUrl'],
  };
}
