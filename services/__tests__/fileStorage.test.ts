import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock fns are available when the hoisted vi.mock factory runs
const {
  mockStorageInstance,
  mockRef,
  mockUploadString,
  mockGetDownloadURL,
} = vi.hoisted(() => ({
  mockStorageInstance: { _mock: true },
  mockRef: vi.fn().mockReturnValue({ fullPath: 'mock/path' }),
  mockUploadString: vi.fn().mockResolvedValue(undefined),
  mockGetDownloadURL: vi.fn().mockResolvedValue('https://firebasestorage.example.com/download'),
}));

vi.mock('firebase/storage', () => ({
  ref: mockRef,
  uploadString: mockUploadString,
  getDownloadURL: mockGetDownloadURL,
}));

vi.mock('../firebase', () => ({
  storage: mockStorageInstance,
}));

import { isBase64DataUrl, uploadBase64Image, uploadContentImages } from '../fileStorage';
import type { GeneratedContent } from '../../types';

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────── isBase64DataUrl ────────────────────────────

describe('isBase64DataUrl', () => {
  it('returns true for a base64 PNG data URL', () => {
    expect(isBase64DataUrl('data:image/png;base64,abc123')).toBe(true);
  });

  it('returns true for a base64 JPEG data URL', () => {
    expect(isBase64DataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
  });

  it('returns false for an HTTP URL', () => {
    expect(isBase64DataUrl('https://example.com/image.png')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isBase64DataUrl('')).toBe(false);
  });
});

// ──────────────────────────── uploadBase64Image ────────────────────────────

describe('uploadBase64Image', () => {
  it('passes through non-base64 URLs unchanged', async () => {
    const url = 'https://example.com/image.png';
    const result = await uploadBase64Image(url, 'some/path');

    expect(result).toBe(url);
    expect(mockUploadString).not.toHaveBeenCalled();
  });

  it('uploads base64 and returns download URL', async () => {
    const base64 = 'data:image/png;base64,abc123';
    const path = 'content/123/hero.png';

    const result = await uploadBase64Image(base64, path);

    expect(mockRef).toHaveBeenCalledWith(mockStorageInstance, path);
    expect(mockUploadString).toHaveBeenCalledWith(
      { fullPath: 'mock/path' },
      base64,
      'data_url'
    );
    expect(result).toBe('https://firebasestorage.example.com/download');
  });
});

// ──────────────────────────── uploadContentImages ────────────────────────────

describe('uploadContentImages', () => {
  const baseItem: GeneratedContent = {
    id: 'item-1',
    campaignId: 'camp-1',
    channel: 'Twitter',
    audience: 'Teens',
    text: 'Some text',
    complianceScore: 90,
    riskLevel: 'low',
    status: 'draft',
    x: 0,
    y: 0,
  };

  it('uploads hero image and returns updated item', async () => {
    const item: GeneratedContent = {
      ...baseItem,
      imageUrl: 'data:image/png;base64,herodata',
    };

    const result = await uploadContentImages(item);

    expect(mockUploadString).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith(mockStorageInstance, 'content/item-1/hero.png');
    expect(result.imageUrl).toBe('https://firebasestorage.example.com/download');
  });

  it('uploads storyboard scene images', async () => {
    const item: GeneratedContent = {
      ...baseItem,
      storyboard: [
        { sceneNumber: 1, imagePrompt: 'p1', voiceover: 'v1', imageUrl: 'data:image/png;base64,scene1' },
        { sceneNumber: 2, imagePrompt: 'p2', voiceover: 'v2', imageUrl: 'data:image/jpeg;base64,scene2' },
      ],
    };

    const result = await uploadContentImages(item);

    expect(mockUploadString).toHaveBeenCalledTimes(2);
    expect(mockRef).toHaveBeenCalledWith(mockStorageInstance, 'content/item-1/scene-1.png');
    expect(mockRef).toHaveBeenCalledWith(mockStorageInstance, 'content/item-1/scene-2.png');
    expect(result.storyboard![0].imageUrl).toBe('https://firebasestorage.example.com/download');
    expect(result.storyboard![1].imageUrl).toBe('https://firebasestorage.example.com/download');
  });

  it('skips non-base64 imageUrls', async () => {
    const item: GeneratedContent = {
      ...baseItem,
      imageUrl: 'https://picsum.photos/800/400',
    };

    const result = await uploadContentImages(item);

    expect(mockUploadString).not.toHaveBeenCalled();
    expect(result.imageUrl).toBe('https://picsum.photos/800/400');
  });

  it('keeps original on upload failure', async () => {
    mockUploadString.mockRejectedValueOnce(new Error('Upload failed'));

    const item: GeneratedContent = {
      ...baseItem,
      imageUrl: 'data:image/png;base64,baddata',
    };

    const result = await uploadContentImages(item);

    // Should keep original base64 since upload failed (catch branch)
    expect(result.imageUrl).toBe('data:image/png;base64,baddata');
  });

  it('keeps original scene image on upload failure', async () => {
    mockUploadString.mockRejectedValueOnce(new Error('Upload failed'));

    const item: GeneratedContent = {
      ...baseItem,
      storyboard: [
        { sceneNumber: 1, imagePrompt: 'p', voiceover: 'v', imageUrl: 'data:image/png;base64,failme' },
      ],
    };

    const result = await uploadContentImages(item);

    expect(result.storyboard![0].imageUrl).toBe('data:image/png;base64,failme');
  });

  it('handles item with no images', async () => {
    const result = await uploadContentImages(baseItem);

    expect(mockUploadString).not.toHaveBeenCalled();
    expect(result.imageUrl).toBeUndefined();
    expect(result.storyboard).toBeUndefined();
  });
});
