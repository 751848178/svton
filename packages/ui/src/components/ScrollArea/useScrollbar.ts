import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScrollbarMetrics {
  hasVertical: boolean;
  hasHorizontal: boolean;
  /** thumb 尺寸占比（0-100）与位移占比（0-100） */
  vSize: number;
  vOffset: number;
  hSize: number;
  hOffset: number;
}

const EMPTY: ScrollbarMetrics = {
  hasVertical: false,
  hasHorizontal: false,
  vSize: 100,
  vOffset: 0,
  hSize: 100,
  hOffset: 0,
};

function ratio(content: number, viewport: number): number {
  if (content <= 0 || viewport <= 0 || content <= viewport) return 100;
  return Math.max(10, (viewport / content) * 100);
}

function offset(scroll: number, content: number, viewport: number): number {
  const maxScroll = content - viewport;
  if (maxScroll <= 0) return 0;
  return Math.min(100, Math.max(0, (scroll / maxScroll) * 100));
}

/** 视口滚动度量：thumb 大小/位移随内容与滚动位置变化；ResizeObserver 跟随视口与内容尺寸。 */
export function useScrollbarMetrics(): {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  metrics: ScrollbarMetrics;
  measure: () => void;
} {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<ScrollbarMetrics>(EMPTY);

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const next: ScrollbarMetrics = {
      hasVertical: el.scrollHeight > el.clientHeight + 1,
      hasHorizontal: el.scrollWidth > el.clientWidth + 1,
      vSize: ratio(el.scrollHeight, el.clientHeight),
      vOffset: offset(el.scrollTop, el.scrollHeight, el.clientHeight),
      hSize: ratio(el.scrollWidth, el.clientWidth),
      hOffset: offset(el.scrollLeft, el.scrollWidth, el.clientWidth),
    };
    setMetrics((prev) =>
      prev.hasVertical === next.hasVertical &&
      prev.hasHorizontal === next.hasHorizontal &&
      prev.vSize === next.vSize &&
      prev.vOffset === next.vOffset &&
      prev.hSize === next.hSize &&
      prev.hOffset === next.hOffset
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    measure();
  }, [measure]);

  return { viewportRef, metrics, measure };
}

/** thumb 拖拽：pointer 捕获期间按「位移 × 内容/视口比」换算滚动位置。 */
export function useThumbDrag(params: {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  axis: 'y' | 'x';
}): (e: React.PointerEvent<HTMLDivElement>) => void {
  const { viewportRef, axis } = params;

  return useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = viewportRef.current;
      if (!el) return;
      e.preventDefault();
      const startPos = axis === 'y' ? e.clientY : e.clientX;
      const startScroll = axis === 'y' ? el.scrollTop : el.scrollLeft;

      const onMove = (ev: PointerEvent) => {
        const delta = (axis === 'y' ? ev.clientY : ev.clientX) - startPos;
        const viewportSpan = axis === 'y' ? el.clientHeight : el.clientWidth;
        const contentSpan = axis === 'y' ? el.scrollHeight : el.scrollWidth;
        if (contentSpan <= viewportSpan || viewportSpan <= 0) return;
        const next = startScroll + delta * (contentSpan / viewportSpan);
        if (axis === 'y') el.scrollTop = next;
        else el.scrollLeft = next;
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [axis, viewportRef],
  );
}
