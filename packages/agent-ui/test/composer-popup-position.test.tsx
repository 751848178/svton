import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from '../src/components/chat/ChatInput';

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left, y: top, left, top, width, height,
    right: left + width, bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

class VisualViewportFixture extends EventTarget {
  width = 320;
  height = 600;
  offsetLeft = 0;
  offsetTop = 0;
  pageLeft = 0;
  pageTop = 0;
  scale = 1;
  onresize = null;
  onscroll = null;
}

describe('composer popup geometry', () => {
  let resize: ResizeObserverCallback | null;
  let viewport: VisualViewportFixture;
  let currentRect: DOMRect;

  beforeEach(() => {
    resize = null;
    viewport = new VisualViewportFixture();
    currentRect = rect(290, 400, 100, 80);
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('keeps one stable textarea name across placeholder, value, and disabled state', async () => {
    const rendered = render(<ChatInput onSend={vi.fn()} placeholder="First placeholder" />);
    const input = screen.getByRole('combobox', { name: 'Message input' });
    await userEvent.type(input, 'draft');
    rendered.rerender(<ChatInput onSend={vi.fn()} placeholder="Changed placeholder" disabled />);
    expect(screen.getByRole('combobox', { name: 'Message input' })).toBe(input);
    expect(input).toHaveValue('draft');
    expect(input).toBeDisabled();
  });

  it('repositions on observer, capture scroll, window, and visual viewport events', async () => {
    render(<ChatInput
      onSend={vi.fn()}
      slashCommands={[{ name: 'help', description: 'Help', action: vi.fn() }]}
    />);
    const surface = screen.getByTestId('composer-surface');
    vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(() => currentRect);
    fireEvent.change(screen.getByRole('combobox', { name: 'Message input' }), { target: { value: '/' } });
    const popup = await screen.findByRole('listbox');
    await waitFor(() => expect(popup.style.left).toBe('212px'));
    expect(Number.parseFloat(popup.style.left) + Number.parseFloat(popup.style.width)).toBeLessThanOrEqual(312);
    expect(popup).toHaveAttribute('data-popup-placement', 'above');

    currentRect = rect(20, 300, 200, 80);
    resize?.([], {} as ResizeObserver);
    await waitFor(() => expect(popup.style.left).toBe('20px'));

    currentRect = rect(30, 280, 200, 80);
    surface.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(popup.style.left).toBe('30px'));

    currentRect = rect(40, 260, 200, 80);
    window.dispatchEvent(new Event('resize'));
    await waitFor(() => expect(popup.style.left).toBe('40px'));

    currentRect = rect(50, 240, 200, 80);
    viewport.dispatchEvent(new Event('resize'));
    await waitFor(() => expect(popup.style.left).toBe('50px'));

    currentRect = rect(60, 220, 200, 80);
    viewport.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(popup.style.left).toBe('60px'));
  });

  it('chooses contained below placement near the visual viewport top', async () => {
    currentRect = rect(-30, 10, 400, 44);
    render(<ChatInput
      onSend={vi.fn()}
      mentionItems={[{ label: 'alpha', description: 'Alpha' }]}
    />);
    const surface = screen.getByTestId('composer-surface');
    vi.spyOn(surface, 'getBoundingClientRect').mockImplementation(() => currentRect);
    fireEvent.change(screen.getByRole('combobox', { name: 'Message input' }), { target: { value: '@' } });
    const popup = await screen.findByRole('listbox', { name: 'Reference' });
    await waitFor(() => expect(popup).toHaveAttribute('data-popup-placement', 'below'));
    expect(popup.style.left).toBe('8px');
    expect(popup.style.width).toBe('304px');
    expect(Number.parseFloat(popup.style.top) + Number.parseFloat(popup.style.maxHeight)).toBeLessThanOrEqual(592);
  });

  it('restores textarea focus after slash and mention pointer selection', async () => {
    const rendered = render(<ChatInput
      onSend={vi.fn()}
      slashCommands={[{ name: 'help', description: 'Help', action: vi.fn() }]}
    />);
    let input = screen.getByRole('combobox', { name: 'Message input' });
    await userEvent.type(input, '/');
    await userEvent.click(screen.getByRole('option', { name: /help/ }));
    await waitFor(() => expect(input).toHaveFocus());

    rendered.unmount();
    render(<ChatInput
      onSend={vi.fn()}
      mentionItems={[{ label: 'alpha', description: 'Alpha' }]}
    />);
    input = screen.getByRole('combobox', { name: 'Message input' });
    await userEvent.type(input, '@');
    await userEvent.click(screen.getByRole('option', { name: /alpha/ }));
    await waitFor(() => expect(input).toHaveFocus());
  });
});
