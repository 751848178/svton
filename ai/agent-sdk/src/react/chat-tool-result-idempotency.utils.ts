import type { ContentBlock } from './types';

export function appendToolResultBlocksOnce(
  blocks: ContentBlock[],
  callId: string,
  additions: ContentBlock[],
): ContentBlock[] {
  if (additions.length === 0) return blocks;

  const slot = readToolResultSlot(blocks, callId);
  const uniqueAdditions = additions.filter((block) => !slot.existingTypes.has(block.type));
  return uniqueAdditions.length > 0
    ? insertBlocks(blocks, slot.insertIndex, uniqueAdditions)
    : blocks;
}

function readToolResultSlot(
  blocks: ContentBlock[],
  callId: string,
): { existingTypes: Set<ContentBlock['type']>; insertIndex: number } {
  const anchorIndex = blocks.findIndex((block) => isToolAnchorBlock(block, callId));
  if (anchorIndex < 0) return { existingTypes: new Set(), insertIndex: blocks.length };

  const insertIndex = readNextToolSegmentIndex(blocks, anchorIndex + 1);
  const resultBlocks = blocks.slice(anchorIndex + 1, insertIndex);
  return { existingTypes: new Set(resultBlocks.map((block) => block.type)), insertIndex };
}

function readNextToolSegmentIndex(blocks: ContentBlock[], startIndex: number): number {
  const nextIndex = blocks.findIndex((block, index) => index >= startIndex && isAnyToolAnchorBlock(block));
  if (nextIndex < 0) return blocks.length;
  const progressIndex = nextIndex - 1;
  return progressIndex >= startIndex && blocks[progressIndex].type === 'progress'
    ? progressIndex
    : nextIndex;
}

function insertBlocks(blocks: ContentBlock[], index: number, additions: ContentBlock[]): ContentBlock[] {
  return [
    ...blocks.slice(0, index),
    ...additions,
    ...blocks.slice(index),
  ];
}

function isToolAnchorBlock(block: ContentBlock, callId: string): boolean {
  if (block.type === 'tool_call') return block.call.id === callId;
  return block.type === 'subagent' && block.agentId === callId;
}

function isAnyToolAnchorBlock(block: ContentBlock): boolean {
  return block.type === 'tool_call' || block.type === 'subagent';
}
