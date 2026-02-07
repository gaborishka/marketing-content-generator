
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { functions, db, auth } from './firebase';
import { GeneratedContent, Scene } from '../types';

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

// ── Cloud Function reference ─────────────────────────────────────────────────

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
