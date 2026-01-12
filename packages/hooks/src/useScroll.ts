/**
 * useScroll
 * 滚动位置监听
 *
 * @example
 * // 监听 window 滚动
 * const { x, y } = useScroll();
 *
 * // 监听指定元素滚动
 * const ref = useRef<HTMLDivElement>(null);
 * const { x, y } = useScroll(ref);
 *
 * // 显示返回顶部按钮
 * {y > 300 && <BackToTop />}
 */

import { useState, useEffect, RefObject } from 'react';

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface UseScrollOptions {
  throttle?: number;
}

export function useScroll(
  target?: RefObject<Element | null> | null,
  options: UseScrollOptions = {},
): ScrollPosition {
  const { throttle = 0 } = options;

  const [position, setPosition] = useState<ScrollPosition>({ x: 0, y: 0 });

  useEffect(() => {
    const element = target?.current;
    const isWindow = !target;

    const getScrollPosition = (): ScrollPosition => {
      if (isWindow) {
        return {
          x: window.scrollX ?? window.pageXOffset,
          y: window.scrollY ?? window.pageYOffset,
        };
      }
      if (element) {
        return {
          x: element.scrollLeft,
          y: element.scrollTop,
        };
      }
      return { x: 0, y: 0 };
    };

    // 初始化位置
    setPosition(getScrollPosition());

    let lastTime = 0;
    let rafId: number | null = null;

    const handleScroll = () => {
      if (throttle > 0) {
        const now = Date.now();
        if (now - lastTime < throttle) {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            lastTime = Date.now();
            setPosition(getScrollPosition());
          });
          return;
        }
        lastTime = now;
      }
      setPosition(getScrollPosition());
    };

    const targetElement = isWindow ? window : element;
    if (!targetElement) return;

    targetElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      targetElement.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [target, throttle]);

  return position;
}
