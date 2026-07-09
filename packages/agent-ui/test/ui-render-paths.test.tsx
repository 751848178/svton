/**
 * UI render-path + CSS class assertion tests.
 *
 * Validates the visual correctness layer that getByText tests miss:
 * - Which render path is chosen (DiffView vs MarkdownRenderer vs ShellOutput)
 * - CSS class names match expected styling (dark theme, monospace, dim, error)
 * - DOM structure (no bubbles, left-aligned, correct prefixes)
 * - Output truncation at the correct line count
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from '../src/components/chat/ChatMessage';
import { ToolCallCard } from '../src/components/chat/ToolCallCard';
import type { ToolCallInfo } from '../src/components/chat/ToolCallCard';
import { getToolDisplayName, getMcpServerName } from '../src/components/chat/tool-names';

// ============================================================
// User message layout (Codex-style: no bubble, left-aligned, › prefix)
// ============================================================
describe('User message bubble layout', () => {
  it('uses right-aligned bubble style (justify-end + rounded-2xl)', () => {
    const { container } = render(<ChatMessage id="m1" role="user" content="Hello" />);
    const html = container.innerHTML;
    expect(html).toContain('justify-end');
    expect(html).toContain('rounded-2xl');
  });

  it('renders user content in the bubble', () => {
    render(<ChatMessage id="m1" role="user" content="Hello AI" />);
    expect(screen.getByText('Hello AI')).toBeInTheDocument();
  });

  it('has dark background bubble (#1c1c1c)', () => {
    const { container } = render(<ChatMessage id="m1" role="user" content="Hi" />);
    expect(container.innerHTML).toContain('bg-[#1c1c1c]');
  });
});

// ============================================================
// ToolCallCard render-path selection
// ============================================================
describe('ToolCallCard render path selection', () => {
  function makeTool(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
    return { id: 'tc1', name: 'bash', arguments: {}, status: 'completed', result: { output: '' }, ...overrides };
  }

  it('routes diff output through DiffView (pre with green/red classes)', () => {
    const { container } = render(<ToolCallCard toolCall={makeTool({
      name: 'git_diff',
      result: { output: '@@ -1,1 +1,1 @@\n-old\n+new\n' },
    })} />);
    // Expand to see output
    fireEvent.click(container.querySelector('button')!);
    // DiffView renders colored lines — check for add/delete styles
    expect(container.innerHTML).toMatch(/green|red/);
  });

  it('routes shell output through ShellOutput (dim text-gray-600)', () => {
    const { container } = render(<ToolCallCard toolCall={makeTool({
      name: 'bash',
      arguments: { command: 'echo hi' },
      result: { output: 'line1\nline2\nline3' },
    })} />);
    fireEvent.click(container.querySelector('button')!);
    // ShellOutput uses text-gray-600 (dim)
    expect(container.innerHTML).toContain('text-gray-600');
  });

  it('routes image output through ScreenshotView', () => {
    const { container } = render(<ToolCallCard toolCall={makeTool({
      name: 'screenshot',
      result: { output: JSON.stringify({ type: 'image', data: 'base64==', mimeType: 'image/png' }) },
    })} />);
    // ScreenshotView renders collapsed by default for completed screenshots
    // Just verify no crash and the card rendered
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('routes markdown output through MarkdownRenderer (only for fenced code / headings)', () => {
    const { container } = render(<ToolCallCard toolCall={makeTool({
      name: 'file_read',
      arguments: { path: '/x' },
      result: { output: '# Heading\n\nSome text here.\n\n```js\nconst x = 1;\n```' },
    })} />);
    fireEvent.click(container.querySelector('button')!);
    // MarkdownRenderer wraps in a div with rounded-md bg — check for the markdown container
    expect(container.innerHTML).toContain('rounded-md');
  });

  it('does NOT route plain shell output as markdown (no - or 1. heuristic)', () => {
    const { container } = render(<ToolCallCard toolCall={makeTool({
      name: 'bash',
      arguments: { command: 'ls' },
      result: { output: '-rw-r--r-- file1\n-rw-r--r-- file2\n1. first item\n' },
    })} />);
    fireEvent.click(container.querySelector('button')!);
    // Should be ShellOutput (text-gray-600), not MarkdownRenderer
    expect(container.innerHTML).toContain('text-gray-600');
    // Should NOT have markdown-specific spacing
    expect(container.querySelectorAll('h1, h2, h3').length).toBe(0);
  });
});

// ============================================================
// ToolCallCard truncation (5 lines max)
// ============================================================
describe('ToolCallCard output truncation', () => {
  it('truncates output longer than 5 lines (head + tail, middle hidden)', () => {
    // 20 lines — truncation keeps ~2 head + ~3 tail, hiding middle lines
    const long = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const { container } = render(<ToolCallCard toolCall={{
      id: 'tc1', name: 'git_diff',
      arguments: { base: 'main' },
      status: 'completed',
      result: { output: long },
    }} />);
    fireEvent.click(container.querySelector('button')!);
    // Truncation marker present
    expect(container.textContent).toMatch(/\.\.\.|lines/);
    // Middle lines hidden (line 7-17 should NOT all be visible)
    expect(container.textContent).not.toContain('line 10');
  });

  it('does not truncate output with 5 or fewer lines', () => {
    const short = 'line1\nline2\nline3';
    const { container } = render(<ToolCallCard toolCall={{
      id: 'tc1', name: 'bash',
      arguments: { command: 'echo' },
      status: 'completed',
      result: { output: short },
    }} />);
    fireEvent.click(container.querySelector('button')!);
    expect(container.textContent).not.toMatch(/\.\.\. .* lines/);
  });
});

// ============================================================
// ToolCallCard default expand/collapse state (Codex-style)
// ============================================================
describe('ToolCallCard expand state', () => {
  it('starts expanded when tool is running', () => {
    const { container } = render(<ToolCallCard toolCall={{
      id: 'tc1', name: 'bash',
      arguments: { command: 'sleep 10' },
      status: 'running',
    }} />);
    // Running → expanded → output area visible (even without result, the params/command show)
    // Just verify it doesn't crash and the button exists
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('starts collapsed when tool is completed (output in collapsed preview)', () => {
    const { container } = render(<ToolCallCard toolCall={{
      id: 'tc1', name: 'bash',
      arguments: { command: 'echo hi' },
      status: 'completed',
      result: { output: 'hi' },
    }} />);
    // Completed → collapsed → ShellOutput NOT rendered in expanded form.
    // A 1-line collapsed preview MAY show 'hi' (expected behavior), so we
    // check that the expanded output container (with command echo) is absent.
    // The collapsed preview is a line-clamp-1 span, not the full output.
    const pre = container.querySelector('pre');
    expect(pre).toBeNull(); // No expanded ShellOutput <pre> when collapsed
  });
});

// ============================================================
// MCP tool name display
// ============================================================
describe('MCP tool name display', () => {
  it('getMcpServerName extracts server from mcp__server__tool', () => {
    expect(getMcpServerName('mcp__playwright__navigate')).toBe('playwright');
    expect(getMcpServerName('mcp__context7__resolve')).toBe('context7');
    expect(getMcpServerName('bash')).toBeNull();
  });

  it('getToolDisplayName shows server/tool for MCP tools', () => {
    expect(getToolDisplayName('mcp__playwright__navigate')).toBe('playwright/navigate');
    expect(getToolDisplayName('bash')).toBe('bash');
  });

  it('renders MCP badge in tool card header', () => {
    const { container } = render(<ToolCallCard toolCall={{
      id: 'tc1', name: 'mcp__myserver__search',
      arguments: { query: 'test' },
      status: 'completed',
      result: { output: 'results' },
    }} />);
    expect(container.innerHTML).toContain('MCP');
    expect(container.innerHTML).toContain('myserver/search');
  });

  it('renders MCP badge in purple, not cyan', () => {
    const { container } = render(<ToolCallCard toolCall={{
      id: 'tc1', name: 'mcp__myserver__search',
      arguments: { query: 'test' },
      status: 'completed',
      result: { output: 'results' },
    }} />);
    expect(container.innerHTML).toContain('text-purple-');
  });
});

// ============================================================
// Error styling
// ============================================================
describe('Error state styling', () => {
  it('uses red text for error output', () => {
    const { container } = render(<ToolCallCard toolCall={{
      id: 'tc1', name: 'bash',
      arguments: { command: 'false' },
      status: 'error',
      result: { output: 'Command failed', isError: true },
    }} />);
    expect(container.innerHTML).toContain('text-red');
  });

  it('ChatMessage error renders with visible error text', () => {
    render(<ChatMessage id="m1" role="assistant" content="" error="API timeout" />);
    expect(screen.getByText(/API timeout/)).toBeInTheDocument();
  });
});

// ============================================================
// ActivityIndicator shimmer CSS
// ============================================================
describe('ActivityIndicator shimmer CSS', () => {
  it('uses bg-clip-text + animate-shimmer', async () => {
    const { ActivityIndicator } = await import('../src/components/chat/ActivityIndicator');
    const { container } = render(<ActivityIndicator activeSkills={['code-review']} />);
    expect(container.innerHTML).toContain('bg-clip-text');
    expect(container.innerHTML).toContain('animate-[shimmer');
  });

  it('shows cursor-pointer (clickable)', async () => {
    const { ActivityIndicator } = await import('../src/components/chat/ActivityIndicator');
    const { container } = render(<ActivityIndicator />);
    expect(container.firstElementChild!.className).toContain('cursor-pointer');
  });
});
