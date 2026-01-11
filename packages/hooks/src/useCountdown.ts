/**
 * useCountdown
 * 倒计时 Hook（验证码场景常用）
 *
 * @example
 * const { count, counting, start, reset } = useCountdown(60);
 *
 * <button onClick={() => start()} disabled={counting}>
 *   {counting ? `${count}s 后重新获取` : '获取验证码'}
 * </button>
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseCountdownOptions {
  interval?: number;
  onEnd?: () => void;
}

export interface UseCountdownReturn {
  count: number;
  counting: boolean;
  start: (initialCount?: number) => void;
  reset: () => void;
  pause: () => void;
}

export function useCountdown(
  initialCount: number = 60,
  options: UseCountdownOptions = {},
): UseCountdownReturn {
  const { interval = 1000, onEnd } = options;

  const [count, setCount] = useState(initialCount);
  const [counting, setCounting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((startCount?: number) => {
    clear();
    const targetCount = startCount ?? initialCount;
    setCount(targetCount);
    setCounting(true);

    timerRef.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clear();
          setCounting(false);
          onEndRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, interval);
  }, [initialCount, interval, clear]);

  const reset = useCallback(() => {
    clear();
    setCount(initialCount);
    setCounting(false);
  }, [initialCount, clear]);

  const pause = useCallback(() => {
    clear();
    setCounting(false);
  }, [clear]);

  useEffect(() => {
    return clear;
  }, [clear]);

  return { count, counting, start, reset, pause };
}
