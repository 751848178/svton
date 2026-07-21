import type { ImageContent } from './types';

const REMOTE_IMAGE_URL_PATTERN = /^https?:\/\//i;

export function formatOpenAIImageUrl(block: ImageContent): string {
  if (block.data.startsWith('data:') || REMOTE_IMAGE_URL_PATTERN.test(block.data)) {
    return block.data;
  }

  return `data:${block.mimeType || 'image/png'};base64,${block.data}`;
}
