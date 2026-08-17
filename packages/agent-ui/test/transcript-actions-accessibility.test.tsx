import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatMessage } from '../src/components/chat/ChatMessage';
import { CodeBlock } from '../src/components/chat/CodeBlock';
import { ImageResultBlock } from '../src/components/chat/ImageResultBlock';
import { ThinkingDisclosure } from '../src/components/chat/ThinkingDisclosure';

afterEach(() => vi.restoreAllMocks());

describe('transcript keyboard actions', () => {
  it('reveals and activates a non-last message action from keyboard focus', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<ChatMessage id="assistant-1" role="assistant" content="Keyboard message" />);

    const action = screen.getByRole('button', { name: /copy|复制/i });
    const actions = action.closest('[data-message-actions]');
    expect(actions).toHaveClass('group-focus-within:opacity-100');
    expect(action).toHaveClass('min-h-11', 'min-w-11');
    await user.tab();
    expect(action).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(writeText).toHaveBeenCalledWith('Keyboard message');
  });

  it('reveals and activates the hover-hidden code copy action from the keyboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<CodeBlock code="const accessible = true" />);

    const action = screen.getByRole('button', { name: /copy|复制/i });
    expect(action).toHaveClass(
      'group-focus-within/code:opacity-100',
      'focus-visible:opacity-100',
      'min-h-11',
      'min-w-11',
    );
    await user.tab();
    expect(action).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(writeText).toHaveBeenCalledWith('const accessible = true');
  });

  it('reveals image actions through focus and activates prompt and download', async () => {
    const user = userEvent.setup();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { container } = render(<ImageResultBlock
      images={[{ base64: 'data:image/png;base64,AA==', revisedPrompt: 'Safe prompt' }]}
      model="fixture-model"
    />);

    const prompt = screen.getByRole('button', { name: /show revised prompt|显示修订提示词/i });
    const download = screen.getByRole('button', { name: /download image|下载图像/i });
    const overlay = prompt.parentElement;
    expect(overlay).toHaveClass('pointer-events-none', 'group-focus-within/image:opacity-100');
    expect(prompt).not.toHaveClass('pointer-events-auto');
    expect(download).not.toHaveClass('pointer-events-auto');
    expect(prompt).toHaveClass('h-11', 'w-11');
    expect(download).toHaveClass('h-11', 'w-11');
    expect(container.querySelector('.lucide-eye')).toBeInTheDocument();
    expect(container.querySelector('.lucide-download')).toBeInTheDocument();

    await user.tab();
    expect(prompt).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByText('Safe prompt')).toBeVisible();
    expect(container.querySelector('.lucide-eye-off')).toBeInTheDocument();
    await user.tab();
    expect(download).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(anchorClick).toHaveBeenCalledOnce();
  });

  it('activates a disclosure and exposes its controlled content by keyboard', async () => {
    const user = userEvent.setup();
    render(<ThinkingDisclosure text="Reasoned detail" />);
    const disclosure = screen.getByRole('button');
    expect(disclosure).toHaveClass('min-h-11');
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user.tab();
    expect(disclosure).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Reasoned detail')).toBeVisible();
  });
});
