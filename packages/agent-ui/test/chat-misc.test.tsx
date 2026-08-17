/**
 * CodeBlock / StreamingText / TurnSeparator / ToolApprovalModal tests.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeBlock } from '../src/components/chat/CodeBlock';
import { StreamingText } from '../src/components/chat/StreamingText';
import { TurnSeparator } from '../src/components/chat/TurnSeparator';
import { ToolApprovalModal } from '../src/components/chat/ToolApprovalModal';
import type { ApprovalRequestView } from '../src/components/chat/approval.types';

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

  it('preserves Hook order when rerendered from inline to block', () => {
    const view = render(<CodeBlock code="const value = 1" language="js" inline highlight />);
    expect(screen.queryByTestId('code-copy-action')).not.toBeInTheDocument();
    expect(() => view.rerender(
      <CodeBlock code="const value = 1" language="js" inline={false} highlight />,
    )).not.toThrow();
    expect(screen.getByTestId('code-copy-action')).toBeInTheDocument();
    expect(view.container.querySelector('code.hljs')).toBeInTheDocument();
  });

  it('copy button writes to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CodeBlock code="const x = 1" />);
    const copyBtn = screen.getByRole('button', { name: /copy|复制/i }) ?? screen.getByText(/copy|复制/i);
    fireEvent.click(copyBtn);
    // clipboard.writeText called with the code (allow for trimming)
    await waitFor(() => expect(writeText).toHaveBeenCalled());
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
  const request: ApprovalRequestView = {
    requestId: 'request-1', sessionId: 'session-1', itemId: 'tc1', createdAt: 1,
    toolName: 'bash',
    arguments: { command: 'rm -rf /tmp/x' },
    decisions: ['accept', 'acceptForSession', 'decline', 'cancel'],
  };

  it('renders an accessible alertdialog with safest initial focus', () => {
    render(<ToolApprovalModal request={request} onDecision={vi.fn()} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Approve this tool?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByText(/bash wants to run/)).toBeInTheDocument();
    expect(screen.getByText(/rm -rf/)).toBeInTheDocument();
  });

  it('settles once under a double click and exposes session accept only when allowed', () => {
    const onDecision = vi.fn();
    const { rerender } = render(<ToolApprovalModal request={request} onDecision={onDecision} />);
    const allow = screen.getByRole('button', { name: 'Allow once' });
    fireEvent.click(allow);
    fireEvent.click(allow);
    expect(onDecision).toHaveBeenCalledOnce();
    expect(onDecision).toHaveBeenCalledWith('request-1', 'accept');
    expect(screen.getByRole('button', { name: 'Allow for session' })).toBeInTheDocument();

    const nextDecision = vi.fn();
    rerender(<ToolApprovalModal request={{ ...request, requestId: 'request-2', decisions: ['accept', 'decline', 'cancel'] }} onDecision={nextDecision} />);
    expect(screen.queryByRole('button', { name: 'Allow for session' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }));
    expect(nextDecision).toHaveBeenCalledWith('request-2', 'accept');
  });

  it('maps Escape to cancel once and traps Tab in both directions', () => {
    const onDecision = vi.fn();
    render(<ToolApprovalModal request={request} onDecision={onDecision} />);
    const dialog = screen.getByRole('alertdialog');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const allow = screen.getByRole('button', { name: 'Allow once' });
    allow.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(allow).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onDecision).toHaveBeenCalledOnce();
    expect(onDecision).toHaveBeenCalledWith('request-1', 'cancel');
  });

  it('renders only allowed no-cancel decisions and makes Escape and backdrop no-ops', () => {
    const onDecision = vi.fn();
    render(<ToolApprovalModal request={{ ...request, decisions: ['accept', 'decline'] }} onDecision={onDecision} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allow for session' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(document.querySelector('[data-svton-modal-layer] > [aria-hidden="true"]')!);
    expect(onDecision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDecision).toHaveBeenCalledOnce();
    expect(onDecision).toHaveBeenCalledWith('request-1', 'decline');
  });

  it('focuses static approval context before affirmative-only controls', () => {
    const onDecision = vi.fn();
    render(<ToolApprovalModal request={{ ...request, decisions: ['accept'] }} onDecision={onDecision} />);
    expect(screen.getByText(/wants to run/).closest('[data-approval-summary]')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Allow once' })).not.toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDecision).not.toHaveBeenCalled();
  });

  it('restores focus to the previously focused composer after settlement', async () => {
    const onDecision = vi.fn();
    const opener = document.createElement('button');
    opener.textContent = 'External composer';
    document.body.appendChild(opener);
    opener.focus();
    function FocusRestorationHarness() {
      const [activeRequest, setActiveRequest] = useState<ApprovalRequestView | undefined>(request);
      return (
        <>
          {activeRequest && (
            <ToolApprovalModal
              request={activeRequest}
              onDecision={(...decision) => {
                onDecision(...decision);
                setActiveRequest(undefined);
              }}
            />
          )}
        </>
      );
    }

    render(<FocusRestorationHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(opener).toHaveFocus());
    expect(onDecision).toHaveBeenCalledOnce();
    opener.remove();
  });

  it('renders malformed legacy values without throwing', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    render(<ToolApprovalModal request={{
      ...request,
      arguments: { cyclic, bigint: 42n, missing: undefined, callback: () => true },
    }} onDecision={vi.fn()} />);
    expect(screen.getByText('[unavailable]')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
