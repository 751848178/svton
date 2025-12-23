import { useState, useCallback } from 'react';

/**
 * 计算滚动透明度的 Hook
 * @param threshold 达到完全透明的滚动距离（像素），默认 200
 * @returns [scrollOpacity, handleScroll]
 */
export function useScrollOpacity(threshold: number = 200) {
  const [scrollOpacity, setScrollOpacity] = useState(1);

  const handleScroll = useCallback((scrollTop: number) => {
    // 计算透明度：1 (初始不透明) -> 0 (滚动后透明)
    const opacity = Math.max(1 - scrollTop / threshold, 0);
    setScrollOpacity(opacity);
  }, [threshold]);

  return [scrollOpacity, handleScroll] as const;
}
