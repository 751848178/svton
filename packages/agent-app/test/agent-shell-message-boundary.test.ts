import { describe, expect, it } from 'vitest';
import type { ContentBlock, DisplayMessage } from '@svton/agent-client';
import {
  projectClientMessageToChatPanel,
  toInlineChatBlocks,
} from '../src/components/agent-shell-message-boundary.utils';

describe('AgentShell message display boundary', () => {
  it('keeps inline blocks and leaves preview images to SplitScreenPanel', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'inline result' },
      {
        type: 'preview_images',
        title: 'Document Preview',
        images: ['data:image/png;base64,preview'],
      },
    ];

    expect(toInlineChatBlocks(blocks)).toEqual([
      { type: 'text', text: 'inline result' },
    ]);
  });

  it('projects Client messages, tools and canonical Pi usage without casts', () => {
    const message: DisplayMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'done',
      timestamp: 1,
      toolCalls: [{
        id: 'call-1',
        name: 'file_read',
        arguments: { path: '/tmp/a' },
        status: 'completed',
        result: { callId: 'call-1', output: 'contents' },
      }],
      blocks: [
        { type: 'tool_call', call: {
          id: 'call-1',
          name: 'file_read',
          arguments: { path: '/tmp/a' },
          status: 'completed',
        } },
        {
          type: 'preview_images',
          title: 'Document Preview',
          images: ['data:image/png;base64,preview'],
        },
      ],
    };

    const projected = projectClientMessageToChatPanel(message, {
      input: 10,
      output: 4,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 14,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    });

    expect(projected.toolCalls?.[0].name).toBe('file_read');
    expect(projected.blocks).toEqual([message.blocks?.[0]]);
    expect(projected.usage).toEqual({
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
    });
  });
});
