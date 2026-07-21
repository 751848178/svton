import type { GeneratedImage } from '../../image-gen/types';

export function imageGenerateRequestMetadata(args: {
  model: string | null;
  prompt: string;
  size?: string;
  quality?: string;
  n?: number;
}): Record<string, unknown> {
  return {
    model: args.model,
    promptLength: args.prompt.length,
    size: args.size ?? 'auto',
    quality: args.quality ?? 'standard',
    requestedCount: args.n ?? 1,
  };
}

export function filterUsableGeneratedImages(images: unknown): GeneratedImage[] {
  if (!Array.isArray(images)) {
    return [];
  }
  return images.filter(hasUsableImagePayload);
}

function hasUsableImagePayload(image: unknown): image is GeneratedImage {
  if (!image || typeof image !== 'object') {
    return false;
  }
  const candidate = image as { url?: unknown; base64?: unknown };
  return (
    typeof candidate.url === 'string' && candidate.url.trim().length > 0
  ) || (
    typeof candidate.base64 === 'string' && candidate.base64.trim().length > 0
  );
}
