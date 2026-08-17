import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePinnedTranscriptScroll } from '../src/components/chat/use-pinned-transcript-scroll';

describe('usePinnedTranscriptScroll', () => {
  let resize: ResizeObserverCallback | null = null;

  afterEach(() => vi.unstubAllGlobals());

  it('re-pins layout reflow only while the user is following the bottom', () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      disconnect() { resize = null; }
      unobserve() {}
    });
    const view = render(<Fixture scrolledUp={false} />);
    const transcript = view.getByRole('log');
    Object.defineProperty(transcript, 'scrollHeight', { configurable: true, value: 640 });
    act(() => resize?.([], {} as ResizeObserver));
    expect(transcript.scrollTop).toBe(640);

    view.rerender(<Fixture scrolledUp />);
    transcript.scrollTop = 120;
    Object.defineProperty(transcript, 'scrollHeight', { configurable: true, value: 900 });
    act(() => resize?.([], {} as ResizeObserver));
    expect(transcript.scrollTop).toBe(120);

    view.rerender(<Fixture scrolledUp={false} enabled={false} />);
    transcript.scrollTop = 80;
    act(() => resize?.([], {} as ResizeObserver));
    expect(transcript.scrollTop).toBe(80);
  });
});

function Fixture({ scrolledUp, enabled = true }: { scrolledUp: boolean; enabled?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(scrolledUp);
  userScrolledUp.current = scrolledUp;
  usePinnedTranscriptScroll(scrollRef, userScrolledUp, enabled);
  return <div ref={scrollRef} role="log" />;
}
