/**
 * useLocalStorage
 * localStorage 持久化状态
 *
 * @example
 * const [token, setToken, removeToken] = useLocalStorage<string>('auth_token');
 *
 * setToken('xxx');
 * removeToken();
 */

import { useState, useCallback, useEffect } from 'react';

export interface UseStorageOptions<T> {
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
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return deserializer ? deserializer(item) : JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

export function useLocalStorage<T>(
  key: string,
  options: UseStorageOptions<T> = {},
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
          localStorage.setItem(key, serializer(nextValue));
        } catch (e) {
          console.warn(`useLocalStorage: Failed to set "${key}"`, e);
        }

        return nextValue;
      });
    },
    [key, serializer],
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setState(defaultValue);
    } catch (e) {
      console.warn(`useLocalStorage: Failed to remove "${key}"`, e);
    }
  }, [key, defaultValue]);

  // 监听其他标签页的 storage 变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.storageArea === localStorage) {
        setState(e.newValue ? deserializer(e.newValue) : defaultValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue, deserializer]);

  return [state, setValue, removeValue];
}
