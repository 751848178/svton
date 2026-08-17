import { describe, expect, it, vi } from 'vitest';
import type { ChatService, DisplayMessage } from '../src/service/chat.service';
import type { SessionService } from '../src/service/session.service';
import { loadSessionMessagesForSwitch } from '../src/hooks/use-session-switch-load.utils';

describe('loadSessionMessagesForSwitch', () => {
  it('preserves A target messages and live queue when deleting active B returns to A', async () => {
    const pendingA: DisplayMessage[] = [{
      id: 'assistant-a',
      role: 'assistant',
      content: '',
      timestamp: 1,
      toolCalls: [{
        id: 'approval-a',
        name: 'memory_save',
        arguments: { content: 'owned by A' },
        status: 'pending_approval',
      }],
    }];
    const loadMessages = vi.fn().mockResolvedValue(undefined);
    const chatService = {
      getCachedMessages: (sessionId: string) => sessionId === 'session-a' ? pendingA : undefined,
      hasPendingApprovalsForSession: (sessionId: string) => sessionId === 'session-a',
      isSessionStreaming: (sessionId: string) => sessionId === 'session-a',
      loadMessages,
    } as unknown as ChatService;

    await loadSessionMessagesForSwitch(
      chatService,
      {} as SessionService,
      'session-a',
      true,
    );

    expect(loadMessages).toHaveBeenCalledWith(pendingA, {
      preservePendingToolCalls: true,
      preserveLiveApprovals: true,
    });
  });

  it('keeps global A live approval while switching to ordinary B messages', async () => {
    const messagesB: DisplayMessage[] = [{
      id: 'assistant-b', role: 'assistant', content: 'B ready', timestamp: 2,
    }];
    const loadMessages = vi.fn().mockResolvedValue(undefined);
    const chatService = {
      getCachedMessages: () => messagesB,
      hasPendingApprovalsForSession: () => false,
      isSessionStreaming: () => false,
      loadMessages,
    } as unknown as ChatService;

    await loadSessionMessagesForSwitch(
      chatService,
      {} as SessionService,
      'session-b',
      true,
    );

    expect(loadMessages).toHaveBeenCalledWith(messagesB, {
      preservePendingToolCalls: false,
      preserveLiveApprovals: true,
    });
  });
});
