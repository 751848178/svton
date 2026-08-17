import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from '../src/components/chat/ChatInput';
import type { ComposerInteraction, ComposerIntent, ComposerIntentResult, MentionItem, SlashCommand } from '../src/components/chat/composer.types';

function interaction(handler: (intent: ComposerIntent) => Promise<ComposerIntentResult>): ComposerInteraction {
  let sequence = 0;
  return {
    dispatch: handler,
    createOperationId: () => `op-${++sequence}`,
    result: null,
    pending: false,
    resolveAssistantAction: () => ({ supported: false, reason: 'unsupported' }),
  };
}

const command: SlashCommand = { id: 'help', name: 'help', description: 'Help', execute: async () => true };

describe('typed composer UI', () => {
  it('dispatches exactly the same slash intent once by click and keyboard', async () => {
    const dispatch = vi.fn(async (intent: ComposerIntent) => ({ id: intent.id, kind: 'succeeded' as const }));
    const first = render(<ChatInput interaction={interaction(dispatch)} slashCommands={[command]} />);
    await userEvent.type(screen.getByRole('combobox'), '/');
    await userEvent.click(screen.getByText('/help'));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toEqual(expect.objectContaining({ kind: 'slash.execute', commandId: 'help', args: '' }));
    first.unmount();

    dispatch.mockClear();
    render(<ChatInput interaction={interaction(dispatch)} slashCommands={[command]} />);
    await userEvent.type(screen.getByRole('combobox'), '/{Enter}');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toEqual(expect.objectContaining({ kind: 'slash.execute', commandId: 'help', args: '' }));
  });

  it('keeps the legacy slash action API and uses the command name as its intent identity', async () => {
    const action = vi.fn();
    const legacy: SlashCommand = { name: 'legacy', description: 'Legacy command', action };
    const first = render(<ChatInput onSend={vi.fn()} slashCommands={[legacy]} />);
    await userEvent.type(screen.getByRole('combobox'), '/legacy{Enter}');
    expect(action).toHaveBeenCalledTimes(1);
    first.unmount();

    const dispatch = vi.fn(async (intent: ComposerIntent) => ({ id: intent.id, kind: 'succeeded' as const }));
    render(<ChatInput interaction={interaction(dispatch)} slashCommands={[legacy]} />);
    await userEvent.type(screen.getByRole('combobox'), '/{Enter}');
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ kind: 'slash.execute', commandId: 'legacy' }));
  });

  it('keeps the draft when a direct execute command is not accepted', async () => {
    const rejected: SlashCommand = {
      id: 'review', name: 'review', description: 'Review', execute: async () => false,
    };
    render(<ChatInput onSend={vi.fn()} slashCommands={[rejected]} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, '/review pending{Enter}');
    expect(input).toHaveValue('/review pending');
    expect(screen.getByRole('alert')).toHaveTextContent('草稿已保留');
  });

  it('links slash and mention listboxes without mutating the draft on Escape', async () => {
    const mention: MentionItem = { id: 'skill:a', label: 'alpha', name: 'alpha', path: '/skills/alpha', category: 'skill' };
    render(<ChatInput onSend={vi.fn()} slashCommands={[command]} mentionItems={[mention]} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, '/');
    const commandList = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', commandList.id);
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('/help');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('/');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await userEvent.clear(input);
    await userEvent.type(input, '@');
    const mentionList = screen.getByRole('listbox', { name: 'Reference' });
    expect(input).toHaveAttribute('aria-controls', mentionList.id);
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('alpha');
  });

  it('keeps mention keyboard order aligned with the rendered category order', async () => {
    const mentions: MentionItem[] = [
      { id: 'skill:a', label: 'skill-a', name: 'skill-a', path: '/skills/a', category: 'skill' },
      { id: 'file:a', label: 'file-a', name: 'file-a', path: '/src/a.ts', category: 'file' },
    ];
    render(<ChatInput onSend={vi.fn()} mentionItems={mentions} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, '@');
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('file-a');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('skill-a');
  });

  it('keeps a busy draft and announces a retryable explanation', async () => {
    const dispatch = vi.fn(async (intent: ComposerIntent) => ({
      id: intent.id, kind: 'busy' as const, retryable: true as const, message: '草稿已保留，请停止后重试。',
    }));
    render(<ChatInput interaction={interaction(dispatch)} isStreaming />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'keep me{Enter}');
    expect(input).toHaveValue('keep me');
    expect(screen.getByRole('alert')).toHaveTextContent('草稿已保留');
  });

  it('adds a selected file without sending, then removes it by accessible name', async () => {
    const dispatch = vi.fn(async (intent: ComposerIntent): Promise<ComposerIntentResult> => intent.kind === 'draft.file.pick'
      ? { id: intent.id, kind: 'succeeded', attachment: { id: 'file:/a.txt', kind: 'file', name: 'a.txt', path: '/a.txt', size: 10 } }
      : { id: intent.id, kind: 'succeeded' });
    render(<ChatInput interaction={interaction(dispatch)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Reference file' }));
    expect(dispatch.mock.calls.filter(([intent]) => intent.kind === 'turn.send')).toHaveLength(0);
    expect(screen.getByText('/a.txt')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove attachment a.txt' }));
    expect(screen.queryByText('/a.txt')).not.toBeInTheDocument();
  });

  it('navigates the attachment menu by keyboard and restores trigger focus', async () => {
    render(<ChatInput onSend={vi.fn()} onFileReference={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Add attachment' });
    await userEvent.click(trigger);
    const upload = screen.getByRole('menuitem', { name: 'Upload image' });
    expect(upload).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Reference file' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await vi.waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('preserves duplicate display names with distinct full paths', async () => {
    const mentions: MentionItem[] = [
      { id: 'a', label: 'same.ts', name: 'same.ts', path: '/a/same.ts', category: 'file' },
      { id: 'b', label: 'same.ts', name: 'same.ts', path: '/b/same.ts', category: 'file' },
    ];
    render(<ChatInput onSend={vi.fn()} mentionItems={mentions} />);
    await userEvent.type(screen.getByRole('combobox'), '@');
    const options = screen.getAllByRole('option', { name: /same.ts/ });
    await userEvent.click(options[0]);
    await userEvent.type(screen.getByRole('combobox'), '@');
    await userEvent.click(screen.getAllByRole('option', { name: /same.ts/ })[1]);
    const draft = screen.getByLabelText('Draft attachments');
    expect(within(draft).getByText('/a/same.ts')).toBeInTheDocument();
    expect(within(draft).getByText('/b/same.ts')).toBeInTheDocument();
  });

  it('keeps a legacy mention display-only in the reference group', async () => {
    const legacy: MentionItem = { label: 'legacy-tool', category: 'tool', description: 'Legacy item' };
    render(<ChatInput onSend={vi.fn()} mentionItems={[legacy]} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, '@');
    expect(screen.getByRole('group', { name: 'Reference' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /legacy-tool/ }));
    expect(input).toHaveValue('@legacy-tool ');
    expect(screen.queryByLabelText('Draft attachments')).not.toBeInTheDocument();
  });

  it('announces oversize image and disabled drop failures without adding it', async () => {
    const rendered = render(<ChatInput onSend={vi.fn()} />);
    const container = screen.getByTestId('chat-input').closest('.relative')!;
    const oversize = { name: 'large.png', type: 'image/png', size: 11 * 1024 * 1024 } as File;
    fireEvent.drop(container, { dataTransfer: { files: [oversize] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('exceeds 10 MiB');
    rendered.rerender(<ChatInput onSend={vi.fn()} disabled />);
    fireEvent.drop(screen.getByTestId('chat-input').closest('.relative')!, { dataTransfer: { files: [oversize] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Input is unavailable');
  });

  it('announces an image reader failure and keeps the draft intact', async () => {
    const OriginalReader = globalThis.FileReader;
    class FailingReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      onabort: null | (() => void) = null;
      readAsDataURL() { this.onerror?.(); }
    }
    vi.stubGlobal('FileReader', FailingReader);
    try {
      render(<ChatInput onSend={vi.fn()} />);
      const input = screen.getByRole('combobox');
      await userEvent.type(input, 'draft');
      const image = { name: 'bad.png', type: 'image/png', size: 100 } as File;
      fireEvent.drop(input.closest('.relative')!, { dataTransfer: { files: [image] } });
      expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
      expect(input).toHaveValue('draft');
    } finally {
      vi.stubGlobal('FileReader', OriginalReader);
    }
  });
});
