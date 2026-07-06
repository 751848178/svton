import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatMessage } from '../src/components/chat/ChatMessage';
import type { ToolCallInfo } from '../src/components/chat/ToolCallCard';

// ==============================================================
// Helpers
// ==============================================================

const mockToolCall: ToolCallInfo = {
  id: 'tc1',
  name: 'read_file',
  arguments: { path: '/test.txt' },
  status: 'completed',
  result: { callId: 'tc1', output: 'file contents here', isError: false },
};

const pendingToolCall: ToolCallInfo = {
  id: 'tc2',
  name: 'write_file',
  arguments: { path: '/out.txt', content: 'hello' },
  status: 'pending_approval',
};

// ==============================================================
// Tests
// ==============================================================

describe('ChatMessage — User Messages', () => {
  it('renders user message content', () => {
    render(<ChatMessage id="m1" role="user" content="Hello AI" />);
    expect(screen.getByText('Hello AI')).toBeInTheDocument();
  });

  it('shows Copy button with correct title', () => {
    render(<ChatMessage id="m1" role="user" content="Test" />);
    expect(screen.getByTitle('Copy')).toBeInTheDocument();
  });

  it('shows Retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ChatMessage id="m1" role="user" content="Test" onRetry={onRetry} />);
    expect(screen.getByTitle('Retry')).toBeInTheDocument();
  });

  it('hides Retry button when onRetry not provided', () => {
    render(<ChatMessage id="m1" role="user" content="Test" />);
    expect(screen.queryByTitle('Retry')).not.toBeInTheDocument();
  });

  it('shows Edit button when onEdit provided', () => {
    render(<ChatMessage id="m1" role="user" content="Test" onEdit={vi.fn()} />);
    // Edit button title comes from t('chat.editMessage') or falls back to "Edit"
    const editButtons = screen.getAllByText('Edit');
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onRetry with message ID when Retry clicked', async () => {
    const onRetry = vi.fn();
    render(<ChatMessage id="m1" role="user" content="Test" onRetry={onRetry} />);

    const retryBtn = screen.getByTitle('Retry');
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledWith('m1');
  });

  it('enters edit mode when Edit clicked', async () => {
    const onEdit = vi.fn();
    render(<ChatMessage id="m1" role="user" content="Original text" onEdit={onEdit} />);

    // Find the user message Edit button (there may be an assistant one too)
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    // Should show textarea with current content
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('Original text');

    // Should show submit and cancel buttons
    expect(screen.getByText('发送')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('calls onEdit with new content when submitted', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ChatMessage id="m1" role="user" content="Original" onEdit={onEdit} />);

    // Click Edit
    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);

    // Clear and type new content
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'New content');

    // Submit
    await user.click(screen.getByText('发送'));
    expect(onEdit).toHaveBeenCalledWith('m1', 'New content');
  });

  it('cancels edit without calling onEdit', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<ChatMessage id="m1" role="user" content="Original" onEdit={onEdit} />);

    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);

    await user.click(screen.getByText('取消'));
    expect(onEdit).not.toHaveBeenCalled();
    // Textarea should be gone
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders images', () => {
    render(
      <ChatMessage
        id="m1" role="user" content="Look at this"
        images={[{ data: 'data:image/png;base64,abc123', mimeType: 'image/png' }]}
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
  });
});

describe('ChatMessage — Assistant Messages', () => {
  it('renders assistant message content', () => {
    render(<ChatMessage id="m2" role="assistant" content="Hello human" />);
    expect(screen.getByText('Hello human')).toBeInTheDocument();
  });

  it('shows Copy button for completed assistant message', () => {
    render(<ChatMessage id="m2" role="assistant" content="Response" isLast />);
    expect(screen.getByTitle('Copy')).toBeInTheDocument();
  });

  it('shows Regenerate button for last assistant message when onRetry provided', () => {
    render(<ChatMessage id="m2" role="assistant" content="Response" isLast onRetry={vi.fn()} />);
    expect(screen.getByTitle('Regenerate')).toBeInTheDocument();
  });

  it('hides Regenerate for non-last assistant message', () => {
    render(<ChatMessage id="m2" role="assistant" content="Response" isLast={false} onRetry={vi.fn()} />);
    expect(screen.queryByTitle('Regenerate')).not.toBeInTheDocument();
  });

  it('calls onRetry without message ID when Regenerate clicked', () => {
    const onRetry = vi.fn();
    render(<ChatMessage id="m2" role="assistant" content="Response" isLast onRetry={onRetry} />);
    fireEvent.click(screen.getByTitle('Regenerate'));
    expect(onRetry).toHaveBeenCalledWith(); // no args
  });

  it('shows Edit (openEditor) button when onOpenEditor provided', () => {
    render(<ChatMessage id="m2" role="assistant" content="Code" isLast onOpenEditor={vi.fn()} />);
    expect(screen.getByTitle('Edit')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<ChatMessage id="m2" role="assistant" content="" error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders thinking content via blocks', () => {
    render(
      <ChatMessage
        id="m2" role="assistant" content=""
        blocks={[
          { type: 'thinking', text: 'Let me analyze this...' },
          { type: 'text', text: 'Here is my answer' },
        ]}
      />,
    );
    // Process blocks (thinking) are collapsed by default; only the conclusion
    // text and the "已处理" expand toggle are visible.
    expect(screen.queryByText('Let me analyze this...')).not.toBeInTheDocument();
    expect(screen.getByText('Here is my answer')).toBeInTheDocument();
    expect(screen.getByText('已处理')).toBeInTheDocument();
  });

  it('renders tool calls via blocks', () => {
    render(
      <ChatMessage
        id="m2" role="assistant" content=""
        blocks={[
          { type: 'tool_call', call: mockToolCall },
        ]}
      />,
    );
    // Tool call is collapsed by default — the "已处理" toggle shows instead.
    expect(screen.queryByText('read_file')).not.toBeInTheDocument();
    expect(screen.getByText('已处理')).toBeInTheDocument();
  });

  it('renders error blocks', () => {
    render(
      <ChatMessage
        id="m2" role="assistant" content=""
        blocks={[
          { type: 'error', text: 'Tool execution failed' },
        ]}
      />,
    );
    // Error blocks are process blocks — collapsed by default.
    expect(screen.queryByText('Tool execution failed')).not.toBeInTheDocument();
    expect(screen.getByText('已处理')).toBeInTheDocument();
  });

  it('renders legacy thinking + toolCalls when no blocks', () => {
    render(
      <ChatMessage
        id="m2" role="assistant" content="Done"
        thinking="I thought about it"
        toolCalls={[mockToolCall]}
      />,
    );
    // Thinking is collapsed by default (process content).
    expect(screen.queryByText('I thought about it')).not.toBeInTheDocument();
    // Tool call header (name) is always visible — only its detail/output is
    // collapsed. This is intentional: you see what ran, not the verbose result.
    expect(screen.getByText('read_file')).toBeInTheDocument();
  });

  it('renders process summary with duration when collapsed', () => {
    const { container } = render(
      <ChatMessage
        id="m2" role="assistant" content="Result"
        duration={2500}
        blocks={[
          { type: 'thinking', text: 'Thinking...' },
          { type: 'text', text: 'Result' },
        ]}
      />,
    );
    // Duration should appear somewhere — Math.round(2500/1000) = 3s
    expect(container.textContent).toContain('3s');
  });
});

describe('ChatMessage — System Messages', () => {
  it('renders default system message', () => {
    const { container } = render(
      <ChatMessage id="m3" role="system" content="System notification" />,
    );
    expect(container.textContent).toContain('System notification');
  });

  it('renders context_compacted system message', () => {
    const { container } = render(
      <ChatMessage id="m3" role="system" content="" systemType="context_compacted" />,
    );
    // Should render the compacted divider style
    expect(container.querySelector('.text-gray-300')).toBeInTheDocument();
  });
});
