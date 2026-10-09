import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tooltip } from '../src/components/Tooltip';
import { Modal } from '../src/components/Modal';
import { Popover } from '../src/components/Popover';

const initialViewport = { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY };
const rect = (left: number, top: number, width: number, height: number) => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {},
}) as DOMRect;
let triggerRect: DOMRect;
let floatingRect: DOMRect;

beforeEach(() => {
  triggerRect = rect(542.9, 439.8, 144.5, 24.6);
  floatingRect = rect(0, 0, 280, 26.5);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440, writable: true });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000, writable: true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.matches('[role="tooltip"],[data-test-popover]')) return floatingRect;
    if (this.classList.contains('inline-block') && this.querySelector('#position-trigger')) return triggerRect;
    return rect(0, 0, 0, 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: initialViewport.width, writable: true });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: initialViewport.height, writable: true });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: initialViewport.scrollY, writable: true });
});

function hint() {
  return <Tooltip content="Exact immutable image reference" placement="bottom"><button id="position-trigger">Image digest</button></Tooltip>;
}

describe('Tooltip geometry and portal lifecycle', () => {
  it('positions the first animated opening after the portal element actually mounts', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    render(hint());
    fireEvent.focus(screen.getByRole('button', { name: 'Image digest' }));
    const bubble = await screen.findByRole('tooltip');
    await waitFor(() => {
      expect(parseFloat(bubble.style.top)).toBeCloseTo(472.4);
      expect(parseFloat(bubble.style.left)).toBeCloseTo(475.15);
    });
    expect(bubble).toHaveClass('fixed');
    expect(bubble).toHaveClass('whitespace-normal', 'break-words');
    expect(bubble).not.toHaveClass('whitespace-nowrap');
    expect(screen.getByRole('button')).toHaveAttribute('aria-describedby', bubble.id);
  });

  it('follows captured container scrolling and window resizing, flipping and clamping at viewport edges', async () => {
    render(<div data-testid="scroller">{hint()}</div>);
    fireEvent.focus(screen.getByRole('button'));
    const bubble = await screen.findByRole('tooltip');
    triggerRect = rect(542.9, 339.8, 144.5, 24.6);
    fireEvent.scroll(screen.getByTestId('scroller'));
    await waitFor(() => expect(parseFloat(bubble.style.top)).toBeCloseTo(372.4));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500, writable: true });
    fireEvent.scroll(window);
    expect(parseFloat(bubble.style.top)).toBeCloseTo(372.4); // fixed space never adds document scroll.
    window.innerWidth = 320; window.innerHeight = 640;
    triggerRect = rect(292, 610, 20, 24.6);
    fireEvent.resize(window);
    await waitFor(() => {
      expect(parseFloat(bubble.style.left)).toBe(32);
      expect(parseFloat(bubble.style.top)).toBeCloseTo(575.5);
    });
    expect(parseFloat(bubble.style.left) + floatingRect.width).toBeLessThanOrEqual(window.innerWidth - 8);
    expect(parseFloat(bubble.style.top) + floatingRect.height).toBeLessThanOrEqual(window.innerHeight - 8);
  });

  it('remeasures content size changes and disconnects its resize observer on unmount', async () => {
    const callbacks: ResizeObserverCallback[] = [];
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
      observe() {}
      disconnect = disconnect;
    });
    const view = render(hint());
    fireEvent.focus(screen.getByRole('button'));
    const bubble = await screen.findByRole('tooltip');
    floatingRect = rect(0, 0, 320, 50);
    act(() => callbacks.at(-1)!([], {} as ResizeObserver));
    await waitFor(() => expect(parseFloat(bubble.style.left)).toBeCloseTo(455.15));
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('keeps a tooltip in its owning Modal layer, outside inert isolation without weakening background isolation', async () => {
    render(<Modal open title="Rollback" closeOnEscape={false} onClose={() => undefined}>{hint()}</Modal>);
    const button = await screen.findByRole('button', { name: 'Image digest' });
    fireEvent.focus(button);
    const bubble = await screen.findByRole('tooltip');
    await waitFor(() => expect(parseFloat(bubble.style.top)).toBeCloseTo(472.4));
    expect(bubble.closest('[data-svton-modal-layer]')).toBe(button.closest('[data-svton-modal-layer]'));
    expect(bubble.closest('[inert]')).toBeNull();
    const background = document.createElement('aside');
    background.dataset.testExternal = 'tooltip-background';
    document.body.append(background);
    await waitFor(() => expect(background).toHaveAttribute('inert'));
    expect(bubble).not.toHaveAttribute('inert');
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rollback' })).toBeInTheDocument();
  });

  it('preserves Popover absolute coordinates and outside-click behavior with the shared mount callback', async () => {
    triggerRect = rect(200, 100, 100, 20);
    floatingRect = rect(0, 0, 180, 60);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 160, writable: true });
    render(<Popover placement="bottom" content="Content" className="popover-probe"><button id="position-trigger">Popover</button></Popover>);
    fireEvent.click(screen.getByRole('button'));
    const bubble = await screen.findByRole('dialog');
    bubble.setAttribute('data-test-popover', '');
    fireEvent.resize(window);
    await waitFor(() => {
      expect(parseFloat(bubble.style.top)).toBe(288);
      expect(parseFloat(bubble.style.left)).toBe(160);
    });
    expect(bubble).toHaveClass('absolute');
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
