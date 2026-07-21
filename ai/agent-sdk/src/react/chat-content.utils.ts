import type { ContentBlock as CoreContentBlock } from '@svton/agent-core';

type ChatImage = { data: string; mimeType?: string };

export function buildChatContent(message: string, images?: ChatImage[]): string | CoreContentBlock[] {
  if (!images?.length) {
    return message;
  }

  return [
    { type: 'text' as const, text: message },
    ...images.map(
      (img): CoreContentBlock => ({
        type: 'image' as const,
        data: img.data,
        mimeType: img.mimeType,
      }),
    ),
  ];
}
