/**
 * Cloudinary Integration Adapter
 *
 * Replaces Firebase Storage as the primary image/video asset store.
 * Provides on-the-fly image transformations for channel-specific sizes
 * and CDN-optimized delivery.
 *
 * Key benefit: A single generated image can be automatically transformed
 * for Instagram Stories (9:16), LinkedIn Posts (1.91:1), Email Headers (600px wide),
 * etc. without re-generating through Gemini.
 *
 * Setup: Requires Cloud Name, API Key, and API Secret.
 * Free tier: 25 credits/month (sufficient for development).
 *
 * API: REST Upload API + URL-based transformations (no API call needed for transforms)
 * SDK: cloudinary-react or @cloudinary/url-gen for React
 * Docs: https://cloudinary.com/documentation
 */

import type {
  IntegrationAdapter,
  IntegrationConfig,
  CloudinaryAsset,
} from '../../types/integrations';

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset?: string;  // For unsigned uploads from browser
  folder?: string;        // Default folder for generated assets
}

/**
 * Channel-specific image transformation presets.
 * These are applied via URL parameters — no API call needed.
 */
export const CHANNEL_TRANSFORMS: Record<string, { width: number; height: number; crop: string }> = {
  'Instagram Post':      { width: 1080, height: 1080, crop: 'fill' },
  'Instagram Story':     { width: 1080, height: 1920, crop: 'fill' },
  'Instagram Reel':      { width: 1080, height: 1920, crop: 'fill' },
  'Instagram Carousel':  { width: 1080, height: 1080, crop: 'fill' },
  'LinkedIn Post':       { width: 1200, height: 628, crop: 'fill' },
  'LinkedIn Article':    { width: 1200, height: 644, crop: 'fill' },
  'Tweet':               { width: 1200, height: 675, crop: 'fill' },
  'Twitter Thread':      { width: 1200, height: 675, crop: 'fill' },
  'Facebook Post':       { width: 1200, height: 630, crop: 'fill' },
  'Facebook Ad':         { width: 1200, height: 628, crop: 'fill' },
  'Email Newsletter':    { width: 600, height: 300, crop: 'fill' },
  'Web Banner':          { width: 1440, height: 400, crop: 'fill' },
  'Blog Post':           { width: 1200, height: 630, crop: 'fill' },
  'Pinterest Pin':       { width: 1000, height: 1500, crop: 'fill' },
  'YouTube Video':       { width: 1280, height: 720, crop: 'fill' },
  'YouTube Short':       { width: 1080, height: 1920, crop: 'fill' },
  'TikTok Video':        { width: 1080, height: 1920, crop: 'fill' },
};

export class CloudinaryAdapter implements IntegrationAdapter<CloudinaryConfig> {
  id = 'cloudinary' as const;
  category = 'dam' as const;

  async testConnection(config: CloudinaryConfig): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image`,
        {
          headers: {
            'Authorization': `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Upload a generated image (base64 or URL) to Cloudinary.
   * Returns a CloudinaryAsset with the public ID for transformation URLs.
   */
  async uploadImage(
    config: CloudinaryConfig,
    imageData: string,
    options: { folder?: string; tags?: string[]; publicId?: string }
  ): Promise<CloudinaryAsset> {
    const formData = new FormData();

    if (imageData.startsWith('data:')) {
      formData.append('file', imageData);
    } else {
      formData.append('file', imageData); // URL upload
    }

    if (config.uploadPreset) {
      formData.append('upload_preset', config.uploadPreset);
    } else {
      // Signed upload requires timestamp + signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      formData.append('timestamp', timestamp);
      formData.append('api_key', config.apiKey);
      // In production, signature should be computed server-side
    }

    const folder = options.folder ?? config.folder ?? 'marketgen';
    formData.append('folder', folder);

    if (options.tags?.length) {
      formData.append('tags', options.tags.join(','));
    }
    if (options.publicId) {
      formData.append('public_id', options.publicId);
    }

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    const data = await response.json();

    return {
      publicId: data.public_id,
      secureUrl: data.secure_url,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
      tags: data.tags,
      folder: data.folder,
    };
  }

  /**
   * Generate a transformed URL for a specific channel.
   * No API call — just URL construction.
   */
  getTransformedUrl(
    cloudName: string,
    publicId: string,
    channel: string,
    format: string = 'auto'
  ): string {
    const transform = CHANNEL_TRANSFORMS[channel];
    if (!transform) {
      // Return original if no channel-specific transform
      return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
    }

    return `https://res.cloudinary.com/${cloudName}/image/upload/c_${transform.crop},w_${transform.width},h_${transform.height},f_${format},q_auto/${publicId}`;
  }

  async sync(_config: CloudinaryConfig): Promise<void> {
    // Sync: list all assets in the marketgen folder, reconcile with local state
    // TODO: Implement asset sync
  }

  async disconnect(): Promise<void> {
    // Clean up credentials
  }
}

export function parseCloudinaryConfig(integration: IntegrationConfig): CloudinaryConfig {
  return {
    cloudName: integration.credentials['cloudName'] ?? '',
    apiKey: integration.credentials['apiKey'] ?? '',
    apiSecret: integration.credentials['apiSecret'] ?? '',
    uploadPreset: integration.credentials['uploadPreset'],
    folder: (integration.settings['folder'] as string) ?? 'marketgen',
  };
}
