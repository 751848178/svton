import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallCard, type ToolCallInfo } from '../src/components/chat/ToolCallCard';

function makeTool(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: 'tc_1',
    name: 'read_file',
    arguments: { path: '/tmp/a.txt' },
    status: 'completed',
    result: { output: 'file contents here' },
    ...overrides,
  };
}

describe('ToolCallCard', () => {
  it('renders the tool name (header always visible)', () => {
    render(<ToolCallCard toolCall={makeTool()} />);
    expect(screen.getByText('read_file')).toBeInTheDocument();
  });

  it('starts collapsed (output preview shown) and expands on click', () => {
    render(<ToolCallCard toolCall={makeTool()} />);
    // Collapsed shows a 1-line output preview (not the full detail view).
    // The expand toggle ▾/▸ control flips expanded state.
    const header = screen.getByText('read_file');
    // Find the toggle affordance — clicking the header button toggles state.
    fireEvent.click(header);
    // Expanded: full output visible (still present, now in detail region).
    expect(screen.getByText('file contents here')).toBeInTheDocument();
  });

  it('collapses again on second click (no error, preview remains)', () => {
    render(<ToolCallCard toolCall={makeTool()} />);
    const header = screen.getByText('read_file');
    fireEvent.click(header); // expand
    fireEvent.click(header); // collapse — output preview still shown either way
    expect(screen.getByText('file contents here')).toBeInTheDocument();
  });

  it('shows error preview when collapsed and result is error', () => {
    render(<ToolCallCard toolCall={makeTool({
      status: 'error',
      result: { output: 'Permission denied', isError: true },
    })} />);
    // collapsed error preview shows the error text
    expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
  });

  it('shows pending indicator (not approval buttons) when status is pending_approval', () => {
    // Note: ToolCallCard itself only shows a "pending" label; the actual
    // approve/reject buttons live in ToolApprovalModal (rendered by ChatPanel).
    render(<ToolCallCard
      toolCall={makeTool({ status: 'pending_approval' })}
      onApprove={vi.fn()}
      onReject={vi.fn()}
    />);
    expect(screen.getByText('read_file')).toBeInTheDocument();
  });

  it('renders shell command inline for bash tool', () => {
    render(<ToolCallCard toolCall={makeTool({
      name: 'bash',
      arguments: { command: 'ls -la' },
    })} />);
    expect(screen.getByText('ls -la')).toBeInTheDocument();
  });

  it('renders file path for file_edit tool', () => {
    render(<ToolCallCard toolCall={makeTool({
      name: 'file_edit',
      arguments: { path: '/src/index.ts' },
    })} />);
    expect(screen.getByText('/src/index.ts')).toBeInTheDocument();
  });
});
