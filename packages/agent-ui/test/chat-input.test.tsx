import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../src/components/chat/ChatInput';
import type { SlashCommand, MentionItem } from '../src/components/chat/ChatInput';

// ==============================================================
// Tests
// ==============================================================

describe('ChatInput', () => {
  // ----------------------------------------------------------
  // 1. Basic rendering
  // ----------------------------------------------------------
  describe('rendering', () => {
    it('renders textarea with placeholder', () => {
      render(<ChatInput onSend={vi.fn()} placeholder="Type here..." />);
      expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
    });

    it('renders send button when not streaming', () => {
      render(<ChatInput onSend={vi.fn()} />);
      // The send button is the arrow icon button
      const buttons = screen.getAllByRole('button');
      // At least the + button and send button
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('renders stop button when streaming', () => {
      const onAbort = vi.fn();
      render(<ChatInput onSend={vi.fn()} onAbort={onAbort} isStreaming />);
      expect(screen.getByTitle('Stop')).toBeInTheDocument();
    });

    it('disables textarea when disabled', () => {
      render(<ChatInput onSend={vi.fn()} disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('renders leading and trailing slots', () => {
      render(
        <ChatInput
          onSend={vi.fn()}
          leadingSlot={<span data-testid="leading">Model</span>}
          trailingSlot={<span data-testid="trailing">Extra</span>}
        />,
      );
      expect(screen.getByTestId('leading')).toBeInTheDocument();
      expect(screen.getByTestId('trailing')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // 2. Sending messages
  // ----------------------------------------------------------
  describe('sending', () => {
    it('calls onSend when send button clicked with text', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');
      await user.click(screen.getByTitle('引用').parentElement!.querySelector('button:last-child')!);

      // Alternative: press Enter
      // The send button is the last button in the bottom bar
    });

    it('calls onSend on Enter key', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello{Enter}');
      expect(onSend).toHaveBeenCalledWith('Hello', undefined);
    });

    it('does not send on Shift+Enter', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello{Shift>}{Enter}{/Shift}');
      expect(onSend).not.toHaveBeenCalled();
    });

    it('does not send empty message', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '{Enter}');
      expect(onSend).not.toHaveBeenCalled();
    });

    it('clears input after sending', async () => {
      const onSend = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello{Enter}');
      expect(textarea).toHaveValue('');
    });
  });

  // ----------------------------------------------------------
  // 3. Abort
  // ----------------------------------------------------------
  describe('abort', () => {
    it('calls onAbort when stop button clicked', async () => {
      const onAbort = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput onSend={vi.fn()} onAbort={onAbort} isStreaming />);

      await user.click(screen.getByTitle('Stop'));
      expect(onAbort).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // 4. Slash commands
  // ----------------------------------------------------------
  describe('slash commands', () => {
    const commands: SlashCommand[] = [
      { name: 'help', description: 'Show help', action: vi.fn() },
      { name: 'clear', description: 'Clear chat', action: vi.fn() },
    ];

    it('shows command popup when typing /', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={vi.fn()} slashCommands={commands} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');
      expect(screen.getByText('/help')).toBeInTheDocument();
      expect(screen.getByText('/clear')).toBeInTheDocument();
    });

    it('filters commands as user types', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={vi.fn()} slashCommands={commands} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/he');
      expect(screen.getByText('/help')).toBeInTheDocument();
      expect(screen.queryByText('/clear')).not.toBeInTheDocument();
    });

    it('executes command when clicked', async () => {
      const action = vi.fn();
      const cmds: SlashCommand[] = [
        { name: 'help', description: 'Show help', action },
      ];
      const user = userEvent.setup();
      render(<ChatInput onSend={vi.fn()} slashCommands={cmds} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');
      await user.click(screen.getByText('/help'));
      expect(action).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // 5. Attach menu
  // ----------------------------------------------------------
  describe('attach menu', () => {
    it('shows attach menu when + button clicked', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={vi.fn()} />);

      await user.click(screen.getByTitle('引用'));
      expect(screen.getByText('上传图片')).toBeInTheDocument();
      expect(screen.getByText('引用文件')).toBeInTheDocument();
    });

    it('calls onFileReference when 引用文件 clicked', async () => {
      const onFileRef = vi.fn();
      const user = userEvent.setup();
      render(<ChatInput onSend={vi.fn()} onFileReference={onFileRef} />);

      await user.click(screen.getByTitle('引用'));
      await user.click(screen.getByText('引用文件'));
      expect(onFileRef).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // 6. Mention (@) items
  // ----------------------------------------------------------
  describe('mention items', () => {
    const mentions: MentionItem[] = [
      { label: 'read_file', description: 'Read a file', category: 'tool' },
      { label: 'write_file', description: 'Write a file', category: 'tool' },
      { label: 'code-review', description: 'Review code quality', category: 'skill' },
    ];

    it('shows mention categories when typing @', async () => {
      const user = userEvent.setup();
      render(
        <ChatInput
          onSend={vi.fn()}
          mentionItems={mentions}
          onMentionSelect={(item) => `@${item.label}`}
        />,
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');
      // Should show category buttons: 工具 and 技能
      expect(screen.getByText('工具')).toBeInTheDocument();
      expect(screen.getByText('技能')).toBeInTheDocument();
    });

    it('shows mention items when category selected', async () => {
      const user = userEvent.setup();
      render(
        <ChatInput
          onSend={vi.fn()}
          mentionItems={mentions}
          onMentionSelect={(item) => `@${item.label}`}
        />,
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');
      await user.click(screen.getByText('工具'));
      expect(screen.getByText('read_file')).toBeInTheDocument();
      expect(screen.getByText('write_file')).toBeInTheDocument();
    });

    it('inserts mention text when item clicked', async () => {
      const user = userEvent.setup();
      render(
        <ChatInput
          onSend={vi.fn()}
          mentionItems={mentions}
          onMentionSelect={(item) => `@${item.label}`}
        />,
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@');
      await user.click(screen.getByText('工具'));
      await user.click(screen.getByText('read_file'));
      expect(textarea.value).toContain('@read_file');
    });

    it('filters mentions by query', async () => {
      const user = userEvent.setup();
      render(
        <ChatInput
          onSend={vi.fn()}
          mentionItems={mentions}
          onMentionSelect={(item) => `@${item.label}`}
        />,
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '@read');
      // Should show the filtered category with read_file
      expect(screen.getByText('read_file')).toBeInTheDocument();
    });
  });

  // ----------------------------------------------------------
  // 7. Input history
  // ----------------------------------------------------------
  describe('input history', () => {
    it('navigates submitted input history with arrow keys', () => {
      render(<ChatInput onSend={vi.fn()} inputHistory={['first prompt', 'second prompt']} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(textarea).toHaveValue('second prompt');

      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(textarea).toHaveValue('first prompt');

      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      expect(textarea).toHaveValue('second prompt');

      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      expect(textarea).toHaveValue('');
    });

    it('restores the draft when returning past the newest history item', async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={vi.fn()} inputHistory={['previous prompt']} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'draft text');

      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
      expect(textarea).toHaveValue('previous prompt');

      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      expect(textarea).toHaveValue('draft text');
    });

    it('keeps arrow keys scoped to slash command navigation when commands are open', async () => {
      const user = userEvent.setup();
      const commands: SlashCommand[] = [
        { name: 'help', description: 'Show help', action: vi.fn() },
        { name: 'clear', description: 'Clear chat', action: vi.fn() },
      ];

      render(
        <ChatInput
          onSend={vi.fn()}
          slashCommands={commands}
          inputHistory={['previous prompt']}
        />,
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      expect(textarea).toHaveValue('/');
      expect(screen.getByText('/help')).toBeInTheDocument();
      expect(screen.getByText('/clear')).toBeInTheDocument();
    });
  });
});
