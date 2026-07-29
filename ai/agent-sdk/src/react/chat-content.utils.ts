import type { UserMessage } from '@earendil-works/pi-ai';

type ChatImage = { data: string; mimeType?: string };

export function buildChatContent(message: string, images?: ChatImage[]): UserMessage['content'] {
  if (!images?.length) {
    return message;
  }

  return [
    { type: 'text' as const, text: message },
    ...images.map((img) => ({
      type: 'image' as const,
      data: img.data,
      mimeType: img.mimeType ?? 'image/png',
    })),
  ];
}
