/**
 * Stability AI image generation provider.
 *
 * Supports stable-image-core and stable-image-ultra via the
 * Stability AI REST API.
 */

import type {
  IImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from './types';

const STABILITY_BASE = 'https://api.stability.ai/v2beta';

export class StabilityProvider implements IImageGenerationProvider {
  readonly name = 'stability';
  readonly models = ['stable-image-core', 'stable-image-ultra'];

  async generate(
    req: ImageGenerationRequest,
    apiKey: string,
  ): Promise<ImageGenerationResult> {
    if (!apiKey) {
      throw new Error('Stability AI API key is required for image generation.');
    }

    // Stability expects multipart/form-data with the Accept header set to image/png
    const form = new FormData();
    form.append('prompt', req.prompt);
    form.append('output_format', 'png');

    // Map size to aspect ratio (Stability uses aspect_ratio, not pixel dims)
    if (req.size) {
      const aspect = this.sizeToAspectRatio(req.size);
      if (aspect) {
        form.append('aspect_ratio', aspect);
      }
    }

    // Stability supports a "seed" param but not quality/style — ignore those.

    const endpoint = `${STABILITY_BASE}/stable-image/generate/${req.model}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'image/*',
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        `Stability AI API error ${response.status}: ${errText || response.statusText}`,
      );
    }

    // Stability returns the raw image bytes when Accept: image/*
    const buffer = await response.arrayBuffer();
    const base64 = bufferToBase64(buffer);

    const count = Math.max(1, req.n ?? 1);
    const images = Array.from({ length: count }, () => ({ base64 }));

    return { images, model: req.model };
  }

  /**
   * Convert a pixel-size string to a Stability aspect_ratio value.
   * Stability accepts ratios like "1:1", "16:9", "9:16", "3:2", "2:3".
   */
  private sizeToAspectRatio(
    size: NonNullable<ImageGenerationRequest['size']>,
  ): string | null {
    switch (size) {
      case '1024x1024':
        return '1:1';
      case '1792x1024':
        return '16:9';
      case '1024x1792':
        return '9:16';
      case 'auto':
        return null; // let the provider decide
      default:
        return null;
    }
  }
}

/** Convert an ArrayBuffer to a base64 string without Node-specific APIs. */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000; // 32KB chunks to avoid call-stack limits
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}
