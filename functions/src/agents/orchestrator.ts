// Orchestrator: pipeline controller that runs agents in sequence.
// Pure code — no LLM calls. Deterministic flow: Planner → Generator.
// Compliance and Asset Manager stages will be wired in later phases.

import { ProgressWriter } from "../utils/progress";
import { TimeoutBudget } from "../utils/timeout";
import { runPlanner } from "./planner";
import { generateText } from "./generator";
import { ContentDoc } from "../types/pipeline";

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

    const contentDocs: ContentDoc[] = genResult.data;
    const contentIds = contentDocs.map((d) => d.id);

    await progress.update({
      status: "generating",
      phase: "Copy generated",
      progress: 70,
      contentIds,
      itemsCompleted: contentIds.length,
    });

    // ── Complete ───────────────────────────────────────────────────────────
    // Future phases will add compliance check and asset manager stages here.
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
