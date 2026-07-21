import type { ImageContent } from './types';

export type AnthropicImageSource =
  | { type: 'base64'; media_type: string; data: string }
  | { type: 'url'; url: string };

const REMOTE_IMAGE_URL_PATTERN = /^https?:\/\//i;
const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.*)$/s;

export function formatAnthropicImageSource(block: ImageContent): AnthropicImageSource {
  if (REMOTE_IMAGE_URL_PATTERN.test(block.data)) {
    return { type: 'url', url: block.data };
  }

  const dataUrlMatch = DATA_URL_PATTERN.exec(block.data);
  if (dataUrlMatch) {
    return {
      type: 'base64',
      media_type: dataUrlMatch[1],
      data: dataUrlMatch[2],
    };
  }

  return {
    type: 'base64',
    media_type: block.mimeType || 'image/png',
    data: block.data,
  };
}
