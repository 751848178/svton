import type { ContentBlock, DisplayMessage, FileChange } from './types';

export function finalizeTurnBlocks(msg: DisplayMessage): DisplayMessage {
  return aggregateFileChangesForTurn(extractCommandBlocksForTurn(msg));
}

export function extractCommandBlocksForTurn(msg: DisplayMessage): DisplayMessage {
  const commands: ContentBlock[] = [];
  const blocks = msg.blocks.map((block) => {
    if (block.type !== 'text' || !block.text) {
      return block;
    }

    const text = block.text
      .replace(/\[([^\]]+)\]\(action:([^)]+)\)/g, (_match, label, action) => {
        commands.push({ type: 'command', label, action });
        return '';
      })
      .trim();
    return { type: 'text' as const, text };
  });

  return commands.length > 0 ? { ...msg, blocks: [...blocks, ...commands] } : msg;
}

export function aggregateFileChangesForTurn(msg: DisplayMessage): DisplayMessage {
  const fileChangeBlocks = msg.blocks.filter((block) => block.type === 'file_change');
  if (fileChangeBlocks.length < 2) {
    return msg;
  }

  const changes: FileChange[] = fileChangeBlocks.flatMap((block) =>
    block.type === 'file_change' ? block.changes : [],
  );
  const blocks = msg.blocks.filter((block) => block.type !== 'file_change');
  return { ...msg, blocks: [...blocks, { type: 'turn_diff', changes }] };
}
