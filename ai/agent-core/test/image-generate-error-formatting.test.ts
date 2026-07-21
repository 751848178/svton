import { describe, expect, it, vi } from 'vitest';
import { ImageGenRegistry } from '../src/image-gen/registry';
import type { IImageGenerationProvider } from '../src/image-gen/types';
import { ImageGenerateExecutor } from '../src/tool/builtins/image_generate';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(args: Record<string, unknown>): ToolCall {
  return { id: 'image-result', name: 'image_generate', arguments: args };
}

function makeContext(): ToolContext {
  return {
    platform: createMockPlatform(),
    sessionId: 'session',
    workingDir: '/repo',
  };
}

describe('image_generate error formatting', () => {
  it('normalizes non-Error provider generation failures', async () => {
    const provider: IImageGenerationProvider = {
      name: 'mock',
      models: ['mock-image'],
      generate: vi.fn(async () => {
        throw { code: 'image_down' };
      }),
    };
    const registry = new ImageGenRegistry();
    registry.register(provider, 'key');

    const result = await new ImageGenerateExecutor(registry).execute(
      makeCall({
        prompt: ' paint a test\t',
        model: ' mock-image\n',
        size: '1024x1024',
        quality: 'hd',
        n: 2,
      }),
      makeContext(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Error generating image: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.output).not.toContain('paint a test');
    expect(result.metadata).toMatchObject({
      model: 'mock-image',
      promptLength: 12,
      size: '1024x1024',
      quality: 'hd',
      requestedCount: 2,
    });
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'paint a test',
        model: 'mock-image',
        size: '1024x1024',
        quality: 'hd',
        n: 2,
      }),
      'key',
    );
  });
});
