/**
 * Image generation tool.
 *
 * Delegates to an {@link ImageGenRegistry} so the agent can generate
 * images from a text prompt without knowing which provider to use.
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import type { ImageGenRegistry } from '../../image-gen/registry';
import { formatUnknownErrorMessage } from './error-message.utils';
import { filterUsableGeneratedImages, imageGenerateRequestMetadata } from './image-generate-result.utils';

const IMAGE_SIZES = ['1024x1024', '1792x1024', '1024x1792', 'auto'] as const;
const IMAGE_QUALITIES = ['standard', 'hd'] as const;

type ImageSize = (typeof IMAGE_SIZES)[number];
type ImageQuality = (typeof IMAGE_QUALITIES)[number];

export const imageGenerateDef: ToolDefinition = {
  name: 'image_generate',
  description:
    'Generate one or more images from a text prompt. Supports multiple models (e.g. dall-e-3, stable-image-ultra, imagen-4.0).',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Text description of the desired image.',
      },
      model: {
        type: 'string',
        description:
          'Model to use. If omitted, uses the first registered model. Examples: dall-e-3, dall-e-2, gpt-image-1, stable-image-core, stable-image-ultra, imagen-3.0, imagen-4.0.',
      },
      size: {
        type: 'string',
        enum: [...IMAGE_SIZES],
        description: 'Image dimensions. Default: auto.',
      },
      quality: {
        type: 'string',
        enum: [...IMAGE_QUALITIES],
        description: 'Image quality. Default: standard.',
      },
      n: {
        type: 'number',
        description: 'Number of images to generate. Default: 1.',
      },
    },
    required: ['prompt'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class ImageGenerateExecutor implements IToolExecutor {
  constructor(private readonly registry: ImageGenRegistry) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { prompt, model, size, quality, n } = call.arguments as {
      prompt?: string;
      model?: string;
      size?: string;
      quality?: string;
      n?: number;
    };

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return {
        callId: call.id,
        output: 'Error: "prompt" is required and must be a string.',
        isError: true,
      };
    }
    const resolvedPrompt = prompt.trim();
    const resolvedSize = typeof size === 'string' ? size.trim() : size;
    const resolvedQuality = typeof quality === 'string' ? quality.trim() : quality;
    if (model !== undefined && (typeof model !== 'string' || model.trim().length === 0)) {
      return {
        callId: call.id,
        output: 'Error: "model" must be a non-empty string.',
        isError: true,
      };
    }
    if (
      n !== undefined &&
      (
        typeof n !== 'number' ||
        !Number.isFinite(n) ||
        !Number.isInteger(n) ||
        n <= 0
      )
    ) {
      return {
        callId: call.id,
        output: 'Error: "n" must be a positive integer.',
        isError: true,
      };
    }
    if (resolvedSize !== undefined && !IMAGE_SIZES.includes(resolvedSize as ImageSize)) {
      return {
        callId: call.id,
        output: `Error: "size" must be one of: ${IMAGE_SIZES.join(', ')}.`,
        isError: true,
      };
    }
    if (
      resolvedQuality !== undefined &&
      !IMAGE_QUALITIES.includes(resolvedQuality as ImageQuality)
    ) {
      return {
        callId: call.id,
        output: `Error: "quality" must be one of: ${IMAGE_QUALITIES.join(', ')}.`,
        isError: true,
      };
    }

    // Resolve model: explicit > first available
    const resolvedModel = model?.trim() ?? this.registry.getAvailableModels()[0];
    if (!resolvedModel) {
      return { callId: call.id, output: 'Error: No image generation models are registered. Configure a provider first.', isError: true, metadata: imageGenerateRequestMetadata({ model: null, prompt: resolvedPrompt, size: resolvedSize, quality: resolvedQuality, n }) };
    }

    try {
      const result = await this.registry.generate({
        prompt: resolvedPrompt,
        model: resolvedModel,
        size: resolvedSize as ImageSize | undefined,
        quality: resolvedQuality as ImageQuality | undefined,
        n: n ?? 1,
      });
      const images = filterUsableGeneratedImages(result.images);
      if (images.length === 0) {
        return {
          callId: call.id,
          output: 'Error generating image: provider returned no usable image data.',
          isError: true,
          metadata: {
            ...imageGenerateRequestMetadata({
              model: result.model,
              prompt: resolvedPrompt,
              size: resolvedSize,
              quality: resolvedQuality,
              n,
            }),
            count: 0,
          },
        };
      }

      // Format output for the LLM — describe what was generated
      const lines: string[] = [
        `Generated ${images.length} image(s) using model "${result.model}".`,
      ];
      images.forEach((img, i) => {
        const parts: string[] = [`  Image ${i + 1}:`];
        if (img.url) parts.push(`url=${img.url}`);
        if (img.base64) parts.push(`base64=(${img.base64.length} chars)`);
        lines.push(parts.join(' '));
      });

      return {
        callId: call.id,
        output: lines.join('\n'),
        metadata: {
          ...imageGenerateRequestMetadata({
            model: result.model,
            prompt: resolvedPrompt,
            size: resolvedSize,
            quality: resolvedQuality,
            n,
          }),
          count: images.length,
          images,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error generating image: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: imageGenerateRequestMetadata({
          model: resolvedModel,
          prompt: resolvedPrompt,
          size: resolvedSize,
          quality: resolvedQuality,
          n,
        }),
      };
    }
  }
}
