import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock fns are available in the hoisted vi.mock factory
const { callableMocks, snapshotCallbacks } = vi.hoisted(() => ({
  callableMocks: {} as Record<string, ReturnType<typeof vi.fn>>,
  snapshotCallbacks: {
    doc: null as ((snap: any) => void) | null,
    collection: null as ((snap: any) => void) | null,
  },
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: (_functions: any, name: string) => {
    if (!callableMocks[name]) {
      callableMocks[name] = vi.fn();
    }
    return callableMocks[name];
  },
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn((_db: any, path: string) => ({ path })),
  doc: vi.fn((_db: any, collectionName: string, id: string) => ({ collectionName, id })),
  query: vi.fn((...args: any[]) => args),
  where: vi.fn((field: string, op: string, value: string) => ({ field, op, value })),
  onSnapshot: vi.fn((ref: any, onNext: any, _onError?: any) => {
    // Determine if this is a doc or collection subscription based on shape
    if (ref && typeof ref === 'object' && ref.id) {
      snapshotCallbacks.doc = onNext;
    } else {
      snapshotCallbacks.collection = onNext;
    }
    // Return unsubscribe function
    return vi.fn();
  }),
}));

vi.mock('../firebase', () => ({
  functions: {},
  db: {},
  auth: { currentUser: { uid: 'test-user-123' } },
}));

import {
  startGeneration,
  subscribeToJob,
  subscribeToContent,
} from '../orchestrationService';

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  snapshotCallbacks.doc = null;
  snapshotCallbacks.collection = null;
  // Don't delete callableMocks entries — the module-level httpsCallable()
  // captured the mock fn reference at import time. Just reset the implementations.
});

// ── startGeneration ─────────────────────────────────────────────────────────

describe('startGeneration', () => {
  it('calls generateCampaignContent and returns jobId', async () => {
    // callableMocks['generateCampaignContent'] was lazily created by httpsCallable
    // during module init. We can override its implementation:
    callableMocks['generateCampaignContent'].mockResolvedValue({
      data: { jobId: 'job-123' },
    });

    const jobId = await startGeneration('campaign-1');

    expect(jobId).toBe('job-123');
    expect(callableMocks['generateCampaignContent']).toHaveBeenCalledWith({
      campaignId: 'campaign-1',
    });
  });

  it('propagates errors from the Cloud Function', async () => {
    callableMocks['generateCampaignContent'].mockRejectedValue(
      new Error('Auth required')
    );

    await expect(startGeneration('campaign-1')).rejects.toThrow('Auth required');
  });
});

// ── subscribeToJob ──────────────────────────────────────────────────────────

describe('subscribeToJob', () => {
  it('calls onSnapshot with a doc reference and returns unsubscribe', () => {
    const onUpdate = vi.fn();
    const unsub = subscribeToJob('job-123', onUpdate);

    expect(typeof unsub).toBe('function');
  });

  it('maps Firestore snapshot data to JobStatus shape', () => {
    const onUpdate = vi.fn();
    subscribeToJob('job-123', onUpdate);

    expect(snapshotCallbacks.doc).not.toBeNull();
    snapshotCallbacks.doc!({
      exists: () => true,
      data: () => ({
        status: 'generating',
        progress: 45,
        phase: 'Generating copy...',
        contentIds: ['c1', 'c2'],
        itemsCompleted: 2,
        itemsTotal: 4,
        retryCount: 0,
      }),
    });

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'generating',
      progress: 45,
      phase: 'Generating copy...',
      contentIds: ['c1', 'c2'],
      itemsCompleted: 2,
      itemsTotal: 4,
      retryCount: 0,
      error: undefined,
    });
  });

  it('ignores snapshots where doc does not exist', () => {
    const onUpdate = vi.fn();
    subscribeToJob('job-123', onUpdate);

    snapshotCallbacks.doc!({
      exists: () => false,
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('includes error field when present', () => {
    const onUpdate = vi.fn();
    subscribeToJob('job-456', onUpdate);

    snapshotCallbacks.doc!({
      exists: () => true,
      data: () => ({
        status: 'failed',
        progress: 30,
        phase: 'Generation failed',
        contentIds: [],
        itemsCompleted: 0,
        itemsTotal: 4,
        retryCount: 0,
        error: 'API key invalid',
      }),
    });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: 'API key invalid',
      })
    );
  });
});

// ── subscribeToContent ──────────────────────────────────────────────────────

describe('subscribeToContent', () => {
  it('calls onSnapshot with a query and returns unsubscribe', () => {
    const onUpdate = vi.fn();
    const unsub = subscribeToContent('campaign-1', onUpdate);

    expect(typeof unsub).toBe('function');
  });

  it('maps Firestore docs to GeneratedContent[]', () => {
    const onUpdate = vi.fn();
    subscribeToContent('campaign-1', onUpdate);

    expect(snapshotCallbacks.collection).not.toBeNull();
    snapshotCallbacks.collection!({
      docs: [
        {
          id: 'content-1',
          data: () => ({
            campaignId: 'campaign-1',
            channel: 'Email Newsletter',
            audience: 'Patients',
            text: 'Hello patients',
            imageUrl: 'https://storage.example.com/img.png',
            complianceScore: 92,
            status: 'draft',
            riskLevel: 'low',
            x: 50,
            y: 100,
            width: 320,
            generationJobId: 'job-123',
            complianceDetails: {
              score: 92,
              violations: [],
              suggestions: [],
              retryAttempt: 0,
            },
          }),
        },
        {
          id: 'content-2',
          data: () => ({
            campaignId: 'campaign-1',
            channel: 'Tweet',
            audience: 'General Public',
            text: 'Check out our product!',
            complianceScore: 85,
            status: 'draft',
            riskLevel: 'low',
            x: 400,
            y: 100,
            generationJobId: 'job-123',
          }),
        },
      ],
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const items = onUpdate.mock.calls[0][0];
    expect(items).toHaveLength(2);

    // First item has all fields
    expect(items[0]).toEqual(expect.objectContaining({
      id: 'content-1',
      campaignId: 'campaign-1',
      channel: 'Email Newsletter',
      audience: 'Patients',
      text: 'Hello patients',
      complianceScore: 92,
      generationJobId: 'job-123',
    }));

    // Second item defaults missing imageUrl to ''
    expect(items[1].imageUrl).toBe('');
  });

  it('handles empty snapshot', () => {
    const onUpdate = vi.fn();
    subscribeToContent('campaign-1', onUpdate);

    snapshotCallbacks.collection!({ docs: [] });

    expect(onUpdate).toHaveBeenCalledWith([]);
  });
});
