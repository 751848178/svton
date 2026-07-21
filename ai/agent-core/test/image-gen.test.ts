import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGenRegistry } from '@svton/agent-core';
import type {
  IImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  GeneratedImage,
} from '@svton/agent-core';
import type { ToolCall, ToolContext } from '@svton/agent-core';
import { ImageGenerateExecutor } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

function createMockProvider(
  name: string,
  models: string[],
  result?: ImageGenerationResult,
): IImageGenerationProvider & { generate: ReturnType<typeof vi.fn> } {
  return {
    name,
    models,
    generate: vi.fn(async (
      _req: ImageGenerationRequest,
      _apiKey: string,
    ): Promise<ImageGenerationResult> => (
      result ?? {
        images: [{ url: `https://example.com/${name}-image.png` }],
        model: _req.model,
      }
    )),
  };
}

function createMockPlatform(): IPlatform {
  return {
    type: 'browser',
    capabilities: {
      filesystem: false,
      process: false,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
    },
    fs: {} as any,
    process: {} as any,
    storage: {} as any,
    search: {} as any,
  };
}

// ==============================================================
// Tests
// ==============================================================

describe('F9 — Image Generation', () => {
  // ----------------------------------------------------------
  // ImageGenRegistry.register() and resolve()
  // ----------------------------------------------------------
  describe('ImageGenRegistry.register() and resolve()', () => {
    it('register() makes models resolvable', () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('openai', ['dall-e-3', 'dall-e-2']);

      registry.register(provider, 'test-key');

      expect(registry.resolve('dall-e-3')).not.toBeNull();
      expect(registry.resolve('dall-e-2')).not.toBeNull();
    });

    it('resolve() returns null for unregistered models', () => {
      const registry = new ImageGenRegistry();

      expect(registry.resolve('unknown-model')).toBeNull();
    });

    it('resolve() returns the provider entry with the API key', () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('stab', ['stable-image-ultra']);

      registry.register(provider, 'secret-key');

      const entry = registry.resolve('stable-image-ultra');
      expect(entry).not.toBeNull();
      expect(entry!.apiKey).toBe('secret-key');
      expect(entry!.provider.name).toBe('stab');
    });

    it('multiple providers can be registered', () => {
      const registry = new ImageGenRegistry();
      registry.register(createMockProvider('openai', ['dall-e-3']), 'k1');
      registry.register(createMockProvider('stab', ['sdxl']), 'k2');

      expect(registry.resolve('dall-e-3')!.provider.name).toBe('openai');
      expect(registry.resolve('sdxl')!.provider.name).toBe('stab');
    });
  });

  // ----------------------------------------------------------
  // ImageGenRegistry.generate()
  // ----------------------------------------------------------
  describe('ImageGenRegistry.generate()', () => {
    it('routes to the correct provider based on model', async () => {
      const registry = new ImageGenRegistry();
      const openai = createMockProvider('openai', ['dall-e-3']);
      const stab = createMockProvider('stab', ['sdxl']);
      registry.register(openai, 'k1');
      registry.register(stab, 'k2');

      const req: ImageGenerationRequest = {
        prompt: 'a cat',
        model: 'dall-e-3',
      };

      await registry.generate(req);

      expect(openai.generate).toHaveBeenCalledWith(req, 'k1');
      expect(stab.generate).not.toHaveBeenCalled();
    });

    it('passes the API key to the provider', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['m1']);
      registry.register(provider, 'my-key');

      await registry.generate({ prompt: 'test', model: 'm1' });

      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'm1' }),
        'my-key',
      );
    });

    it('returns the result from the provider', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['m1']);
      registry.register(provider, 'k');

      const result = await registry.generate({ prompt: 'hello', model: 'm1' });

      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toContain('test-image.png');
      expect(result.model).toBe('m1');
    });

    it('throws when no provider is registered for the model', async () => {
      const registry = new ImageGenRegistry();

      await expect(
        registry.generate({ prompt: 'test', model: 'unknown' }),
      ).rejects.toThrow('No image generation provider registered');
    });

    it('includes available models in the error message', async () => {
      const registry = new ImageGenRegistry();
      registry.register(createMockProvider('p', ['known-model']), 'k');

      await expect(
        registry.generate({ prompt: 'x', model: 'unknown' }),
      ).rejects.toThrow('known-model');
    });
  });

  // ----------------------------------------------------------
  // ImageGenRegistry.getAvailableModels()
  // ----------------------------------------------------------
  describe('ImageGenRegistry.getAvailableModels()', () => {
    it('returns all registered model names', () => {
      const registry = new ImageGenRegistry();
      registry.register(createMockProvider('a', ['m1', 'm2']), 'k');
      registry.register(createMockProvider('b', ['m3']), 'k');

      const models = registry.getAvailableModels();
      expect(models).toHaveLength(3);
      expect(models).toContain('m1');
      expect(models).toContain('m2');
      expect(models).toContain('m3');
    });

    it('returns empty array when nothing is registered', () => {
      const registry = new ImageGenRegistry();
      expect(registry.getAvailableModels()).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // ImageGenerateExecutor
  // ----------------------------------------------------------
  describe('ImageGenerateExecutor', () => {
    it('calls registry.generate with the prompt and resolved model', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');

      const executor = new ImageGenerateExecutor(registry);
      const call: ToolCall = {
        id: 'tc1',
        name: 'image_generate',
        arguments: { prompt: 'a sunset', model: 'dall-e-3' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBeFalsy();
      expect(result.output).toContain('dall-e-3');
      expect(provider.generate).toHaveBeenCalled();
    });

    it('uses the first registered model when model is not specified', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['default-model']);
      registry.register(provider, 'key');

      const executor = new ImageGenerateExecutor(registry);
      const call: ToolCall = {
        id: 'tc2',
        name: 'image_generate',
        arguments: { prompt: 'something' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      await executor.execute(call, ctx);

      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'default-model' }),
        'key',
      );
    });

    it('uses the trimmed explicit model before provider generation', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');

      const executor = new ImageGenerateExecutor(registry);
      const call: ToolCall = {
        id: 'tc_trim_model',
        name: 'image_generate',
        arguments: { prompt: 'a sunset', model: ' \ndall-e-3\t ' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBeFalsy();
      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'dall-e-3' }),
        'key',
      );
    });

    it('returns an error result when prompt is missing', async () => {
      const registry = new ImageGenRegistry();
      registry.register(createMockProvider('t', ['m']), 'k');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc3',
        name: 'image_generate',
        arguments: {},
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('prompt');
    });

    it('returns an error when prompt is blank before provider generation', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_blank_prompt',
        name: 'image_generate',
        arguments: { prompt: '  \n\t  ', model: 'dall-e-3' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"prompt" is required');
      expect(provider.generate).not.toHaveBeenCalled();
    });

    it('uses the trimmed prompt before provider generation', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_trim_prompt',
        name: 'image_generate',
        arguments: { prompt: '  \na sunset\t  ', model: 'dall-e-3' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBeFalsy();
      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'a sunset' }),
        'key',
      );
    });

    it.each([
      ['non-string', 42],
      ['blank', ' \n\t '],
    ])('returns an error when model is %s before registry resolution', async (_label, model) => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');
      const generateSpy = vi.spyOn(registry, 'generate');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_invalid_model',
        name: 'image_generate',
        arguments: { prompt: 'a sunset', model },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"model" must be a non-empty string');
      expect(generateSpy).not.toHaveBeenCalled();
      expect(provider.generate).not.toHaveBeenCalled();
    });

    it('returns an error when n is not a number', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_invalid_n',
        name: 'image_generate',
        arguments: { prompt: 'a sunset', model: 'dall-e-3', n: '2' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"n" must be a positive integer');
      expect(provider.generate).not.toHaveBeenCalled();
    });

    it.each([
      ['NaN', Number.NaN],
      ['fractional', 1.5],
      ['zero', 0],
    ])('returns an error when n is %s before provider generation', async (_label, n) => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_invalid_n_value',
        name: 'image_generate',
        arguments: { prompt: 'a sunset', model: 'dall-e-3', n },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"n" must be a positive integer');
      expect(provider.generate).not.toHaveBeenCalled();
    });

    it('returns an error when size is invalid', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_invalid_size',
        name: 'image_generate',
        arguments: { prompt: 'a sunset', model: 'dall-e-3', size: '2048x2048' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"size" must be one of');
      expect(provider.generate).not.toHaveBeenCalled();
    });

    it('returns an error when quality is invalid', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_invalid_quality',
        name: 'image_generate',
        arguments: { prompt: 'a sunset', model: 'dall-e-3', quality: 'ultra' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"quality" must be one of');
      expect(provider.generate).not.toHaveBeenCalled();
    });

    it('uses trimmed size and quality before provider generation', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_trim_size_quality',
        name: 'image_generate',
        arguments: {
          prompt: 'a sunset',
          model: 'dall-e-3',
          size: ' \n1024x1024\t ',
          quality: ' hd\n',
        },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBeFalsy();
      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({ size: '1024x1024', quality: 'hd' }),
        'key',
      );
    });

    it('returns an error when no models are registered', async () => {
      const registry = new ImageGenRegistry();
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc4',
        name: 'image_generate',
        arguments: { prompt: '  private scene\t' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('No image generation models');
      expect(result.output).not.toContain('private scene');
      expect(result.metadata).toMatchObject({
        model: null,
        promptLength: 13,
        size: 'auto',
        quality: 'standard',
        requestedCount: 1,
      });
    });

    it.each([
      ['empty image array', { images: [], model: 'dall-e-3' }],
      [
        'image without url or base64',
        { images: [{ revisedPrompt: 'a sharper prompt' }], model: 'dall-e-3' },
      ],
    ])('returns an error when provider returns %s', async (_label, providerResult) => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3'], providerResult);
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc_empty_images',
        name: 'image_generate',
        arguments: { prompt: 'a sunset', model: 'dall-e-3' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('no usable image data');
      expect(result.output).not.toContain('a sunset');
      expect(result.metadata).toMatchObject({
        model: 'dall-e-3',
        promptLength: 8,
        size: 'auto',
        quality: 'standard',
        requestedCount: 1,
        count: 0,
      });
      expect(provider.generate).toHaveBeenCalled();
    });

    it('returns non-sensitive request metadata when provider generation throws', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3']);
      provider.generate = vi.fn().mockRejectedValue(new Error('provider unavailable'));
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const result = await executor.execute(
        {
          id: 'tc_provider_throw',
          name: 'image_generate',
          arguments: {
            prompt: '  a private sunset\t',
            model: ' \ndall-e-3\t',
            size: ' \n1024x1024\t',
            quality: ' hd\n',
            n: 2,
          },
        },
        {
          platform: createMockPlatform(),
          sessionId: 's1',
          workingDir: '/tmp',
        },
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('provider unavailable');
      expect(result.output).not.toContain('a private sunset');
      expect(result.metadata).toMatchObject({
        model: 'dall-e-3',
        promptLength: 16,
        size: '1024x1024',
        quality: 'hd',
        requestedCount: 2,
      });
    });

    it('keeps usable images when a provider includes empty image entries', async () => {
      const registry = new ImageGenRegistry();
      const provider = createMockProvider('test', ['dall-e-3'], {
        images: [
          { revisedPrompt: 'empty placeholder' },
          { url: 'https://example.com/usable.png' },
          { base64: 'ZmFrZQ==', revisedPrompt: 'usable base64' },
        ] as GeneratedImage[],
        model: 'dall-e-3',
      });
      registry.register(provider, 'key');
      const executor = new ImageGenerateExecutor(registry);

      const result = await executor.execute(
        {
          id: 'tc_mixed_images',
          name: 'image_generate',
          arguments: { prompt: 'a sunset', model: 'dall-e-3' },
        },
        {
          platform: createMockPlatform(),
          sessionId: 's1',
          workingDir: '/tmp',
        },
      );

      expect(result.isError).toBeFalsy();
      expect(result.metadata).toMatchObject({ count: 2 });
      expect((result.metadata as any).images).toEqual([
        { url: 'https://example.com/usable.png' },
        { base64: 'ZmFrZQ==', revisedPrompt: 'usable base64' },
      ]);
      expect(result.output).toContain('Generated 2 image(s)');
      expect(result.output).toContain('base64=(8 chars)');
      expect(result.output).not.toContain('usable base64');
    });
  });
});
