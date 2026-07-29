import type { ContentBlock as ClientContentBlock } from '@svton/agent-client';
import type { ContentBlock as UiContentBlock } from '@svton/agent-ui';

type RenderableClientBlock = Exclude<
  ClientContentBlock,
  { type: 'preview_images' }
>;

/**
 * Converts Client display blocks into the narrower inline ChatMessage contract.
 * Document preview images remain owned by SplitScreenPanel and are not rendered
 * as inline process blocks.
 */
export function toInlineChatBlocks(
  blocks: ClientContentBlock[] | undefined,
): UiContentBlock[] | undefined {
  if (!blocks) return undefined;
  const renderable = blocks.filter(isRenderableClientBlock);
  return renderable.length > 0 ? renderable : undefined;
}

function isRenderableClientBlock(
  block: ClientContentBlock,
): block is RenderableClientBlock {
  return block.type !== 'preview_images';
}
