import {
  MAX_COMPOSER_IMAGE_BYTES,
  type ComposerAttachment,
  type ComposerIntentResult,
} from './composer.types';
import type { Translator } from '@svton/ui';

export async function readComposerImages(
  files: File[],
  available: number,
  operationId: string,
  t: Translator,
): Promise<{ attachments: ComposerAttachment[]; error: ComposerIntentResult | null }> {
  const images = files.filter((file) => file.type.startsWith('image/'));
  if (images.length !== files.length) return {
    attachments: [],
    error: { id: operationId, kind: 'unsupported', message: t('chat.composer.image.imagesOnly') },
  };
  if (available <= 0 || images.length > available) return {
    attachments: [],
    error: { id: operationId, kind: 'failed', retryable: true, message: t('chat.composer.image.maxCount') },
  };
  const oversize = images.find((file) => file.size > MAX_COMPOSER_IMAGE_BYTES);
  if (oversize) return {
    attachments: [],
    error: { id: operationId, kind: 'failed', retryable: true, message: t('chat.composer.image.tooLarge', { name: oversize.name }) },
  };
  try {
    const attachments = await Promise.all(images.map(async (file, index) => ({
      id: `image:${operationId}:${index}:${file.name}`,
      kind: 'image' as const,
      name: file.name || t('chat.composer.image.unnamed', { index: index + 1 }),
      mimeType: file.type,
      size: file.size,
      data: await readBase64(file),
    })));
    return { attachments, error: null };
  } catch {
    return {
      attachments: [],
      error: { id: operationId, kind: 'failed', retryable: true, message: t('chat.composer.image.readFailed') },
    };
  }
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onabort = () => reject(new Error('read cancelled'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const data = value.includes(',') ? value.slice(value.indexOf(',') + 1) : '';
      data ? resolve(data) : reject(new Error('empty image'));
    };
    reader.readAsDataURL(file);
  });
}
