/**
 * useDebounce
 * 防抖 Hook
 *
 * @example
 * const debouncedValue = useDebounce(searchValue, 500);
 *
 * useEffect(() => {
 *   fetchData(debouncedValue);
 * }, [debouncedValue]);
 */

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
