/**
 * Google Vertex AI Imagen provider.
 *
 * Supports imagen-3.0 and imagen-4.0 via the Vertex AI REST API.
 * Requires a Google Cloud project and OAuth bearer token (or
 * a service-account-derived access token passed as the apiKey).
 */

import type {
  IImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from './types';

export class GoogleImagenProvider implements IImageGenerationProvider {
  readonly name = 'google';
  readonly models = ['imagen-3.0', 'imagen-4.0'];

  /**
   * @param projectId - Google Cloud project ID.
   * @param location  - Vertex AI region (default: us-central1).
   */
  constructor(
    private readonly projectId: string,
    private readonly location: string = 'us-central1',
  ) {}

  async generate(
    req: ImageGenerationRequest,
    apiKey: string,
  ): Promise<ImageGenerationResult> {
    if (!apiKey) {
      throw new Error('Google Cloud access token is required for Imagen.');
    }
    if (!this.projectId) {
      throw new Error('Google Cloud project ID is required for Imagen.');
    }

    // Map common size presets to Imagen's aspectRatio enum
    const aspectRatio = req.size ? this.sizeToAspectRatio(req.size) : null;

    const modelVersion = this.resolveModelVersion(req.model);
    const endpoint =
      `https://${this.location}-aiplatform.googleapis.com/v1/projects/` +
      `${this.projectId}/locations/${this.location}/publishers/google/models/` +
      `${modelVersion}:predict`;

    const body = {
      instances: [
        {
          prompt: req.prompt,
        },
      ],
      parameters: {
        sampleCount: Math.max(1, Math.min(req.n ?? 1, 4)),
        ...(aspectRatio ? { aspectRatio } : {}),
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        `Google Imagen API error ${response.status}: ${errText || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      predictions?: Array<{
        bytesBase64Encoded?: string;
      }>;
    };

    if (!data.predictions || !Array.isArray(data.predictions)) {
      throw new Error('Google Imagen API returned no predictions.');
    }

    const images = data.predictions.map((pred) => ({
      base64: pred.bytesBase64Encoded,
    }));

    return { images, model: req.model };
  }

  /**
   * Map a user-facing model name to the Vertex AI model identifier.
   */
  private resolveModelVersion(model: string): string {
    if (model.includes('4')) return 'imagen-4.0-generate-001';
    if (model.includes('3')) return 'imagegeneration@006';
    return model;
  }

  /**
   * Convert pixel size to Imagen's aspectRatio parameter.
   * Imagen accepts: "1:1", "9:16", "16:9", "3:4", "4:3".
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
        return null;
      default:
        return null;
    }
  }
}
