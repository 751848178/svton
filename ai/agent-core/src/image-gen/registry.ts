/**
 * Image generation registry.
 *
 * Maintains a set of provider+API-key pairs and routes generate
 * requests to the correct provider based on the model name.
 */

import type {
  IImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from './types';

interface ProviderEntry {
  provider: IImageGenerationProvider;
  apiKey: string;
}

export class ImageGenRegistry {
  private providers = new Map<string, ProviderEntry>();

  /**
   * Register a provider with its associated API key.
   * All models declared by the provider become resolvable.
   */
  register(provider: IImageGenerationProvider, apiKey: string): void {
    const entry: ProviderEntry = { provider, apiKey };
    for (const model of provider.models) {
      this.providers.set(model, entry);
    }
  }

  /**
   * Look up the provider entry that handles a given model.
   * Returns null if no provider is registered for the model.
   */
  resolve(model: string): ProviderEntry | null {
    return this.providers.get(model) ?? null;
  }

  /**
   * Generate images using the provider registered for the request's model.
   * Throws if no provider is found.
   */
  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const entry = this.resolve(req.model);
    if (!entry) {
      const available = this.getAvailableModels();
      throw new Error(
        `No image generation provider registered for model "${req.model}".` +
          (available.length
            ? ` Available models: ${available.join(', ')}.`
            : ' No models are currently registered.'),
      );
    }
    return entry.provider.generate(req, entry.apiKey);
  }

  /**
   * Return all model names currently registered across all providers.
   */
  getAvailableModels(): string[] {
    return Array.from(this.providers.keys());
  }
}
