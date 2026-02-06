import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock fns are available in the hoisted vi.mock factory
const { callableMocks } = vi.hoisted(() => ({
  callableMocks: {} as Record<string, ReturnType<typeof vi.fn>>,
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

vi.mock('../firebase', () => ({
  functions: {},
}));

import { generateImage, generateVideoFromStoryboard, generateMarketingContent } from '../geminiService';
import type { Product, Campaign, Scene, ComplianceRule } from '../../types';

// ── Helpers ──

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  name: 'Widget Pro',
  sku: 'WP-001',
  brand: 'AcmeCo',
  category: 'Gadgets',
  description: 'The best widget',
  price: 29.99,
  features: ['fast', 'reliable'],
  imageUrl: 'https://example.com/widget.png',
  complianceFiles: [],
  marketingTags: ['premium'],
  ...overrides,
});

const makeCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: 'camp-1',
  name: 'Summer Sale',
  description: 'Big summer sale',
  status: 'draft',
  primaryProductId: 'prod-1',
  secondaryProductIds: [],
  context: 'Summer vibes campaign',
  attachments: [],
  targetAudiences: ['Young Adults'],
  channels: ['Twitter'],
  languages: ['en'],
  keyMessage: 'Best deal ever',
  startDate: '2025-06-01',
  budget: 5000,
  progress: 0,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(callableMocks).forEach(key => {
    callableMocks[key].mockReset();
  });
});

// ══════════════════════════════ generateImage ══════════════════════════════

describe('generateImage', () => {
  it('calls generateImage Cloud Function with product-specific prompt', async () => {
    callableMocks['generateImage']?.mockResolvedValueOnce({
      data: { mimeType: 'image/png', data: 'abc123' },
    });

    const product = makeProduct();
    const result = await generateImage(product, 'summer vibes');

    expect(callableMocks['generateImage']).toHaveBeenCalledTimes(1);
    const callArg = callableMocks['generateImage'].mock.calls[0][0];
    expect(callArg.prompt).toContain('Widget Pro');
    expect(callArg.prompt).toContain('AcmeCo');
    expect(result).toBe('data:image/png;base64,abc123');
  });

  it('builds generic prompt when product is undefined', async () => {
    callableMocks['generateImage']?.mockResolvedValueOnce({
      data: { mimeType: 'image/png', data: 'abc' },
    });

    await generateImage(undefined, 'abstract branding');

    const callArg = callableMocks['generateImage'].mock.calls[0][0];
    expect(callArg.prompt).toContain('abstract branding');
    expect(callArg.prompt).not.toContain('Widget Pro');
  });

  it('returns base64 data URL from successful Cloud Function response', async () => {
    callableMocks['generateImage']?.mockResolvedValueOnce({
      data: { mimeType: 'image/jpeg', data: '/9j/4AAQ' },
    });

    const result = await generateImage(undefined, 'test');
    expect(result).toBe('data:image/jpeg;base64,/9j/4AAQ');
  });

  it('returns picsum placeholder on Cloud Function error', async () => {
    callableMocks['generateImage']?.mockRejectedValueOnce(new Error('Function error'));

    const result = await generateImage(undefined, 'test');
    expect(result).toMatch(/^https:\/\/picsum\.photos\/seed\/\d+\/800\/400$/);
  });
});

// ══════════════════════════ generateVideoFromStoryboard ══════════════════════════

describe('generateVideoFromStoryboard', () => {
  it('throws when storyboard has no valid images', async () => {
    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p', voiceover: 'v' }, // no imageUrl
    ];

    await expect(generateVideoFromStoryboard(scenes, 'test-id')).rejects.toThrow('No images available');
  });

  it('slices to at most 3 scenes for reference images', async () => {
    // Mock fetch for createReferenceImage (URL path)
    const mockBlob = new Blob(['fake'], { type: 'image/png' });
    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(mockBlob),
      ok: true,
    } as any);

    // Mock FileReader for createReferenceImage
    const originalFileReader = global.FileReader;
    class MockFileReader {
      result: string = '';
      onloadend: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      readAsDataURL() {
        this.result = 'data:image/png;base64,mockdata';
        if (this.onloadend) this.onloadend();
      }
    }
    global.FileReader = MockFileReader as any;

    // Set up video Cloud Function to fail fast
    callableMocks['generateVideo']?.mockRejectedValueOnce(new Error('test-stop'));

    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p1', voiceover: 'v1', imageUrl: 'https://example.com/1.png' },
      { sceneNumber: 2, imagePrompt: 'p2', voiceover: 'v2', imageUrl: 'https://example.com/2.png' },
      { sceneNumber: 3, imagePrompt: 'p3', voiceover: 'v3', imageUrl: 'https://example.com/3.png' },
      { sceneNumber: 4, imagePrompt: 'p4', voiceover: 'v4', imageUrl: 'https://example.com/4.png' },
    ];

    await expect(generateVideoFromStoryboard(scenes, 'test-id')).rejects.toThrow();

    // fetch called 3 times (not 4) because of .slice(0, 3)
    expect(global.fetch).toHaveBeenCalledTimes(3);

    global.FileReader = originalFileReader;
  });

  it('calls generateVideo Cloud Function and returns download URL', async () => {
    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p', voiceover: 'v', imageUrl: 'data:image/png;base64,abc' },
    ];

    const mockVideoUrl = 'https://firebasestorage.googleapis.com/v0/b/test/o/video.mp4?alt=media&token=abc';

    // Mock the video Cloud Function response
    callableMocks['generateVideo']?.mockResolvedValueOnce({
      data: { videoUrl: mockVideoUrl },
    });

    const result = await generateVideoFromStoryboard(scenes, 'content-123');

    expect(callableMocks['generateVideo']).toHaveBeenCalledTimes(1);
    const callArg = callableMocks['generateVideo'].mock.calls[0][0];
    expect(callArg.referenceImages).toHaveLength(1);
    expect(callArg.contentId).toBe('content-123');
    expect(callArg.prompt).toContain('cinematic');
    expect(result).toBe(mockVideoUrl);
  });

  it('throws on Cloud Function error', async () => {
    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p', voiceover: 'v', imageUrl: 'data:image/png;base64,abc' },
    ];

    callableMocks['generateVideo']?.mockRejectedValueOnce(new Error('Video generation failed'));

    await expect(generateVideoFromStoryboard(scenes, 'test-id')).rejects.toThrow('Video generation failed');
  });
});

// ══════════════════════════ generateMarketingContent ══════════════════════════

describe('generateMarketingContent', () => {
  const product = makeProduct();
  const allProducts = [product];

  it('calls generateContent Cloud Function with correct prompt', async () => {
    callableMocks['generateContent']?.mockResolvedValueOnce({
      data: { text: '[]' },
    });

    await generateMarketingContent(makeCampaign(), allProducts);

    expect(callableMocks['generateContent']).toHaveBeenCalledTimes(1);
    const callArg = callableMocks['generateContent'].mock.calls[0][0];
    expect(callArg.prompt).toContain('Widget Pro');
    expect(callArg.prompt).toContain('AcmeCo');
    expect(callArg.responseSchema).toBeDefined();
  });

  it('includes secondary products in prompt', async () => {
    const secondary = makeProduct({ id: 'prod-2', name: 'Gizmo Plus' });
    callableMocks['generateContent']?.mockResolvedValueOnce({
      data: { text: '[]' },
    });

    const campaign = makeCampaign({ secondaryProductIds: ['prod-2'] });
    await generateMarketingContent(campaign, [product, secondary]);

    const callArg = callableMocks['generateContent'].mock.calls[0][0];
    expect(callArg.prompt).toContain('Gizmo Plus');
  });

  it('includes compliance rules in prompt when provided', async () => {
    callableMocks['generateContent']?.mockResolvedValueOnce({
      data: { text: '[]' },
    });

    const complianceRule: ComplianceRule = {
      id: 'rule-1',
      name: 'FDA Guidelines',
      description: 'Must follow FDA rules',
      ruleText: 'No unapproved claims',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };

    await generateMarketingContent(makeCampaign(), allProducts, complianceRule);

    const callArg = callableMocks['generateContent'].mock.calls[0][0];
    expect(callArg.prompt).toContain('FDA Guidelines');
    expect(callArg.prompt).toContain('No unapproved claims');
  });

  it('handles brand/idea campaigns (no primary product)', async () => {
    callableMocks['generateContent']?.mockResolvedValueOnce({
      data: { text: '[]' },
    });

    const campaign = makeCampaign({ primaryProductId: undefined });
    await generateMarketingContent(campaign, allProducts);

    const callArg = callableMocks['generateContent'].mock.calls[0][0];
    expect(callArg.prompt).toContain('Brand/Idea Campaign');
  });

  it('parses JSON response into GeneratedContent array', async () => {
    const apiResponse = [
      {
        channel: 'Twitter',
        audience: 'Young Adults',
        text: 'Check out our sale!',
        complianceScore: 95,
        riskLevel: 'low',
      },
    ];
    callableMocks['generateContent']?.mockResolvedValueOnce({
      data: { text: JSON.stringify(apiResponse) },
    });

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result).toHaveLength(1);
    expect(result[0].channel).toBe('Twitter');
    expect(result[0].audience).toBe('Young Adults');
    expect(result[0].text).toBe('Check out our sale!');
    expect(result[0].complianceScore).toBe(95);
    expect(result[0].riskLevel).toBe('low');
    expect(result[0].status).toBe('draft');
    expect(result[0].campaignId).toBe('camp-1');
    expect(result[0].id).toMatch(/^gen-/);
  });

  it('falls back to mock on JSON parse error', async () => {
    callableMocks['generateContent']?.mockResolvedValueOnce({
      data: { text: 'not valid json{{{' },
    });

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text).toContain('Mock content');
  });

  it('falls back to mock when response is not an array', async () => {
    callableMocks['generateContent']?.mockResolvedValueOnce({
      data: { text: '{"notAnArray": true}' },
    });

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text).toContain('Mock content');
  });

  it('falls back to mock on Cloud Function error', async () => {
    callableMocks['generateContent']?.mockRejectedValueOnce(new Error('Function failure'));

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text).toContain('Mock content');
  });

  it('parses video storyboard channel correctly', async () => {
    const apiResponse = [
      {
        channel: 'Video Storyboard',
        audience: 'Teens',
        text: 'Full voiceover script',
        complianceScore: 88,
        riskLevel: 'medium',
        storyboard: [
          { sceneNumber: 1, imagePrompt: 'Product shot', voiceover: 'Intro' },
          { sceneNumber: 2, imagePrompt: 'Action shot', voiceover: 'Middle' },
        ],
      },
    ];
    callableMocks['generateContent']?.mockResolvedValueOnce({
      data: { text: JSON.stringify(apiResponse) },
    });

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result[0].channel).toBe('Video Storyboard');
    expect(result[0].storyboard).toHaveLength(2);
    expect(result[0].storyboard![0].imageUrl).toBe(''); // initially empty
    expect(result[0].storyboard![0].imagePrompt).toBe('Product shot');
  });
});

// ══════════════════════ mockGeneration (tested indirectly) ══════════════════════

describe('mockGeneration (via generateMarketingContent on error)', () => {
  it('generates content for each channel x audience combination', async () => {
    callableMocks['generateContent']?.mockRejectedValueOnce(new Error('fail'));

    const campaign = makeCampaign({
      channels: ['Twitter', 'Email'],
      targetAudiences: ['Teens', 'Adults'],
    });

    const result = await generateMarketingContent(campaign, [makeProduct()]);

    expect(result).toHaveLength(4);
    const combos = result.map(r => `${r.channel}-${r.audience}`);
    expect(combos).toContain('Twitter-Teens');
    expect(combos).toContain('Twitter-Adults');
    expect(combos).toContain('Email-Teens');
    expect(combos).toContain('Email-Adults');
  });

  it('caps at 6 items maximum', async () => {
    callableMocks['generateContent']?.mockRejectedValueOnce(new Error('fail'));

    const campaign = makeCampaign({
      channels: ['Twitter', 'Email', 'LinkedIn'],
      targetAudiences: ['A', 'B', 'C'],
    });

    const result = await generateMarketingContent(campaign, [makeProduct()]);

    expect(result).toHaveLength(6);
  });

  it('uses primary product name when available', async () => {
    callableMocks['generateContent']?.mockRejectedValueOnce(new Error('fail'));

    const campaign = makeCampaign({ primaryProductId: 'prod-1' });
    const result = await generateMarketingContent(campaign, [makeProduct()]);

    expect(result[0].text).toContain('Widget Pro');
  });

  it('uses "Brand Idea" label when no primary product', async () => {
    callableMocks['generateContent']?.mockRejectedValueOnce(new Error('fail'));

    const campaign = makeCampaign({ primaryProductId: undefined });
    const result = await generateMarketingContent(campaign, [makeProduct()]);

    expect(result[0].text).toContain('Brand Idea');
  });

  it('returns correct GeneratedContent shape', async () => {
    callableMocks['generateContent']?.mockRejectedValueOnce(new Error('fail'));

    const campaign = makeCampaign();
    const result = await generateMarketingContent(campaign, [makeProduct()]);

    const item = result[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('campaignId', 'camp-1');
    expect(item).toHaveProperty('channel');
    expect(item).toHaveProperty('audience');
    expect(item).toHaveProperty('text');
    expect(item).toHaveProperty('complianceScore', 90);
    expect(item).toHaveProperty('riskLevel', 'low');
    expect(item).toHaveProperty('status', 'draft');
    expect(item).toHaveProperty('imageUrl');
    expect(item).toHaveProperty('x', 0);
    expect(item).toHaveProperty('y', 0);
  });
});
