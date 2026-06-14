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
): IImageGenerationProvider & { generate: ReturnType<typeof vi.fn> } {
  return {
    name,
    models,
    generate: vi.fn(async (
      _req: ImageGenerationRequest,
      _apiKey: string,
    ): Promise<ImageGenerationResult> => ({
      images: [{ url: `https://example.com/${name}-image.png` }],
      model: _req.model,
    })),
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

    it('returns an error when no models are registered', async () => {
      const registry = new ImageGenRegistry();
      const executor = new ImageGenerateExecutor(registry);

      const call: ToolCall = {
        id: 'tc4',
        name: 'image_generate',
        arguments: { prompt: 'hello' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: 's1',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('No image generation models');
    });
  });
});
