/**
 * Image generation tool.
 *
 * Delegates to an {@link ImageGenRegistry} so the agent can generate
 * images from a text prompt without knowing which provider to use.
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import type { ImageGenRegistry } from '../../image-gen/registry';

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
        enum: ['1024x1024', '1792x1024', '1024x1792', 'auto'],
        description: 'Image dimensions. Default: auto.',
      },
      quality: {
        type: 'string',
        enum: ['standard', 'hd'],
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

    if (!prompt || typeof prompt !== 'string') {
      return {
        callId: call.id,
        output: 'Error: "prompt" is required and must be a string.',
        isError: true,
      };
    }

    // Resolve model: explicit > first available
    const resolvedModel = model ?? this.registry.getAvailableModels()[0];
    if (!resolvedModel) {
      return {
        callId: call.id,
        output:
          'Error: No image generation models are registered. Configure a provider first.',
        isError: true,
      };
    }

    try {
      const result = await this.registry.generate({
        prompt,
        model: resolvedModel,
        size: size as '1024x1024' | '1792x1024' | '1024x1792' | 'auto' | undefined,
        quality: quality as 'standard' | 'hd' | undefined,
        n: n ?? 1,
      });

      // Format output for the LLM — describe what was generated
      const lines: string[] = [
        `Generated ${result.images.length} image(s) using model "${result.model}".`,
      ];
      result.images.forEach((img, i) => {
        const parts: string[] = [`  Image ${i + 1}:`];
        if (img.url) parts.push(`url=${img.url}`);
        if (img.base64) parts.push(`base64=(${img.base64.length} chars)`);
        if (img.revisedPrompt) parts.push(`revisedPrompt="${img.revisedPrompt}"`);
        lines.push(parts.join(' '));
      });

      return {
        callId: call.id,
        output: lines.join('\n'),
        metadata: {
          model: result.model,
          count: result.images.length,
          images: result.images,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Error generating image: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
