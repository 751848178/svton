import { describe, expect, it } from 'vitest';
import type { ContentBlock } from '@svton/agent-client';
import { toInlineChatBlocks } from '../src/components/agent-shell-message-boundary.utils';

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
});
