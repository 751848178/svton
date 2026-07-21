import type { ContentBlock } from '../types';

export function readSlowToolProgressBlock(
  name: string,
): { type: 'progress'; text: string; status: 'running' } | null {
  if (name === 'web_search') {
    return { type: 'progress', text: 'Searching the web', status: 'running' };
  }
  if (name === 'grep' || name === 'glob') {
    return { type: 'progress', text: 'Searching codebase', status: 'running' };
  }
  if (name === 'file_read' || name === 'read' || name === 'read_file') {
    return { type: 'progress', text: 'Reading file', status: 'running' };
  }
  return name === 'list_files' || name === 'list_dir' || name === 'ls'
    ? { type: 'progress', text: 'Listing files', status: 'running' }
    : null;
}

export function insertSlowToolProgressBlock(
  blocks: ContentBlock[],
  callId: string,
  name: string | undefined,
): ContentBlock[] {
  if (!name) return blocks;
  const progressBlock = readSlowToolProgressBlock(name);
  if (!progressBlock) return blocks;
  const toolCallIndex = blocks.findIndex((block) =>
    block.type === 'tool_call' && block.call?.id === callId,
  );
  if (toolCallIndex < 0) return blocks;

  const previousBlock = blocks[toolCallIndex - 1];
  const alreadyExistsForCall = previousBlock?.type === 'progress'
    && previousBlock.status === 'running'
    && previousBlock.text === progressBlock.text;
  if (alreadyExistsForCall) return blocks;

  return [
    ...blocks.slice(0, toolCallIndex),
    progressBlock,
    ...blocks.slice(toolCallIndex),
  ];
}

export function markSlowToolProgressBlockDone(
  blocks: ContentBlock[],
  callId: string,
): ContentBlock[] {
  const toolCallIndex = blocks.findIndex((block) =>
    block.type === 'tool_call' && block.call.id === callId,
  );
  if (toolCallIndex <= 0) return blocks;

  const progressIndex = toolCallIndex - 1;
  const progressBlock = blocks[progressIndex];
  if (progressBlock.type !== 'progress' || progressBlock.status !== 'running') return blocks;

  const nextBlocks = [...blocks];
  nextBlocks[progressIndex] = { ...progressBlock, status: 'done' };
  return nextBlocks;
}
