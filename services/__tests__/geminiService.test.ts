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

import { generateImage, generateVideoFromStoryboard } from '../geminiService';
import type { Product, Scene } from '../../types';

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
    callableMocks['generateVideo']?.mockRejectedValueOnce(new Error('test-stop'));

    const scenes: Scene[] = [
      { sceneNumber: 1, imagePrompt: 'p1', voiceover: 'v1', imageUrl: 'https://example.com/1.png' },
      { sceneNumber: 2, imagePrompt: 'p2', voiceover: 'v2', imageUrl: 'https://example.com/2.png' },
      { sceneNumber: 3, imagePrompt: 'p3', voiceover: 'v3', imageUrl: 'https://example.com/3.png' },
      { sceneNumber: 4, imagePrompt: 'p4', voiceover: 'v4', imageUrl: 'https://example.com/4.png' },
    ];

    await expect(generateVideoFromStoryboard(scenes, 'test-id')).rejects.toThrow();

    // Only 3 reference images passed to Cloud Function (not 4) because of .slice(0, 3)
    const callArg = callableMocks['generateVideo'].mock.calls[0][0];
    expect(callArg.referenceImages).toHaveLength(3);
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

