import type { ContentBlock } from './chat-message.types';

export function lastTextBlockIndex(blocks: ContentBlock[]): number {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index].type === 'text' && blocks[index].text) return index;
  }
  return -1;
}

export function isProcessBlock(block: ContentBlock, index: number, lastTextIndex: number): boolean {
  if (block.type === 'text') return index !== lastTextIndex;
  return block.type !== 'command' && block.type !== 'error';
}

export function effectiveAssistantText(content: string, blocks?: ContentBlock[]): string | undefined {
  if (content) return content;
  if (!blocks) return undefined;
  const index = lastTextBlockIndex(blocks);
  return index >= 0 ? blocks[index].text : undefined;
}

export function formatMessageDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function assistantDocumentTitle(content: string, fallback: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}
