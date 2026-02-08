
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { GeneratedContent, Scene } from '../types';
import { checkContentCompliance, checkMultipleContentCompliance, ComplianceCheckResult } from './geminiClient';
import { getContentForCampaign, getContentByIds } from './firestoreHelpers';
import { updateContentDoc } from './contentStorage';
import { saveAnalyticsResult } from './analyticsStorage';
import { saveComplianceCheck } from './complianceCheckStorage';

// ── Types ────────────────────────────────────────────────────────────────────

export type JobPhase =
  | 'pending'
  | 'planning'
  | 'generating'
  | 'compliance_check'
  | 'retrying'
  | 'generating_images'
  | 'completed'
  | 'failed';

export interface JobStatus {
  status: JobPhase;
  progress: number;
  phase: string;
  contentIds: string[];
  itemsCompleted: number;
  itemsTotal: number;
  retryCount: number;
  error?: string;
}

// ── Cloud Function reference (only for pipeline generation) ─────────────────────

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Note: Compliance checking now uses direct Gemini API calls via geminiClient.ts
// Firebase is only used for data storage. Only pipeline generation uses Cloud Functions.

const generateCampaignContentFn = httpsCallable<
  { campaignId: string },
  { jobId: string }
>(functions, 'generateCampaignContent');

// ── startGeneration ──────────────────────────────────────────────────────────
// Calls the onCall trigger and returns a jobId instantly.

export async function startGeneration(campaignId: string): Promise<string> {
  const result = await generateCampaignContentFn({ campaignId });
  return result.data.jobId;
}

// ── subscribeToJob ───────────────────────────────────────────────────────────
// Subscribes to the generationJobs/{jobId} doc for real-time progress.

export function subscribeToJob(
  jobId: string,
  onUpdate: (job: JobStatus) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const jobRef = doc(db, 'generationJobs', jobId);

  return onSnapshot(
    jobRef,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onUpdate({
        status: data.status as JobPhase,
        progress: data.progress ?? 0,
        phase: data.phase ?? '',
        contentIds: data.contentIds ?? [],
        itemsCompleted: data.itemsCompleted ?? 0,
        itemsTotal: data.itemsTotal ?? 0,
        retryCount: data.retryCount ?? 0,
        error: data.error,
      });
    },
    (error) => {
      console.error('subscribeToJob error:', error);
      onError?.(error);
    },
  );
}

// ── subscribeToContent ───────────────────────────────────────────────────────
// Subscribes to content docs for a given campaign, converting Firestore docs
// to the frontend GeneratedContent shape.

export function subscribeToContent(
  campaignId: string,
  onUpdate: (content: GeneratedContent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const contentRef = collection(db, 'content');
  const userId = auth.currentUser?.uid;
  if (!userId) {
    onError?.(new Error('User not authenticated'));
    return () => {};
  }
  const q = query(contentRef, where('campaignId', '==', campaignId), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: GeneratedContent[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          campaignId: data.campaignId,
          channel: data.channel,
          audience: data.audience,
          text: data.text ?? '',
          imageUrl: data.imageUrl ?? '',
          complianceScore: data.complianceScore ?? 0,
          status: data.status ?? 'draft',
          riskLevel: data.riskLevel ?? 'low',
          x: data.x ?? 0,
          y: data.y ?? 0,
          width: data.width,
          height: data.height,
          connections: data.connections,
          storyboard: data.storyboard as Scene[] | undefined,
          videoUrl: data.videoUrl,
          videoStatus: data.videoStatus,
          generationJobId: data.generationJobId,
          complianceDetails: data.complianceDetails,
        };
      });
      onUpdate(items);
    },
    (error) => {
      console.error('subscribeToContent error:', error);
      onError?.(error);
    },
  );
}

// ── checkCompliance ──────────────────────────────────────────────────────────
// Standalone compliance checking for existing content items or campaigns
// Uses direct Gemini API calls (frontend)

export interface ComplianceCheckResponse {
  success: boolean;
  total: number;
  passed: number;
  failed: number;
  results: ComplianceCheckResult[];
}

export async function checkCompliance(
  ruleId: string,
  options: { contentIds?: string[]; campaignId?: string; campaignName?: string },
  ruleText: string,
  ruleName: string
): Promise<ComplianceCheckResponse> {
  try {
    // Fetch content items
    let contentItems: GeneratedContent[] = [];

    if (options.contentIds && options.contentIds.length > 0) {
      contentItems = await getContentByIds(options.contentIds);
    } else if (options.campaignId) {
      contentItems = await getContentForCampaign(options.campaignId);
    } else {
      throw new Error('Either contentIds or campaignId must be provided');
    }

    if (contentItems.length === 0) {
      return {
        success: true,
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
      };
    }

    // Check compliance using Gemini API directly
    const itemsToCheck = contentItems.map(item => ({
      id: item.id,
      text: item.text,
      channel: item.channel,
      audience: item.audience,
    }));

    const results = await checkMultipleContentCompliance(
      itemsToCheck,
      ruleText,
      ruleName
    );

    // Update Firestore with results
    await Promise.allSettled(
      results.map(result =>
        updateContentDoc(result.contentId, {
          complianceScore: result.score,
          complianceDetails: {
            score: result.score,
            violations: result.violations,
            suggestions: result.suggestedFix ? [result.suggestedFix] : [],
            suggestedFix: result.suggestedFix,
            retryAttempt: 0,
          },
        })
      )
    );

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;

    // Save compliance check result to Firestore
    try {
      await saveComplianceCheck(
        ruleId,
        ruleName,
        options.campaignId ? 'campaign' : 'content',
        {
          campaignId: options.campaignId,
          campaignName: options.campaignName,
          contentIds: options.contentIds,
        },
        results
      );
    } catch (error) {
      console.error('Failed to save compliance check result:', error);
      // Continue even if save fails
    }

    return {
      success: true,
      total: results.length,
      passed,
      failed,
      results,
    };
  } catch (error: any) {
    console.error('Compliance check error:', error);
    return {
      success: false,
      total: 0,
      passed: 0,
      failed: 0,
      results: [],
    };
  }
}

// ── analyzeCampaignsCompliance ──────────────────────────────────────────────────
// Analyzes all campaigns against selected compliance rules

export interface CampaignAnalysisResult {
  campaignId: string;
  campaignName: string;
  ruleId: string;
  ruleName: string;
  totalContent: number;
  passed: number;
  failed: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  results: ComplianceCheckResult[];
  analyzedAt: string;
}

export interface CampaignAnalysisResponse {
  success: boolean;
  summary: {
    totalCampaigns: number;
    totalRules: number;
    totalContent: number;
    totalPassed: number;
    totalFailed: number;
    overallAverage: number;
  };
  results: CampaignAnalysisResult[];
}

export async function analyzeCampaignsCompliance(
  ruleIds: string[],
  campaigns: Array<{ id: string; name: string }>,
  complianceRules: Array<{ id: string; name: string; ruleText: string }>
): Promise<CampaignAnalysisResponse> {
  try {
    const analysisResults: CampaignAnalysisResult[] = [];

    // Filter to valid rules
    const validRules = complianceRules.filter(rule => ruleIds.includes(rule.id));

    if (validRules.length === 0) {
      throw new Error('No valid compliance rules found');
    }

    // Analyze each campaign against each rule
    for (const campaign of campaigns) {
      const contentItems = await getContentForCampaign(campaign.id);

      if (contentItems.length === 0) {
        continue; // Skip campaigns with no content
      }

      for (const rule of validRules) {
        // Check compliance using Gemini API directly
        const itemsToCheck = contentItems.map(item => ({
          id: item.id,
          text: item.text,
          channel: item.channel,
          audience: item.audience,
        }));

        const results = await checkMultipleContentCompliance(
          itemsToCheck,
          rule.ruleText,
          rule.name
        );

        const passed = results.filter(r => r.pass).length;
        const failed = results.filter(r => !r.pass).length;
        const scores = results.map(r => r.score);
        const averageScore = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
        const minScore = scores.length > 0 ? Math.min(...scores) : 0;
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

        // Update Firestore with results
        await Promise.allSettled(
          results.map(result =>
            updateContentDoc(result.contentId, {
              complianceScore: result.score,
              complianceDetails: {
                score: result.score,
                violations: result.violations,
                suggestions: result.suggestedFix ? [result.suggestedFix] : [],
                suggestedFix: result.suggestedFix,
                retryAttempt: 0,
              },
            })
          )
        );

        const analysisResult: CampaignAnalysisResult = {
          campaignId: campaign.id,
          campaignName: campaign.name,
          ruleId: rule.id,
          ruleName: rule.name,
          totalContent: results.length,
          passed,
          failed,
          averageScore,
          minScore,
          maxScore,
          results,
          analyzedAt: new Date().toISOString(),
        };

        analysisResults.push(analysisResult);

        // Save analytics result to Firestore
        try {
          await saveAnalyticsResult(analysisResult);
        } catch (error) {
          console.error(`Failed to save analytics for campaign ${campaign.id}, rule ${rule.id}:`, error);
          // Continue even if save fails
        }
      }
    }

    // Calculate summary statistics
    const totalCampaigns = new Set(analysisResults.map(r => r.campaignId)).size;
    const totalContent = analysisResults.reduce((sum, r) => sum + r.totalContent, 0);
    const totalPassed = analysisResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = analysisResults.reduce((sum, r) => sum + r.failed, 0);
    const overallAverage = analysisResults.length > 0
      ? Math.round(analysisResults.reduce((sum, r) => sum + r.averageScore, 0) / analysisResults.length)
      : 0;

    return {
      success: true,
      summary: {
        totalCampaigns,
        totalRules: validRules.length,
        totalContent,
        totalPassed,
        totalFailed,
        overallAverage,
      },
      results: analysisResults,
    };
  } catch (error: any) {
    console.error('Campaign analysis error:', error);
    throw error;
  }
}
