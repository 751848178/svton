import { describe, expect, it, vi } from 'vitest';
import { ImageGenRegistry } from '../src/image-gen/registry';
import type { IImageGenerationProvider } from '../src/image-gen/types';
import { ImageGenerateExecutor } from '../src/tool/builtins/image_generate';
import type { ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCtx(): ToolContext {
  return {
    platform: createMockPlatform(),
    sessionId: 's',
    workingDir: '/tmp',
  };
}

describe('image_generate success result metadata', () => {
  it('preserves non-sensitive request metadata on success', async () => {
    const provider: IImageGenerationProvider = {
      name: 'mock',
      models: ['dall-e-3'],
      generate: vi.fn(async () => ({
        images: [{ url: 'https://example.com/generated.png' }],
        model: 'dall-e-3',
      })),
    };
    const registry = new ImageGenRegistry();
    registry.register(provider, 'key');

    const result = await new ImageGenerateExecutor(registry).execute(
      {
        id: 'image-success',
        name: 'image_generate',
        arguments: {
          prompt: '  private product sketch\t',
          model: ' \ndall-e-3\t',
          size: '1024x1024',
          quality: 'hd',
          n: 2,
        },
      },
      makeCtx(),
    );

    expect(result.isError).toBeFalsy();
    expect(result.output).toContain('Generated 1 image(s)');
    expect(result.output).not.toContain('private product sketch');
    expect(result.metadata).toMatchObject({
      model: 'dall-e-3',
      promptLength: 22,
      size: '1024x1024',
      quality: 'hd',
      requestedCount: 2,
      count: 1,
    });
  });
});
