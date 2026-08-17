import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChatPanel, type ChatPanelMessage } from '../src/components/chat/ChatPanel';

function userMsg(content: string, id = 'u1'): ChatPanelMessage {
  return { id, role: 'user', content };
}
function assistantMsg(overrides: Partial<ChatPanelMessage> = {}, id = 'a1'): ChatPanelMessage {
  return { id, role: 'assistant', content: '', ...overrides };
}

describe('ChatPanel', () => {
  it('renders messages in order', () => {
    render(<ChatPanel
      messages={[userMsg('hello', 'u1'), assistantMsg({ content: 'hi there' }, 'a1')]}
      onSend={vi.fn()}
    />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('hi there')).toBeInTheDocument();
  });

  it('forwards restored URL and local images to user messages', () => {
    render(<ChatPanel
      messages={[{
        ...userMsg('attachments'),
        images: [
          { data: 'https://example.com/remote.png', mimeType: 'image/png' },
          { data: 'local-base64', mimeType: 'image/jpeg' },
        ],
      }]}
      onSend={vi.fn()}
    />);

    expect(screen.getByRole('img', { name: 'User attachment 1' }))
      .toHaveAttribute('src', 'https://example.com/remote.png');
    expect(screen.getByRole('img', { name: 'User attachment 2' }))
      .toHaveAttribute('src', 'data:image/jpeg;base64,local-base64');
  });

  it('shows empty message when no messages', () => {
    render(<ChatPanel messages={[]} onSend={vi.fn()} emptyMessage={<div>start chatting</div>} />);
    expect(screen.getByText('start chatting')).toBeInTheDocument();
  });

  it('does NOT render the legacy bottom skill-match indicator', () => {
    const { container } = render(<ChatPanel
      messages={[userMsg('hi')]}
      onSend={vi.fn()}
      matchedSkills={['code-review']}
    />);
    // The 🎯 / "已匹配技能" line should be gone
    expect(container.textContent).not.toContain('已匹配技能');
    expect(container.textContent).not.toContain('🎯');
  });

  it('forwards activeSkills to streaming assistant message (shimmer shows skill)', () => {
    render(<ChatPanel
      messages={[assistantMsg({
        content: '',
        isStreaming: true,
        blocks: [{ type: 'thinking', text: 'hmm' }],
        activeSkills: ['code-review'],
      })]}
      onSend={vi.fn()}
      isStreaming
    />);
    // Streaming → process collapsed → shimmer indicator visible with skill name
    expect(screen.getByText(/code-review/)).toBeInTheDocument();
    // "已处理" not shown during streaming
    expect(screen.queryByText(/已处理|Processed/)).not.toBeInTheDocument();
  });

  it('renders presets when provided and message list is empty', () => {
    render(<ChatPanel
      messages={[]}
      onSend={vi.fn()}
      emptyMessage={<div>empty</div>}
      presets={[{ label: 'Write code', prompt: 'write code' }]}
    />);
    expect(screen.getByText('Write code')).toBeInTheDocument();
  });

  it('does not scan transcript cards to invent a live approval', () => {
    render(<ChatPanel
      messages={[assistantMsg({
        content: '',
        toolCalls: [{
          id: 'tc1', name: 'bash',
          arguments: { command: 'rm -rf /' },
          status: 'pending_approval' as const,
        }],
      })]}
      onSend={vi.fn()}
      onApproveTool={vi.fn()}
      onRejectTool={vi.fn()}
    />);
    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders only the typed active-session approval request as modal', () => {
    const { container } = render(<ChatPanel
      messages={[assistantMsg()]}
      onSend={vi.fn()}
      approvalRequest={{
        sessionId: 'session-a', requestId: 'approval-a', itemId: 'tc-a',
        createdAt: 1, toolName: 'bash', arguments: { command: 'pwd' },
        decisions: ['accept', 'decline', 'cancel'],
      }}
      onApprovalDecision={vi.fn()}
    />);
    expect(screen.getByRole('alertdialog', { name: 'Approve this tool?' })).toBeInTheDocument();
    const paneContent = screen.getByTestId('chat-pane-content');
    expect(paneContent).not.toHaveAttribute('aria-hidden');
    expect((paneContent as HTMLElement & { inert?: boolean }).inert).not.toBe(true);
    expect((container as HTMLElement & { inert: boolean }).inert).toBe(true);
  });

  it('restores composer focus only after a settled decision becomes enabled', async () => {
    const approvalRequest = {
      sessionId: 'session-a', requestId: 'approval-a', itemId: 'tc-a',
      createdAt: 1, toolName: 'bash', arguments: { command: 'pwd' },
      decisions: ['accept', 'decline', 'cancel'] as const,
    };
    const { rerender } = render(<ChatPanel
      messages={[assistantMsg()]}
      onSend={vi.fn()}
      approvalRequest={approvalRequest}
      onApprovalDecision={vi.fn()}
      isStreaming
    />);

    rerender(<ChatPanel messages={[assistantMsg()]} onSend={vi.fn()} isStreaming />);
    expect(screen.getByTestId('chat-input')).not.toHaveFocus();

    rerender(<ChatPanel messages={[assistantMsg()]} onSend={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('chat-input')).toHaveFocus());
  });

  it('disables the composer with an accessible runtime ownership explanation', () => {
    render(<ChatPanel
      messages={[assistantMsg()]}
      onSend={vi.fn()}
      disabled
      disabledReason="Another session is still running. Return to it or stop it before sending here."
    />);
    expect(screen.getByTestId('chat-input')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Another session is still running');
  });

  it('scopes structured input to the chat pane without claiming a global modal', () => {
    render(<ChatPanel
      messages={[userMsg('ask')]}
      onSend={vi.fn()}
      userInputRequest={{
        sessionId: 'session-a', requestId: 'request-a', state: 'pending',
        questions: [{
          id: 'answer', header: 'Answer', question: 'Continue?',
          isOther: false, isSecret: false, options: null,
        }],
      }}
      onSubmitUserInput={vi.fn()}
    />);

    const dialog = screen.getByRole('dialog', { name: 'Input required' });
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(dialog).toHaveClass('absolute');
    const paneContent = screen.getByTestId('chat-pane-content');
    expect(paneContent).toHaveAttribute('aria-hidden', 'true');
    expect((paneContent as HTMLElement & { inert: boolean }).inert).toBe(true);
  });
});
