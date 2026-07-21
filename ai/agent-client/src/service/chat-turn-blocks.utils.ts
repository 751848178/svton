import type { ContentBlock, DisplayMessage, FileChange } from '../types';

export function finalizeTurnBlocks(message: DisplayMessage): DisplayMessage {
  return aggregateFileChangesForTurn(extractCommandBlocksForTurn(message));
}

export function extractCommandBlocksForTurn(message: DisplayMessage): DisplayMessage {
  const commands: ContentBlock[] = [];
  const blocks = (message.blocks || []).map((block) => {
    if (block.type !== 'text' || !block.text) return block;

    const text = block.text
      .replace(/\[([^\]]+)\]\(action:([^)]+)\)/g, (_match, label, action) => {
        commands.push({ type: 'command', label, action });
        return '';
      })
      .trim();
    return { type: 'text' as const, text };
  });

  return commands.length > 0 ? { ...message, blocks: [...blocks, ...commands] } : message;
}

export function aggregateFileChangesForTurn(message: DisplayMessage): DisplayMessage {
  const blocks = message.blocks || [];
  const fileChangeBlocks = blocks.filter((block) => block.type === 'file_change');
  if (fileChangeBlocks.length < 2) return message;

  const changes: FileChange[] = fileChangeBlocks.flatMap((block) =>
    block.type === 'file_change' ? block.changes : [],
  );
  const blocksWithoutFileChanges = blocks.filter((block) => block.type !== 'file_change');
  return { ...message, blocks: [...blocksWithoutFileChanges, { type: 'turn_diff', changes }] };
}
