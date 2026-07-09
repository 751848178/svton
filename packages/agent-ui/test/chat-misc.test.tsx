/**
 * CodeBlock / StreamingText / TurnSeparator / ToolApprovalModal tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeBlock } from '../src/components/chat/CodeBlock';
import { StreamingText } from '../src/components/chat/StreamingText';
import { TurnSeparator } from '../src/components/chat/TurnSeparator';
import { ToolApprovalModal } from '../src/components/chat/ToolApprovalModal';
import type { ToolCallInfo } from '../src/components/chat/ToolCallCard';

// ============================================================
// CodeBlock
// ============================================================
describe('CodeBlock', () => {
  it('renders code content', () => {
    render(<CodeBlock code="console.log('hi')" />);
    expect(screen.getByText(/console\.log/)).toBeInTheDocument();
  });

  it('renders language label when provided', () => {
    render(<CodeBlock code="x = 1" language="python" />);
    expect(screen.getByText(/python/i)).toBeInTheDocument();
  });

  it('renders filename when provided', () => {
    render(<CodeBlock code="x" filename="app.ts" />);
    expect(screen.getByText(/app\.ts/)).toBeInTheDocument();
  });

  it('copy button writes to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CodeBlock code="const x = 1" />);
    const copyBtn = screen.getByRole('button', { name: /copy|复制/i }) ?? screen.getByText(/copy|复制/i);
    fireEvent.click(copyBtn);
    // clipboard.writeText called with the code (allow for trimming)
    expect(writeText).toHaveBeenCalled();
    const arg = writeText.mock.calls[0][0];
    expect(arg).toMatch(/const x = 1/);
  });
});

// ============================================================
// StreamingText
// ============================================================
describe('StreamingText', () => {
  it('renders the provided text', () => {
    render(<StreamingText text="hello world" />);
    expect(screen.getByText(/hello world/)).toBeInTheDocument();
  });

  it('shows a cursor indicator when isStreaming', () => {
    const { container } = render(<StreamingText text="partial" isStreaming />);
    // streaming cursor is a pulse/caret element
    expect(container.innerHTML).toMatch(/animate-pulse|cursor|block/);
  });

  it('does not show cursor when not streaming', () => {
    const { container } = render(<StreamingText text="done" isStreaming={false} />);
    expect(container.innerHTML).not.toMatch(/animate-pulse/);
  });
});

// ============================================================
// TurnSeparator
// ============================================================
describe('TurnSeparator', () => {
  it('renders a divider line when no label', () => {
    const { container } = render(<TurnSeparator />);
    // should render a thin divider element
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders the label when provided', () => {
    render(<TurnSeparator label="2.1k in → 1.8k out" />);
    expect(screen.getByText(/2\.1k/)).toBeInTheDocument();
  });
});

// ============================================================
// ToolApprovalModal
// ============================================================
describe('ToolApprovalModal', () => {
  const toolCall: ToolCallInfo = {
    id: 'tc1',
    name: 'bash',
    arguments: { command: 'rm -rf /tmp/x' },
    status: 'pending_approval',
  };

  it('renders the tool name and arguments', () => {
    render(<ToolApprovalModal toolCall={toolCall} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getAllByText('bash').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/rm -rf/)).toBeInTheDocument();
  });

  it('fires onApprove with the call id', () => {
    const onApprove = vi.fn();
    render(<ToolApprovalModal toolCall={toolCall} onApprove={onApprove} onReject={vi.fn()} />);
    // Button label is i18n 'tool.allow' (允许执行 / Allow)
    const approveBtn = screen.getByText(/允许执行|Allow/i).closest('button')!;
    fireEvent.click(approveBtn);
    expect(onApprove).toHaveBeenCalledWith('tc1');
  });

  it('fires onReject with the call id', () => {
    const onReject = vi.fn();
    render(<ToolApprovalModal toolCall={toolCall} onApprove={vi.fn()} onReject={onReject} />);
    // Button label is i18n 'tool.deny' (拒绝 / Deny)
    const rejectBtn = screen.getByText(/拒绝|Deny/i).closest('button')!;
    fireEvent.click(rejectBtn);
    expect(onReject).toHaveBeenCalledWith('tc1');
  });
});
