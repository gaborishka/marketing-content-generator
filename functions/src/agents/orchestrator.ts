// Orchestrator: pipeline controller that runs agents in sequence.
// Pure code — no LLM calls. Deterministic flow: Planner → Generator → Compliance → (retry?) → Asset Manager.

import { ProgressWriter } from "../utils/progress";
import { TimeoutBudget } from "../utils/timeout";
import { runPlanner } from "./planner";
import { generateText, regenerateText } from "./generator";
import { runComplianceCheck } from "./compliance";
import { ContentDoc, ComplianceFeedback } from "../types/pipeline";

const MAX_COMPLIANCE_RETRIES = 2;

export interface OrchestratorInput {
  campaignId: string;
  userId: string;
  jobId: string;
  maxSeconds: number;
}

export interface OrchestratorResult {
  success: boolean;
  contentIds: string[];
  error?: string;
}

export async function runOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  const { campaignId, userId, jobId, maxSeconds } = input;
  const progress = new ProgressWriter(jobId);
  const budget = new TimeoutBudget(maxSeconds);

  try {
    // ── Stage 1: Planning ──────────────────────────────────────────────────
    if (budget.isExpired()) {
      await progress.fail("Timeout before planning could start");
      return { success: false, contentIds: [], error: "Timeout before planning" };
    }

    await progress.setPhase("planning", "Gathering context...", 10);

    const planResult = await runPlanner(campaignId, userId);
    if (!planResult.success || !planResult.data) {
      const error = planResult.error || "Planner returned no data";
      await progress.fail(error);
      return { success: false, contentIds: [], error };
    }

    const plannerContext = planResult.data;

    await progress.update({
      status: "planning",
      phase: "Context assembled",
      progress: 25,
      itemsTotal: plannerContext.combinations.length,
    });

    // ── Stage 2: Text Generation ───────────────────────────────────────────
    if (budget.isExpired()) {
      await progress.fail("Timeout before text generation");
      return { success: false, contentIds: [], error: "Timeout before generation" };
    }

    await progress.setPhase("generating", "Generating copy...", 30);

    const genResult = await generateText(plannerContext, campaignId, userId, jobId);
    if (!genResult.success || !genResult.data) {
      const error = genResult.error || "Generator returned no data";
      await progress.fail(error);
      return { success: false, contentIds: [], error };
    }

    let contentDocs: ContentDoc[] = genResult.data;
    const contentIds = contentDocs.map((d) => d.id);

    await progress.update({
      status: "generating",
      phase: "Copy generated",
      progress: 50,
      contentIds,
      itemsCompleted: contentIds.length,
    });

    // ── Stage 3: Compliance Check + Retry Loop ─────────────────────────────
    if (plannerContext.complianceRule && !budget.isExpired()) {
      await progress.setPhase("compliance_check", "Checking compliance...", 55);

      let retryCount = 0;

      while (retryCount <= MAX_COMPLIANCE_RETRIES) {
        if (budget.isExpired()) {
          // Accept what we have — timeout is more important than perfect compliance
          break;
        }

        const complianceResult = await runComplianceCheck(
          contentDocs,
          plannerContext.complianceRule.name,
          plannerContext.complianceRule.ruleText,
          retryCount
        );

        if (!complianceResult.success || !complianceResult.data) {
          // Compliance check itself failed — continue without it
          break;
        }

        const failedResults = complianceResult.data.filter((r) => !r.pass);

        if (failedResults.length === 0) {
          // All items passed compliance
          break;
        }

        // Already at max retries — accept with current scores
        if (retryCount >= MAX_COMPLIANCE_RETRIES) {
          break;
        }

        // Retry failed items
        retryCount++;
        await progress.update({
          status: "retrying",
          phase: `Revising ${failedResults.length} item(s) (attempt ${retryCount}/${MAX_COMPLIANCE_RETRIES})...`,
          progress: 55 + retryCount * 5,
          retryCount,
        });

        if (budget.isExpired()) {
          break;
        }

        for (const failedItem of failedResults) {
          const failedDoc = contentDocs.find((d) => d.id === failedItem.contentId);
          if (!failedDoc) continue;

          const feedback: ComplianceFeedback = {
            contentId: failedItem.contentId,
            score: failedItem.score,
            violations: failedItem.violations,
            suggestedFix: failedItem.suggestedFix,
          };

          const regenResult = await regenerateText(
            plannerContext,
            failedDoc,
            feedback
          );

          if (regenResult.success && regenResult.data) {
            // Replace the doc in our working set
            contentDocs = contentDocs.map((d) =>
              d.id === failedItem.contentId ? regenResult.data! : d
            );
          }
        }
      }

      await progress.update({
        status: "compliance_check",
        phase: "Compliance review complete",
        progress: 70,
        retryCount,
      });
    }

    // ── Complete ───────────────────────────────────────────────────────────
    // Future phases will add asset manager stage here.
    await progress.complete(contentIds);

    return { success: true, contentIds };
  } catch (error: any) {
    const message = error.message || String(error);
    try {
      await progress.fail(message);
    } catch {
      // Progress write failed — log but don't mask the original error
      console.error("Failed to write error status to job doc:", message);
    }
    return { success: false, contentIds: [], error: message };
  }
}
