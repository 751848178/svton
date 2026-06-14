/**
 * Image generation module — multi-vendor support.
 */

// Types
export type {
  ImageGenerationRequest,
  GeneratedImage,
  ImageGenerationResult,
  IImageGenerationProvider,
} from './types';

// Providers
export { OpenAIImageProvider } from './openai-image';
export { StabilityProvider } from './stability';
export { GoogleImagenProvider } from './google-imagen';

// Registry
export { ImageGenRegistry } from './registry';
