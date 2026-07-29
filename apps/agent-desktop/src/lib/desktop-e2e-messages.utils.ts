export interface DesktopE2eMessage {
  role?: unknown;
  content?: unknown;
  blocks?: unknown;
}

export function extractDesktopE2eText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(isTextBlock)
    .map((block) => block.text)
    .join('');
}

export function extractDesktopE2eMessageText(
  message: DesktopE2eMessage,
): string {
  const content = extractDesktopE2eText(message.content);
  return content || extractDesktopE2eText(message.blocks);
}

function isTextBlock(
  value: unknown,
): value is { type: 'text'; text: string } {
  if (!value || typeof value !== 'object') return false;
  const block = value as { type?: unknown; text?: unknown };
  return block.type === 'text' && typeof block.text === 'string';
}
