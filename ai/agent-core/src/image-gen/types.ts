/**
 * Image generation type definitions.
 *
 * Provider-agnostic interfaces that allow multiple image generation
 * backends (OpenAI DALL-E, Stability AI, Google Imagen) to be used
 * through a uniform API.
 */

// ── Request ──────────────────────────────────────────────

export interface ImageGenerationRequest {
  /** Text prompt describing the desired image. */
  prompt: string;
  /** Provider-specific model identifier (e.g. "dall-e-3", "stable-image-ultra"). */
  model: string;
  /** Desired image dimensions. Use 'auto' to let the provider decide. */
  size?: '1024x1024' | '1792x1024' | '1024x1792' | 'auto';
  /** Image quality. Not all providers support all values. */
  quality?: 'standard' | 'hd';
  /** Visual style hint. Not all providers support both values. */
  style?: 'natural' | 'vivid';
  /** Number of images to generate (1-N). Defaults to 1. */
  n?: number;
}

// ── Result ───────────────────────────────────────────────

export interface GeneratedImage {
  /** URL to download the generated image (if the provider returns URLs). */
  url?: string;
  /** Base64-encoded image data (if the provider returns inline data). */
  base64?: string;
  /** Revised / enhanced prompt produced by the provider (e.g. DALL-E 3). */
  revisedPrompt?: string;
}

export interface ImageGenerationResult {
  /** Array of generated images. */
  images: GeneratedImage[];
  /** Model that produced the images. */
  model: string;
}

// ── Provider Interface ───────────────────────────────────

export interface IImageGenerationProvider {
  /** Provider display name (e.g. "openai"). */
  readonly name: string;
  /** List of model identifiers this provider supports. */
  readonly models: string[];
  /**
   * Generate one or more images.
   * @param req   - Standardized request.
   * @param apiKey - Provider-specific API key.
   */
  generate(req: ImageGenerationRequest, apiKey: string): Promise<ImageGenerationResult>;
}
