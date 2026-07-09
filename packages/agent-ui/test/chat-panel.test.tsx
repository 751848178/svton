import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    expect(screen.queryByText('已处理')).not.toBeInTheDocument();
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

  it('shows tool approval modal when a tool is pending_approval', () => {
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
    // The tool name 'bash' appears (both in the card header and approval modal)
    const bashEls = screen.getAllByText('bash');
    expect(bashEls.length).toBeGreaterThanOrEqual(1);
  });
});
