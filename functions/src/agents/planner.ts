// Planner agent: assembles minimal, focused context for downstream agents.
// Extracted from services/geminiService.ts:84-154

import {
  getCampaign,
  getProduct,
  getProducts,
  getComplianceRule,
  getContentForCampaign,
} from "../utils/firestore";
import { PlannerContext, AgentResult } from "../types/pipeline";

export async function runPlanner(
  campaignId: string,
  userId: string
): Promise<AgentResult<PlannerContext>> {
  try {
    // 1. Fetch campaign
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      return { success: false, error: `Campaign ${campaignId} not found` };
    }
    if (campaign.userId !== userId) {
      return { success: false, error: "Campaign does not belong to user" };
    }

    // 2. Fetch primary product
    let primaryProduct: PlannerContext["primaryProduct"];
    if (campaign.primaryProductId) {
      const product = await getProduct(campaign.primaryProductId);
      if (product) {
        primaryProduct = {
          name: product.name,
          brand: product.brand,
          description: product.description,
          features: product.features || [],
          marketingTags: product.marketingTags || [],
        };
      }
    }

    // 3. Fetch secondary products
    const secondaryProductDocs = await getProducts(
      campaign.secondaryProductIds || []
    );
    const secondaryProducts = secondaryProductDocs.map((p) => ({
      name: p.name,
      brand: p.brand,
    }));

    // 4. Fetch compliance rule (if set)
    let complianceRule: PlannerContext["complianceRule"];
    if (campaign.complianceRuleId) {
      const rule = await getComplianceRule(campaign.complianceRuleId);
      if (rule) {
        complianceRule = {
          name: rule.name,
          ruleText: rule.ruleText,
        };
      }
    }

    // 5. Fetch existing content for deduplication
    const existingContent = await getContentForCampaign(campaignId, userId);
    const existingCombinations = existingContent.map((c) => ({
      channel: c.channel,
      audience: c.audience,
    }));

    // 6. Build channel x audience combinations, skip existing, cap at 6
    const allCombinations: { channel: string; audience: string }[] = [];
    for (const channel of campaign.channels || []) {
      for (const audience of campaign.targetAudiences || []) {
        allCombinations.push({ channel, audience });
      }
    }

    // Filter out existing combinations
    const newCombinations = allCombinations.filter(
      (combo) =>
        !existingCombinations.some(
          (existing) =>
            existing.channel === combo.channel &&
            existing.audience === combo.audience
        )
    );

    const cappedCombinations = newCombinations.slice(0, 6);

    if (cappedCombinations.length === 0) {
      return {
        success: false,
        error: "No new channel/audience combinations to generate",
      };
    }

    // 7. Return structured PlannerContext with minimal, focused context
    const context: PlannerContext = {
      campaign: {
        name: campaign.name,
        description: campaign.description,
        keyMessage: campaign.keyMessage,
        context: campaign.context,
      },
      primaryProduct,
      secondaryProducts,
      complianceRule,
      combinations: cappedCombinations,
      existingCombinations,
    };

    return { success: true, data: context };
  } catch (error: any) {
    return {
      success: false,
      error: `Planner failed: ${error.message || String(error)}`,
    };
  }
}
