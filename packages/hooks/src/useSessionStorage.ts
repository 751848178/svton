/**
 * useSessionStorage
 * sessionStorage 持久化状态
 *
 * @example
 * const [data, setData, removeData] = useSessionStorage<object>('form_data');
 */

import { useState, useCallback } from 'react';

export interface UseSessionStorageOptions<T> {
  defaultValue?: T;
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
}

function getStorageValue<T>(
  key: string,
  defaultValue?: T,
  deserializer?: (value: string) => T,
): T | undefined {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const item = sessionStorage.getItem(key);
    if (item === null) return defaultValue;
    return deserializer ? deserializer(item) : JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

export function useSessionStorage<T>(
  key: string,
  options: UseSessionStorageOptions<T> = {},
): [T | undefined, (value: T | ((prev: T | undefined) => T)) => void, () => void] {
  const {
    defaultValue,
    serializer = JSON.stringify,
    deserializer = JSON.parse,
  } = options;

  const [state, setState] = useState<T | undefined>(() =>
    getStorageValue(key, defaultValue, deserializer),
  );

  const setValue = useCallback(
    (value: T | ((prev: T | undefined) => T)) => {
      setState((prev) => {
        const nextValue = typeof value === 'function'
          ? (value as (prev: T | undefined) => T)(prev)
          : value;

        try {
          sessionStorage.setItem(key, serializer(nextValue));
        } catch (e) {
          console.warn(`useSessionStorage: Failed to set "${key}"`, e);
        }

        return nextValue;
      });
    },
    [key, serializer],
  );

  const removeValue = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
      setState(defaultValue);
    } catch (e) {
      console.warn(`useSessionStorage: Failed to remove "${key}"`, e);
    }
  }, [key, defaultValue]);

  return [state, setValue, removeValue];
}
