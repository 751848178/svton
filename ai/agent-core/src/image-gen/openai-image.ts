/**
 * OpenAI image generation provider.
 *
 * Supports DALL-E 2, DALL-E 3, and the newer gpt-image-1 model via
 * the OpenAI Images API (/v1/images/generations).
 */

import type {
  IImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from './types';

const OPENAI_BASE = 'https://api.openai.com/v1';

export class OpenAIImageProvider implements IImageGenerationProvider {
  readonly name = 'openai';
  readonly models = ['dall-e-3', 'dall-e-2', 'gpt-image-1'];

  async generate(
    req: ImageGenerationRequest,
    apiKey: string,
  ): Promise<ImageGenerationResult> {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for image generation.');
    }

    const body: Record<string, unknown> = {
      model: req.model,
      prompt: req.prompt,
      n: req.n ?? 1,
      size: req.size ?? '1024x1024',
    };

    // dall-e-3 supports quality and style; dall-e-2 does not
    if (req.model === 'dall-e-3' || req.model === 'gpt-image-1') {
      if (req.quality) body.quality = req.quality;
    }
    if (req.model === 'dall-e-3') {
      if (req.style) body.style = req.style;
      // dall-e-3 only supports n=1
      body.n = 1;
    }

    // gpt-image-1 returns base64 by default; request b64_json for consistency
    if (req.model === 'gpt-image-1') {
      body.response_format = 'b64_json';
    } else {
      body.response_format = 'url';
    }

    const response = await fetch(`${OPENAI_BASE}/images/generations`, {
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
        `OpenAI Images API error ${response.status}: ${errText || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      data?: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
      }>;
    };

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('OpenAI Images API returned no image data.');
    }

    const images = data.data.map((item) => ({
      url: item.url,
      base64: item.b64_json,
      revisedPrompt: item.revised_prompt,
    }));

    return { images, model: req.model };
  }
}
