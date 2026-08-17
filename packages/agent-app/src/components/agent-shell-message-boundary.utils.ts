import type {
  ContentBlock as ClientContentBlock,
  DisplayMessage,
} from '@svton/agent-client';
import type {
  ChatPanelMessage,
  ContentBlock as UiContentBlock,
} from '@svton/agent-ui';

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

/**
 * The sole Client display-model to UI panel projection.
 *
 * Pi remains the runtime truth; Client owns session/display DTOs; UI receives
 * only its renderable view, with document preview images excluded from the
 * inline block union.
 */
export function projectClientMessageToChatPanel(
  message: DisplayMessage,
): ChatPanelMessage {
  const usage = message.timeline?.usage;
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    thinking: message.thinking,
    error: message.error,
    images: message.images,
    publicAttachments: message.publicAttachments,
    toolCalls: message.toolCalls,
    blocks: toInlineChatBlocks(message.blocks),
    timeline: message.timeline,
    isStreaming: message.isStreaming,
    systemType: message.systemType,
    duration: message.duration,
    activeSkills: message.activeSkills,
    usage: usage ? {
      promptTokens: usage.input,
      completionTokens: usage.output,
      totalTokens: usage.totalTokens,
    } : undefined,
  };
}

function isRenderableClientBlock(
  block: ClientContentBlock,
): block is RenderableClientBlock {
  return block.type !== 'preview_images';
}
