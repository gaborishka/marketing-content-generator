import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so mock fns are available in the hoisted vi.mock factory
const { mockGenerateContent, mockGenerateVideos, mockGetVideosOperation } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGenerateVideos: vi.fn(),
  mockGetVideosOperation: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    constructor() {
      // no-op
    }
    models = {
      generateContent: mockGenerateContent,
      generateVideos: mockGenerateVideos,
    };
    operations = {
      getVideosOperation: mockGetVideosOperation,
    };
  },
  Type: {
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    INTEGER: 'INTEGER',
  },
}));

import { generateImage, generateVideoFromStoryboard, generateMarketingContent } from '../geminiService';
import type { Product, Campaign, Scene, ComplianceRule } from '../../types';

// ── Helpers ──

const originalEnv = { ...process.env };

const setApiKey = (key: string | undefined) => {
  if (key === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = key;
  }
};

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
  // Reset env
  process.env = { ...originalEnv };
  delete process.env.API_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// ══════════════════════════════ generateImage ══════════════════════════════

describe('generateImage', () => {
  it('returns picsum placeholder when no API key', async () => {
    const result = await generateImage(undefined, 'test context');
    expect(result).toMatch(/^https:\/\/picsum\.photos\/seed\/\d+\/800\/400$/);
  });

  it('builds product-specific prompt when product is provided', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'abc' } }] } }],
    });

    const product = makeProduct();
    await generateImage(product, 'summer vibes');

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents.parts[0].text;
    expect(promptText).toContain('Widget Pro');
    expect(promptText).toContain('AcmeCo');
    expect(promptText).toContain('The best widget');
  });

  it('builds generic prompt when product is undefined', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'abc' } }] } }],
    });

    await generateImage(undefined, 'abstract branding');

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents.parts[0].text;
    expect(promptText).toContain('abstract branding');
    expect(promptText).not.toContain('Widget Pro');
  });

  it('returns base64 data URL from successful API response', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: '/9j/4AAQ' } }] } }],
    });

    const result = await generateImage(undefined, 'test');
    expect(result).toBe('data:image/jpeg;base64,/9j/4AAQ');
  });

  it('returns picsum placeholder on API error', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockRejectedValueOnce(new Error('API down'));

    const result = await generateImage(undefined, 'test');
    expect(result).toMatch(/^https:\/\/picsum\.photos\/seed\/\d+\/800\/400$/);
  });

  it('returns picsum placeholder when response has no inline data', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ text: 'no image here' }] } }],
    });

    const result = await generateImage(undefined, 'test');
    expect(result).toMatch(/^https:\/\/picsum\.photos\/seed\/\d+\/800\/400$/);
  });
});

// ══════════════════════════ generateVideoFromStoryboard ══════════════════════════

describe('generateVideoFromStoryboard', () => {
  it('throws when no API key', async () => {
    await expect(generateVideoFromStoryboard([])).rejects.toThrow('API Key required');
  });

  it('throws when storyboard has no valid images', async () => {
    setApiKey('test-key');
    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p', voiceover: 'v' }, // no imageUrl
    ];

    await expect(generateVideoFromStoryboard(scenes)).rejects.toThrow('No images available');
  });

  it('slices to at most 3 scenes for reference images', async () => {
    setApiKey('test-key');

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

    // Set up video generation to fail fast (we're testing the slice, not the full flow)
    mockGenerateVideos.mockRejectedValueOnce(new Error('test-stop'));

    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p1', voiceover: 'v1', imageUrl: 'https://example.com/1.png' },
      { sceneNumber: 2, imagePrompt: 'p2', voiceover: 'v2', imageUrl: 'https://example.com/2.png' },
      { sceneNumber: 3, imagePrompt: 'p3', voiceover: 'v3', imageUrl: 'https://example.com/3.png' },
      { sceneNumber: 4, imagePrompt: 'p4', voiceover: 'v4', imageUrl: 'https://example.com/4.png' },
    ];

    await expect(generateVideoFromStoryboard(scenes)).rejects.toThrow();

    // fetch called 3 times (not 4) because of .slice(0, 3)
    expect(global.fetch).toHaveBeenCalledTimes(3);

    global.FileReader = originalFileReader;
  });

  it('polls until operation.done is true', async () => {
    setApiKey('test-key');

    // Use base64 scenes to skip fetch/FileReader
    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p', voiceover: 'v', imageUrl: 'data:image/png;base64,abc' },
    ];

    // First call: not done, second poll: done
    mockGenerateVideos.mockResolvedValueOnce({ done: false });
    mockGetVideosOperation
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({
        done: true,
        response: {
          generatedVideos: [{ video: { uri: 'https://genai.example.com/video.mp4' } }],
        },
      });

    // Mock fetch for the final video download
    const videoBlob = new Blob(['video'], { type: 'video/mp4' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(videoBlob),
    } as any);

    // Mock URL.createObjectURL
    const originalCreateObjectURL = global.URL.createObjectURL;
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-video-url');

    // Shorten the poll delay
    vi.useFakeTimers();
    const promise = generateVideoFromStoryboard(scenes);
    // Advance past two 5s delays
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(mockGetVideosOperation).toHaveBeenCalledTimes(2);
    expect(result).toBe('blob:mock-video-url');

    vi.useRealTimers();
    global.URL.createObjectURL = originalCreateObjectURL;
  });

  it('throws on operation error', async () => {
    setApiKey('test-key');

    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p', voiceover: 'v', imageUrl: 'data:image/png;base64,abc' },
    ];

    mockGenerateVideos.mockResolvedValueOnce({
      done: true,
      error: { message: 'Veo failed' },
    });

    await expect(generateVideoFromStoryboard(scenes)).rejects.toThrow('Video generation failed: Veo failed');
  });
});

// ══════════════════════════ generateMarketingContent ══════════════════════════

describe('generateMarketingContent', () => {
  const product = makeProduct();
  const allProducts = [product];

  it('falls back to mockGeneration when no API key', async () => {
    const campaign = makeCampaign();
    const result = await generateMarketingContent(campaign, allProducts);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text).toContain('Widget Pro');
    expect(result[0].text).toContain('Mock content');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('includes primary product in prompt', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({ text: '[]' });

    await generateMarketingContent(makeCampaign(), allProducts);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain('Widget Pro');
    expect(callArgs.contents).toContain('AcmeCo');
  });

  it('includes secondary products in prompt', async () => {
    setApiKey('test-key');
    const secondary = makeProduct({ id: 'prod-2', name: 'Gizmo Plus' });
    mockGenerateContent.mockResolvedValueOnce({ text: '[]' });

    const campaign = makeCampaign({ secondaryProductIds: ['prod-2'] });
    await generateMarketingContent(campaign, [product, secondary]);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain('Gizmo Plus');
  });

  it('includes compliance rules in prompt when provided', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({ text: '[]' });

    const complianceRule: ComplianceRule = {
      id: 'rule-1',
      name: 'FDA Guidelines',
      description: 'Must follow FDA rules',
      ruleText: 'No unapproved claims',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };

    await generateMarketingContent(makeCampaign(), allProducts, complianceRule);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain('FDA Guidelines');
    expect(callArgs.contents).toContain('No unapproved claims');
  });

  it('handles brand/idea campaigns (no primary product)', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({ text: '[]' });

    const campaign = makeCampaign({ primaryProductId: undefined });
    await generateMarketingContent(campaign, allProducts);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain('Brand/Idea Campaign');
  });

  it('parses JSON response into GeneratedContent array', async () => {
    setApiKey('test-key');
    const apiResponse = [
      {
        channel: 'Twitter',
        audience: 'Young Adults',
        text: 'Check out our sale!',
        complianceScore: 95,
        riskLevel: 'low',
      },
    ];
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(apiResponse) });

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
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({ text: 'not valid json{{{' });

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text).toContain('Mock content');
  });

  it('falls back to mock when response is not an array', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockResolvedValueOnce({ text: '{"notAnArray": true}' });

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text).toContain('Mock content');
  });

  it('falls back to mock on API error', async () => {
    setApiKey('test-key');
    mockGenerateContent.mockRejectedValueOnce(new Error('API failure'));

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].text).toContain('Mock content');
  });

  it('parses video storyboard channel correctly', async () => {
    setApiKey('test-key');
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
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(apiResponse) });

    const result = await generateMarketingContent(makeCampaign(), allProducts);

    expect(result[0].channel).toBe('Video Storyboard');
    expect(result[0].storyboard).toHaveLength(2);
    expect(result[0].storyboard![0].imageUrl).toBe(''); // initially empty
    expect(result[0].storyboard![0].imagePrompt).toBe('Product shot');
  });
});

// ══════════════════════ mockGeneration (tested indirectly) ══════════════════════

describe('mockGeneration (via generateMarketingContent with no API key)', () => {
  it('generates content for each channel x audience combination', async () => {
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

  it('caps at 5 items maximum', async () => {
    const campaign = makeCampaign({
      channels: ['Twitter', 'Email', 'LinkedIn'],
      targetAudiences: ['A', 'B', 'C'],
    });

    const result = await generateMarketingContent(campaign, [makeProduct()]);

    expect(result).toHaveLength(5);
  });

  it('uses primary product name when available', async () => {
    const campaign = makeCampaign({ primaryProductId: 'prod-1' });
    const result = await generateMarketingContent(campaign, [makeProduct()]);

    expect(result[0].text).toContain('Widget Pro');
  });

  it('uses "Brand Idea" label when no primary product', async () => {
    const campaign = makeCampaign({ primaryProductId: undefined });
    const result = await generateMarketingContent(campaign, [makeProduct()]);

    expect(result[0].text).toContain('Brand Idea');
  });

  it('returns correct GeneratedContent shape', async () => {
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
